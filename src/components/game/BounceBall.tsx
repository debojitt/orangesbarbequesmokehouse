import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface Props {
  running: boolean;
  soundEnabled: boolean;
  onGameOver: (score: number) => void;
  onScoreChange: (score: number) => void;
}

type Platform = { x: number; y: number; w: number; h: number; type: "safe" | "spike" | "bounce" };
type Ring = { x: number; y: number; r: number; taken: boolean };

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
    bounce: () => tone(280, 0.08, "sine", 0.04),
    ring: () => { tone(660, 0.07, "triangle", 0.045); tone(880, 0.1, "sine", 0.03, 0.05); },
    die: () => { tone(180, 0.2, "sawtooth", 0.05); tone(90, 0.25, "square", 0.03, 0.05); },
  };
};

const BounceBall = ({ running, soundEnabled, onGameOver, onScoreChange }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameOverRef = useRef(onGameOver);
  const scoreRef = useRef(onScoreChange);
  const soundOnRef = useRef(soundEnabled);
  const runningRef = useRef(running);

  useEffect(() => { gameOverRef.current = onGameOver; }, [onGameOver]);
  useEffect(() => { scoreRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { soundOnRef.current = soundEnabled; }, [soundEnabled]);

  const stateRef = useRef({
    width: 0,
    height: 0,
    x: 80,
    y: 120,
    vx: 0,
    vy: 0,
    r: 16,
    groundY: 0,
    platforms: [] as Platform[],
    rings: [] as Ring[],
    camX: 0,
    score: 0,
    ringsGot: 0,
    ended: false,
    ending: false,
    move: 0,
    bounceBoost: 0,
    lastScore: -1,
    sized: false,
  });

  const buildLevel = (w: number, h: number) => {
    const platforms: Platform[] = [];
    const rings: Ring[] = [];
    const ground = h - 48;
    platforms.push({ x: 0, y: ground, w: 320, h: 48, type: "safe" });

    let x = 300;
    for (let i = 0; i < 48; i += 1) {
      // Easy early, then gaps shrink into near-miss territory
      const progress = i / 48;
      const gap = Math.max(42, 95 - progress * 55 + (i % 3) * 8);
      const elev = ground - 30 - Math.min(150, progress * 140) - ((i * 29) % 40);
      const pw = Math.max(78, 145 - progress * 55 + (i % 2) * 12);
      let kind: Platform["type"] = "safe";
      if (i > 8 && i % 8 === 4) kind = "spike";
      else if (i % 6 === 0) kind = "bounce";
      // Late spikes placed just after a bounce pad so you "almost" clear them
      if (i > 22 && i % 9 === 2) kind = "spike";

      platforms.push({ x, y: elev, w: pw, h: kind === "spike" ? 16 : 24, type: kind });
      if (kind !== "spike") {
        rings.push({ x: x + pw / 2, y: elev - 38, r: 13, taken: false });
        if (i % 4 === 0) rings.push({ x: x + pw * 0.75, y: elev - 78, r: 12, taken: false });
      }
      x += pw + gap;
      if (i % 7 === 6) {
        platforms.push({ x: x - 50, y: elev - 95, w: 88, h: 20, type: "safe" });
        rings.push({ x: x - 6, y: elev - 135, r: 12, taken: false });
      }
    }
    platforms.push({ x, y: ground - 16, w: 260, h: 40, type: "safe" });
    return { platforms, rings, endX: x + 100 };
  };

  const reset = () => {
    const s = stateRef.current;
    const built = buildLevel(Math.max(s.width, 360), Math.max(s.height, 640));
    s.x = 100;
    s.y = Math.max(90, s.height * 0.42);
    s.vx = 150;
    s.vy = -40;
    s.platforms = built.platforms;
    s.rings = built.rings;
    s.camX = 0;
    s.score = 0;
    s.ringsGot = 0;
    s.ended = false;
    s.ending = false;
    s.move = 0;
    s.bounceBoost = 0;
    s.lastScore = -1;
    s.groundY = Math.max(s.height - 48, 400);
  };

  useEffect(() => {
    runningRef.current = running;
    if (running) {
      reset();
      scoreRef.current(0);
    } else {
      stateRef.current.ended = true;
      stateRef.current.move = 0;
    }
  }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sounds = createSound();
    const s = stateRef.current;
    let raf = 0;
    let last = 0;

    const resize = () => {
      const firstSize = !s.sized;
      const oldGround = s.groundY;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.width = rect.width;
      s.height = rect.height;
      s.groundY = rect.height - 48;
      s.sized = rect.width > 0 && rect.height > 0;
      if (firstSize || s.platforms.length === 0) {
        reset();
      } else if (oldGround > 0) {
        const verticalShift = s.groundY - oldGround;
        s.y += verticalShift;
        for (const platform of s.platforms) platform.y += verticalShift;
        for (const ring of s.rings) ring.y += verticalShift;
      }
    };

    const endRun = () => {
      if (s.ended || s.ending || !runningRef.current) return;
      s.ending = true;
      s.ended = true;
      s.move = 0;
      if (soundOnRef.current) sounds.die();
      try { haptic("error"); } catch { /* ignore */ }
      const finalScore = Math.max(0, Math.floor(s.score));
      window.setTimeout(() => {
        try { gameOverRef.current(finalScore); } catch { /* ignore */ }
      }, 0);
    };

    const keyDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.move = -1;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.move = 1;
      if (e.code === "Space" || e.code === "ArrowUp") s.bounceBoost = 1;
    };
    const keyUp = (e: KeyboardEvent) => {
      if ((e.code === "ArrowLeft" || e.code === "KeyA") && s.move < 0) s.move = 0;
      if ((e.code === "ArrowRight" || e.code === "KeyD") && s.move > 0) s.move = 0;
      if (e.code === "Space" || e.code === "ArrowUp") s.bounceBoost = 0;
    };

    const applyTouchZone = (e: PointerEvent) => {
      if (!runningRef.current || s.ended) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      s.move = px < rect.width * 0.33 ? -1 : px > rect.width * 0.66 ? 1 : 0;
      s.bounceBoost = px >= rect.width * 0.33 && px <= rect.width * 0.66 ? 1 : 0;
    };
    const pointerDown = (e: PointerEvent) => {
      applyTouchZone(e);
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const pointerMove = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) applyTouchZone(e);
    };
    const pointerUp = () => {
      s.move = 0;
      s.bounceBoost = 0;
    };

    const loop = (time: number) => {
      const dt = last ? Math.min(0.033, (time - last) / 1000) : 0.016;
      last = time;

      if (runningRef.current && !s.ended && !s.ending) {
        const gravity = 1180;
        const air = 0.992;
        s.vy += gravity * dt;
        // Gentle auto-forward so play feels continuous; steer to fine-tune
        s.vx += (95 + s.move * 920) * dt;
        s.vx *= air;
        s.vx = Math.max(-280, Math.min(390, s.vx));
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        for (const p of s.platforms) {
          const withinX = s.x + s.r * 0.85 > p.x && s.x - s.r * 0.85 < p.x + p.w;
          const wasAbove = s.y - s.vy * dt <= p.y - s.r + 4;
          if (withinX && wasAbove && s.y + s.r >= p.y && s.y - s.r < p.y + p.h + 6) {
            if (p.type === "spike") {
              // Tiny forgiveness window on spike edges
              const edge = Math.min(s.x - p.x, p.x + p.w - s.x);
              if (edge < 10) {
                s.y = p.y - s.r;
                s.vy = -520;
                continue;
              }
              endRun();
              break;
            }
            s.y = p.y - s.r;
            const bouncePower = p.type === "bounce" ? 820 : 620;
            const boost = s.bounceBoost ? 220 : 40;
            s.vy = -(bouncePower + boost + Math.min(90, Math.abs(s.vx) * 0.12));
            if (soundOnRef.current) sounds.bounce();
            try { haptic("selection"); } catch { /* ignore */ }
          }
        }

        if (s.y - s.r > s.height + 80) endRun();
        if (s.y < -200) s.vy = Math.max(s.vy, 40);

        for (const ring of s.rings) {
          if (ring.taken) continue;
          const d = Math.hypot(s.x - ring.x, s.y - ring.y);
          if (d < s.r + ring.r) {
            ring.taken = true;
            s.ringsGot += 1;
            s.score += 25;
            if (soundOnRef.current) sounds.ring();
            try { haptic("success"); } catch { /* ignore */ }
          }
        }

        s.score = Math.max(s.score, Math.floor(s.x / 10) + s.ringsGot * 25);

        const rounded = Math.floor(s.score);
        if (rounded !== s.lastScore) {
          s.lastScore = rounded;
          scoreRef.current(rounded);
        }

        s.camX += (s.x - s.width * 0.35 - s.camX) * 0.12;
      }

      // Draw
      const sky = ctx.createLinearGradient(0, 0, 0, s.height);
      sky.addColorStop(0, "#0f2a4a");
      sky.addColorStop(0.55, "#1d5f78");
      sky.addColorStop(1, "#f0b35a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.width, s.height);

      ctx.save();
      ctx.translate(-s.camX, 0);

      // distant hills
      ctx.fillStyle = "rgba(20,50,40,.35)";
      for (let i = 0; i < 8; i += 1) {
        const hx = i * 280 + (s.camX * 0.2);
        ctx.beginPath();
        ctx.ellipse(hx, s.height - 20, 160, 70, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of s.platforms) {
        if (p.x + p.w < s.camX - 40 || p.x > s.camX + s.width + 40) continue;
        if (p.type === "spike") {
          ctx.fillStyle = "#3a1c1c";
          ctx.fillRect(p.x, p.y + 8, p.w, p.h);
          ctx.fillStyle = "#ff4d4d";
          const spikes = Math.max(3, Math.floor(p.w / 16));
          for (let i = 0; i < spikes; i += 1) {
            const sx = p.x + (i + 0.5) * (p.w / spikes);
            ctx.beginPath();
            ctx.moveTo(sx - 7, p.y + 10);
            ctx.lineTo(sx, p.y - 10);
            ctx.lineTo(sx + 7, p.y + 10);
            ctx.fill();
          }
        } else if (p.type === "bounce") {
          ctx.fillStyle = "#2f9e44";
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.fillStyle = "#8ce99a";
          ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, 5);
        } else {
          ctx.fillStyle = "#6b3a1e";
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.fillStyle = "#d9480f";
          ctx.fillRect(p.x, p.y, p.w, 5);
        }
      }

      for (const ring of s.rings) {
        if (ring.taken) continue;
        if (ring.x < s.camX - 30 || ring.x > s.camX + s.width + 30) continue;
        ctx.strokeStyle = "#ffd43b";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(ring.x, ring.y, ring.r, ring.r * 0.7, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#fff3bf";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Ball (BBQ meatball)
      const grad = ctx.createRadialGradient(s.x - 5, s.y - 6, 3, s.x, s.y, s.r);
      grad.addColorStop(0, "#ff8787");
      grad.addColorStop(0.55, "#e03131");
      grad.addColorStop(1, "#7f1d1d");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff5f5";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.beginPath();
      ctx.arc(s.x - 4, s.y - 5, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      if (runningRef.current) {
        ctx.fillStyle = "rgba(0,0,0,.4)";
        ctx.fillRect(10, 10, 120, 40);
        ctx.fillStyle = "#ffe8a3";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("SCORE", 18, 25);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px monospace";
        ctx.fillText(String(Math.floor(s.score)), 18, 43);
        ctx.fillStyle = "rgba(0,0,0,.35)";
        ctx.fillRect(s.width - 90, 10, 80, 28);
        ctx.fillStyle = "#ffd43b";
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(`O ${s.ringsGot}`, s.width - 72, 29);
      }

      // Mobile touch zones hint when idle start
      if (runningRef.current && !s.ended && s.x < 140) {
        ctx.fillStyle = "rgba(255,255,255,.12)";
        ctx.fillRect(0, s.height - 70, s.width / 3, 70);
        ctx.fillRect((s.width * 2) / 3, s.height - 70, s.width / 3, 70);
        ctx.fillStyle = "rgba(255,255,255,.5)";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("◀ LEFT", s.width / 6, s.height - 30);
        ctx.fillText("BOUNCE ▲", s.width / 2, s.height - 30);
        ctx.fillText("RIGHT ▶", (s.width * 5) / 6, s.height - 30);
        ctx.textAlign = "left";
      }

      raf = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Meatball Bounce. Tap left or right to steer, center to bounce higher."
      className="block h-full w-full touch-none select-none"
    />
  );
};

export default BounceBall;
