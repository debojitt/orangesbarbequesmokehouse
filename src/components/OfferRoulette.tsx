import { useEffect, useMemo, useRef, useState } from "react";

import confetti from "@/lib/confetti";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface OfferRouletteProps {
  visitNumber: number;
  onClaim: () => Promise<void> | void;
  isClaimed: boolean;
}

type OfferKey = "percent_off" | "dessert" | "mocktail" | "cash_off" | "better_luck" | "starter";
type SpinPhase = "idle" | "spinning" | "ready" | "claiming" | "claimed";

const OFFER_TILES: Array<{ key: OfferKey; label: string; winningLabel: string }> = [
  {
    key: "percent_off",
    label: "20% OFF your bill",
    winningLabel: "20% OFF your bill (up to ₹300)",
  },
  {
    key: "dessert",
    label: "FREE Dessert of the Day",
    winningLabel: "FREE Dessert of the Day",
  },
  {
    key: "mocktail",
    label: "FREE Mocktail",
    winningLabel: "FREE Mocktail",
  },
  {
    key: "cash_off",
    label: "₹100 OFF",
    winningLabel: "₹100 OFF",
  },
  {
    key: "better_luck",
    label: "Better Luck Next Time",
    winningLabel: "Better Luck Next Time",
  },
  {
    key: "starter",
    label: "FREE Starter",
    winningLabel: "FREE Starter",
  },
];

const RIGGED_RESULTS: Record<number, OfferKey> = {
  2: "percent_off",
  3: "dessert",
  4: "better_luck",
  6: "better_luck",
};

const STEP_DELAYS = [
  ...Array.from({ length: 17 }, () => 80),
  ...Array.from({ length: 6 }, () => 180),
  ...Array.from({ length: 2 }, () => 350),
];

const OfferRoulette = ({ visitNumber, onClaim, isClaimed }: OfferRouletteProps) => {
  const timeoutsRef = useRef<number[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<SpinPhase>(isClaimed ? "claimed" : "idle");
  const [landed, setLanded] = useState(false);

  const winningKey = RIGGED_RESULTS[visitNumber] ?? "better_luck";
  const winningIndex = useMemo(
    () => OFFER_TILES.findIndex((tile) => tile.key === winningKey),
    [winningKey],
  );
  const winningTile = OFFER_TILES[winningIndex] ?? OFFER_TILES[4];
  const isBetterLuck = winningTile.key === "better_luck";

  useEffect(() => {
    if (isClaimed) {
      setPhase("claimed");
      setActiveIndex(winningIndex);
      setLanded(true);
      return;
    }

    setPhase("idle");
    setActiveIndex(0);
    setLanded(false);
  }, [isClaimed, winningIndex, visitNumber]);

  useEffect(() => () => {
    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutsRef.current = [];
  }, []);

  const clearSpinTimers = () => {
    timeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timeoutsRef.current = [];
  };

  const startSpin = () => {
    if (phase === "spinning" || phase === "claiming" || phase === "claimed") return;

    clearSpinTimers();
    haptic("medium");

    const totalSteps = STEP_DELAYS.length;
    const startIndex = (winningIndex - totalSteps + OFFER_TILES.length * 20) % OFFER_TILES.length;

    setPhase("spinning");
    setLanded(false);
    setActiveIndex(startIndex);

    let currentIndex = startIndex;

    const runStep = (step: number) => {
      if (step >= STEP_DELAYS.length) {
        setActiveIndex(winningIndex);
        setLanded(true);
        setPhase("ready");

        if (isBetterLuck) {
          haptic("warning");
        } else {
          confetti();
          haptic("success");
        }
        return;
      }

      const timeout = window.setTimeout(() => {
        currentIndex = (currentIndex + 1) % OFFER_TILES.length;
        setActiveIndex(currentIndex);
        runStep(step + 1);
      }, STEP_DELAYS[step]);

      timeoutsRef.current.push(timeout);
    };

    runStep(0);
  };

  const handleClaim = async () => {
    if (phase !== "ready") return;

    setPhase("claiming");

    try {
      await onClaim();
      setPhase("claimed");
      setLanded(true);
      haptic(isBetterLuck ? "selection" : "success");
    } catch {
      setPhase("ready");
    }
  };

  return (
    <div
      className="rounded-[28px] border border-premium-border bg-premium-card p-4 shadow-[0_18px_55px_hsl(var(--primary)/0.12)] sm:p-5"
      style={{ fontFamily: "'Lato', sans-serif" }}
    >
      <div className="mb-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-primary/70">Possible rewards</p>
        <p className="mt-2 text-sm leading-relaxed text-premium-ink/80">
          🎁 Win up to a FREE MEAL — depends on your luck!
        </p>
      </div>

      <div className="space-y-2.5">
        {OFFER_TILES.map((tile, index) => {
          const isActive = index === activeIndex && phase === "spinning";
          const isWinner = index === winningIndex && (phase === "ready" || phase === "claiming" || phase === "claimed");
          const isDimmed = phase === "claimed" && isWinner;

          return (
            <div
              key={tile.key}
              className={cn(
                "relative overflow-hidden rounded-2xl border px-4 py-3 text-center transition-all duration-300 ease-out",
                "transform-gpu",
                isWinner && !isBetterLuck && "offer-winning-tile animate-pulse-gold text-primary",
                isWinner && isBetterLuck && "border-border bg-secondary/85 text-muted-foreground",
                isActive && "border-premium-gold bg-premium-gold text-primary-foreground scale-[1.03] shadow-[0_12px_26px_hsl(var(--premium-gold)/0.32)]",
                !isActive && !isWinner && "border-premium-border bg-premium-soft text-premium-ink/65 opacity-80",
                landed && isWinner && "offer-landing-bounce",
                isDimmed && "opacity-70 saturate-75",
              )}
            >
              {isWinner && !isBetterLuck && (
                <div className="mb-2 inline-flex items-center rounded-full border border-premium-gold/60 bg-background/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary shadow-sm">
                  🎉 You Won!
                </div>
              )}

              {isWinner && phase === "claimed" && (
                <div className="absolute right-3 top-3 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground">
                  ✓ Claimed
                </div>
              )}

              <p className={cn("text-sm font-semibold leading-tight", isWinner && "font-display text-lg")}>{tile.label}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 text-center">
        {phase !== "idle" && (
          <div className="mb-4 min-h-[56px] rounded-2xl border border-premium-border bg-background/80 px-4 py-3">
            {phase === "spinning" ? (
              <p className="text-sm font-medium text-muted-foreground">Spinning...</p>
            ) : isBetterLuck ? (
              <>
                <p className="font-display text-xl text-foreground">Come back next visit! 🍀</p>
                <p className="mt-1 text-xs text-muted-foreground">This round was a near miss, but your progress is saved.</p>
              </>
            ) : (
              <>
                <p className="font-display text-2xl text-primary">{winningTile.winningLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">{phase === "claimed" ? "Saved to your loyalty card." : "Locked in and ready to claim."}</p>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={phase === "ready" ? handleClaim : startSpin}
          disabled={phase === "spinning" || phase === "claiming" || phase === "claimed"}
          className="w-full rounded-2xl border border-primary/15 maroon-gradient px-5 py-3.5 font-display text-base tracking-[0.08em] text-[hsl(var(--premium-gold-light))] shadow-[0_14px_32px_hsl(var(--primary)/0.22)] transition-all duration-300 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {phase === "spinning"
            ? "Spinning..."
            : phase === "claiming"
              ? "Claiming..."
              : phase === "claimed"
                ? "✓ Claimed"
                : phase === "ready"
                  ? "Claim Reward"
                  : "TRY YOUR LUCK"}
        </button>
      </div>
    </div>
  );
};

export default OfferRoulette;