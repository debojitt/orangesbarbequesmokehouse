// Simple confetti effect
export default function confetti() {
  const colors = ['#C9A96E', '#F8F8F8', '#E8D5A3'];
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden';
  document.body.appendChild(container);

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const size = Math.random() * 8 + 4;

    particle.style.cssText = `
      position:absolute;
      left:${left}%;
      top:-10px;
      width:${size}px;
      height:${size}px;
      background:${color};
      animation:confetti-fall 2s ${delay}s ease-out forwards;
    `;
    container.appendChild(particle);
  }

  // Add keyframes
  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
      @keyframes confetti-fall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => container.remove(), 3000);
}
