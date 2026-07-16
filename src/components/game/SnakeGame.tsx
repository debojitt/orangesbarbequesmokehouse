import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface Props {
  running: boolean;
  soundEnabled: boolean;
  onGameOver: (score: number) => void;
  onScoreChange: (score: number) => void;
}

type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";

const COLS = 18;
const ROWS = 24;

const SnakeGame = ({ running, soundEnabled, onGameOver, onScoreChange }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef(onGameOver);
  const scoreRef = useRef(onScoreChange);
  const soundRef = useRef(soundEnabled);
  const runningRef = useRef(running);
  const stateRef = useRef({
    width: 0,
    height: 0,
    snake: [] as Point[],
    food: { x: 13, y: 12 },
    dir: "right" as Direction,
    queued: "right" as Direction,
    turnQueue: [] as Direction[],
    score: 0,
    lastStep: 0,
    foodBorn: 0,
    combo: 0,
    ended: false,
    ending: false,
    touchX: 0,
    touchY: 0,
  });

  useEffect(() => { overRef.current = onGameOver; }, [onGameOver]);
  useEffect(() => { scoreRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  const reset = () => {
    const s = stateRef.current;
    s.snake = [{ x: 8, y: 13 }, { x: 7, y: 13 }, { x: 6, y: 13 }];
    s.food = { x: 13, y: 12 };
    s.dir = "right";
    s.queued = "right";
    s.turnQueue = [];
    s.score = 0;
    s.lastStep = 0;
    s.foodBorn = performance.now();
    s.combo = 0;
    s.ended = false;
    s.ending = false;
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
    let audio: AudioContext | null = null;

    const tone = (freq: number, duration = 0.08) => {
      if (!soundRef.current) return;
      try {
        audio ??= new AudioContext();
        if (audio.state === "suspended") void audio.resume();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = freq;
        oscillator.type = "square";
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
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.width = rect.width;
      s.height = rect.height;
    };

    const setDirection = (next: Direction) => {
      const current = s.turnQueue[s.turnQueue.length - 1] ?? s.dir;
      const opposite =
        (current === "up" && next === "down") ||
        (current === "down" && next === "up") ||
        (current === "left" && next === "right") ||
        (current === "right" && next === "left");
      if (!opposite && next !== current && s.turnQueue.length < 2) {
        s.turnQueue.push(next);
        s.queued = next;
      }
    };

    const keyDown = (event: KeyboardEvent) => {
      const map: Record<string, Direction | undefined> = {
        ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
        ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      };
      const direction = map[event.code];
      if (direction) {
        event.preventDefault();
        setDirection(direction);
      }
    };

    const pointerDown = (event: PointerEvent) => {
      s.touchX = event.clientX;
      s.touchY = event.clientY;
      try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    };
    const pointerUp = (event: PointerEvent) => {
      const dx = event.clientX - s.touchX;
      const dy = event.clientY - s.touchY;
      if (Math.hypot(dx, dy) > 20) {
        setDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
      } else {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        if (y > rect.height - 105) {
          if (x < rect.width / 3) setDirection("left");
          else if (x > rect.width * 2 / 3) setDirection("right");
          else setDirection(y < rect.height - 50 ? "up" : "down");
        }
      }
    };

    const spawnFood = () => {
      const free: Point[] = [];
      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
          if (!s.snake.some((part) => part.x === x && part.y === y)) free.push({ x, y });
        }
      }
      if (free.length) s.food = free[Math.floor(Math.random() * free.length)];
      s.foodBorn = performance.now();
    };

    const endGame = () => {
      if (s.ending || s.ended || !runningRef.current) return;
      s.ending = true;
      s.ended = true;
      tone(90, 0.3);
      haptic("error");
      const finalScore = s.score;
      setTimeout(() => overRef.current(finalScore), 0);
    };

    const step = () => {
      s.dir = s.turnQueue.shift() ?? s.dir;
      s.queued = s.turnQueue[s.turnQueue.length - 1] ?? s.dir;
      const head = { ...s.snake[0] };
      if (s.dir === "up") head.y -= 1;
      if (s.dir === "down") head.y += 1;
      if (s.dir === "left") head.x -= 1;
      if (s.dir === "right") head.x += 1;
      if (
        head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
        s.snake.some((part) => part.x === head.x && part.y === head.y)
      ) {
        endGame();
        return;
      }
      s.snake.unshift(head);
      if (head.x === s.food.x && head.y === s.food.y) {
        const age = performance.now() - s.foodBorn;
        s.combo = age < 4200 ? Math.min(5, s.combo + 1) : 0;
        s.score += 10 + s.combo * 2;
        scoreRef.current(s.score);
        tone(620);
        haptic("success");
        spawnFood();
      } else {
        s.snake.pop();
      }
    };

    const draw = (time: number) => {
      if (runningRef.current && !s.ended) {
        const interval = Math.max(62, 185 - s.snake.length * 3.1);
        if (!s.lastStep || time - s.lastStep >= interval) {
          s.lastStep = s.lastStep ? s.lastStep + interval : time;
          step();
        }
      }

      const controlH = Math.min(110, s.height * 0.18);
      const cell = Math.max(8, Math.min((s.width - 20) / COLS, (s.height - controlH - 20) / ROWS));
      const boardW = cell * COLS;
      const boardH = cell * ROWS;
      const ox = (s.width - boardW) / 2;
      const oy = Math.max(8, (s.height - controlH - boardH) / 2);

      const bg = ctx.createLinearGradient(0, 0, 0, s.height);
      bg.addColorStop(0, "#a9c783");
      bg.addColorStop(1, "#78955e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, s.width, s.height);
      ctx.fillStyle = "rgba(25,43,24,.08)";
      for (let x = 0; x <= COLS; x += 1) ctx.fillRect(ox + x * cell, oy, 1, boardH);
      for (let y = 0; y <= ROWS; y += 1) ctx.fillRect(ox, oy + y * cell, boardW, 1);

      const pulse = 0.88 + Math.sin(time * 0.012) * 0.12;
      ctx.fillStyle = "#273d23";
      ctx.shadowColor = "#d9ef9c";
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(ox + (s.food.x + 0.5) * cell, oy + (s.food.y + 0.5) * cell, cell * 0.32 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      s.snake.forEach((part, index) => {
        const gradient = ctx.createLinearGradient(0, oy, 0, oy + boardH);
        gradient.addColorStop(0, "#20391e");
        gradient.addColorStop(1, "#385631");
        ctx.fillStyle = index === 0 ? "#172d18" : gradient;
        const pad = Math.max(1, cell * 0.08);
        ctx.beginPath();
        ctx.roundRect(ox + part.x * cell + pad, oy + part.y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.24);
        ctx.fill();
        if (index === 0) {
          ctx.fillStyle = "#b9d38d";
          const eyeY = oy + part.y * cell + cell * 0.32;
          ctx.fillRect(ox + part.x * cell + cell * 0.25, eyeY, Math.max(1.5, cell * 0.1), Math.max(1.5, cell * 0.1));
          ctx.fillRect(ox + part.x * cell + cell * 0.65, eyeY, Math.max(1.5, cell * 0.1), Math.max(1.5, cell * 0.1));
        }
      });

      const cy = s.height - controlH / 2;
      const buttonR = Math.min(31, controlH * 0.32);
      ctx.fillStyle = "rgba(255,255,255,.1)";
      [[s.width / 6, cy, "◀"], [s.width / 2, cy - buttonR * 0.6, "▲"], [s.width / 2, cy + buttonR * 0.9, "▼"], [s.width * 5 / 6, cy, "▶"]].forEach(([x, y, label]) => {
        ctx.beginPath();
        ctx.arc(x as number, y as number, buttonR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.7)";
        ctx.font = `bold ${buttonR * 0.7}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label as string, x as number, y as number);
        ctx.fillStyle = "rgba(255,255,255,.1)";
      });
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      frame = requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("keydown", keyDown);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointerup", pointerUp);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", keyDown);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
    };
  }, []);

  return <canvas ref={canvasRef} aria-label="Snake. Swipe or use arrows to steer." className="block h-full w-full touch-none select-none" />;
};

export default SnakeGame;
