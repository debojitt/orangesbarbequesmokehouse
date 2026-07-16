import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface Props {
  running: boolean;
  soundEnabled: boolean;
  onGameOver: (score: number) => void;
  onScoreChange: (score: number) => void;
}

type Pillar = { x: number; gapY: number; gapH: number; passed: boolean };
type Ember = { x: number; y: number; vx: number; vy: number; life: number };

const FlyingDrumstick = ({ running, soundEnabled, onGameOver, onScoreChange }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refs = useRef({ running, soundEnabled, onGameOver, onScoreChange });
  const stateRef = useRef({
    width: 0, height: 0, y: 0, vy: 0, score: 0, distance: 0,
    pillars: [] as Pillar[], embers: [] as Ember[], holding: false,
    ended: false, ending: false, lastSpawnX: 0, startedAt: 0,
  });

  useEffect(() => {
    refs.current = { running, soundEnabled, onGameOver, onScoreChange };
  }, [running, soundEnabled, onGameOver, onScoreChange]);

  useEffect(() => {
    refs.current.running = running;
    const s = stateRef.current;
    if (running) {
      s.y = s.height * 0.46;
      s.vy = 0;
      s.score = 0;
      s.distance = 0;
      s.pillars = [];
      s.embers = [];
      s.holding = false;
      s.ended = false;
      s.ending = false;
      s.lastSpawnX = s.width + 150;
      s.startedAt = performance.now();
      refs.current.onScoreChange(0);
    } else {
      s.ended = true;
      s.holding = false;
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

    const tone = (frequency: number, duration = 0.07, type: OscillatorType = "sine") => {
      if (!refs.current.soundEnabled) return;
      try {
        audio ??= new AudioContext();
        if (audio.state === "suspended") void audio.resume();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.035, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start();
        oscillator.stop(audio.currentTime + duration);
      } catch { /* sound is optional */ }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const oldH = s.height || rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.width = rect.width;
      s.height = rect.height;
      s.y = Math.max(50, Math.min(s.height - 70, (s.y / oldH) * s.height || s.height * 0.46));
    };

    const lift = () => {
      if (!refs.current.running || s.ended) return;
      s.vy = Math.min(s.vy, -250);
      tone(430, 0.045, "triangle");
      haptic("selection");
      for (let i = 0; i < 4; i += 1) {
        s.embers.push({
          x: s.width * 0.28 - 20,
          y: s.y + 10,
          vx: -45 - Math.random() * 55,
          vy: (Math.random() - 0.5) * 55,
          life: 0.35,
        });
      }
    };
    const down = (event: PointerEvent) => {
      event.preventDefault();
      s.holding = true;
      lift();
      try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    };
    const up = () => { s.holding = false; };
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        if (!s.holding) lift();
        s.holding = true;
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") s.holding = false;
    };
    const end = () => {
      if (s.ending || s.ended || !refs.current.running) return;
      s.ending = true;
      s.ended = true;
      s.holding = false;
      tone(95, 0.32, "sawtooth");
      haptic("error");
      window.setTimeout(() => refs.current.onGameOver(s.score), 0);
    };

    const loop = (time: number) => {
      const dt = last ? Math.min(0.033, (time - last) / 1000) : 0.016;
      last = time;
      if (refs.current.running && !s.ended) {
        const elapsed = (time - s.startedAt) / 1000;
        const speed = Math.min(245, 132 + elapsed * 2.2);
        const gapH = Math.max(155, Math.min(s.height * 0.34, 230) - elapsed * 0.7);
        const pillarW = Math.max(58, Math.min(78, s.width * 0.18));
        const playerX = s.width * 0.28;
        s.distance += speed * dt;
        s.vy += (s.holding ? 385 : 760) * dt;
        if (s.holding) s.vy -= 720 * dt;
        s.vy = Math.max(-360, Math.min(440, s.vy));
        s.y += s.vy * dt;

        const rightmost = s.pillars.reduce((max, pillar) => Math.max(max, pillar.x), -Infinity);
        const spacing = Math.max(205, Math.min(285, s.width * 0.72));
        if (!s.pillars.length && elapsed > 1.8) {
          s.pillars.push({ x: s.width + 55, gapY: s.height * 0.48, gapH, passed: false });
        } else if (s.pillars.length && rightmost < s.width - spacing) {
          const margin = 80 + gapH / 2;
          const previous = s.pillars[s.pillars.length - 1];
          const desired = margin + Math.random() * Math.max(1, s.height - margin * 2);
          const gapY = Math.max(margin, Math.min(s.height - margin, previous.gapY + Math.max(-100, Math.min(100, desired - previous.gapY))));
          s.pillars.push({ x: s.width + 35, gapY, gapH, passed: false });
        }

        for (const pillar of s.pillars) {
          pillar.x -= speed * dt;
          pillar.gapH = gapH;
          if (!pillar.passed && pillar.x + pillarW < playerX - 18) {
            pillar.passed = true;
            s.score += 10;
            refs.current.onScoreChange(s.score);
            tone(720, 0.08, "triangle");
            haptic("success");
          }
          const overlapsX = playerX + 20 > pillar.x && playerX - 20 < pillar.x + pillarW;
          const hitsPillar = s.y - 16 < pillar.gapY - pillar.gapH / 2 || s.y + 16 > pillar.gapY + pillar.gapH / 2;
          if (overlapsX && hitsPillar) end();
        }
        s.pillars = s.pillars.filter((pillar) => pillar.x > -pillarW - 10);
        if (s.y < 22 || s.y > s.height - 32) end();

        for (const ember of s.embers) {
          ember.x += ember.vx * dt;
          ember.y += ember.vy * dt;
          ember.life -= dt;
        }
        s.embers = s.embers.filter((ember) => ember.life > 0);
      }

      const sky = ctx.createLinearGradient(0, 0, 0, s.height);
      sky.addColorStop(0, "#28114b");
      sky.addColorStop(0.55, "#b54230");
      sky.addColorStop(1, "#ffb552");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s.width, s.height);
      ctx.fillStyle = "rgba(255,225,170,.16)";
      for (let i = 0; i < 7; i += 1) {
        const x = ((i * 137 - s.distance * 0.18) % (s.width + 180)) - 90;
        const y = 75 + (i % 4) * 98;
        ctx.beginPath();
        ctx.ellipse(x, y, 55, 17, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      const pillarW = Math.max(58, Math.min(78, s.width * 0.18));
      for (const pillar of s.pillars) {
        const topH = pillar.gapY - pillar.gapH / 2;
        const bottomY = pillar.gapY + pillar.gapH / 2;
        const drawStack = (x: number, y: number, w: number, h: number, capAtBottom: boolean) => {
          const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
          gradient.addColorStop(0, "#351a19");
          gradient.addColorStop(0.5, "#a34d26");
          gradient.addColorStop(1, "#47201c");
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = "#e39045";
          ctx.lineWidth = 3;
          for (let yy = y + 20; yy < y + h; yy += 35) {
            ctx.beginPath();
            ctx.moveTo(x + 7, yy);
            ctx.lineTo(x + w - 7, yy + 10);
            ctx.stroke();
          }
          const capY = capAtBottom ? y + h - 16 : y;
          ctx.fillStyle = "#cf692f";
          ctx.beginPath();
          ctx.roundRect(x - 6, capY, w + 12, 16, 5);
          ctx.fill();
        };
        drawStack(pillar.x, 0, pillarW, topH, true);
        drawStack(pillar.x, bottomY, pillarW, s.height - bottomY, false);
      }

      for (const ember of s.embers) {
        ctx.globalAlpha = Math.min(1, ember.life * 3);
        ctx.fillStyle = "#ffd166";
        ctx.beginPath();
        ctx.arc(ember.x, ember.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const playerX = s.width * 0.28;
      ctx.save();
      ctx.translate(playerX, s.y);
      ctx.rotate(Math.max(-0.42, Math.min(0.62, s.vy / 620)));
      ctx.fillStyle = "#f7d7a0";
      ctx.beginPath();
      ctx.arc(-17, 10, 9, 0, Math.PI * 2);
      ctx.arc(-25, 10, 7, 0, Math.PI * 2);
      ctx.fill();
      const meat = ctx.createLinearGradient(-12, -18, 24, 18);
      meat.addColorStop(0, "#ffad4d");
      meat.addColorStop(0.55, "#b94722");
      meat.addColorStop(1, "#642116");
      ctx.fillStyle = meat;
      ctx.beginPath();
      ctx.ellipse(6, 0, 28, 19, -0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffd08a";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff8e7";
      ctx.beginPath();
      ctx.arc(13, -5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "rgba(0,0,0,.42)";
      ctx.fillRect(10, 10, 126, 42);
      ctx.fillStyle = "#ffe7a6";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("SKY FRY", 18, 25);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 17px monospace";
      ctx.fillText(String(s.score), 18, 44);
      if (refs.current.running && !s.pillars.length) {
        ctx.fillStyle = "rgba(0,0,0,.36)";
        ctx.beginPath();
        ctx.roundRect(s.width / 2 - 110, s.height * 0.68, 220, 46, 18);
        ctx.fill();
        ctx.fillStyle = "#fff3cf";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("TAP OR HOLD TO FLY", s.width / 2, s.height * 0.68 + 28);
        ctx.textAlign = "left";
      }
      raf = requestAnimationFrame(loop);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener("pointerdown", down, { passive: false });
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  return <canvas ref={canvasRef} aria-label="Sky Fry. Tap or hold to fly through smokehouse pillars." className="block h-full w-full touch-none select-none" />;
};

export default FlyingDrumstick;
