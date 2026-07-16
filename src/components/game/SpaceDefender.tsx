import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface Props {
  running: boolean;
  soundEnabled: boolean;
  onGameOver: (score: number) => void;
  onScoreChange: (score: number) => void;
}

type Shot = { x: number; y: number; vy: number; enemy?: boolean };
type Enemy = { x: number; y: number; alive: boolean; kind: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

const SpaceDefender = ({ running, soundEnabled, onGameOver, onScoreChange }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef(onGameOver);
  const scoreRef = useRef(onScoreChange);
  const soundRef = useRef(soundEnabled);
  const runningRef = useRef(running);
  const stateRef = useRef({
    width: 0, height: 0, shipX: 0, targetX: 0, score: 0, lives: 3, wave: 1,
    shots: [] as Shot[], enemies: [] as Enemy[], enemyDirection: 1, lastShot: 0,
    lastEnemyShot: 0, ended: false, ending: false, pointerDown: false,
    invulnerableUntil: 0, particles: [] as Particle[],
    stars: Array.from({ length: 55 }, (_, i) => ({ x: (i * 83) % 997, y: (i * 47) % 797, speed: 12 + (i % 4) * 9 })),
  });

  useEffect(() => { overRef.current = onGameOver; }, [onGameOver]);
  useEffect(() => { scoreRef.current = onScoreChange; }, [onScoreChange]);
  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);

  const createWave = () => {
    const s = stateRef.current;
    const cols = Math.max(5, Math.min(9, Math.floor(s.width / 48)));
    const spacing = Math.min(48, (s.width - 40) / cols);
    const startX = (s.width - (cols - 1) * spacing) / 2;
    s.enemies = [];
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        s.enemies.push({ x: startX + col * spacing, y: 80 + row * 42, alive: true, kind: row });
      }
    }
    s.enemyDirection = 1;
  };

  const reset = () => {
    const s = stateRef.current;
    s.shipX = s.width / 2;
    s.targetX = s.shipX;
    s.score = 0;
    s.lives = 3;
    s.wave = 1;
    s.shots = [];
    s.ended = false;
    s.ending = false;
    s.lastShot = 0;
    s.lastEnemyShot = 0;
    s.invulnerableUntil = 0;
    s.particles = [];
    createWave();
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

    const tone = (frequency: number, duration = 0.06, volume = 0.025) => {
      if (!soundRef.current) return;
      try {
        audio ??= new AudioContext();
        if (audio.state === "suspended") void audio.resume();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = frequency;
        oscillator.type = "square";
        gain.gain.setValueAtTime(volume, audio.currentTime);
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
      const oldWidth = s.width || rect.width;
      const oldHeight = s.height || rect.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.width = rect.width;
      s.height = rect.height;
      if (!first) {
        const scaleX = s.width / oldWidth;
        const scaleY = s.height / oldHeight;
        s.shipX *= scaleX;
        for (const enemy of s.enemies) {
          enemy.x *= scaleX;
          enemy.y *= scaleY;
        }
        for (const shot of s.shots) {
          shot.x *= scaleX;
          shot.y *= scaleY;
        }
      }
      s.shipX = Math.max(24, Math.min(s.width - 24, first ? s.width / 2 : s.shipX));
      s.targetX = s.shipX;
      if (first || !s.enemies.length) createWave();
    };

    const setTarget = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      s.targetX = Math.max(24, Math.min(s.width - 24, event.clientX - rect.left));
    };
    const pointerDown = (event: PointerEvent) => {
      s.pointerDown = true;
      setTarget(event);
      try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    };
    const pointerMove = (event: PointerEvent) => {
      if (s.pointerDown) setTarget(event);
    };
    const pointerUp = () => { s.pointerDown = false; };
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") s.targetX -= 55;
      if (event.code === "ArrowRight" || event.code === "KeyD") s.targetX += 55;
      s.targetX = Math.max(24, Math.min(s.width - 24, s.targetX));
    };

    const endGame = () => {
      if (s.ending || s.ended || !runningRef.current) return;
      s.ending = true;
      s.ended = true;
      tone(75, 0.35, 0.05);
      haptic("error");
      setTimeout(() => overRef.current(s.score), 0);
    };

    const hitShip = () => {
      if (performance.now() < s.invulnerableUntil) return;
      s.lives -= 1;
      s.invulnerableUntil = performance.now() + 1100;
      tone(110, 0.18, 0.04);
      haptic("error");
      for (let i = 0; i < 18; i += 1) {
        const angle = (i / 18) * Math.PI * 2;
        s.particles.push({ x: s.shipX, y: s.height - 48, vx: Math.cos(angle) * 95, vy: Math.sin(angle) * 95, life: 0.65, color: "#60a5fa" });
      }
      s.shots = s.shots.filter((shot) => !shot.enemy);
      if (s.lives <= 0) endGame();
    };

    const loop = (time: number) => {
      const dt = last ? Math.min(0.033, (time - last) / 1000) : 0.016;
      last = time;
      if (runningRef.current && !s.ended) {
        s.shipX += (s.targetX - s.shipX) * Math.min(1, dt * 13);
        if (time - s.lastShot > Math.max(180, 330 - s.wave * 15)) {
          s.lastShot = time;
          s.shots.push({ x: s.shipX, y: s.height - 62, vy: -520 });
          tone(520);
        }

        const alive = s.enemies.filter((enemy) => enemy.alive);
        if (!alive.length) {
          s.wave += 1;
          s.score += 100;
          scoreRef.current(s.score);
          createWave();
        }

        const enemySpeed = Math.min(82, 18 + s.wave * 5);
        const left = Math.min(...alive.map((enemy) => enemy.x));
        const right = Math.max(...alive.map((enemy) => enemy.x));
        const hitRight = right > s.width - 23 && s.enemyDirection > 0;
        const hitLeft = left < 23 && s.enemyDirection < 0;
        const shouldDrop = hitRight || hitLeft;
        if (hitRight) s.enemyDirection = -1;
        if (hitLeft) s.enemyDirection = 1;
        for (const enemy of alive) {
          enemy.x += s.enemyDirection * enemySpeed * dt;
          if (shouldDrop) enemy.y += 2;
          if (enemy.y > s.height - 115) endGame();
        }

        if (alive.length && time - s.lastEnemyShot > Math.max(480, 1150 - s.wave * 55)) {
          s.lastEnemyShot = time;
          const shooter = alive[Math.floor(Math.random() * alive.length)];
          s.shots.push({ x: shooter.x, y: shooter.y + 15, vy: 230 + s.wave * 12, enemy: true });
        }

        for (const shot of s.shots) shot.y += shot.vy * dt;
        for (const shot of s.shots.filter((item) => !item.enemy)) {
          for (const enemy of alive) {
            if (enemy.alive && Math.abs(shot.x - enemy.x) < 17 && Math.abs(shot.y - enemy.y) < 15) {
              enemy.alive = false;
              shot.y = -999;
              s.score += 10 + (3 - enemy.kind) * 3;
              scoreRef.current(s.score);
              for (let i = 0; i < 8; i += 1) {
                const angle = Math.random() * Math.PI * 2;
                s.particles.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 70, vy: Math.sin(angle) * 70, life: 0.45, color: ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c"][enemy.kind] });
              }
              tone(160, 0.08, 0.035);
              haptic("selection");
              break;
            }
          }
        }
        for (const shot of s.shots.filter((item) => item.enemy)) {
          if (Math.abs(shot.x - s.shipX) < 23 && shot.y > s.height - 82 && shot.y < s.height - 42) {
            shot.y = s.height + 999;
            hitShip();
          }
        }
        s.shots = s.shots.filter((shot) => shot.y > -40 && shot.y < s.height + 40);
        for (const particle of s.particles) {
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          particle.vy += 45 * dt;
          particle.life -= dt;
        }
        s.particles = s.particles.filter((particle) => particle.life > 0);
      }

      const bg = ctx.createLinearGradient(0, 0, 0, s.height);
      bg.addColorStop(0, "#020617");
      bg.addColorStop(1, "#101b3d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, s.width, s.height);
      ctx.fillStyle = "#fff";
      for (const star of s.stars) {
        const x = star.x % Math.max(1, s.width);
        const y = (star.y + time * star.speed * 0.001) % Math.max(1, s.height);
        ctx.globalAlpha = 0.25 + (star.speed % 25) / 50;
        ctx.fillRect(x, y, star.speed > 25 ? 2 : 1, star.speed > 25 ? 2 : 1);
      }
      ctx.globalAlpha = 1;

      for (const enemy of s.enemies) {
        if (!enemy.alive) continue;
        ctx.fillStyle = ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c"][enemy.kind];
        ctx.beginPath();
        ctx.roundRect(enemy.x - 15, enemy.y - 11, 30, 22, 7);
        ctx.fill();
        ctx.fillStyle = "#101b3d";
        ctx.fillRect(enemy.x - 8, enemy.y - 3, 4, 4);
        ctx.fillRect(enemy.x + 4, enemy.y - 3, 4, 4);
      }

      for (const shot of s.shots) {
        ctx.fillStyle = shot.enemy ? "#ff5470" : "#78f6ff";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.fillRect(shot.x - 2, shot.y - 7, 4, 14);
      }
      ctx.shadowBlur = 0;
      for (const particle of s.particles) {
        ctx.globalAlpha = Math.min(1, particle.life * 2);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(s.shipX, s.height - 48);
      if (time < s.invulnerableUntil && Math.floor(time / 80) % 2 === 0) ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#60a5fa";
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(24, 17);
      ctx.lineTo(8, 11);
      ctx.lineTo(0, 20);
      ctx.lineTo(-8, 11);
      ctx.lineTo(-24, 17);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(-6, 17);
      ctx.lineTo(0, 30 + Math.sin(time * 0.025) * 4);
      ctx.lineTo(6, 17);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = "rgba(0,0,0,.38)";
      ctx.fillRect(10, 10, 145, 38);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px monospace";
      ctx.fillText(`SCORE ${s.score}`, 18, 34);
      ctx.fillStyle = "#fb7185";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("♥".repeat(Math.max(0, s.lives)), s.width - 14, 34);
      ctx.textAlign = "left";
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

  return <canvas ref={canvasRef} aria-label="Space Defender. Drag the ship; firing is automatic." className="block h-full w-full touch-none select-none" />;
};

export default SpaceDefender;
