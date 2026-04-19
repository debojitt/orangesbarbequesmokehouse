import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

interface Props {
  segments: string[];
  targetIndex: number;
  spinning: boolean;
  onSettled: () => void;
}

/**
 * Premium physics-based wheel.
 * - Accelerates fast, decelerates with realistic friction (cubic-bezier easing).
 * - Always lands precisely on `targetIndex`.
 * - Pointer at top (12 o'clock) marks the winner.
 */
const RouletteWheel = ({ segments, targetIndex, spinning, onSettled }: Props) => {
  const controls = useAnimation();
  const [rotation, setRotation] = useState(0);
  const settledRef = useRef(false);

  const segCount = segments.length;
  const segAngle = 360 / segCount;

  useEffect(() => {
    if (!spinning) return;
    settledRef.current = false;

    // Center the target segment under the pointer (top, 0deg).
    // Each segment center sits at i*segAngle + segAngle/2 from 0 (rotating clockwise from top).
    const targetCenter = targetIndex * segAngle + segAngle / 2;
    // Add randomness within the segment so it doesn't feel mechanical
    const jitter = (Math.random() - 0.5) * (segAngle * 0.55);
    const fullSpins = 6 + Math.floor(Math.random() * 3); // 6-8 full rotations
    const finalRotation = rotation + fullSpins * 360 + (360 - targetCenter) + jitter;

    controls.start({
      rotate: finalRotation,
      transition: {
        duration: 5.2,
        ease: [0.16, 0.84, 0.3, 1], // strong start, long deceleration
      },
    }).then(() => {
      if (!settledRef.current) {
        settledRef.current = true;
        setRotation(finalRotation % 360);
        onSettled();
      }
    });
  }, [spinning, targetIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build conic gradient for segments
  const colors = [
    'hsl(0 60% 30%)', 'hsl(38 70% 50%)',
    'hsl(0 50% 40%)', 'hsl(38 65% 55%)',
    'hsl(0 60% 25%)', 'hsl(38 70% 48%)',
    'hsl(0 55% 35%)', 'hsl(38 60% 52%)',
  ];
  const gradient = segments.map((_, i) => {
    const start = i * segAngle;
    const end = (i + 1) * segAngle;
    return `${colors[i % colors.length]} ${start}deg ${end}deg`;
  }).join(', ');

  return (
    <div className="relative w-[280px] h-[280px] mx-auto">
      {/* Pointer */}
      <div className="absolute top-[-8px] left-1/2 -translate-x-1/2 z-20">
        <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-primary drop-shadow-md" />
      </div>

      {/* Outer ring glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-transparent blur-xl" />

      {/* Wheel */}
      <motion.div
        animate={controls}
        className="relative w-full h-full rounded-full shadow-2xl border-[6px] border-white"
        style={{
          background: `conic-gradient(from 0deg, ${gradient})`,
          willChange: 'transform',
        }}
      >
        {segments.map((seg, i) => {
          const angle = i * segAngle + segAngle / 2;
          const isWin = !seg.toLowerCase().includes('better luck');
          return (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 origin-left"
              style={{
                transform: `rotate(${angle}deg) translateX(20px)`,
                width: '110px',
                height: '20px',
              }}
            >
              <span className={`text-[10px] font-bold leading-none whitespace-nowrap ${isWin ? 'text-white' : 'text-white/85'}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                {seg.length > 18 ? seg.slice(0, 16) + '…' : seg}
              </span>
            </div>
          );
        })}

        {/* Center hub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white border-4 border-primary shadow-inner flex items-center justify-center">
          <span className="text-2xl">🍀</span>
        </div>
      </motion.div>
    </div>
  );
};

export default RouletteWheel;
