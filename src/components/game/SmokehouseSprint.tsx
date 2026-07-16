import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

type ObstacleType = "flame" | "crate" | "tray" | "coin";

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  type: ObstacleType;
  collected?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface Props {
  running: boolean;
  soundEnabled: boolean;
  onGameOver: (score: number) => void;
  onScoreChange: (score: number) => void;
  onLevelChange?: (level: number) => void;
}

const createSound = () => {
  let audio: AudioContext | null = null;
  const context = () => {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    return audio;
  };
  const tone = (frequency: number, duration: number, type: OscillatorType, volume = 0.05, delay = 0) => {
    const ac = context();
    const oscillator = ac.createOscillator();
    const gain = ac.createGain();
    const start = ac.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ac.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  };
  return {
    jump: () => tone(260, 0.14, "square", 0.035),
    coin: () => {
      tone(740, 0.08, "sine", 0.05);
      tone(1040, 0.12, "sine", 0.04, 0.07);
    },
    crash: () => {
      tone(150, 0.25, "sawtooth", 0.06);
      tone(80, 0.34, "square", 0.04, 0.08);
    },
    level: () => {
      tone(440, 0.08, "triangle", 0.04);
      tone(560, 0.08, "triangle", 0.04, 0.08);
      tone(720, 0.14, "triangle", 0.04, 0.16);
    },
  };
};

const SmokehouseSprint = ({
  running,
  soundEnabled,
  onGameOver,
  onScoreChange,
  onLevelChange,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameOverRef = useRef(onGameOver);
  const scoreRef = useRef(onScoreChange);
  const levelRef = useRef(onLevelChange);
  const soundRef = useRef(soundEnabled);
  const runningRef = useRef(running);

  useEffect(() => { gameOverRef.current = onGameOver; }, [onGameOver]);
  useEffect(() => { scoreRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { levelRef.current = onLevelChange; }, [onLevelChange]);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  const stateRef = useRef({
    active: false,
    width: 0,
    height: 0,
    ground: 0,
    playerY: 0,
    vy: 0,
    ducking: false,
    score: 0,
    level: 1,
    speed: 330,
    distance: 0,
    spawnDistance: 420,
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    lastTime: 0,
    lastScoreSent: -1,
    shake: 0,
  });

  useEffect(() => {
    runningRef.current = running;
    const state = stateRef.current;
    if (running) {
      state.active = true;
      state.score = 0;
      state.level = 1;
      state.speed = 330;
      state.distance = 0;
      state.spawnDistance = 460;
      state.obstacles = [];
      state.particles = [];
      state.vy = 0;
      state.ducking = false;
      state.lastTime = 0;
      state.lastScoreSent = -1;
      levelRef.current?.(1);
    } else {
      state.active = false;
    }
  }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sounds = createSound();
    const state = stateRef.current;
    let frame = 0;
    let touchY = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.width = rect.width;
      state.height = rect.height;
      state.ground = rect.height - Math.max(54, rect.height * 0.14);
      if (!state.active || state.playerY === 0) state.playerY = state.ground;
    };

    const jump = () => {
      if (!state.active) return;
      if (state.playerY >= state.ground - 2) {
        state.vy = -Math.min(830, 690 + state.level * 8);
        state.ducking = false;
        if (soundRef.current) sounds.jump();
        haptic("selection");
      }
    };

    const setDuck = (value: boolean) => {
      if (!state.active) return;
      state.ducking = value && state.playerY >= state.ground - 4;
    };

    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
        event.preventDefault();
        jump();
      }
      if (event.code === "ArrowDown" || event.code === "KeyS") {
        event.preventDefault();
        setDuck(true);
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "ArrowDown" || event.code === "KeyS") setDuck(false);
    };
    const pointerDown = (event: PointerEvent) => {
      touchY = event.clientY;
      if (event.pointerType === "mouse") jump();
    };
    const pointerUp = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        if (event.clientY - touchY > 32) setDuck(true);
        else jump();
        window.setTimeout(() => setDuck(false), 420);
      }
    };

    const addDust = (x: number, y: number, count: number, color = "#f4a261") => {
      for (let i = 0; i < count; i += 1) {
        state.particles.push({
          x,
          y,
          vx: -40 - Math.random() * 100,
          vy: -20 - Math.random() * 70,
          life: 0.35 + Math.random() * 0.35,
          color,
          size: 2 + Math.random() * 5,
        });
      }
    };

    const spawn = () => {
      const x = state.width + 50;
      const chance = Math.random();
      if (chance < 0.27) {
        const count = 2 + Math.min(3, Math.floor(state.level / 3));
        for (let i = 0; i < count; i += 1) {
          state.obstacles.push({
            x: x + i * 38,
            y: state.ground - 78 - Math.sin(i * 0.9) * 34,
            w: 24,
            h: 24,
            type: "coin",
          });
        }
      } else if (chance < 0.55) {
        state.obstacles.push({ x, y: state.ground - 42, w: 36, h: 42, type: "flame" });
      } else if (chance < 0.8) {
        state.obstacles.push({ x, y: state.ground - 48, w: 52, h: 48, type: "crate" });
      } else {
        state.obstacles.push({ x, y: state.ground - 88, w: 62, h: 26, type: "tray" });
      }
      const minimumGap = Math.max(275, 430 - state.level * 14);
      state.spawnDistance = minimumGap + Math.random() * 240;
    };

    const roundedRect = (x: number, y: number, w: number, h: number, radius: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
    };

    const drawBackground = (time: number) => {
      const { width, height, ground, distance } = state;
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#281146");
      sky.addColorStop(0.52, "#b63b37");
      sky.addColorStop(1, "#ffb347");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(width * 0.78, height * 0.2, 5, width * 0.78, height * 0.2, 100);
      glow.addColorStop(0, "rgba(255,240,170,.95)");
      glow.addColorStop(1, "rgba(255,150,60,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#ffd36a";
      ctx.beginPath();
      ctx.arc(width * 0.78, height * 0.2, 27, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,.65)";
      for (let i = 0; i < 18; i += 1) {
        const x = (i * 137 + 31) % Math.max(width, 1);
        const y = 18 + ((i * 67) % Math.max(40, ground * 0.48));
        const sparkle = 1.2 + Math.sin(time * 0.002 + i) * 0.7;
        ctx.beginPath();
        ctx.arc(x, y, sparkle, 0, Math.PI * 2);
        ctx.fill();
      }

      const ridge = (base: number, color: string, rate: number, size: number) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, ground);
        for (let x = -size; x <= width + size; x += size) {
          const shifted = x - ((distance * rate) % size);
          ctx.lineTo(shifted, base - Math.abs(Math.sin((x + 30) * 0.018)) * size * 0.55);
        }
        ctx.lineTo(width, ground);
        ctx.closePath();
        ctx.fill();
      };
      ridge(ground - 44, "rgba(76,24,62,.42)", 0.08, 100);
      ridge(ground - 20, "rgba(69,30,31,.68)", 0.18, 72);

      const cityOffset = (distance * 0.28) % 90;
      ctx.fillStyle = "#3b1c28";
      for (let x = -cityOffset - 30; x < width + 60; x += 90) {
        const buildingH = 45 + ((Math.floor((x + cityOffset) / 90) * 23) % 42);
        ctx.fillRect(x, ground - buildingH, 58, buildingH);
        ctx.fillStyle = "rgba(255,194,92,.7)";
        for (let wy = ground - buildingH + 12; wy < ground - 10; wy += 18) {
          ctx.fillRect(x + 10, wy, 7, 7);
          ctx.fillRect(x + 34, wy, 7, 7);
        }
        ctx.fillStyle = "#3b1c28";
      }

      ctx.fillStyle = "#2b1517";
      ctx.fillRect(0, ground, width, height - ground);
      ctx.fillStyle = "#e97035";
      ctx.fillRect(0, ground, width, 7);
      ctx.fillStyle = "rgba(255,181,79,.26)";
      const tileOffset = distance % 48;
      for (let x = -tileOffset; x < width + 48; x += 48) {
        ctx.fillRect(x, ground + 18, 30, 4);
        ctx.fillRect(x + 18, ground + 40, 30, 3);
      }
    };

    const drawChef = (time: number) => {
      const x = Math.max(68, state.width * 0.16);
      const duck = state.ducking;
      const h = duck ? 38 : 66;
      const y = state.playerY - h;
      const stride = state.active && state.playerY >= state.ground - 2 ? Math.sin(time * 0.018 * (state.speed / 330)) : 0;
      ctx.save();
      ctx.translate(x, y);
      ctx.shadowColor = "rgba(0,0,0,.3)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.beginPath();
      ctx.ellipse(24, h + 5, duck ? 30 : 23, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#ff742c";
      roundedRect(8, duck ? 13 : 24, duck ? 48 : 34, duck ? 24 : 36, 9);
      ctx.fill();
      ctx.fillStyle = "#fff3d6";
      roundedRect(16, duck ? 18 : 29, duck ? 30 : 20, duck ? 17 : 29, 6);
      ctx.fill();
      ctx.fillStyle = "#5b1c19";
      ctx.fillRect(14, duck ? 34 : 48, duck ? 36 : 25, 6);

      ctx.fillStyle = "#8a391f";
      if (!duck) {
        ctx.save();
        ctx.translate(14, 59);
        ctx.rotate(stride * 0.3);
        ctx.fillRect(-2, 0, 9, 12);
        ctx.restore();
        ctx.save();
        ctx.translate(38, 59);
        ctx.rotate(-stride * 0.3);
        ctx.fillRect(-7, 0, 9, 12);
        ctx.restore();
      }

      ctx.fillStyle = "#cf7444";
      ctx.beginPath();
      ctx.arc(25, duck ? 10 : 20, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#542016";
      ctx.beginPath();
      ctx.arc(32, duck ? 12 : 21, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#542016";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(29, duck ? 16 : 25, 5, 0.1, 1.8);
      ctx.stroke();

      ctx.fillStyle = "#fffaf0";
      ctx.fillRect(11, duck ? -2 : 7, 28, 8);
      ctx.beginPath();
      ctx.arc(17, duck ? -2 : 7, 9, Math.PI, 0);
      ctx.arc(25, duck ? -5 : 4, 11, Math.PI, 0);
      ctx.arc(34, duck ? -2 : 7, 9, Math.PI, 0);
      ctx.fill();
      ctx.restore();
      return { x: x + 9, y, w: duck ? 49 : 35, h };
    };

    const drawObstacle = (item: Obstacle, time: number) => {
      ctx.save();
      if (item.type === "coin") {
        const squash = 0.35 + Math.abs(Math.sin(time * 0.007 + item.x * 0.02)) * 0.65;
        ctx.translate(item.x + item.w / 2, item.y + item.h / 2);
        ctx.scale(squash, 1);
        ctx.shadowColor = "#ffd75f";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#ffc83d";
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff1a8";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#9a4a10";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("₹", 0, 1);
      } else if (item.type === "flame") {
        const flicker = Math.sin(time * 0.018 + item.x) * 4;
        const gradient = ctx.createLinearGradient(0, item.y, 0, item.y + item.h);
        gradient.addColorStop(0, "#fff07b");
        gradient.addColorStop(0.45, "#ff7a21");
        gradient.addColorStop(1, "#d52b20");
        ctx.fillStyle = gradient;
        ctx.shadowColor = "#ff6a22";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(item.x + 18, item.y + item.h);
        ctx.bezierCurveTo(item.x - 2, item.y + 25, item.x + 14 + flicker, item.y + 18, item.x + 17, item.y);
        ctx.bezierCurveTo(item.x + 35, item.y + 16, item.x + 42, item.y + 29, item.x + 18, item.y + item.h);
        ctx.fill();
      } else if (item.type === "crate") {
        ctx.fillStyle = "#8b3f20";
        roundedRect(item.x, item.y, item.w, item.h, 5);
        ctx.fill();
        ctx.strokeStyle = "#e89244";
        ctx.lineWidth = 4;
        ctx.strokeRect(item.x + 4, item.y + 4, item.w - 8, item.h - 8);
        ctx.beginPath();
        ctx.moveTo(item.x + 7, item.y + 7);
        ctx.lineTo(item.x + item.w - 7, item.y + item.h - 7);
        ctx.moveTo(item.x + item.w - 7, item.y + 7);
        ctx.lineTo(item.x + 7, item.y + item.h - 7);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#b9c1ca";
        roundedRect(item.x, item.y, item.w, item.h, 10);
        ctx.fill();
        ctx.fillStyle = "#4d2020";
        ctx.fillRect(item.x + 8, item.y + item.h - 4, item.w - 16, 8);
        ctx.fillStyle = "#ff9b39";
        ctx.beginPath();
        ctx.ellipse(item.x + item.w / 2, item.y + 7, 20, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.45)";
        for (let i = 0; i < 3; i += 1) {
          ctx.beginPath();
          ctx.arc(item.x + 16 + i * 15, item.y - 5 - Math.sin(time * 0.004 + i) * 5, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    };

    const intersects = (a: { x: number; y: number; w: number; h: number }, b: Obstacle) => {
      const pad = b.type === "coin" ? 0 : 5;
      return a.x + a.w - 5 > b.x + pad &&
        a.x + 5 < b.x + b.w - pad &&
        a.y + a.h - 3 > b.y + pad &&
        a.y + 3 < b.y + b.h - pad;
    };

    const loop = (time: number) => {
      const dt = state.lastTime ? Math.min((time - state.lastTime) / 1000, 0.034) : 0;
      state.lastTime = time;
      if (state.active && runningRef.current) {
        state.speed = Math.min(720, 330 + state.score * 1.45);
        const newLevel = Math.min(10, 1 + Math.floor(state.score / 120));
        if (newLevel !== state.level) {
          state.level = newLevel;
          levelRef.current?.(newLevel);
          if (soundRef.current) sounds.level();
        }
        state.distance += state.speed * dt;
        state.score += dt * (12 + state.level * 0.7);
        state.spawnDistance -= state.speed * dt;
        if (state.spawnDistance <= 0) spawn();

        state.vy += 1900 * dt;
        state.playerY += state.vy * dt;
        if (state.playerY >= state.ground) {
          if (state.vy > 250) addDust(Math.max(80, state.width * 0.16), state.ground, 4);
          state.playerY = state.ground;
          state.vy = 0;
        }

        for (const item of state.obstacles) item.x -= state.speed * dt;
        const player = drawChef(time);
        for (const item of state.obstacles) {
          if (!item.collected && intersects(player, item)) {
            if (item.type === "coin") {
              item.collected = true;
              state.score += 20;
              addDust(item.x + 12, item.y + 12, 9, "#ffd85a");
              if (soundRef.current) sounds.coin();
              haptic("success");
            } else {
              state.active = false;
              state.shake = 0.4;
              addDust(player.x + player.w, player.y + player.h / 2, 16, "#ff6138");
              if (soundRef.current) sounds.crash();
              haptic("error");
              gameOverRef.current(Math.floor(state.score));
              break;
            }
          }
        }
        state.obstacles = state.obstacles.filter((item) => !item.collected && item.x > -100);
        const roundedScore = Math.floor(state.score);
        if (roundedScore !== state.lastScoreSent) {
          state.lastScoreSent = roundedScore;
          scoreRef.current(roundedScore);
        }
      }

      state.particles = state.particles.filter((particle) => {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 210 * dt;
        return particle.life > 0;
      });
      state.shake = Math.max(0, state.shake - dt);

      ctx.save();
      if (state.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6);
      drawBackground(time);
      for (const item of state.obstacles) drawObstacle(item, time);
      drawChef(time);
      for (const particle of state.particles) {
        ctx.globalAlpha = Math.min(1, particle.life * 2.5);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      frame = requestAnimationFrame(loop);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointerup", pointerUp);
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Smokehouse Sprint game. Press space or up to jump, down to duck."
      className="block h-full w-full touch-none select-none"
    />
  );
};

export default SmokehouseSprint;
