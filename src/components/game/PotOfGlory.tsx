import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { haptic } from "@/lib/haptics";

interface Props {
  running: boolean;
  soundEnabled: boolean;
  onGameOver: (score: number) => void;
  onScoreChange: (score: number) => void;
}

type TerrainKind = "wood" | "metal" | "stone" | "grill" | "crate";

interface TerrainMeta {
  kind: TerrainKind;
  label?: string;
}

const PX_PER_METER = 5.5;
const FORK_LEN = 132;
const POT_R = 24;

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
    } catch { /* ignore audio errors */ }
  };
  return {
    clang: () => { tone(220, 0.08, "square", 0.035); tone(440, 0.12, "triangle", 0.025, 0.02); },
    scrape: () => tone(90, 0.06, "sawtooth", 0.018),
    thud: () => tone(70, 0.18, "sine", 0.05),
    fall: () => { tone(320, 0.2, "sine", 0.03); tone(140, 0.35, "triangle", 0.04, 0.1); },
  };
};

const block = (x: number, y: number, w: number, h: number, kind: TerrainKind, angle = 0, label?: string) => {
  const body = Matter.Bodies.rectangle(x, y, w, h, {
    isStatic: true,
    angle,
    friction: 1.2,
    frictionStatic: 1.4,
    restitution: 0.02,
    chamfer: { radius: kind === "metal" ? 2 : 4 },
    label: "terrain",
  });
  (body as Matter.Body & { meta?: TerrainMeta }).meta = { kind, label };
  return body;
};

const buildMountain = (startX: number, startY: number) => {
  const parts: Matter.Body[] = [];
  // Room to learn — wide pit floor and gentle first steps
  parts.push(block(startX, startY + 110, 480, 50, "stone"));
  parts.push(block(startX - 220, startY - 20, 48, 280, "stone"));
  parts.push(block(startX + 220, startY - 20, 48, 280, "stone"));
  parts.push(block(startX - 40, startY + 8, 140, 28, "wood", -0.08));
  parts.push(block(startX + 110, startY - 55, 150, 26, "crate", 0.05));
  parts.push(block(startX - 20, startY - 130, 160, 26, "grill", -0.06));
  parts.push(block(startX + 140, startY - 210, 150, 26, "wood", 0.08));
  parts.push(block(startX - 30, startY - 290, 170, 28, "stone", -0.04));
  parts.push(block(startX + 130, startY - 380, 140, 26, "crate", 0.1));
  parts.push(block(startX - 40, startY - 470, 160, 26, "wood", -0.08));

  // Mid — still readable, slightly steeper "almost" gaps
  parts.push(block(startX + 120, startY - 560, 130, 24, "grill", 0.18));
  parts.push(block(startX - 60, startY - 640, 140, 24, "metal", -0.16));
  parts.push(block(startX + 110, startY - 730, 120, 22, "crate", 0.22));
  parts.push(block(startX - 40, startY - 820, 135, 24, "wood", -0.12));
  parts.push(block(startX + 130, startY - 910, 115, 22, "stone", 0.2));
  parts.push(block(startX - 20, startY - 1000, 145, 24, "grill", -0.18));
  parts.push(block(startX + 100, startY - 1090, 110, 22, "crate", 0.28));
  parts.push(block(startX - 50, startY - 1180, 140, 24, "wood", -0.1));

  // Late — narrow ledges that feel one-swing-away
  parts.push(block(startX + 90, startY - 1280, 95, 20, "metal", 0.35));
  parts.push(block(startX - 40, startY - 1380, 105, 20, "grill", -0.32));
  parts.push(block(startX + 100, startY - 1480, 90, 18, "crate", 0.4));
  parts.push(block(startX - 30, startY - 1580, 110, 20, "wood", -0.25));
  parts.push(block(startX + 110, startY - 1680, 85, 18, "stone", 0.38));
  parts.push(block(startX - 20, startY - 1780, 100, 20, "metal", -0.3));
  parts.push(block(startX + 90, startY - 1880, 80, 18, "grill", 0.45));
  parts.push(block(startX - 40, startY - 1980, 120, 22, "wood", -0.12));
  parts.push(block(startX + 100, startY - 2080, 75, 18, "crate", 0.5));
  parts.push(block(startX - 10, startY - 2180, 115, 22, "stone", -0.18));
  parts.push(block(startX + 80, startY - 2280, 90, 18, "metal", 0.42));
  parts.push(block(startX - 30, startY - 2380, 130, 24, "wood", -0.08));
  parts.push(block(startX + 40, startY - 2480, 160, 28, "stone", 0, "SUMMIT"));
  parts.push(block(startX + 40, startY - 2540, 44, 80, "metal"));

  parts.push(block(startX - 360, startY - 1200, 54, 2800, "stone"));
  parts.push(block(startX + 400, startY - 1200, 54, 2800, "stone"));
  return parts;
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

  const worldRef = useRef({
    engine: null as Matter.Engine | null,
    pot: null as Matter.Body | null,
    fork: null as Matter.Body | null,
    terrain: [] as Matter.Body[],
    startY: 0,
    startX: 0,
    maxHeight: 0,
    lastScore: -1,
    camX: 0,
    camY: 0,
    shake: 0,
    ended: false,
    pointerX: 0,
    pointerY: 0,
    dragging: false,
    width: 0,
    height: 0,
    climbed: false,
    lastClang: 0,
    ending: false,
    onImpact: null as null | ((impact: number) => void),
  });

  const destroyEngine = () => {
    const w = worldRef.current;
    if (!w.engine) return;
    try {
      Matter.Events.off(w.engine, "collisionStart");
      Matter.World.clear(w.engine.world, false);
      Matter.Engine.clear(w.engine);
    } catch { /* ignore */ }
    w.engine = null;
    w.pot = null;
    w.fork = null;
    w.terrain = [];
  };

  const resetWorld = () => {
    const w = worldRef.current;
    destroyEngine();

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0.88, scale: 0.001 },
      enableSleeping: false,
    });
    engine.positionIterations = 10;
    engine.velocityIterations = 8;

    const startX = 200;
    const startY = 2500;
    const playerGroup = Matter.Body.nextGroup(true);

    const pot = Matter.Bodies.circle(startX, startY, POT_R, {
      density: 0.0026,
      friction: 0.7,
      frictionAir: 0.028,
      restitution: 0.04,
      label: "pot",
      collisionFilter: { group: playerGroup },
    });
    const fork = Matter.Bodies.rectangle(startX + FORK_LEN * 0.42, startY, FORK_LEN, 12, {
      density: 0.001,
      friction: 1.35,
      frictionAir: 0.012,
      restitution: 0.02,
      label: "fork",
      chamfer: { radius: 3 },
      collisionFilter: { group: playerGroup },
    });
    const pivot = Matter.Constraint.create({
      bodyA: pot,
      bodyB: fork,
      pointA: { x: 0, y: 0 },
      pointB: { x: -FORK_LEN * 0.42, y: 0 },
      stiffness: 1,
      damping: 0.05,
      length: 0,
    });

    const terrain = buildMountain(startX, startY);
    Matter.Composite.add(engine.world, [pot, fork, pivot, ...terrain]);

    Matter.Events.on(engine, "collisionStart", (event) => {
      if (w.ended || w.ending) return;
      for (const pair of event.pairs) {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        const depth = pair.collision?.depth ?? 0;
        if ((labels.includes("fork") || labels.includes("pot")) && labels.includes("terrain") && depth > 1) {
          if (performance.now() - w.lastClang > 100) {
            w.lastClang = performance.now();
            w.shake = Math.min(0.3, depth * 0.035);
            w.onImpact?.(depth);
          }
        }
      }
    });

    w.engine = engine;
    w.pot = pot;
    w.fork = fork;
    w.terrain = terrain;
    w.startX = startX;
    w.startY = startY;
    w.maxHeight = 0;
    w.lastScore = -1;
    w.camX = startX;
    w.camY = startY;
    w.shake = 0;
    w.ended = false;
    w.ending = false;
    w.climbed = false;
    w.dragging = false;
    w.lastClang = 0;
  };

  useEffect(() => {
    runningRef.current = running;
    if (running) {
      resetWorld();
      scoreRef.current(0);
    } else {
      worldRef.current.ended = true;
      worldRef.current.dragging = false;
    }
  }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
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

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left - w.width / 2 + w.camX,
        y: clientY - rect.top - w.height / 2 + w.camY,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!runningRef.current || w.ended) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const p = toWorld(e.clientX, e.clientY);
      w.pointerX = p.x;
      w.pointerY = p.y;
      w.dragging = true;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!w.dragging) return;
      e.preventDefault();
      const p = toWorld(e.clientX, e.clientY);
      w.pointerX = p.x;
      w.pointerY = p.y;
    };
    const onPointerUp = (e: PointerEvent) => {
      w.dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };

    const endRun = (reason: "fall" | "summit") => {
      if (w.ended || w.ending || !runningRef.current) return;
      w.ending = true;
      w.ended = true;
      w.dragging = false;
      if (soundOnRef.current) sounds.fall();
      try { haptic(reason === "summit" ? "success" : "error"); } catch { /* ignore */ }
      const finalScore = Math.max(0, Math.floor(w.maxHeight));
      // Defer React state updates so Matter loop finishes this frame safely
      window.setTimeout(() => {
        try { gameOverRef.current(finalScore); } catch { /* ignore */ }
      }, 0);
    };

    const tipOfFork = () => {
      if (!w.fork) return { x: 0, y: 0 };
      const tipOffset = FORK_LEN * 0.48;
      return {
        x: w.fork.position.x + Math.cos(w.fork.angle) * tipOffset,
        y: w.fork.position.y + Math.sin(w.fork.angle) * tipOffset,
      };
    };

    const drawTerrain = (body: Matter.Body) => {
      const meta = (body as Matter.Body & { meta?: TerrainMeta }).meta;
      const kind = meta?.kind ?? "stone";
      const verts = body.vertices;
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i += 1) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      const fills: Record<TerrainKind, string> = {
        wood: "#8b4a24", metal: "#9aa3ad", stone: "#4a2c2a", grill: "#2f2f35", crate: "#a05a2c",
      };
      ctx.fillStyle = fills[kind];
      ctx.fill();
      ctx.strokeStyle = kind === "metal" ? "#e8c27a" : "#ffb067";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (meta?.label === "SUMMIT") {
        ctx.fillStyle = "#ffe08a";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SUMMIT", body.position.x, body.bounds.min.y - 12);
      }
    };

    const drawPlayer = () => {
      if (!w.pot || !w.fork) return;
      const pot = w.pot;
      const fork = w.fork;

      ctx.save();
      ctx.translate(fork.position.x, fork.position.y);
      ctx.rotate(fork.angle);
      ctx.fillStyle = "#c0c7d1";
      ctx.strokeStyle = "#fff1c4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-FORK_LEN * 0.42, -5.5, FORK_LEN, 11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e8edf3";
      for (let i = -1; i <= 1; i += 1) ctx.fillRect(FORK_LEN * 0.4, i * 5 - 1.5, 20, 3);
      ctx.fillStyle = "#6b2f1a";
      ctx.fillRect(-FORK_LEN * 0.42, -6.5, 24, 13);
      ctx.restore();

      ctx.save();
      ctx.translate(pot.position.x, pot.position.y);
      ctx.rotate(pot.angle);
      const potGrad = ctx.createRadialGradient(-8, -8, 4, 0, 0, POT_R);
      potGrad.addColorStop(0, "#6a6f78");
      potGrad.addColorStop(1, "#2a2e35");
      ctx.fillStyle = potGrad;
      ctx.beginPath();
      ctx.arc(0, 0, POT_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e2a54a";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#d9956a";
      ctx.beginPath();
      ctx.arc(0, -9, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fffaf0";
      ctx.fillRect(-9, -20, 18, 6);
      ctx.beginPath();
      ctx.arc(-4, -20, 5, Math.PI, 0);
      ctx.arc(0, -22, 6, Math.PI, 0);
      ctx.arc(4, -20, 5, Math.PI, 0);
      ctx.fill();
      ctx.restore();
    };

    const drawBackdrop = () => {
      const { width, height, camX, camY } = w;
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#1a0b2e");
      sky.addColorStop(0.45, "#8b2e2a");
      sky.addColorStop(1, "#f0a35a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(55,20,48,.55)";
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 24) {
        const worldX = camX + (x - width / 2) * 0.15;
        ctx.lineTo(x, height * 0.62 + Math.sin(worldX * 0.004) * 40 + camY * 0.02);
      }
      ctx.lineTo(width, height);
      ctx.fill();
    };

    const loop = (time: number) => {
      const engine = w.engine;
      if (!engine || !w.pot || !w.fork) {
        raf = requestAnimationFrame(loop);
        return;
      }

      if (runningRef.current && !w.ended && !w.ending) {
        // Simple tag & pull: fork tip follows finger with strong, readable leverage
        if (w.dragging) {
          const tip = tipOfFork();
          const dx = w.pointerX - w.pot.position.x;
          const dy = w.pointerY - w.pot.position.y;
          const target = Math.atan2(dy, dx);
          let diff = target - w.fork.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          const pullX = w.pointerX - tip.x;
          const pullY = w.pointerY - tip.y;
          const pullDist = Math.hypot(pullX, pullY);
          const strength = Math.min(1.35, 0.45 + pullDist / 70);

          Matter.Body.setAngularVelocity(
            w.fork,
            w.fork.angularVelocity * 0.62 + Math.max(-0.85, Math.min(0.85, diff * 0.42 * strength)),
          );

          const forceScale = 0.00085 * strength;
          Matter.Body.applyForce(w.pot, w.pot.position, {
            x: -Math.sin(w.fork.angle) * diff * forceScale,
            y: Math.cos(w.fork.angle) * diff * forceScale * 0.72,
          });
          Matter.Body.applyForce(w.fork, tip, {
            x: pullX * 0.000032,
            y: pullY * 0.000032,
          });
        } else {
          Matter.Body.setAngularVelocity(w.fork, w.fork.angularVelocity * 0.94);
        }

        const delta = lastFrame ? Math.min(22, time - lastFrame) : 1000 / 60;
        try {
          Matter.Engine.update(engine, delta);
        } catch {
          endRun("fall");
          raf = requestAnimationFrame(loop);
          return;
        }

        // Sanity — prevent NaN explosions that "break" the game
        if (!Number.isFinite(w.pot.position.x) || !Number.isFinite(w.pot.position.y)) {
          endRun("fall");
          raf = requestAnimationFrame(loop);
          return;
        }

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

        w.camX += (w.pot.position.x - w.camX) * 0.12;
        w.camY += (w.pot.position.y - w.camY) * 0.12;
        w.shake = Math.max(0, w.shake - 0.025);

        // Only end after a real climb — early slips are recoverable
        if (w.climbed && w.pot.position.y > w.startY + 55) endRun("fall");
        if (w.pot.position.y < w.startY - 2500) endRun("summit");
      }

      lastFrame = time;
      drawBackdrop();
      ctx.save();
      const shakeX = w.shake > 0 ? (Math.random() - 0.5) * 8 : 0;
      const shakeY = w.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
      ctx.translate(w.width / 2 - w.camX + shakeX, w.height / 2 - w.camY + shakeY);
      for (const body of w.terrain) drawTerrain(body);
      drawPlayer();

      if (runningRef.current && !w.ended && w.dragging && w.pot) {
        const tip = tipOfFork();
        ctx.strokeStyle = "rgba(255,200,120,.55)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(w.pointerX, w.pointerY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(255,210,120,.85)";
        ctx.beginPath();
        ctx.arc(w.pointerX, w.pointerY, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (runningRef.current) {
        ctx.fillStyle = "rgba(0,0,0,.4)";
        ctx.fillRect(10, 10, 90, 38);
        ctx.fillStyle = "#ffd28a";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("HEIGHT", 18, 25);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px monospace";
        ctx.fillText(`${Math.floor(w.maxHeight)}m`, 18, 42);
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
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      destroyEngine();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Pot of Glory. Touch and drag to pull the fork tip and climb."
      className="block h-full w-full touch-none select-none"
    />
  );
};

export default PotOfGlory;
