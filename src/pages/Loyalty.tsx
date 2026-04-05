import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomer } from '@/contexts/CustomerContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, QrCode, Gift } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import confetti from '@/lib/confetti';

const LoyaltyPage = () => {
  const { customer, isLoggedIn, login } = useCustomer();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<string | null>(null);
  const [rouletteRunning, setRouletteRunning] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) setShowLogin(true);
  }, [isLoggedIn]);

  const { data: card } = useQuery({
    queryKey: ['loyalty-card', customer?.id],
    queryFn: async () => {
      if (!customer) return null;
      const { data } = await supabase
        .from('loyalty_cards')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('is_active', true)
        .maybeSingle();
      return data;
    },
    enabled: !!customer,
  });

  const { data: visits = [] } = useQuery({
    queryKey: ['loyalty-visits', card?.id],
    queryFn: async () => {
      if (!card) return [];
      const { data } = await supabase
        .from('loyalty_visits')
        .select('*')
        .eq('loyalty_card_id', card.id)
        .order('visit_number');
      return data || [];
    },
    enabled: !!card,
  });

  const { data: rewardsConfig = [] } = useQuery({
    queryKey: ['rewards-config'],
    queryFn: async () => {
      const { data } = await supabase.from('loyalty_rewards_config').select('*').order('visit_number');
      return data || [];
    },
  });

  const handleLogin = async () => {
    if (!phone.trim() || !name.trim()) return;
    try {
      await login(phone.trim(), name.trim());
      setShowLogin(false);
    } catch {}
  };

  const rouletteOffers = [
    '30% OFF (up to ₹400)',
    '10% OFF',
    'Better Luck Next Time',
    'Any meal combo for ₹299',
    'FREE MEAL (up to ₹500)',
    '20% OFF',
    'Free Dessert',
    'Better Luck Next Time',
  ];

  const startRoulette = useCallback(() => {
    if (!card) return;
    const currentVisit = card.visit_count;
    const config = rewardsConfig.find((r) => r.visit_number === currentVisit);
    if (!config || config.reward_type !== 'roulette') return;

    setRouletteRunning(true);
    setRouletteResult(null);
    setShowRoulette(true);

    // Find the index of the rigged result
    const resultDescription = config.reward_description || 'Better Luck Next Time';
    let targetIndex = rouletteOffers.findIndex((o) => o === resultDescription);
    if (targetIndex === -1) targetIndex = 2; // fallback to "Better Luck Next Time"

    let speed = 50;
    let currentIdx = 0;
    let iterations = 0;
    const totalIterations = 30 + targetIndex;

    const interval = setInterval(() => {
      currentIdx = (currentIdx + 1) % rouletteOffers.length;
      setHighlightedIndex(currentIdx);
      iterations++;

      if (iterations > totalIterations - 10) {
        speed += 30; // decelerate
      }

      if (iterations >= totalIterations) {
        clearInterval(interval);
        setHighlightedIndex(targetIndex);
        setRouletteResult(rouletteOffers[targetIndex]);
        setRouletteRunning(false);

        if (!rouletteOffers[targetIndex].includes('Better Luck')) {
          confetti();
        }

        // Record the reward
        supabase.from('loyalty_visits').insert({
          loyalty_card_id: card.id,
          visit_number: currentVisit,
          reward_type: 'roulette',
          reward_result: config.rigged_result,
        }).then(() => {});
      }
    }, speed);

    return () => clearInterval(interval);
  }, [card, rewardsConfig, rouletteOffers]);

  const currentVisitConfig = rewardsConfig.find((r) => r.visit_number === (card?.visit_count || 0));
  const showTryLuck = currentVisitConfig?.reward_type === 'roulette' && card && [2, 3, 4, 6].includes(card.visit_count);
  const isGuaranteedReward = currentVisitConfig?.reward_type === 'guaranteed' && card && [5, 7].includes(card.visit_count);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="glass-panel p-8 max-w-sm w-full">
          <h1 className="font-display text-2xl gold-text text-center mb-6">INARA Loyalty</h1>
          <p className="text-muted-foreground text-sm text-center mb-6">Enter your details to access your loyalty card</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your Name"
            className="w-full px-4 py-3 bg-secondary text-foreground border border-border placeholder:text-muted-foreground focus:outline-none focus:border-primary mb-3"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone Number"
            className="w-full px-4 py-3 bg-secondary text-foreground border border-border placeholder:text-muted-foreground focus:outline-none focus:border-primary mb-4"
          />
          <button onClick={handleLogin} className="w-full py-3 gold-gradient text-primary-foreground font-medium">
            Access My Card
          </button>
          <Link to="/" className="block text-center text-sm text-muted-foreground mt-4 hover:text-primary">Back to Menu</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-panel-strong">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="font-display text-xl gold-text">Loyalty Card</h1>
        </div>
      </header>

      <div className="px-4 py-6 max-w-md mx-auto">
        {/* Card Info */}
        <div className="glass-panel-strong p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-display text-lg text-primary">{customer?.name}</h2>
              <p className="text-sm text-muted-foreground">{customer?.phone}</p>
              {card && <p className="text-xs text-muted-foreground mt-1">Card #{card.id.slice(0, 8)}</p>}
            </div>
            <div className="p-3 glass-panel">
              <QrCode className="w-12 h-12 text-primary" />
            </div>
          </div>

          {card && (
            <p className="text-xs text-muted-foreground">
              Expires: {new Date(card.expires_at).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Progress Tracker */}
        {card && (
          <div className="glass-panel p-6 mb-6">
            <h3 className="font-display text-sm text-primary mb-4">Your Progress</h3>
            <div className="flex justify-between mb-6">
              {[1, 2, 3, 4, 5, 6, 7].map((step) => {
                const visit = visits.find((v) => v.visit_number === step);
                const isCurrent = card.visit_count === step;
                const isCompleted = card.visit_count > step;
                return (
                  <div key={step} className="flex flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 flex items-center justify-center text-xs font-bold transition-all ${
                        isCompleted
                          ? 'gold-gradient text-primary-foreground'
                          : isCurrent
                          ? 'border-2 border-primary text-primary animate-pulse-gold'
                          : 'border border-border text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? '✓' : step}
                    </div>
                    <span className="text-[8px] text-muted-foreground text-center max-w-[40px]">
                      {step === 5 || step === 7 ? '🎁' : step === 1 ? '👋' : '🍀'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Reward milestones */}
            <div className="space-y-2">
              {rewardsConfig.map((config) => {
                const visit = visits.find((v) => v.visit_number === config.visit_number);
                const isCompleted = card.visit_count > config.visit_number;
                return (
                  <div key={config.visit_number} className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground w-14">Visit {config.visit_number}</span>
                    <span className={isCompleted ? 'text-primary' : 'text-muted-foreground'}>
                      {visit
                        ? `✓ ${config.reward_description}`
                        : config.visit_number <= card.visit_count
                        ? config.reward_description
                        : 'Win up to a FREE MEAL — depends on your luck! 🍀'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Try Your Luck Button */}
        {showTryLuck && (
          <button
            onClick={startRoulette}
            className="w-full py-4 gold-gradient text-primary-foreground font-display text-lg font-bold animate-pulse-gold gold-glow flex items-center justify-center gap-2"
          >
            <Gift className="w-6 h-6" />
            Try Your Luck! 🍀
          </button>
        )}

        {/* Guaranteed Reward */}
        {isGuaranteedReward && (
          <div className="glass-panel-strong p-6 text-center gold-glow">
            <h3 className="font-display text-xl text-primary mb-2">🎉 Congratulations!</h3>
            <p className="text-foreground font-medium">{currentVisitConfig?.reward_description}</p>
          </div>
        )}

        {!card && (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">No active loyalty card found.</p>
            <p className="text-muted-foreground text-xs mt-2">Ask staff to create one for you on your next visit!</p>
          </div>
        )}
      </div>

      {/* Roulette Dialog */}
      <Dialog open={showRoulette} onOpenChange={(open) => !rouletteRunning && setShowRoulette(open)}>
        <DialogContent className="glass-panel-strong border-border max-w-sm">
          <h2 className="font-display text-xl text-primary text-center mb-4">🍀 Try Your Luck!</h2>
          <div className="space-y-1 max-h-[300px] overflow-hidden">
            {rouletteOffers.map((offer, idx) => (
              <div
                key={idx}
                className={`px-4 py-3 text-sm font-medium transition-all duration-100 ${
                  highlightedIndex === idx
                    ? 'gold-gradient text-primary-foreground scale-105'
                    : 'glass-panel text-muted-foreground'
                }`}
              >
                {offer}
              </div>
            ))}
          </div>
          {rouletteResult && !rouletteRunning && (
            <div className="mt-4 text-center">
              <p className="font-display text-lg text-primary">
                {rouletteResult.includes('Better Luck') ? '😅' : '🎉'} {rouletteResult}
              </p>
              <button
                onClick={() => setShowRoulette(false)}
                className="mt-4 px-6 py-2 gold-gradient text-primary-foreground font-medium"
              >
                Close
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoyaltyPage;
