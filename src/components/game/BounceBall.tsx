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
  });

  const buildLevel = (w: number, h: number) => {
    const platforms: Platform[] = [];
    const rings: Ring[] = [];
    const ground = h - 48;
    platforms.push({ x: 0, y: ground, w: 260, h: 48, type: "safe" });

    let x = 280;
    for (let i = 0; i < 42; i += 1) {
      const gap = 70 + (i % 5) * 18;
      const elev = ground - 40 - ((i * 37) % 160);
      const pw = 90 + (i % 4) * 28;
      const kind: Platform["type"] = i % 7 === 3 ? "spike" : i % 5 === 0 ? "bounce" : "safe";
      platforms.push({ x, y: elev, w: pw, h: kind === "spike" ? 18 : 22, type: kind });
      if (kind !== "spike") {
        rings.push({ x: x + pw / 2, y: elev - 42, r: 12, taken: false });
        if (i % 3 === 0) rings.push({ x: x + pw / 2 + 30, y: elev - 90, r: 12, taken: false });
      }
      x += pw + gap;
      if (i % 6 === 5) {
        platforms.push({ x: x - 40, y: elev - 110, w: 70, h: 18, type: "safe" });
        rings.push({ x: x - 5, y: elev - 150, r: 12, taken: false });
      }
    }
    platforms.push({ x, y: ground - 20, w: 220, h: 40, type: "safe" });
    return { platforms, rings, endX: x + 100 };
  };

  const reset = () => {
    const s = stateRef.current;
    const built = buildLevel(Math.max(s.width, 360), Math.max(s.height, 640));
    s.x = 90;
    s.y = Math.max(80, s.height * 0.35);
    s.vx = 120;
    s.vy = 0;
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
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.width = rect.width;
      s.height = rect.height;
      s.groundY = rect.height - 48;
      if (!runningRef.current && s.platforms.length === 0) reset();
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

    const pointerDown = (e: PointerEvent) => {
      if (!runningRef.current || s.ended) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      if (px < rect.width * 0.33) s.move = -1;
      else if (px > rect.width * 0.66) s.move = 1;
      else s.bounceBoost = 1;
    };
    const pointerUp = () => {
      s.move = 0;
      s.bounceBoost = 0;
    };

    const loop = (time: number) => {
      const dt = last ? Math.min(0.033, (time - last) / 1000) : 0.016;
      last = time;

      if (runningRef.current && !s.ended && !s.ending) {
        const gravity = 1450;
        const air = 0.995;
        s.vy += gravity * dt;
        s.vx += s.move * 780 * dt;
        s.vx *= air;
        s.vx = Math.max(-340, Math.min(340, s.vx));
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        let onGround = false;
        for (const p of s.platforms) {
          const withinX = s.x + s.r > p.x && s.x - s.r < p.x + p.w;
          const wasAbove = s.y - s.vy * dt <= p.y - s.r + 2;
          if (withinX && wasAbove && s.y + s.r >= p.y && s.y - s.r < p.y + p.h) {
            if (p.type === "spike") {
              endRun();
              break;
            }
            s.y = p.y - s.r;
            const bouncePower = p.type === "bounce" ? 780 : 560;
            const boost = s.bounceBoost ? 180 : 0;
            s.vy = -(bouncePower + boost + Math.min(120, Math.abs(s.vx) * 0.15));
            onGround = true;
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

        s.score = Math.max(s.score, Math.floor(s.x / 12) + s.ringsGot * 25);
        if (!onGround) {
          /* keep bouncing midair */
        }

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
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("pointerdown", pointerDown);
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
