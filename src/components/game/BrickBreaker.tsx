import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface Props {
  running: boolean;
  soundEnabled: boolean;
  onGameOver: (score: number) => void;
  onScoreChange: (score: number) => void;
}

type Brick = { col: number; row: number; hp: number; maxHp: number };

const BrickBreaker = ({ running, soundEnabled, onGameOver, onScoreChange }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef(onGameOver);
  const scoreRef = useRef(onScoreChange);
  const soundRef = useRef(soundEnabled);
  const runningRef = useRef(running);
  const stateRef = useRef({
    width: 0, height: 0, paddleX: 0, targetX: 0, paddleW: 92,
    ballX: 0, ballY: 0, vx: 190, vy: -270, radius: 9,
    bricks: [] as Brick[], score: 0, lives: 3, level: 1,
    ended: false, ending: false, dragging: false, launched: false,
  });

  useEffect(() => { overRef.current = onGameOver; }, [onGameOver]);
  useEffect(() => { scoreRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  const createBricks = () => {
    const s = stateRef.current;
    const cols = Math.max(6, Math.min(10, Math.floor(s.width / 42)));
    const rows = Math.min(7, 4 + Math.floor(s.level / 2));
    s.bricks = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (s.level > 2 && row === rows - 1 && col % 4 === 1) continue;
        const hp = Math.min(3, 1 + (row < Math.ceil(s.level / 3) ? Math.floor((s.level + 1) / 3) : 0));
        s.bricks.push({ col, row, hp, maxHp: hp });
      }
    }
  };

  const parkBall = () => {
    const s = stateRef.current;
    s.paddleX = Math.max(s.paddleW / 2 + 8, Math.min(s.width - s.paddleW / 2 - 8, s.paddleX || s.width / 2));
    s.targetX = s.paddleX;
    s.ballX = s.paddleX;
    s.ballY = Math.max(120, s.height - 86);
    const speed = Math.min(480, 310 + s.level * 22);
    s.vx = (Math.random() > 0.5 ? 1 : -1) * speed * 0.58;
    s.vy = -speed * 0.82;
    s.launched = false;
  };

  const reset = () => {
    const s = stateRef.current;
    s.score = 0;
    s.lives = 3;
    s.level = 1;
    s.ended = false;
    s.ending = false;
    s.paddleW = Math.max(76, Math.min(112, s.width * 0.25));
    s.paddleX = s.width / 2;
    createBricks();
    parkBall();
    scoreRef.current(0);
  };

  useEffect(() => {
    runningRef.current = running;
    if (running) reset();
    else stateRef.current.ended = true;
  }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    let frame = 0;
    let last = 0;
    let audio: AudioContext | null = null;

    const tone = (frequency: number, duration = 0.055) => {
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
      } catch { /* ignore */ }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const first = s.width === 0;
      const oldW = s.width || rect.width;
      const oldH = s.height || rect.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.width = rect.width;
      s.height = rect.height;
      if (!first) {
        s.paddleX = (s.paddleX / oldW) * s.width;
        s.targetX = s.paddleX;
        s.ballX = (s.ballX / oldW) * s.width;
        s.ballY = (s.ballY / oldH) * s.height;
      } else {
        s.paddleW = Math.max(76, Math.min(112, s.width * 0.25));
        s.paddleX = s.width / 2;
        createBricks();
        parkBall();
      }
    };

    const setTarget = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      s.targetX = Math.max(s.paddleW / 2, Math.min(s.width - s.paddleW / 2, event.clientX - rect.left));
    };
    const pointerDown = (event: PointerEvent) => {
      s.dragging = true;
      setTarget(event);
      s.launched = true;
      try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    };
    const pointerMove = (event: PointerEvent) => {
      if (s.dragging) setTarget(event);
    };
    const pointerUp = () => { s.dragging = false; };
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") s.targetX -= 70;
      if (event.code === "ArrowRight" || event.code === "KeyD") s.targetX += 70;
      if (event.code === "Space") s.launched = true;
      s.targetX = Math.max(s.paddleW / 2, Math.min(s.width - s.paddleW / 2, s.targetX));
    };

    const endGame = () => {
      if (s.ending || s.ended || !runningRef.current) return;
      s.ending = true;
      s.ended = true;
      tone(80, 0.3);
      haptic("error");
      setTimeout(() => overRef.current(s.score), 0);
    };

    const loop = (time: number) => {
      const dt = last ? Math.min(0.026, (time - last) / 1000) : 0.016;
      last = time;
      const paddleY = s.height - 45;
      const cols = Math.max(6, Math.min(10, Math.floor(s.width / 42)));
      const gap = 5;
      const brickW = (s.width - 24 - gap * (cols - 1)) / cols;
      const brickH = Math.max(18, Math.min(25, s.height * 0.035));

      if (runningRef.current && !s.ended) {
        s.paddleX += (s.targetX - s.paddleX) * Math.min(1, dt * 18);
        if (!s.launched) {
          s.ballX = s.paddleX;
          s.ballY = paddleY - 19;
        } else {
          s.ballX += s.vx * dt;
          s.ballY += s.vy * dt;
          if (s.ballX - s.radius <= 0 && s.vx < 0) { s.ballX = s.radius; s.vx *= -1; tone(260); }
          if (s.ballX + s.radius >= s.width && s.vx > 0) { s.ballX = s.width - s.radius; s.vx *= -1; tone(260); }
          if (s.ballY - s.radius <= 0 && s.vy < 0) { s.ballY = s.radius; s.vy *= -1; tone(320); }

          if (
            s.vy > 0 &&
            s.ballY + s.radius >= paddleY &&
            s.ballY - s.radius <= paddleY + 16 &&
            Math.abs(s.ballX - s.paddleX) <= s.paddleW / 2 + s.radius
          ) {
            s.ballY = paddleY - s.radius;
            const offset = (s.ballX - s.paddleX) / (s.paddleW / 2);
            const speed = Math.min(510, Math.hypot(s.vx, s.vy) * 1.015);
            s.vx = speed * offset * 0.9;
            s.vy = -Math.sqrt(Math.max(speed * speed * 0.55, speed * speed - s.vx * s.vx));
            tone(390);
            haptic("selection");
          }

          for (const brick of s.bricks) {
            if (brick.hp <= 0) continue;
            const x = 12 + brick.col * (brickW + gap);
            const y = 72 + brick.row * (brickH + gap);
            if (
              s.ballX + s.radius > x && s.ballX - s.radius < x + brickW &&
              s.ballY + s.radius > y && s.ballY - s.radius < y + brickH
            ) {
              const fromSide = Math.min(Math.abs(s.ballX - x), Math.abs(s.ballX - (x + brickW))) <
                Math.min(Math.abs(s.ballY - y), Math.abs(s.ballY - (y + brickH)));
              if (fromSide) s.vx *= -1;
              else s.vy *= -1;
              brick.hp -= 1;
              s.score += brick.hp <= 0 ? 10 : 3;
              scoreRef.current(s.score);
              tone(brick.hp <= 0 ? 620 : 470);
              break;
            }
          }

          if (s.ballY - s.radius > s.height) {
            s.lives -= 1;
            tone(100, 0.18);
            haptic("error");
            if (s.lives <= 0) endGame();
            else parkBall();
          }

          if (s.bricks.every((brick) => brick.hp <= 0)) {
            s.level += 1;
            s.score += 100;
            if (s.level % 4 === 0) s.lives = Math.min(5, s.lives + 1);
            scoreRef.current(s.score);
            s.paddleW = Math.max(62, s.paddleW - 5);
            createBricks();
            parkBall();
            haptic("success");
          }
        }
      }

      const bg = ctx.createLinearGradient(0, 0, 0, s.height);
      bg.addColorStop(0, "#111827");
      bg.addColorStop(1, "#3b1a32");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, s.width, s.height);

      const colors = ["#fb7185", "#fb923c", "#facc15", "#4ade80", "#38bdf8", "#a78bfa", "#f472b6"];
      for (const brick of s.bricks) {
        if (brick.hp <= 0) continue;
        const x = 12 + brick.col * (brickW + gap);
        const y = 72 + brick.row * (brickH + gap);
        ctx.fillStyle = colors[brick.row % colors.length];
        ctx.globalAlpha = brick.hp > 1 ? 1 : 0.82;
        ctx.beginPath();
        ctx.roundRect(x, y, brickW, brickH, 5);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.3)";
        ctx.fillRect(x + 4, y + 3, brickW - 8, 3);
        if (brick.maxHp > 1) {
          ctx.fillStyle = "rgba(17,24,39,.7)";
          ctx.font = `bold ${Math.max(10, brickH * 0.55)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(brick.hp), x + brickW / 2, y + brickH / 2 + 1);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        }
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = "#f8fafc";
      ctx.shadowColor = "#60a5fa";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(s.ballX, s.ballY, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      const paddleGradient = ctx.createLinearGradient(s.paddleX - s.paddleW / 2, 0, s.paddleX + s.paddleW / 2, 0);
      paddleGradient.addColorStop(0, "#f97316");
      paddleGradient.addColorStop(0.5, "#fde68a");
      paddleGradient.addColorStop(1, "#ef4444");
      ctx.fillStyle = paddleGradient;
      ctx.beginPath();
      ctx.roundRect(s.paddleX - s.paddleW / 2, paddleY, s.paddleW, 16, 8);
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,.4)";
      ctx.fillRect(10, 10, 170, 38);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 13px monospace";
      ctx.fillText(`SCORE ${s.score}  LV ${s.level}`, 18, 34);
      ctx.fillStyle = "#fb7185";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("♥".repeat(Math.max(0, s.lives)), s.width - 14, 34);
      ctx.textAlign = "left";
      if (!s.launched && runningRef.current) {
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("DRAG PADDLE • TAP TO LAUNCH", s.width / 2, s.height - 78);
        ctx.textAlign = "left";
      }
      frame = requestAnimationFrame(loop);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);
    window.addEventListener("keydown", keyDown);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("keydown", keyDown);
    };
  }, []);

  return <canvas ref={canvasRef} aria-label="Brick Breaker. Drag the paddle and tap to launch." className="block h-full w-full touch-none select-none" />;
};

export default BrickBreaker;
