import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

interface Props {
  running: boolean;
  soundEnabled: boolean;
  onGameOver: (score: number) => void;
  onScoreChange: (score: number) => void;
}

type RoadItem = { lane: number; z: number; kind: "crate" | "token"; hit: boolean };

const SmokehouseRush3D = ({ running, soundEnabled, onGameOver, onScoreChange }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const refs = useRef({ over: onGameOver, score: onScoreChange, sound: soundEnabled, running });
  const stateRef = useRef({
    width: 0, height: 0, lane: 0, laneVisual: 0, items: [] as RoadItem[],
    score: 0, bonus: 0, distance: 0, speed: 0.38, lives: 3, lastSpawnZ: 0,
    ended: false, ending: false, pointerX: 0, pointerY: 0,
  });

  useEffect(() => { refs.current = { over: onGameOver, score: onScoreChange, sound: soundEnabled, running }; }, [onGameOver, onScoreChange, soundEnabled, running]);
  useEffect(() => {
    refs.current.running = running;
    const s = stateRef.current;
    if (running) {
      s.lane = 0; s.laneVisual = 0; s.items = []; s.score = 0; s.bonus = 0; s.distance = 0;
      s.speed = 0.38; s.lives = 3; s.lastSpawnZ = 0; s.ended = false; s.ending = false;
      refs.current.score(0);
    } else s.ended = true;
  }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const s = stateRef.current;
    let raf = 0;
    let last = 0;
    let audio: AudioContext | null = null;

    const tone = (frequency: number, duration = 0.08) => {
      if (!refs.current.sound) return;
      try {
        audio ??= new AudioContext();
        if (audio.state === "suspended") void audio.resume();
        const osc = audio.createOscillator(); const gain = audio.createGain();
        osc.type = "sawtooth"; osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.025, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
        osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
      } catch { /* optional audio */ }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); s.width = rect.width; s.height = rect.height;
    };
    const changeLane = (direction: number) => {
      const next = Math.max(-1, Math.min(1, s.lane + direction));
      if (next !== s.lane) { s.lane = next; haptic("selection"); tone(260, 0.04); }
    };
    const down = (event: PointerEvent) => {
      event.preventDefault();
      s.pointerX = event.clientX;
      s.pointerY = event.clientY;
      const rect = canvas.getBoundingClientRect();
      const localY = event.clientY - rect.top;
      if (localY > rect.height - 122) {
        changeLane(event.clientX - rect.left < rect.width / 2 ? -1 : 1);
        s.pointerX = Number.NaN;
      }
      try { canvas.setPointerCapture(event.pointerId); } catch { /* ignore */ }
    };
    const up = (event: PointerEvent) => {
      if (!Number.isFinite(s.pointerX)) return;
      const dx = event.clientX - s.pointerX;
      const dy = event.clientY - s.pointerY;
      if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) changeLane(dx > 0 ? 1 : -1);
    };
    const key = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") changeLane(-1);
      if (event.code === "ArrowRight" || event.code === "KeyD") changeLane(1);
    };
    const end = () => {
      if (s.ending || s.ended || !refs.current.running) return;
      s.ending = true; s.ended = true; tone(70, 0.35); haptic("error");
      setTimeout(() => refs.current.over(s.score), 0);
    };
    const project = (lane: number, z: number) => {
      const horizon = s.height * 0.22;
      const depth = 1 - z;
      const y = horizon + depth * depth * (s.height - horizon + 30);
      const roadHalf = s.width * (0.06 + depth * 0.52);
      return { x: s.width / 2 + lane * roadHalf * 0.58, y, scale: 0.15 + depth * 1.05, roadHalf };
    };

    const loop = (time: number) => {
      const dt = last ? Math.min(0.033, (time - last) / 1000) : 0.016; last = time;
      if (refs.current.running && !s.ended) {
        s.speed = Math.min(0.9, 0.38 + s.distance * 0.000055);
        s.distance += s.speed * dt * 120;
        s.laneVisual += (s.lane - s.laneVisual) * Math.min(1, dt * 12);
        if (!s.items.length || s.lastSpawnZ < 0.76) {
          const obstacleLane = (Math.floor(Math.random() * 3) - 1);
          s.items.push({ lane: obstacleLane, z: 1.08, kind: "crate", hit: false });
          if (Math.random() < 0.82) {
            const tokenLane = [-1, 0, 1].filter((lane) => lane !== obstacleLane)[Math.floor(Math.random() * 2)];
            s.items.push({ lane: tokenLane, z: 1.22, kind: "token", hit: false });
          }
          s.lastSpawnZ = 1.08;
        }
        for (const item of s.items) {
          item.z -= s.speed * dt;
          if (!item.hit && item.z < 0.105 && item.z > -0.04 && item.lane === s.lane) {
            item.hit = true;
            if (item.kind === "token") {
              s.bonus += 25; tone(720); haptic("success");
            } else {
              s.lives -= 1; tone(105, 0.18); haptic("error");
              if (s.lives <= 0) end();
            }
          }
        }
        s.lastSpawnZ = Math.max(...s.items.filter((item) => item.z > 0).map((item) => item.z), 0);
        s.items = s.items.filter((item) => item.z > -0.12);
        const nextScore = Math.floor(s.distance / 10) + s.bonus;
        if (nextScore !== s.score) { s.score = nextScore; refs.current.score(s.score); }
      }

      const horizon = s.height * 0.22;
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, "#160b2e"); sky.addColorStop(1, "#c2412d");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, s.width, horizon + 1);
      ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(s.width * 0.76, horizon * 0.55, 28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#351828"; ctx.beginPath(); ctx.moveTo(0, horizon);
      for (let x = 0; x <= s.width; x += 24) ctx.lineTo(x, horizon - 15 - Math.sin(x * 0.035) * 18);
      ctx.lineTo(s.width, horizon); ctx.fill();

      ctx.fillStyle = "#40251f"; ctx.fillRect(0, horizon, s.width, s.height - horizon);
      ctx.fillStyle = "#221d27"; ctx.beginPath(); ctx.moveTo(s.width * 0.44, horizon); ctx.lineTo(s.width, s.height); ctx.lineTo(0, s.height); ctx.lineTo(s.width * 0.56, horizon); ctx.closePath(); ctx.fill();
      const stripeOffset = (s.distance * 0.012) % 0.2;
      for (let i = 0; i < 7; i += 1) {
        const z1 = (i / 7 + stripeOffset) % 1; const z2 = Math.min(1, z1 + 0.07);
        const a = project(0, z1); const b = project(0, z2);
        ctx.fillStyle = "rgba(255,210,130,.65)";
        for (const laneEdge of [-0.5, 0.5]) {
          ctx.beginPath(); ctx.moveTo(s.width / 2 + laneEdge * a.roadHalf * 0.58, a.y);
          ctx.lineTo(s.width / 2 + laneEdge * b.roadHalf * 0.58, b.y);
          ctx.lineWidth = Math.max(1, 7 * a.scale); ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
        }
      }

      const visible = [...s.items].filter((item) => item.z >= 0 && !item.hit).sort((a, b) => b.z - a.z);
      for (const item of visible) {
        const p = project(item.lane, item.z); ctx.save(); ctx.translate(p.x, p.y);
        if (item.kind === "crate") {
          const size = 38 * p.scale; ctx.fillStyle = "#9a4b24"; ctx.fillRect(-size / 2, -size, size, size);
          ctx.strokeStyle = "#f59e42"; ctx.lineWidth = Math.max(1, 3 * p.scale); ctx.strokeRect(-size / 2, -size, size, size);
          ctx.beginPath(); ctx.moveTo(-size / 2, -size); ctx.lineTo(size / 2, 0); ctx.moveTo(size / 2, -size); ctx.lineTo(-size / 2, 0); ctx.stroke();
        } else {
          const r = 13 * p.scale; ctx.strokeStyle = "#facc15"; ctx.lineWidth = Math.max(2, 5 * p.scale);
          ctx.shadowColor = "#fde047"; ctx.shadowBlur = 12 * p.scale; ctx.beginPath(); ctx.ellipse(0, -r, r, r * 1.25, time * 0.003, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      }

      // The runner stays on the same projected lane used for collision, viewed from
      // behind and facing the horizon so left/right input matches player perspective.
      const rider = project(s.laneVisual, 0.035);
      ctx.save(); ctx.translate(rider.x, Math.min(s.height - 126, rider.y - 44));
      ctx.fillStyle = "rgba(249,115,22,.22)"; ctx.beginPath(); ctx.ellipse(0, 42, 38, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.arc(-20, 30, 10, 0, Math.PI * 2); ctx.arc(20, 30, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.roundRect(-29, -8, 58, 42, 12); ctx.fill();
      ctx.fillStyle = "#7c2d12"; ctx.fillRect(-23, 5, 46, 7);
      ctx.fillStyle = "#f5c28b"; ctx.beginPath(); ctx.arc(0, -20, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff7ed"; ctx.beginPath(); ctx.arc(0, -27, 18, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#ef4444"; ctx.fillRect(-16, -18, 32, 4);
      ctx.fillStyle = "#fb923c"; ctx.beginPath(); ctx.moveTo(-7, 31); ctx.lineTo(0, 46 + Math.sin(time * 0.03) * 4); ctx.lineTo(7, 31); ctx.fill();
      ctx.restore();

      ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(10, 10, 178, 42);
      ctx.fillStyle = "#fff"; ctx.font = "bold 14px monospace"; ctx.fillText(`RUSH ${s.score}`, 18, 36);
      ctx.textAlign = "right"; ctx.fillStyle = "#fb7185"; ctx.fillText("♥".repeat(Math.max(0, s.lives)), s.width - 14, 35); ctx.textAlign = "left";

      const controlY = s.height - 65;
      const controlR = Math.min(44, s.width * 0.115);
      for (const [x, label] of [[controlR + 18, "◀"], [s.width - controlR - 18, "▶"]] as const) {
        ctx.fillStyle = "rgba(15,8,25,.72)";
        ctx.strokeStyle = "rgba(255,210,150,.65)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, controlY, controlR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff1cf"; ctx.font = `bold ${controlR * 0.7}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, x, controlY + 1);
      }
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      raf = requestAnimationFrame(loop);
    };

    resize(); const observer = new ResizeObserver(resize); observer.observe(canvas);
    canvas.addEventListener("pointerdown", down, { passive: false }); canvas.addEventListener("pointerup", up); window.addEventListener("keydown", key);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); observer.disconnect();
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointerup", up); window.removeEventListener("keydown", key);
    };
  }, []);

  return <canvas ref={canvasRef} aria-label="Smokehouse Rush 3D. Swipe between lanes, dodge crates, and collect tokens." className="block h-full w-full touch-none select-none" />;
};

export default SmokehouseRush3D;
