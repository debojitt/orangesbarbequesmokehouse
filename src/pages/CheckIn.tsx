import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { loyaltyApi } from "@/lib/loyalty";
import { useStaffAuth } from "@/contexts/StaffAuthContext";
import confetti from "@/lib/confetti";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";

const CheckIn = () => {
  const { cardId = "" } = useParams<{ cardId: string }>();
  const nav = useNavigate();
  useStaffAuth();
  const [card, setCard] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("loyalty_cards")
        .select("*, customers(*)")
        .eq("id", cardId)
        .maybeSingle();
      if (data) {
        setCard(data);
        setCustomer((data as any).customers);
      }
      setLoading(false);
    })();
  }, [cardId]);

  const handleRecord = async () => {
    if (!pin.trim()) {
      toast.error("Enter Admin PIN");
      return;
    }
    setSubmitting(true);
    try {
      await loyaltyApi.recordVisit(pin.trim(), cardId);
      confetti();
      haptic("success");
      setDone(true);
      setTimeout(() => nav("/staff/loyalty"), 1800);
    } catch (e) {
      haptic("error");
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="ios-card p-6 max-w-sm w-full text-center">
          <p className="text-foreground font-semibold mb-2">Card not found</p>
          <p className="text-sm text-muted-foreground mb-4">This QR code is invalid or expired.</p>
          <Link to="/staff/loyalty" className="px-4 py-2 maroon-gradient text-primary-foreground rounded-xl text-sm">Back</Link>
        </div>
      </div>
    );
  }

  const newCount = Math.min(card.visit_count + 1, 7);

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 py-3 flex items-center gap-3 glass-panel-strong sticky top-0 z-20">
        <Link to="/staff/loyalty" className="text-muted-foreground hover:text-foreground ios-press">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-display text-lg text-primary">Record Visit</h1>
      </header>

      <div className="px-4 py-6 max-w-md mx-auto">
        {done ? (
          <div className="ios-card p-8 text-center ios-spring-in">
            <CheckCircle2 className="w-16 h-16 mx-auto text-primary mb-3" />
            <p className="font-display text-xl text-primary mb-1">Visit Recorded</p>
            <p className="text-sm text-muted-foreground">Visit {newCount} of 7 logged for {customer?.name}</p>
          </div>
        ) : (
          <>
            <div className="ios-card overflow-hidden mb-4">
              <div className="maroon-gradient p-5 text-primary-foreground">
                <p className="text-[10px] uppercase tracking-widest opacity-80">Guest</p>
                <p className="font-display text-2xl leading-tight">{customer?.name}</p>
                <p className="text-sm opacity-80 mt-0.5">{customer?.phone}</p>
              </div>
              <div className="p-5">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-sm font-semibold text-foreground">Current: Visit {card.visit_count}/7</p>
                  <p className="text-xs text-primary font-semibold">→ Visit {newCount}/7</p>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full maroon-gradient transition-all duration-500" style={{ width: `${(newCount / 7) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="ios-card p-5 space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Admin PIN</p>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN to confirm"
                className="w-full px-4 py-3 bg-secondary text-foreground border border-border rounded-xl focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleRecord}
                disabled={submitting || card.visit_count >= 7}
                className="w-full py-3.5 maroon-gradient text-primary-foreground font-semibold rounded-xl ios-press premium-shine disabled:opacity-60"
              >
                {submitting ? "Recording..." : card.visit_count >= 7 ? "Card complete — Restart it" : "Record Visit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CheckIn;
