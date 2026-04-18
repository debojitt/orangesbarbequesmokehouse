import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/contexts/CustomerContext";
import { Link } from "react-router-dom";
import { ArrowLeft, Gift, LogOut, Sparkles, Clock, Phone, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import confetti from "@/lib/confetti";
import { loyaltyApi } from "@/lib/loyalty";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";

const ROULETTE_DECOY = [
  "20% OFF (up to ₹300)",
  "FREE Dessert of the Day",
  "Better Luck Next Time",
  "FREE Mocktail",
  "10% OFF",
  "FREE MEAL FOR TWO",
  "Free Starter",
  "Better Luck Next Time",
];

const MYSTERY_TEXT = "Win a surprise reward — depends on your luck! 🍀";

const LoyaltyPage = () => {
  const qc = useQueryClient();
  const { customer, isLoggedIn, logout, login: setCustomer } = useCustomer();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<string | null>(null);
  const [rouletteRunning, setRouletteRunning] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const { data: card, refetch: refetchCard } = useQuery({
    queryKey: ["loyalty-card", customer?.id],
    queryFn: async () => {
      if (!customer) return null;
      const { data } = await supabase
        .from("loyalty_cards")
        .select("*")
        .eq("customer_id", customer.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!customer,
    refetchInterval: 8000,
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["loyalty-visits", card?.id],
    queryFn: async () => {
      if (!card) return [];
      const { data } = await supabase
        .from("loyalty_visits")
        .select("*")
        .eq("loyalty_card_id", card.id)
        .order("visit_number");
      return data || [];
    },
    enabled: !!card,
  });

  const { data: rewardsConfig = [] } = useQuery({
    queryKey: ["rewards-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_rewards_config")
        .select("*")
        .order("visit_number");
      return data || [];
    },
  });

  const handleLogin = async () => {
    if (!phone.trim() || !name.trim()) {
      toast.error("Enter your name & phone");
      return;
    }
    setLoginLoading(true);
    try {
      const res = await loyaltyApi.createCard(name.trim(), phone.trim());
      await setCustomer(res.customer.phone, res.customer.name);
      qc.invalidateQueries({ queryKey: ["loyalty-card"] });
      haptic("success");
      toast.success(card ? "Welcome back!" : "Loyalty card created 🎉");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const currentMilestone = useMemo(
    () => rewardsConfig.find((r) => r.visit_number === card?.visit_count),
    [rewardsConfig, card]
  );

  const milestoneVisitRow = useMemo(
    () => visits.find((v) => v.visit_number === card?.visit_count),
    [visits, card]
  );

  const isRouletteMilestone =
    !!card && currentMilestone?.reward_type === "roulette" && card.visit_count > 0;
  const isGuaranteedMilestone =
    !!card && currentMilestone?.reward_type === "guaranteed" && card.visit_count > 1;

  const showTryLuck = isRouletteMilestone && !milestoneVisitRow && !card?.is_redeemed;
  const showClaim = isGuaranteedMilestone && !card?.is_redeemed;
  const showAlreadyClaimed = !!card && card.is_redeemed && !!currentMilestone;

  const startRoulette = useCallback(() => {
    if (!card || !currentMilestone || currentMilestone.reward_type !== "roulette") return;
    haptic("medium");
    setRouletteRunning(true);
    setRouletteResult(null);
    setShowRoulette(true);

    const target = currentMilestone.reward_description || "Better Luck Next Time";
    let targetIndex = ROULETTE_DECOY.findIndex((o) =>
      o.toLowerCase().includes(target.toLowerCase().slice(0, 12))
    );
    if (targetIndex === -1) {
      targetIndex = target.includes("Better Luck") ? 2 : 0;
    }

    let currentIdx = 0;
    let iterations = 0;
    const totalIterations = 32 + targetIndex;

    const tick = () => {
      currentIdx = (currentIdx + 1) % ROULETTE_DECOY.length;
      setHighlightedIndex(currentIdx);
      iterations++;

      const delay = iterations < 20 ? 60 : iterations < 28 ? 110 : 180;

      if (iterations >= totalIterations) {
        setHighlightedIndex(targetIndex);
        setRouletteResult(target);
        setRouletteRunning(false);
        if (!target.includes("Better Luck")) {
          confetti();
          haptic("success");
        } else {
          haptic("warning");
        }
        // Persist the visit row + mark redeemed
        loyaltyApi
          .claimReward(card.id, card.visit_count)
          .then(() => {
            qc.invalidateQueries({ queryKey: ["loyalty-visits"] });
            qc.invalidateQueries({ queryKey: ["loyalty-card"] });
          })
          .catch(() => {});
        return;
      }
      setTimeout(tick, delay);
    };
    setTimeout(tick, 60);
  }, [card, currentMilestone, qc]);

  const handleClaim = async () => {
    if (!card) return;
    setClaiming(true);
    try {
      await loyaltyApi.claimReward(card.id, card.visit_count);
      confetti();
      haptic("success");
      toast.success("Reward claimed! Show this to staff.");
      qc.invalidateQueries({ queryKey: ["loyalty-card"] });
      qc.invalidateQueries({ queryKey: ["loyalty-visits"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not claim");
    } finally {
      setClaiming(false);
    }
  };

  const daysLeft = useMemo(() => {
    if (!card) return null;
    const ms = new Date(card.expires_at).getTime() - Date.now();
    if (ms <= 0) return 0;
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    return { d, h };
  }, [card]);

  // Phone-only login screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground ios-press">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display text-lg text-primary">INARA Loyalty</h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
          <div className="ios-card p-6 w-full max-w-sm ios-spring-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-xl text-primary leading-tight">INARA</h2>
                <p className="text-xs text-muted-foreground">Guest Loyalty Program</p>
              </div>
            </div>

            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Find your card</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-4 py-3 bg-secondary text-foreground border border-border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:border-primary mb-2"
            />
            <div className="relative mb-4">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                className="w-full pl-10 pr-4 py-3 bg-secondary text-foreground border border-border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full py-3.5 maroon-gradient text-primary-foreground font-semibold rounded-xl ios-press premium-shine disabled:opacity-60"
            >
              {loginLoading ? "Loading..." : "Look Up My Card"}
            </button>

            <div className="flex items-center gap-3 my-5 text-[11px] text-muted-foreground uppercase tracking-wider">
              <div className="flex-1 h-px bg-border" />OR<div className="flex-1 h-px bg-border" />
            </div>

            <Link
              to="/staff/login"
              className="flex items-center justify-between px-4 py-3 bg-secondary rounded-xl border border-border ios-press"
            >
              <span className="flex items-center gap-2 text-sm text-foreground font-medium">
                <ShieldCheck className="w-4 h-4 text-primary" /> Staff Portal
              </span>
              <span className="text-muted-foreground">›</span>
            </Link>
          </div>

          <p className="text-[11px] text-muted-foreground mt-6 text-center">
            Powered by <span className="font-semibold text-foreground">JorhatStays</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-30 glass-panel-strong">
        <div className="px-4 py-3 flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground ios-press">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-display text-lg text-primary">Loyalty Card</h1>
          </div>
          <button
            onClick={() => { logout(); haptic("selection"); }}
            className="text-muted-foreground hover:text-primary ios-press"
            aria-label="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="px-4 py-5 max-w-md mx-auto space-y-4">
        {/* Hero card */}
        <div className="ios-card overflow-hidden ios-spring-in">
          <div className="maroon-gradient p-5 text-primary-foreground relative">
            <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)]" />
            <div className="relative">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] opacity-80">INARA</p>
                  <h2 className="font-display text-xl mt-0.5 leading-tight">Guest Loyalty Card</h2>
                </div>
                {daysLeft && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 backdrop-blur text-[11px] font-medium">
                    <Clock className="w-3 h-3" />
                    {daysLeft.d > 0 ? `${daysLeft.d}d ${daysLeft.h}h left` : `${daysLeft.h}h left`}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider opacity-70">Guest</p>
                  <p className="font-display text-lg leading-tight">{customer?.name}</p>
                  <p className="text-[11px] opacity-70 mt-0.5">{customer?.phone}</p>
                </div>
                <button
                  onClick={() => { setShowQr(true); haptic("light"); }}
                  className="p-2 bg-white rounded-xl ios-press"
                  aria-label="Show QR"
                >
                  {card?.id && <QRCodeSVG value={card.id} size={56} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Progress + journey */}
        {card && (
          <div className="ios-card p-5">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">
                {card.visit_count} of 7 visits
              </p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground font-medium">
                {Math.round((card.visit_count / 7) * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-5">
              <div
                className="h-full maroon-gradient transition-all duration-700 ease-out"
                style={{ width: `${(card.visit_count / 7) * 100}%` }}
              />
            </div>

            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Your Journey</p>
            <div className="grid grid-cols-7 gap-1.5 mb-4">
              {[1, 2, 3, 4, 5, 6, 7].map((step) => {
                const completed = card.visit_count >= step;
                const isCurrent = card.visit_count === step;
                const cfg = rewardsConfig.find((r) => r.visit_number === step);
                const label =
                  step === 1
                    ? "Start"
                    : cfg?.reward_type === "guaranteed"
                    ? step === 7 ? "Free Meal" : "Combo"
                    : cfg?.reward_description?.includes("Better Luck") ? "Try Luck" : "Try Luck";
                return (
                  <div key={step} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                        completed
                          ? "maroon-gradient text-primary-foreground shadow-md"
                          : isCurrent
                          ? "border-2 border-dashed border-primary text-primary"
                          : "bg-secondary text-muted-foreground border border-border"
                      }`}
                    >
                      {completed && step < (card.visit_count) ? "✓" : step}
                    </div>
                    <span className="text-[8px] text-muted-foreground text-center leading-tight max-w-[40px]">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action area */}
        {showTryLuck && (
          <button
            onClick={startRoulette}
            className="w-full py-4 maroon-gradient text-primary-foreground font-display text-lg rounded-2xl premium-shine ios-press flex items-center justify-center gap-2 shadow-lg"
          >
            <Gift className="w-5 h-5" /> Try Your Luck! 🍀
          </button>
        )}

        {showClaim && (
          <div className="ios-card p-5 text-center">
            <p className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-1">Reward Unlocked</p>
            <p className="font-display text-lg text-foreground mb-3">
              🎉 {currentMilestone?.reward_description}
            </p>
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full py-3 maroon-gradient text-primary-foreground font-semibold rounded-xl ios-press premium-shine disabled:opacity-60"
            >
              {claiming ? "Claiming..." : "Claim Reward"}
            </button>
            <p className="text-[10px] text-muted-foreground mt-2">Show staff after tapping claim</p>
          </div>
        )}

        {showAlreadyClaimed && (
          <div className="ios-card p-5 text-center opacity-70">
            <p className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-1">Claimed</p>
            <p className="font-display text-base text-foreground">
              ✓ {milestoneVisitRow ? rewardsConfig.find(r => r.visit_number === card?.visit_count)?.reward_description : "Reward redeemed"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Visit again to unlock the next reward</p>
          </div>
        )}

        {/* Reward milestones */}
        {card && (
          <div className="ios-card p-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Reward Milestones</p>
            <div className="space-y-3">
              {rewardsConfig.filter((c) => c.visit_number > 1).map((c) => {
                const visitRow = visits.find((v) => v.visit_number === c.visit_number);
                const isPast = card.visit_count > c.visit_number;
                const isCurrent = card.visit_count === c.visit_number;
                const reveal = isPast || (isCurrent && card.is_redeemed) || (isCurrent && c.reward_type === "guaranteed");
                const icon = c.reward_type === "guaranteed" ? "🎁" : "🍀";
                return (
                  <div key={c.visit_number} className={`flex items-start gap-3 ${isPast ? "opacity-60" : ""}`}>
                    <span className="text-lg leading-none mt-0.5">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Visit {c.visit_number}: {c.reward_type === "guaranteed" ? c.reward_description?.split("(")[0].trim() : "Try Your Luck"}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug">
                        {reveal ? (visitRow ? "✓ " : "") + (c.reward_description) : MYSTERY_TEXT}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {card && (
          <div className="ios-card px-4 py-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Started: {new Date(card.created_at).toLocaleDateString()}</span>
            <span className="opacity-60">|</span>
            <span>Expires: {new Date(card.expires_at).toLocaleDateString()}</span>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center pt-2">
          Powered by <span className="font-semibold text-foreground">JorhatStays</span>
        </p>
      </div>

      {/* QR fullscreen */}
      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent className="ios-card border-border max-w-xs p-6">
          <h3 className="font-display text-lg text-primary text-center mb-1">Show to Staff</h3>
          <p className="text-xs text-muted-foreground text-center mb-4">Staff will scan this to record your visit</p>
          {card?.id && (
            <div className="bg-white p-4 rounded-2xl flex items-center justify-center">
              <QRCodeSVG value={card.id} size={220} />
            </div>
          )}
          <p className="text-[10px] text-muted-foreground text-center mt-3">Card ID: {card?.id.slice(0, 8)}</p>
        </DialogContent>
      </Dialog>

      {/* Roulette */}
      <Dialog open={showRoulette} onOpenChange={(open) => !rouletteRunning && setShowRoulette(open)}>
        <DialogContent className="ios-card border-border max-w-sm p-5">
          <h2 className="font-display text-xl text-primary text-center mb-1">🍀 Try Your Luck!</h2>
          <p className="text-xs text-muted-foreground text-center mb-4">Spinning your reward...</p>
          <div className="space-y-1.5 max-h-[280px] overflow-hidden">
            {ROULETTE_DECOY.map((offer, idx) => (
              <div
                key={idx}
                className={`px-4 py-3 text-sm font-medium rounded-xl transition-all duration-150 ${
                  highlightedIndex === idx
                    ? "maroon-gradient text-primary-foreground scale-[1.04] shadow-md"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {offer}
              </div>
            ))}
          </div>
          {rouletteResult && !rouletteRunning && (
            <div className="mt-5 text-center">
              <p className="font-display text-xl text-primary">
                {rouletteResult.includes("Better Luck") ? "😅" : "🎉"} {rouletteResult}
              </p>
              <button
                onClick={() => { setShowRoulette(false); refetchCard(); }}
                className="mt-4 px-6 py-2.5 maroon-gradient text-primary-foreground font-semibold rounded-xl ios-press"
              >
                Awesome
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoyaltyPage;
