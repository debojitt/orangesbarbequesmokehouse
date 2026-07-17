import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { haptic } from "@/lib/haptics";
import {
  GRAVITY_SCALE,
  GRAVITY_Y,
  HAMMER_MAX_SPEED,
  MAX_RANGE,
  POT_DENSITY,
  POT_RADIUS,
  clampAimOffset,
  clampBodyVelocity,
  hammerClosingSpeed,
  hammerFollowLerp,
  idleHammerOffset,
  lipClimbForce,
  outwardNormalFromCollision,
  pogoBounceForce,
  swingReactionForce,
} from "@/components/game/potOfGloryPhysics";
import {
  buildGloryPile,
  polygonGap,
  type RockMeta,
} from "@/components/game/potOfGloryMountain";

interface Props {
  running: boolean;
  soundEnabled: boolean;
  onGameOver: (score: number) => void;
  onScoreChange: (score: number) => void;
}

/**
 * Pot of Glory — clean-room climb inspired by contact-anchored sledge physics.
 * Continuous BBQ rock-pile terrain (no floating wood boards). Original art only.
 */

const PX_PER_METER = 4.8;
const HAMMER_R = 20;
const GRIP_TOLERANCE = 10;
/** Ignore tiny thumb jitter only while planted. */
const AIM_DEADZONE = 8;
const POT_R = POT_RADIUS;
const FIXED_DT = 1000 / 60; // Matter.js recommends ≤ 16.667 ms
const MAX_SUBSTEPS = 4;
const CAM_LERP = 0.16;

const createSound = () => {
  let audio: AudioContext | null = null;
  const ctx = () => {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    return audio;
  };
  const tone = (freq: number, dur: number, type: OscillatorType, vol = 0.04, delay = 0) => {
    try {
      const ac = ctx();
      const o = ac.createOscillator();
      const g = ac.createGain();
      const t = ac.currentTime + delay;
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(ac.destination);
      o.start(t);
      o.stop(t + dur);
    } catch { /* ignore */ }
  };
  return {
    clang: () => { tone(170, 0.07, "square", 0.028); tone(360, 0.1, "triangle", 0.02, 0.015); },
    scrape: () => tone(80, 0.05, "sawtooth", 0.014),
    thud: () => tone(50, 0.2, "sine", 0.05),
    fall: () => { tone(260, 0.22, "sine", 0.026); tone(100, 0.4, "triangle", 0.032, 0.12); },
    summit: () => { tone(440, 0.12, "sine", 0.036); tone(660, 0.18, "triangle", 0.03, 0.1); },
  };
};

type WorldState = {
  engine: Matter.Engine | null;
  pot: Matter.Body | null;
  hammer: Matter.Body | null;
  terrain: Matter.Body[];
  startY: number;
  startX: number;
  maxHeight: number;
  lastScore: number;
  camX: number;
  camY: number;
  shake: number;
  ended: boolean;
  ending: boolean;
  /** Screen-space pointer (client coords relative to canvas) */
  screenX: number;
  screenY: number;
  aiming: boolean;
  width: number;
  height: number;
  climbed: boolean;
  lastClang: number;
  onImpact: null | ((impact: number) => void);
  accum: number;
  hammerPlanted: boolean;
  hammerContacts: Set<number>;
  hammerAngle: number;
  activePointerId: number | null;
  prevAimX: number;
  prevAimY: number;
  lastAimX: number;
  lastAimY: number;
  hammerVelX: number;
  hammerVelY: number;
};

const PotOfGlory = ({ running, soundEnabled, onGameOver, onScoreChange }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameOverRef = useRef(onGameOver);
  const scoreRef = useRef(onScoreChange);
  const soundOnRef = useRef(soundEnabled);
  const runningRef = useRef(running);

  useEffect(() => { gameOverRef.current = onGameOver; }, [onGameOver]);
  useEffect(() => { scoreRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { soundOnRef.current = soundEnabled; }, [soundEnabled]);

  const worldRef = useRef<WorldState>({
    engine: null,
    pot: null,
    hammer: null,
    terrain: [],
    startY: 0,
    startX: 0,
    maxHeight: 0,
    lastScore: -1,
    camX: 0,
    camY: 0,
    shake: 0,
    ended: false,
    ending: false,
    screenX: 0,
    screenY: 0,
    aiming: false,
    width: 0,
    height: 0,
    climbed: false,
    lastClang: 0,
    onImpact: null,
    accum: 0,
    hammerPlanted: false,
    hammerContacts: new Set(),
    hammerAngle: 0,
    activePointerId: null,
    prevAimX: 0,
    prevAimY: 0,
    lastAimX: 0,
    lastAimY: 0,
    hammerVelX: 0,
    hammerVelY: 0,
  });

  const destroyEngine = () => {
    const w = worldRef.current;
    if (!w.engine) return;
    try {
      Matter.Events.off(w.engine, "collisionStart");
      Matter.Events.off(w.engine, "collisionActive");
      Matter.Events.off(w.engine, "collisionEnd");
      Matter.World.clear(w.engine.world, false);
      Matter.Engine.clear(w.engine);
    } catch { /* ignore */ }
    w.engine = null;
    w.pot = null;
    w.hammer = null;
    w.terrain = [];
  };

  const resetWorld = () => {
    const w = worldRef.current;
    destroyEngine();

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: GRAVITY_Y, scale: GRAVITY_SCALE },
      enableSleeping: false,
    });
    engine.positionIterations = 12;
    engine.velocityIterations = 10;

    const startX = 200;
    const startY = 2500;
    const playerGroup = Matter.Body.nextGroup(true);
    const idle = idleHammerOffset(MAX_RANGE);

    // Heavy pot / body — enough ledge friction to rest, slight give for bounce reads
    const pot = Matter.Bodies.circle(startX, startY, POT_R, {
      density: POT_DENSITY,
      friction: 0.45,
      frictionStatic: 0.55,
      frictionAir: 0.022,
      restitution: 0.18,
      label: "pot",
      inertia: Infinity,
      collisionFilter: { group: playerGroup },
    });

    // Hammer head — Matter clamps friction to ~1, so stay in the documented range
    const hammer = Matter.Bodies.circle(startX + idle.x, startY + idle.y, HAMMER_R, {
      density: 0.00035,
      friction: 1,
      frictionStatic: 1,
      frictionAir: 0.008,
      restitution: 0.35,
      label: "hammer",
      inertia: Infinity,
      collisionFilter: { group: playerGroup },
    });

    const terrain = buildGloryPile(startX, startY);
    Matter.Composite.add(engine.world, [pot, hammer, ...terrain]);

    const terrainContactId = (pair: Matter.Pair) => {
      if (pair.bodyA === hammer && pair.bodyB.label === "terrain") return pair.bodyB.id;
      if (pair.bodyB === hammer && pair.bodyA.label === "terrain") return pair.bodyA.id;
      return null;
    };
    const addHammerContacts = (event: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of event.pairs) {
        const id = terrainContactId(pair);
        if (id !== null) w.hammerContacts.add(id);
      }
      w.hammerPlanted = w.hammerContacts.size > 0;
    };
    const removeHammerContacts = (event: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of event.pairs) {
        const id = terrainContactId(pair);
        if (id !== null) w.hammerContacts.delete(id);
      }
      w.hammerPlanted = w.hammerContacts.size > 0;
    };

    Matter.Events.on(engine, "collisionStart", (event) => {
      if (w.ended || w.ending) return;
      addHammerContacts(event);
      for (const pair of event.pairs) {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        const depth = pair.collision?.depth ?? 0;
        if (labels.includes("hammer") && labels.includes("terrain") && depth > 0.5) {
          if (performance.now() - w.lastClang > 90) {
            w.lastClang = performance.now();
            w.shake = Math.min(0.35, depth * 0.04);
            w.onImpact?.(depth);
          }
        }
      }
    });
    Matter.Events.on(engine, "collisionActive", addHammerContacts);
    Matter.Events.on(engine, "collisionEnd", removeHammerContacts);

    w.engine = engine;
    w.pot = pot;
    w.hammer = hammer;
    w.terrain = terrain;
    w.startX = startX;
    w.startY = startY;
    w.maxHeight = 0;
    w.lastScore = -1;
    w.camX = startX;
    w.camY = startY - 20;
    w.shake = 0;
    w.ended = false;
    w.ending = false;
    w.climbed = false;
    w.aiming = false;
    w.lastClang = 0;
    w.accum = 0;
    w.hammerPlanted = false;
    w.hammerContacts.clear();
    w.hammerAngle = Math.atan2(idle.y, idle.x);
    w.activePointerId = null;
    w.prevAimX = idle.x;
    w.prevAimY = idle.y;
    w.lastAimX = idle.x;
    w.lastAimY = idle.y;
    w.hammerVelX = 0;
    w.hammerVelY = 0;
    w.screenX = (w.width || 400) * 0.65;
    w.screenY = (w.height || 700) * 0.45;
  };

  useEffect(() => {
    runningRef.current = running;
    if (running) {
      resetWorld();
      scoreRef.current(0);
    } else {
      worldRef.current.ended = true;
      worldRef.current.aiming = false;
    }
  }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const sounds = createSound();
    const w = worldRef.current;
    w.onImpact = (impact) => {
      if (!soundOnRef.current) return;
      if (impact > 4) sounds.thud();
      else if (impact > 2) sounds.clang();
      else sounds.scrape();
    };
    if (!w.engine) resetWorld();

    let raf = 0;
    let lastFrame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      w.width = rect.width;
      w.height = rect.height;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!runningRef.current || w.ended) return;
      if (w.activePointerId !== null && w.activePointerId !== e.pointerId) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      w.activePointerId = e.pointerId;
      const rect = canvas.getBoundingClientRect();
      w.screenX = e.clientX - rect.left;
      w.screenY = e.clientY - rect.top;
      w.aiming = true;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!runningRef.current || w.ended) return;
      const isTouch = e.pointerType === "touch";
      if (isTouch && w.activePointerId !== e.pointerId) return;
      if (isTouch && !w.aiming) return;
      // Desktop: only aim while a button is held (matches mobile touch-hold).
      if (!isTouch && (e.buttons & 1) === 0 && !w.aiming) return;
      if (!isTouch && (e.buttons & 1) !== 0) w.aiming = true;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      w.screenX = e.clientX - rect.left;
      w.screenY = e.clientY - rect.top;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (w.activePointerId === e.pointerId) {
        w.aiming = false;
        w.activePointerId = null;
      }
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const onPointerLeave = () => {
      if (w.activePointerId === null) w.aiming = false;
    };

    const endRun = (reason: "fall" | "summit") => {
      if (w.ended || w.ending || !runningRef.current) return;
      w.ending = true;
      w.ended = true;
      w.aiming = false;
      if (soundOnRef.current) {
        if (reason === "summit") sounds.summit();
        else sounds.fall();
      }
      try { haptic(reason === "summit" ? "success" : "error"); } catch { /* ignore */ }
      const finalScore = Math.max(0, Math.floor(w.maxHeight));
      window.setTimeout(() => {
        try { gameOverRef.current(finalScore); } catch { /* ignore */ }
      }, 0);
    };

    /**
     * Control model (mobile-readable):
     * 1) aim = clamp(pointer − screen center)
     * 2) always apply swing reaction from Δaim (feels like hammer mass)
     * 3) if planted → spring-damper + lip normal push
     * 4) on hard plant → pogo bounce along surface normal
     * 5) hammer follows pot+aim with snappy lerp
     */
    const stepControls = () => {
      if (!w.pot || !w.hammer) return;
      if (w.width < 2 || w.height < 2) return;

      const pot = w.pot;
      const hammer = w.hammer;

      const aim = clampAimOffset(
        w.screenX,
        w.screenY,
        w.width,
        w.height,
        MAX_RANGE,
      );
      let mx = aim.x;
      let my = aim.y;

      // Hold last aim when finger lifts — don't snap the hammer home.
      if (!w.aiming) {
        mx = w.lastAimX;
        my = w.lastAimY;
      } else if (w.hammerPlanted && aim.distance < AIM_DEADZONE) {
        // Dead-zone only while planted: freeze offset so grips don't flick off.
        mx = hammer.position.x - pot.position.x;
        my = hammer.position.y - pot.position.y;
      }

      // Keep aim inside reach (frozen offsets can drift as pot moves).
      const reach = Math.hypot(mx, my);
      if (reach > MAX_RANGE && reach > 0) {
        const scale = MAX_RANGE / reach;
        mx *= scale;
        my *= scale;
      }

      const aimDelta = {
        x: mx - w.prevAimX,
        y: my - w.prevAimY,
      };

      const candidates = Matter.Query.region(w.terrain, {
        min: {
          x: hammer.bounds.min.x - GRIP_TOLERANCE,
          y: hammer.bounds.min.y - GRIP_TOLERANCE,
        },
        max: {
          x: hammer.bounds.max.x + GRIP_TOLERANCE,
          y: hammer.bounds.max.y + GRIP_TOLERANCE,
        },
      });
      const overlaps = Matter.Query.collides(hammer, candidates);
      const nearGap = candidates.some((body) => polygonGap(hammer, body) <= GRIP_TOLERANCE);
      const wasPlanted = w.hammerPlanted;
      w.hammerPlanted = overlaps.length > 0 || nearGap;
      if (!w.hammerPlanted) w.hammerContacts.clear();

      const normal = overlaps[0]
        ? outwardNormalFromCollision(overlaps[0], hammer)
        : null;

      // 1) Swing mass reaction — always on so flicks feel alive in air.
      const swing = swingReactionForce(aimDelta, w.hammerPlanted);
      Matter.Body.applyForce(pot, pot.position, swing);

      // 2) Planted lever + lip climb.
      if (w.hammerPlanted) {
        const force = lipClimbForce(
          pot,
          hammer.position,
          { x: mx, y: my },
          normal,
        );
        Matter.Body.applyForce(pot, pot.position, force);

        // 3) Fresh plant with closing speed → pogo bounce.
        if (normal && (!wasPlanted || Math.hypot(aimDelta.x, aimDelta.y) > 10)) {
          const closing = hammerClosingSpeed(
            { x: w.hammerVelX, y: w.hammerVelY },
            normal,
          );
          const pogo = pogoBounceForce(closing, normal);
          if (pogo.x !== 0 || pogo.y !== 0) {
            Matter.Body.applyForce(pot, pot.position, pogo);
            w.shake = Math.min(0.45, w.shake + closing * 0.012);
          }
        }
      }

      Matter.Body.setVelocity(pot, clampBodyVelocity(pot.velocity));

      // Hammer follows aim; faster in air, stickier when planted.
      const lerp = hammerFollowLerp(w.hammerPlanted);
      const newHammerX = pot.position.x + mx;
      const newHammerY = pot.position.y + my;
      const desiredDelta = clampBodyVelocity(
        {
          x: (newHammerX - hammer.position.x) * lerp,
          y: (newHammerY - hammer.position.y) * lerp,
        },
        HAMMER_MAX_SPEED,
      );
      const nextX = hammer.position.x + desiredDelta.x;
      const nextY = hammer.position.y + desiredDelta.y;
      w.hammerVelX = desiredDelta.x;
      w.hammerVelY = desiredDelta.y;
      Matter.Body.setPosition(hammer, { x: nextX, y: nextY }, false);
      Matter.Body.setVelocity(hammer, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(hammer, 0);

      w.hammerAngle = Math.atan2(nextY - pot.position.y, nextX - pot.position.x);
      w.prevAimX = mx;
      w.prevAimY = my;
      if (w.aiming) {
        w.lastAimX = mx;
        w.lastAimY = my;
      }
    };

    const drawTerrain = (body: Matter.Body) => {
      const meta = (body as Matter.Body & { rockMeta?: RockMeta }).rockMeta;
      const verts = body.vertices;
      const traceBody = () => {
        ctx.beginPath();
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i += 1) ctx.lineTo(verts[i].x, verts[i].y);
        ctx.closePath();
      };
      traceBody();

      const variant = meta?.variant ?? 0;
      // Tan angular cliff faces matching the continuous-mountain references.
      const palettes = [
        ["#d2b48c", "#9a7b5a", "#4a3a2e"],
        ["#c4b09a", "#7d6a58", "#3d342c"],
        ["#b8956e", "#7a5a42", "#3a2c24"],
        ["#a89888", "#6e6054", "#322c28"],
      ];
      const palette = palettes[variant % palettes.length];
      const g = ctx.createLinearGradient(
        body.bounds.min.x,
        body.bounds.min.y,
        body.bounds.max.x,
        body.bounds.max.y,
      );
      g.addColorStop(0, palette[0]);
      g.addColorStop(0.48, palette[1]);
      g.addColorStop(1, palette[2]);
      ctx.fillStyle = g;
      ctx.fill();

      // Polygon facets are resolution-independent and share the real
      // collider vertices, so graphics and gripping surfaces always agree.
      const centerX = body.position.x;
      const centerY = body.position.y;
      for (let i = 0; i < verts.length; i += 1) {
        const a = verts[i];
        const b = verts[(i + 1) % verts.length];
        const light = (i + variant) % 4;
        ctx.fillStyle = [
          "rgba(255,235,200,.22)",
          "rgba(210,160,100,.12)",
          "rgba(40,28,22,.22)",
          "rgba(12,10,10,.32)",
        ][light];
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.closePath();
        ctx.fill();
      }

      // Bright lip edge on climbable rocks — latch cue for the hammer head.
      if (meta?.lip && !meta.support) {
        let topY = Infinity;
        let leftX = Infinity;
        let rightX = -Infinity;
        for (const v of verts) {
          if (v.y < topY) topY = v.y;
          leftX = Math.min(leftX, v.x);
          rightX = Math.max(rightX, v.x);
        }
        ctx.strokeStyle = "rgba(255, 210, 140, 0.55)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(leftX + 8, topY + 2);
        ctx.lineTo(rightX - 8, topY + 2);
        ctx.stroke();
      }

      // Layered mineral strata and deterministic cracks.
      ctx.save();
      traceBody();
      ctx.clip();
      const width = body.bounds.max.x - body.bounds.min.x;
      const height = body.bounds.max.y - body.bounds.min.y;
      ctx.strokeStyle = "rgba(230,205,170,.16)";
      ctx.lineWidth = 1.2;
      for (let band = 1; band <= 3; band += 1) {
        const y = body.bounds.min.y + (height * band) / 4;
        ctx.beginPath();
        ctx.moveTo(body.bounds.min.x, y);
        for (let x = body.bounds.min.x; x <= body.bounds.max.x; x += 18) {
          ctx.lineTo(x, y + Math.sin(x * 0.055 + variant) * 4);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(20,15,14,.42)";
      ctx.lineWidth = 1.5;
      for (let crack = 0; crack < 3; crack += 1) {
        const startX = body.bounds.min.x + width * (0.22 + crack * 0.25);
        const startY = body.bounds.min.y + height * (0.18 + ((variant + crack) % 3) * 0.12);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + Math.sin(variant + crack) * 9, startY + height * 0.2);
        ctx.lineTo(startX - 5 + Math.cos(variant + crack) * 8, startY + height * 0.38);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = meta?.recovery
        ? "rgba(255,188,92,.48)"
        : "rgba(215,190,155,.3)";
      ctx.lineWidth = meta?.recovery ? 2.4 : 1.5;
      traceBody();
      ctx.stroke();
      ctx.save();
      traceBody();
      ctx.clip();
      const shade = ctx.createLinearGradient(0, body.bounds.min.y, 0, body.bounds.max.y);
      shade.addColorStop(0, "rgba(255,190,100,.1)");
      shade.addColorStop(0.55, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,0,.38)");
      ctx.fillStyle = shade;
      ctx.fillRect(
        body.bounds.min.x,
        body.bounds.min.y,
        body.bounds.max.x - body.bounds.min.x,
        body.bounds.max.y - body.bounds.min.y,
      );
      ctx.restore();

      if (meta?.summit) {
        const fx = body.position.x;
        const fy = body.bounds.min.y - 6;
        ctx.strokeStyle = "#ddd";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx, fy - 48);
        ctx.stroke();
        ctx.fillStyle = "#e85d2a";
        ctx.beginPath();
        ctx.moveTo(fx, fy - 48);
        ctx.lineTo(fx + 34, fy - 36);
        ctx.lineTo(fx, fy - 24);
        ctx.fill();
        ctx.fillStyle = "#ffe08a";
        ctx.font = "bold 12px Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText("GLORY", fx, fy - 56);
      }
    };

    const drawPlayer = () => {
      if (!w.pot || !w.hammer) return;
      const pot = w.pot;
      const hammer = w.hammer;
      const ang = w.hammerAngle;

      // Long yellow sledge handle (visual only — physics uses hammer head)
      const hx = pot.position.x;
      const hy = pot.position.y - 4;
      const tipX = hammer.position.x;
      const tipY = hammer.position.y;
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 11;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.strokeStyle = "#e8c412";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      // Black grip near hands
      const gripX = hx + Math.cos(ang) * 22;
      const gripY = hy + Math.sin(ang) * 22;
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(gripX, gripY);
      ctx.stroke();

      // Heavy rectangular sledge head
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(ang);
      ctx.fillStyle = "#2a2e32";
      ctx.strokeStyle = "#6a7078";
      ctx.lineWidth = 2;
      ctx.fillRect(-14, -22, 32, 44);
      ctx.strokeRect(-14, -22, 32, 44);
      ctx.fillStyle = "#111418";
      ctx.fillRect(-10, -18, 8, 36);
      ctx.fillRect(6, -18, 8, 36);
      if (w.hammerPlanted) {
        ctx.strokeStyle = "rgba(120,255,160,.75)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, HAMMER_R + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Cracked iron cauldron + bald climber (GOI-style silhouette)
      ctx.save();
      ctx.translate(pot.position.x, pot.position.y);

      const potGrad = ctx.createRadialGradient(-6, 2, 4, 0, 8, POT_R + 4);
      potGrad.addColorStop(0, "#4a4e54");
      potGrad.addColorStop(0.55, "#1e2228");
      potGrad.addColorStop(1, "#0a0c10");
      ctx.fillStyle = potGrad;
      ctx.beginPath();
      ctx.arc(0, 8, POT_R + 1, 0.15, Math.PI - 0.15);
      ctx.fill();
      // Rim
      ctx.strokeStyle = "#6a7078";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, -2, POT_R * 0.95, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#12151a";
      ctx.beginPath();
      ctx.ellipse(0, -2, POT_R * 0.88, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Surface cracks on pot
      ctx.strokeStyle = "rgba(180,190,200,.35)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-14, 6);
      ctx.lineTo(-8, 18);
      ctx.lineTo(-2, 12);
      ctx.moveTo(10, 4);
      ctx.lineTo(14, 16);
      ctx.stroke();

      // White polo torso
      ctx.fillStyle = "#f2f0ea";
      ctx.beginPath();
      ctx.ellipse(0, -10, 14, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(4, -18, 3, 5);

      // Bald head
      const lookFlip = Math.cos(ang) < 0;
      const headTilt = Math.max(-0.45, Math.min(0.45, Math.sin(ang) * 0.5));
      ctx.save();
      ctx.translate(0, -28);
      ctx.rotate(headTilt * (lookFlip ? -1 : 1));
      ctx.scale(lookFlip ? -1 : 1, 1);
      ctx.fillStyle = "#e0a888";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      // Subtle scalp shade
      ctx.fillStyle = "rgba(160,110,80,.25)";
      ctx.beginPath();
      ctx.arc(0, -4, 10, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#2a1810";
      ctx.beginPath();
      ctx.arc(3, -1, 1.4, 0, Math.PI * 2);
      ctx.arc(7, -1, 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c08060";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(5, 4, 3, 0.1, Math.PI - 0.1);
      ctx.stroke();
      ctx.restore();

      // Arms gripping the yellow shaft
      ctx.strokeStyle = "#e0a888";
      ctx.lineWidth = 5.5;
      ctx.lineCap = "round";
      const armTx = Math.cos(ang) * 34;
      const armTy = Math.sin(ang) * 34 - 2;
      ctx.beginPath();
      ctx.moveTo(-8, -12);
      ctx.quadraticCurveTo(-14, -2, armTx * 0.65, armTy * 0.65);
      ctx.moveTo(8, -12);
      ctx.quadraticCurveTo(12, 0, armTx * 0.7 + 3, armTy * 0.65);
      ctx.stroke();

      ctx.restore();
    };

    const drawBackdrop = () => {
      const { width, height, camX, camY } = w;
      // High-altitude pale sky like the cliff references
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#9ec4e8");
      sky.addColorStop(0.35, "#b8d4ee");
      sky.addColorStop(0.7, "#c8d8e8");
      sky.addColorStop(1, "#a8b8c8");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      const ridges = [
        { y: 0.52, amp: 70, parallax: 0.02, color: "rgba(120,140,170,.35)" },
        { y: 0.64, amp: 90, parallax: 0.04, color: "rgba(90,110,140,.45)" },
        { y: 0.78, amp: 55, parallax: 0.07, color: "rgba(70,85,110,.55)" },
      ];
      for (const ridge of ridges) {
        ctx.fillStyle = ridge.color;
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 16) {
          const worldX = x + camX * ridge.parallax;
          const peak = Math.abs(Math.sin(worldX * 0.008)) * ridge.amp;
          const detail = Math.sin(worldX * 0.022) * ridge.amp * 0.22;
          ctx.lineTo(x, height * ridge.y - peak + detail + camY * ridge.parallax * 0.02);
        }
        ctx.lineTo(width, height);
        ctx.fill();
      }

      // Soft fog band over distant ranges
      const haze = ctx.createLinearGradient(0, height * 0.45, 0, height * 0.85);
      haze.addColorStop(0, "rgba(200,220,240,0)");
      haze.addColorStop(0.5, "rgba(210,225,240,.35)");
      haze.addColorStop(1, "rgba(180,200,220,.15)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, height * 0.45, width, height * 0.4);
    };

    const loop = (time: number) => {
      const engine = w.engine;
      if (!engine || !w.pot || !w.hammer) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const frameDelta = lastFrame ? Math.min(32, time - lastFrame) : FIXED_DT;
      lastFrame = time;

      if (runningRef.current && !w.ended && !w.ending) {
        w.accum += frameDelta;
        let steps = 0;
        while (w.accum >= FIXED_DT && steps < MAX_SUBSTEPS) {
          // Apply controls exactly once per fixed physics step.
          stepControls();
          try {
            Matter.Engine.update(engine, FIXED_DT);
          } catch {
            endRun("fall");
            break;
          }
          w.accum -= FIXED_DT;
          steps += 1;
        }
        if (w.accum > FIXED_DT * 2) w.accum = 0;

        if (!Number.isFinite(w.pot.position.x) || !Number.isFinite(w.pot.position.y)) {
          endRun("fall");
        } else {
          const heightM = Math.max(0, (w.startY - w.pot.position.y) / PX_PER_METER);
          if (heightM > w.maxHeight) {
            w.maxHeight = heightM;
            if (heightM > 18) w.climbed = true;
          }
          const rounded = Math.floor(w.maxHeight);
          if (rounded !== w.lastScore) {
            w.lastScore = rounded;
            scoreRef.current(rounded);
          }

          w.camX += (w.pot.position.x - w.camX) * CAM_LERP;
          w.camY += (w.pot.position.y - w.camY) * CAM_LERP;
          w.shake = Math.max(0, w.shake - 0.03);

          // Falling is the punishment, not an artificial game-over. The wide
          // base catches normal falls; this only rescues an off-world launch.
          const escapedWorld = w.pot.position.y > w.startY + 650
            || Math.abs(w.pot.position.x - w.startX) > 1400;
          if (escapedWorld && w.hammer) {
            const idle = idleHammerOffset(MAX_RANGE);
            Matter.Body.setPosition(w.pot, { x: w.startX, y: w.startY });
            Matter.Body.setVelocity(w.pot, { x: 0, y: 0 });
            Matter.Body.setPosition(w.hammer, {
              x: w.startX + idle.x,
              y: w.startY + idle.y,
            });
            Matter.Body.setVelocity(w.hammer, { x: 0, y: 0 });
            w.camX = w.startX;
            w.camY = w.startY;
            w.hammerContacts.clear();
            w.hammerPlanted = false;
            w.shake = 0;
            if (soundOnRef.current) sounds.fall();
            try { haptic("error"); } catch { /* ignore */ }
          }

          const summitRock = w.terrain.find(
            (body) => (body as Matter.Body & { rockMeta?: RockMeta }).rockMeta?.summit,
          );
          if (summitRock && w.pot.position.y < summitRock.bounds.min.y + POT_R) {
            endRun("summit");
          }
        }
      }

      drawBackdrop();
      ctx.save();
      const shakeX = w.shake > 0 ? (Math.random() - 0.5) * 8 : 0;
      const shakeY = w.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
      ctx.translate(w.width / 2 - w.camX + shakeX, w.height / 2 - w.camY + shakeY);
      for (const body of w.terrain) drawTerrain(body);
      drawPlayer();

      // Aim cue at pot + aim (matches physics), not camera-lagged screen center
      if (runningRef.current && !w.ended && w.aiming && w.pot) {
        const aim = clampAimOffset(w.screenX, w.screenY, w.width, w.height, MAX_RANGE);
        const tipX = w.pot.position.x + aim.x;
        const tipY = w.pot.position.y + aim.y;
        ctx.strokeStyle = "rgba(255,210,120,.35)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(w.pot.position.x, w.pot.position.y, MAX_RANGE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,220,140,.85)";
        ctx.beginPath();
        ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (runningRef.current) {
        ctx.fillStyle = "rgba(0,0,0,.45)";
        ctx.fillRect(10, 10, 96, 42);
        ctx.fillStyle = "#ffd28a";
        ctx.font = "bold 10px system-ui,sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("HEIGHT", 22, 26);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px ui-monospace,monospace";
        ctx.fillText(`${Math.floor(w.maxHeight)}m`, 22, 44);

        const planted = w.hammerPlanted;
        ctx.fillStyle = "rgba(0,0,0,.45)";
        ctx.fillRect(112, 10, 64, 42);
        ctx.fillStyle = planted ? "#8df2a6" : "#ffb070";
        ctx.font = "bold 10px system-ui,sans-serif";
        ctx.fillText(planted ? "PLANTED" : "SWING", 120, 27);
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.font = "bold 9px system-ui,sans-serif";
        ctx.fillText(planted ? "lever up" : "hook rock", 120, 42);
      }

      raf = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      destroyEngine();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Pot of Glory. Move from screen center to swing the sledge and climb the glory pile."
      className="block h-full w-full touch-none select-none"
      style={{ touchAction: "none", WebkitUserSelect: "none" }}
    />
  );
};

export default PotOfGlory;
