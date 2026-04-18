// Lightweight haptic-style feedback. Uses Vibration API on supported devices.
// Falls back silently on iOS Safari (no vibration), where on-screen press scale gives feedback.

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  selection: 5,
  success: [10, 30, 10],
  warning: [20, 40, 20],
  error: [30, 50, 30, 50, 30],
};

export const haptic = (pattern: HapticPattern = 'light') => {
  try {
    if (typeof window === 'undefined') return;
    const nav = window.navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    if (typeof nav.vibrate === 'function') {
      nav.vibrate(PATTERNS[pattern]);
    }
  } catch {
    // ignore
  }
};
