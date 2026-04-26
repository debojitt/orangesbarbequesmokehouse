import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import confetti from "@/lib/confetti";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface OfferRouletteProps {
  visitNumber: number;
  cardId?: string;
  onClaim: () => Promise<void> | void;
  isClaimed: boolean;
}

type SpinPhase = "idle" | "spinning" | "ready" | "claiming" | "claimed";

// Fallback rigged outcomes by visit (used when no per-card override is set)
const DEFAULT_RIGGED_BY_VISIT: Record<number, "winner" | "better_luck"> = {
  2: "winner",
  3: "winner",
  4: "better_luck",
  6: "better_luck",
};

const STEP_DELAYS = [
  ...Array.from({ length: 17 }, () => 80),
  ...Array.from({ length: 6 }, () => 180),
  ...Array.from({ length: 2 }, () => 350),
];

const OfferRoulette = ({ visitNumber, cardId, onClaim, isClaimed }: OfferRouletteProps) => {
  const timeoutsRef = useRef<number[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [phase, setPhase] = useState<SpinPhase>(isClaimed ? "claimed" : "idle");
  const [landed, setLanded] = useState(false);

  // Load active prize tiles from DB
  const { data: tiles = [] } = useQuery({
    queryKey: ["roulette-prizes-customer"],
    queryFn: async () => {
      const { data } = await supabase
        .from("roulette_prizes")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
  });

  // Per-card override (staff-set: forces wheel to land on a specific tile)
  const { data: overridePrizeId } = useQuery({
    queryKey: ["card-roulette-override", cardId],
    queryFn: async () => {
      if (!cardId) return null;
      const { data } = await supabase
        .from("loyalty_cards")
        .select("next_roulette_prize_id")
        .eq("id", cardId)
        .maybeSingle();
      return (data?.next_roulette_prize_id as string | null) ?? null;
    },
    enabled: !!cardId,
  });

  const winningIndex = useMemo(() => {
    if (tiles.length === 0) return 0;
    // 1) Per-card override takes top priority
    if (overridePrizeId) {
      const idx = tiles.findIndex((t: any) => t.id === overridePrizeId);
      if (idx >= 0) return idx;
    }
    // 2) Default rigged behavior by visit number
    const wantBetterLuck = DEFAULT_RIGGED_BY_VISIT[visitNumber] === "better_luck";
    const candidates = tiles
      .map((t: any, i: number) => ({ t, i }))
      .filter(({ t }) => !!t.is_better_luck === wantBetterLuck);
    const pool = candidates.length > 0 ? candidates : tiles.map((t: any, i: number) => ({ t, i }));
    return pool[Math.floor(Math.random() * pool.length)].i;
  }, [tiles, overridePrizeId, visitNumber]);

  const winningTile = tiles[winningIndex];
  const isBetterLuck = !!winningTile?.is_better_luck;

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
    if (tiles.length === 0) return;

    clearSpinTimers();
    haptic("medium");

    const totalSteps = STEP_DELAYS.length;
    const startIndex = (winningIndex - totalSteps + tiles.length * 20) % tiles.length;

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
        currentIndex = (currentIndex + 1) % tiles.length;
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
        {tiles.map((tile: any, index: number) => {
          const isActive = index === activeIndex && phase === "spinning";
          const isWinner = index === winningIndex && (phase === "ready" || phase === "claiming" || phase === "claimed");
          const isDimmed = phase === "claimed" && isWinner;

          return (
            <div
              key={tile.id}
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
                <p className="font-display text-2xl text-primary">{winningTile?.winning_label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{phase === "claimed" ? "Saved to your loyalty card." : "Locked in and ready to claim."}</p>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={phase === "ready" ? handleClaim : startSpin}
          disabled={phase === "spinning" || phase === "claiming" || phase === "claimed" || tiles.length === 0}
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