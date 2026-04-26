import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomer } from "@/contexts/CustomerContext";
import { Link } from "react-router-dom";
import { ArrowLeft, Gift, LogOut, Sparkles, Clock, Phone, Check, Lock as LockIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import confetti from "@/lib/confetti";
import { loyaltyApi } from "@/lib/loyalty";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";
import OfferRoulette from "@/components/OfferRoulette";

const MYSTERY_TEXT = "A surprise reward — depends on your luck! 🍀";

const LoyaltyPage = () => {
  const qc = useQueryClient();
  const { customer, isLoggedIn, logout, login: setCustomer } = useCustomer();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [claiming, setClaiming] = useState<number | null>(null);

  const { data: card } = useQuery({
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
    refetchInterval: 6000,
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
      toast.success("Welcome to INARA Loyalty! 🎉");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const visitByNumber = useMemo(() => {
    const m = new Map<number, any>();
    visits.forEach(v => m.set(v.visit_number, v));
    return m;
  }, [visits]);

  // A milestone is CLAIMABLE if: card has reached this visit_number AND no visit row exists yet for it (for visit > 1).
  const isClaimable = useCallback((visitNum: number) => {
    if (!card) return false;
    if (visitNum === 1) return false;
    if (card.visit_count < visitNum) return false;
    return !visitByNumber.has(visitNum);
  }, [card, visitByNumber]);

  const handleClaimGuaranteed = async (cfg: any) => {
    if (!card) return;
    setClaiming(cfg.visit_number);
    try {
      await loyaltyApi.claimReward(card.id, cfg.visit_number);
      confetti();
      haptic("success");
      toast.success("Reward claimed! Show this to staff.");
      await qc.invalidateQueries({ queryKey: ["loyalty-card"] });
      await qc.invalidateQueries({ queryKey: ["loyalty-visits"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not claim");
    } finally {
      setClaiming(null);
    }
  };

  const handleClaimMystery = useCallback(async (visitNumber: number) => {
    if (!card) return;
    setClaiming(visitNumber);
    try {
      await loyaltyApi.claimReward(card.id, visitNumber);
      await qc.invalidateQueries({ queryKey: ["loyalty-card"] });
      await qc.invalidateQueries({ queryKey: ["loyalty-visits"] });
      toast.success("Mystery reward claimed!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not claim reward");
      throw e;
    } finally {
      setClaiming(null);
    }
  }, [card, qc]);

  const daysLeft = useMemo(() => {
    if (!card) return null;
    const ms = new Date(card.expires_at).getTime() - Date.now();
    if (ms <= 0) return { d: 0, h: 0 };
    return { d: Math.floor(ms / 86400000), h: Math.floor((ms % 86400000) / 3600000) };
  }, [card]);

  // ───────── Login screen ─────────
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

            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Find or create your card</p>
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
              {loginLoading ? "Loading..." : "Get My Loyalty Card"}
            </button>

            <p className="text-[11px] text-muted-foreground text-center mt-5 leading-relaxed">
              Earn rewards over 7 visits within 2 months. Your phone number is your card — no password needed.
            </p>
          </div>

          <p className="text-[11px] text-muted-foreground mt-6 text-center">
            Powered by <span className="font-semibold text-foreground">JorhatStays</span>
          </p>
        </div>
      </div>
    );
  }

  // ───────── Main view ─────────
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

        {/* Progress */}
        {card && (
          <div className="ios-card p-5">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">{card.visit_count} of 7 visits</p>
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
            <div className="grid grid-cols-7 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((step) => {
                const completed = card.visit_count >= step;
                const isCurrent = card.visit_count === step;
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
                      {completed ? "✓" : step}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reward Milestones — vertical premium list */}
        {card && (
          <div className="space-y-2.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground px-1">Reward Milestones</p>
            {rewardsConfig.filter(c => c.visit_number > 1).map((cfg) => {
              const visitRow = visitByNumber.get(cfg.visit_number);
              const claimable = isClaimable(cfg.visit_number);
              const claimed = !!visitRow;
              const locked = card.visit_count < cfg.visit_number;
              const isRoulette = cfg.reward_type === "roulette";
              const icon = isRoulette ? "🍀" : "🎁";

              return (
                <div
                  key={cfg.visit_number}
                  className={`ios-card p-4 transition-all ${
                    claimable ? "ring-2 ring-primary/40 shadow-lg" : ""
                  } ${locked ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${
                      claimed ? "bg-primary/10" : claimable ? "maroon-gradient" : "bg-secondary"
                    }`}>
                      {claimed ? <Check className="w-5 h-5 text-primary" /> : locked ? <LockIcon className="w-4 h-4 text-muted-foreground" /> : <span>{icon}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">Visit {cfg.visit_number}</p>
                        {claimed && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Claimed</span>}
                        {claimable && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full maroon-gradient text-primary-foreground">Ready</span>}
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug mt-1 break-words">
                        {claimed
                          ? cfg.reward_description
                          : claimable
                          ? (isRoulette ? MYSTERY_TEXT : cfg.reward_description)
                          : (isRoulette ? MYSTERY_TEXT : `Unlock at visit ${cfg.visit_number}: ${cfg.reward_description}`)
                        }
                      </p>

                      {claimable && (
                        isRoulette ? (
                          <div className="mt-4">
                            <OfferRoulette
                              visitNumber={cfg.visit_number}
                              cardId={card.id}
                              isClaimed={claimed}
                              onClaim={() => handleClaimMystery(cfg.visit_number)}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => handleClaimGuaranteed(cfg)}
                            disabled={claiming === cfg.visit_number}
                            className="mt-3 w-full py-2.5 maroon-gradient text-primary-foreground text-sm font-semibold rounded-xl ios-press premium-shine flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            {claiming === cfg.visit_number ? "Claiming..." : <><Gift className="w-4 h-4" /> Claim Reward</>}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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

    </div>
  );
};

export default LoyaltyPage;
