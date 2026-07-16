import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface Props {
  running: boolean;
  soundEnabled: boolean;
  onGameOver: (score: number) => void;
  onScoreChange: (score: number) => void;
}

type Snack = { x: number; y: number; vy: number; kind: number; bad: boolean; spin: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };

const HungryCritters = ({ running, soundEnabled, onGameOver, onScoreChange }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef(onGameOver);
  const scoreRef = useRef(onScoreChange);
  const runningRef = useRef(running);
  const soundRef = useRef(soundEnabled);
  const stateRef = useRef({
    width: 0, height: 0, x: 0, targetX: 0, score: 0, lives: 3, combo: 0,
    snacks: [] as Snack[], sparks: [] as Spark[], lastSpawn: 0, started: 0,
    ended: false, ending: false, dragging: false,
  });

  useEffect(() => { overRef.current = onGameOver; }, [onGameOver]);
  useEffect(() => { scoreRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  useEffect(() => {
    runningRef.current = running;
    const s = stateRef.current;
    if (running) {
      s.x = s.width / 2;
      s.targetX = s.x;
      s.score = 0;
      s.lives = 3;
      s.combo = 0;
      s.snacks = [];
      s.sparks = [];
      s.lastSpawn = 0;
      s.started = performance.now();
      s.ended = false;
      s.ending = false;
      scoreRef.current(0);
    } else {
      s.ended = true;
    }
  }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const s = stateRef.current;
    let raf = 0;
    let last = 0;
    let audio: AudioContext | null = null;

    const tone = (frequency: number, duration = 0.07) => {
      if (!soundRef.current) return;
      try {
        audio ??= new AudioContext();
        if (audio.state === "suspended") void audio.resume();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "triangle";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.035, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + duration);
      } catch { /* audio is optional */ }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const oldW = s.width || rect.width;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.width = rect.width;
      s.height = rect.height;
      s.x = (s.x / oldW) * s.width || s.width / 2;
      s.targetX = s.x;
    };

    const setTarget = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      s.targetX = Math.max(34, Math.min(s.width - 34, event.clientX - rect.left));
    };
    const down = (event: PointerEvent) => {
      s.dragging = true;
      setTarget(event);
      try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    };
    const move = (event: PointerEvent) => { if (s.dragging) setTarget(event); };
    const up = () => { s.dragging = false; };
    const key = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") s.targetX -= 70;
      if (event.code === "ArrowRight" || event.code === "KeyD") s.targetX += 70;
      s.targetX = Math.max(34, Math.min(s.width - 34, s.targetX));
    };

    const end = () => {
      if (s.ending || s.ended || !runningRef.current) return;
      s.ending = true;
      s.ended = true;
      tone(90, 0.3);
      haptic("error");
      setTimeout(() => overRef.current(s.score), 0);
    };

    const burst = (snack: Snack, color: string) => {
      for (let i = 0; i < 9; i += 1) {
        const angle = (i / 9) * Math.PI * 2;
        s.sparks.push({ x: snack.x, y: snack.y, vx: Math.cos(angle) * 85, vy: Math.sin(angle) * 85, life: 0.5, color });
      }
    };

    const loop = (time: number) => {
      const dt = last ? Math.min(0.033, (time - last) / 1000) : 0.016;
      last = time;
      if (runningRef.current && !s.ended) {
        const elapsed = (time - s.started) / 1000;
        s.x += (s.targetX - s.x) * Math.min(1, dt * 14);
        const spawnEvery = Math.max(240, 720 - elapsed * 9);
        if (time - s.lastSpawn > spawnEvery) {
          s.lastSpawn = time;
          const badChance = Math.min(0.38, 0.12 + elapsed * 0.004);
          s.snacks.push({
            x: 28 + Math.random() * Math.max(1, s.width - 56), y: -30,
            vy: 115 + elapsed * 2.5 + Math.random() * 55,
            kind: Math.floor(Math.random() * 4), bad: Math.random() < badChance, spin: Math.random() * Math.PI,
          });
        }
        for (const snack of s.snacks) {
          snack.y += snack.vy * dt;
          snack.spin += dt * 3;
          if (snack.y > s.height - 92 && snack.y < s.height - 30 && Math.abs(snack.x - s.x) < 43) {
            snack.y = s.height + 100;
            if (snack.bad) {
              s.lives -= 1;
              s.combo = 0;
              burst(snack, "#ef4444");
              tone(120, 0.15);
              haptic("error");
              if (s.lives <= 0) end();
            } else {
              s.combo = Math.min(8, s.combo + 1);
              s.score += 8 + s.combo * 2;
              scoreRef.current(s.score);
              burst(snack, "#fbbf24");
              tone(520 + s.combo * 35);
              haptic("success");
            }
          } else if (snack.y > s.height + 35 && !snack.bad) {
            s.combo = 0;
          }
        }
        s.snacks = s.snacks.filter((snack) => snack.y < s.height + 60);
        for (const spark of s.sparks) {
          spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.vy += 120 * dt; spark.life -= dt;
        }
        s.sparks = s.sparks.filter((spark) => spark.life > 0);
      }

      const bg = ctx.createLinearGradient(0, 0, 0, s.height);
      bg.addColorStop(0, "#3b1526"); bg.addColorStop(0.65, "#8b3b22"); bg.addColorStop(1, "#f59e42");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, s.width, s.height);
      ctx.fillStyle = "rgba(255,255,255,.055)";
      for (let y = 75; y < s.height; y += 70) ctx.fillRect(0, y, s.width, 2);

      for (const snack of s.snacks) {
        ctx.save(); ctx.translate(snack.x, snack.y); ctx.rotate(Math.sin(snack.spin) * 0.25);
        if (snack.bad) {
          ctx.fillStyle = "#18181b"; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#ef4444"; ctx.font = "bold 19px sans-serif"; ctx.textAlign = "center"; ctx.fillText("×", 0, 7);
        } else {
          const colors = ["#f97316", "#fbbf24", "#ef4444", "#84cc16"];
          ctx.fillStyle = colors[snack.kind]; ctx.beginPath(); ctx.roundRect(-20, -12, 40, 24, 10); ctx.fill();
          ctx.fillStyle = "#fff3"; ctx.fillRect(-13, -7, 20, 4);
          ctx.fillStyle = "#55200f"; ctx.fillRect(-23, -4, 6, 8); ctx.fillRect(17, -4, 6, 8);
        }
        ctx.restore();
      }
      for (const spark of s.sparks) {
        ctx.globalAlpha = spark.life * 2; ctx.fillStyle = spark.color; ctx.fillRect(spark.x - 2, spark.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;

      const bob = Math.sin(time * 0.012) * 3;
      ctx.save(); ctx.translate(s.x, s.height - 54 + bob);
      ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.ellipse(0, 0, 34, 31, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7c2d12"; ctx.beginPath(); ctx.ellipse(0, 11, 19, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-12, -8, 8, 0, Math.PI * 2); ctx.arc(12, -8, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#292524"; ctx.beginPath(); ctx.arc(-10, -7, 3, 0, Math.PI * 2); ctx.arc(10, -7, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fdba74"; ctx.beginPath(); ctx.moveTo(-22, -24); ctx.lineTo(-10, -42); ctx.lineTo(-4, -27); ctx.moveTo(22, -24); ctx.lineTo(10, -42); ctx.lineTo(4, -27); ctx.fill();
      ctx.restore();

      ctx.fillStyle = "rgba(0,0,0,.38)"; ctx.fillRect(10, 10, 155, 42);
      ctx.fillStyle = "#fff"; ctx.font = "bold 14px monospace"; ctx.fillText(`SCORE ${s.score}`, 18, 36);
      ctx.fillStyle = "#fb7185"; ctx.textAlign = "right"; ctx.fillText("♥".repeat(Math.max(0, s.lives)), s.width - 14, 35);
      if (s.combo > 1) { ctx.fillStyle = "#fde68a"; ctx.font = "bold 12px sans-serif"; ctx.fillText(`COMBO x${s.combo}`, s.width - 14, 54); }
      ctx.textAlign = "left";
      raf = requestAnimationFrame(loop);
    };

    resize();
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); observer.disconnect();
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
    };
  }, []);

  return <canvas ref={canvasRef} aria-label="Hungry Critters. Drag to catch BBQ snacks and avoid burnt food." className="block h-full w-full touch-none select-none" />;
};

export default HungryCritters;
