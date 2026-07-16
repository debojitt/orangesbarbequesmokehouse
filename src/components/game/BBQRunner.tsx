import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

export interface BBQRunnerHandle {
  start: () => void;
  stop: () => void;
}

interface Props {
  onGameOver: (score: number) => void;
  onScoreChange: (score: number) => void;
  running: boolean;
}

/**
 * BBQ Runner — Chrome-dino-inspired side scroller.
 * Character: a running chef. Obstacles: fire, chilli, low grills.
 * Collectibles: coins. Difficulty ramps with score.
 * Controls: tap / space / up = jump; swipe-down / down-arrow = duck.
 */
const BBQRunner: React.FC<Props> = ({ onGameOver, onScoreChange, running }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    running: false,
    score: 0,
    vy: 0,
    y: 0,          // relative to ground
    ducking: false,
    obstacles: [] as { x: number; type: "fire" | "chilli" | "grill" | "coin"; w: number; h: number; yOff: number }[],
    spawnTimer: 0,
    speed: 6,
    lastT: 0,
    ground: 0,
    width: 0,
    height: 0,
    tick: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = stateRef.current;
      s.width = rect.width;
      s.height = rect.height;
      s.ground = rect.height - 42;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const s = stateRef.current;

    const jump = () => {
      if (!s.running) return;
      if (s.y <= 0.1) {
        s.vy = -13.5;
        haptic("selection");
      }
    };
    const duck = (d: boolean) => {
      s.ducking = d;
    };

    const keyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); jump(); }
      if (e.code === "ArrowDown") { e.preventDefault(); duck(true); }
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowDown") duck(false);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    let touchStartY = 0;
    const touchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      jump();
    };
    const touchMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - touchStartY;
      if (dy > 40) duck(true);
    };
    const touchEnd = () => duck(false);
    canvas.addEventListener("touchstart", touchStart, { passive: true });
    canvas.addEventListener("touchmove", touchMove, { passive: true });
    canvas.addEventListener("touchend", touchEnd);
    canvas.addEventListener("mousedown", jump);

    const spawn = () => {
      const s2 = stateRef.current;
      const r = Math.random();
      if (r < 0.15) {
        // coin (floating)
        s2.obstacles.push({ x: s2.width + 20, type: "coin", w: 20, h: 20, yOff: 60 + Math.random() * 40 });
      } else if (r < 0.55) {
        s2.obstacles.push({ x: s2.width + 20, type: "fire", w: 22, h: 32, yOff: 0 });
      } else if (r < 0.8) {
        s2.obstacles.push({ x: s2.width + 20, type: "chilli", w: 18, h: 22, yOff: 0 });
      } else {
        // low grill/flying — must duck
        s2.obstacles.push({ x: s2.width + 20, type: "grill", w: 40, h: 18, yOff: 55 });
      }
    };

    // Chef sprite (procedural)
    const drawChef = (x: number, y: number, duck: boolean, run: number) => {
      const bodyH = duck ? 22 : 38;
      const bodyW = 22;
      ctx.save();
      ctx.translate(x, y - bodyH);
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(bodyW / 2, bodyH + 4, bodyW / 2, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // apron/body
      ctx.fillStyle = "#f97316";
      ctx.fillRect(0, 8, bodyW, bodyH - 8);
      // white apron
      ctx.fillStyle = "#fff";
      ctx.fillRect(4, 14, bodyW - 8, bodyH - 14);
      // head
      ctx.fillStyle = "#f6c89f";
      ctx.beginPath();
      ctx.arc(bodyW / 2, 6, 8, 0, Math.PI * 2);
      ctx.fill();
      // chef hat
      ctx.fillStyle = "#fff";
      ctx.fillRect(3, -6, bodyW - 6, 6);
      ctx.beginPath();
      ctx.arc(bodyW / 2, -6, 6, Math.PI, 0);
      ctx.fill();
      // eye
      ctx.fillStyle = "#20120a";
      ctx.fillRect(bodyW / 2 + 2, 5, 2, 2);
      // legs (animate)
      ctx.fillStyle = "#20120a";
      const legPhase = Math.sin(run * 0.6);
      if (!duck) {
        ctx.fillRect(4, bodyH, 5, 6 + legPhase * 2);
        ctx.fillRect(bodyW - 9, bodyH, 5, 6 - legPhase * 2);
      }
      ctx.restore();
    };

    const drawFire = (x: number, y: number, t: number) => {
      const flick = Math.sin(t * 0.4) * 2;
      ctx.save();
      ctx.translate(x, y);
      // flame
      const grad = ctx.createLinearGradient(0, -30, 0, 0);
      grad.addColorStop(0, "#fbbf24");
      grad.addColorStop(0.5, "#f97316");
      grad.addColorStop(1, "#dc2626");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-12 + flick, -14, -4, -22);
      ctx.quadraticCurveTo(0, -32, 4, -22);
      ctx.quadraticCurveTo(12 - flick, -14, 0, 0);
      ctx.fill();
      // log
      ctx.fillStyle = "#7c2d12";
      ctx.fillRect(-11, 0, 22, 5);
      ctx.restore();
    };

    const drawChilli = (x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y - 18);
      ctx.fillStyle = "#16a34a";
      ctx.fillRect(6, -4, 2, 6);
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.ellipse(9, 8, 6, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawGrill = (x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = "#374151";
      ctx.fillRect(0, 0, 40, 8);
      ctx.strokeStyle = "#9ca3af";
      ctx.lineWidth = 1;
      for (let i = 4; i < 40; i += 6) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 8); ctx.stroke();
      }
      // legs
      ctx.fillStyle = "#374151";
      ctx.fillRect(2, 8, 3, 12);
      ctx.fillRect(35, 8, 3, 12);
      // smoke
      ctx.fillStyle = "rgba(120,120,120,0.4)";
      ctx.beginPath(); ctx.arc(10, -6, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(20, -10, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };

    const drawCoin = (x: number, y: number, t: number) => {
      ctx.save();
      ctx.translate(x, y);
      const w = 10 + Math.abs(Math.sin(t * 0.15)) * 4;
      const grad = ctx.createLinearGradient(-w, 0, w, 0);
      grad.addColorStop(0, "#f59e0b");
      grad.addColorStop(0.5, "#fde68a");
      grad.addColorStop(1, "#f59e0b");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, w, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b45309";
      ctx.font = "bold 12px Inter";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (w > 8) ctx.fillText("₹", 0, 1);
      ctx.restore();
    };

    const loop = (t: number) => {
      const s2 = stateRef.current;
      const dt = s2.lastT ? Math.min((t - s2.lastT) / 16.67, 2.5) : 1;
      s2.lastT = t;
      s2.tick += dt;

      // clear
      ctx.clearRect(0, 0, s2.width, s2.height);

      // sky gradient background
      const sky = ctx.createLinearGradient(0, 0, 0, s2.height);
      sky.addColorStop(0, "#fff7ed");
      sky.addColorStop(1, "#fed7aa");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, s2.width, s2.height);

      // sun
      ctx.fillStyle = "rgba(249,115,22,0.35)";
      ctx.beginPath();
      ctx.arc(s2.width - 50, 50, 24, 0, Math.PI * 2);
      ctx.fill();

      // ground
      ctx.fillStyle = "#7c2d12";
      ctx.fillRect(0, s2.ground + 8, s2.width, 4);
      // ground pattern (scrolls)
      ctx.fillStyle = "rgba(124,45,18,0.35)";
      const off = (s2.tick * s2.speed) % 20;
      for (let x = -off; x < s2.width; x += 20) {
        ctx.fillRect(x, s2.ground + 14, 10, 2);
      }

      if (s2.running) {
        // physics
        s2.vy += 0.75 * dt;
        s2.y += s2.vy * dt;
        if (s2.y > 0) { s2.y = 0; s2.vy = 0; }

        // score
        s2.score += 0.25 * dt;
        // speed ramp
        s2.speed = Math.min(6 + s2.score / 100, 14);

        // spawn
        s2.spawnTimer -= dt;
        if (s2.spawnTimer <= 0) {
          spawn();
          s2.spawnTimer = Math.max(40 - s2.speed * 2, 18) + Math.random() * 30;
        }
      }

      // draw obstacles + collide
      const chefX = 60;
      const chefBoxW = 20;
      const chefBoxH = s2.ducking ? 22 : 38;
      const chefBoxY = s2.ground - chefBoxH + s2.y;

      s2.obstacles = s2.obstacles.filter((o) => {
        if (s2.running) o.x -= s2.speed * dt;

        // draw
        if (o.type === "fire") drawFire(o.x + o.w / 2, s2.ground);
        else if (o.type === "chilli") drawChilli(o.x, s2.ground);
        else if (o.type === "grill") drawGrill(o.x, s2.ground - o.yOff);
        else if (o.type === "coin") drawCoin(o.x + o.w / 2, s2.ground - o.yOff, s2.tick);

        // collision box for obstacle
        const oY = o.type === "grill" ? s2.ground - o.yOff : (o.type === "coin" ? s2.ground - o.yOff - 10 : s2.ground - o.h);
        const hit =
          o.x < chefX + chefBoxW &&
          o.x + o.w > chefX &&
          oY < chefBoxY + chefBoxH &&
          oY + o.h > chefBoxY;

        if (hit && s2.running) {
          if (o.type === "coin") {
            s2.score += 10;
            haptic("success");
            onScoreChange(Math.floor(s2.score));
            return false;
          } else {
            s2.running = false;
            haptic("error");
            onGameOver(Math.floor(s2.score));
            return true;
          }
        }
        return o.x > -60;
      });

      // draw chef
      drawChef(chefX, s2.ground + s2.y, s2.ducking, s2.tick);

      if (s2.running) onScoreChange(Math.floor(s2.score));

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("touchstart", touchStart);
      canvas.removeEventListener("touchmove", touchMove);
      canvas.removeEventListener("touchend", touchEnd);
      canvas.removeEventListener("mousedown", jump);
    };
  }, [onGameOver, onScoreChange]);

  useEffect(() => {
    const s = stateRef.current;
    if (running) {
      // reset
      s.score = 0; s.vy = 0; s.y = 0; s.obstacles = []; s.spawnTimer = 20; s.speed = 6; s.lastT = 0;
      s.running = true;
    } else {
      s.running = false;
    }
  }, [running]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block touch-none select-none"
      style={{ imageRendering: "pixelated" }}
    />
  );
};

export default BBQRunner;
