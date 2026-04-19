import canvasConfetti from "canvas-confetti";

export default function confetti() {
  canvasConfetti({
    particleCount: 120,
    spread: 76,
    startVelocity: 34,
    gravity: 0.92,
    ticks: 220,
    origin: { y: 0.42 },
    colors: ["hsl(42 72% 62%)", "hsl(0 60% 30%)", "hsl(40 55% 92%)"],
  });
}
