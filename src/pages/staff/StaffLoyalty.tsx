import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/contexts/StaffAuthContext';
import { Search, UserPlus, RotateCcw, Eye, MessageSquare, QrCode, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import QrScanner from '@/components/QrScanner';
import { loyaltyApi } from '@/lib/loyalty';

const StaffLoyalty = () => {
  const queryClient = useQueryClient();
  const { staff } = useStaffAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showVisits, setShowVisits] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', phone: '' });
  const [overrideCard, setOverrideCard] = useState<any | null>(null);
  const [overridePin, setOverridePin] = useState('');
  const [overridePrizeId, setOverridePrizeId] = useState<string>('');
  const [savingOverride, setSavingOverride] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ['loyalty-customers', search],
    queryFn: async () => {
      let query = supabase.from('customers').select('*, loyalty_cards(*)').order('created_at', { ascending: false });
      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
      }
      const { data } = await query.limit(50);
      return data || [];
    },
  });

  const { data: visitHistory = [] } = useQuery({
    queryKey: ['visit-history', showVisits],
    queryFn: async () => {
      if (!showVisits) return [];
      const { data } = await supabase.from('loyalty_visits').select('*').eq('loyalty_card_id', showVisits).order('visit_number');
      return data || [];
    },
    enabled: !!showVisits,
  });

  const { data: rewardsConfig = [] } = useQuery({
    queryKey: ['rewards-config'],
    queryFn: async () => {
      const { data } = await supabase.from('loyalty_rewards_config').select('*').order('visit_number');
      return data || [];
    },
  });

  const { data: roulettePrizes = [] } = useQuery({
    queryKey: ['roulette-prizes-active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('roulette_prizes')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      return data || [];
    },
  });

  const addGuest = useMutation({
    mutationFn: async () => {
      const { data: customer } = await supabase.from('customers').insert({ name: newGuest.name, phone: newGuest.phone }).select().single();
      if (!customer) throw new Error('Failed');
      await supabase.from('loyalty_cards').insert({
        customer_id: customer.id,
        qr_code: customer.id,
        visit_count: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-customers'] });
      setShowAddGuest(false);
      setNewGuest({ name: '', phone: '' });
      toast.success('Guest added with loyalty card');
    },
  });

  const recordVisit = useMutation({
    mutationFn: async (card: any) => {
      const newCount = card.visit_count + 1;
      if (newCount > 7) {
        // Reset cycle
        await supabase.from('loyalty_cards').update({ visit_count: 1 }).eq('id', card.id);
      } else {
        await supabase.from('loyalty_cards').update({ visit_count: newCount }).eq('id', card.id);
      }
      // Update last visit
      await supabase.from('customers').update({ last_visit: new Date().toISOString() }).eq('id', card.customer_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-customers'] });
      toast.success('Visit recorded!');
    },
  });

  const restartCard = useMutation({
    mutationFn: async (cardId: string) => {
      await supabase.from('loyalty_cards').update({ visit_count: 0, is_active: true, expires_at: new Date(Date.now() + 90 * 86400000).toISOString() }).eq('id', cardId);
      await supabase.from('loyalty_visits').delete().eq('loyalty_card_id', cardId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty-customers'] });
      toast.success('Card restarted');
    },
  });

  const sendWhatsApp = (phone: string, name: string) => {
    const message = encodeURIComponent(`Hi ${name}! We miss you at INARA. Come visit us and enjoy your loyalty rewards! 🍽️`);
    window.open(`https://wa.me/91${phone.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  const openOverride = (card: any) => {
    setOverrideCard(card);
    setOverridePin('');
    setOverridePrizeId(card?.next_roulette_prize_id || '');
  };

  const saveOverride = async () => {
    if (!overrideCard) return;
    if (!overridePin.trim()) { toast.error('Enter staff PIN'); return; }
    setSavingOverride(true);
    try {
      await loyaltyApi.setRouletteOverride(
        overridePin.trim(),
        overrideCard.id,
        overridePrizeId || null,
      );
      toast.success(overridePrizeId ? 'Next roulette reward locked in 🎯' : 'Override cleared');
      setOverrideCard(null);
      queryClient.invalidateQueries({ queryKey: ['loyalty-customers'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to set override');
    } finally {
      setSavingOverride(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-primary">Loyalty Management</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-primary/30 text-primary rounded-lg ios-press"
          >
            <QrCode className="w-3 h-3" /> Scan QR
          </button>
          <button
            onClick={() => setShowAddGuest(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium maroon-gradient text-primary-foreground rounded-lg ios-press"
          >
            <UserPlus className="w-3 h-3" /> Add Guest
          </button>
        </div>
      </div>

      {showScanner && (
        <QrScanner
          onScan={(text) => {
            setShowScanner(false);
            // Accept either raw card UUID or a /checkin/:id URL
            const id = text.includes('/checkin/') ? text.split('/checkin/')[1].split(/[?#]/)[0] : text.trim();
            if (id) navigate(`/checkin/${id}`);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full pl-10 pr-4 py-2 bg-secondary text-foreground border border-border text-sm focus:outline-none focus:border-primary"
        />
      </div>

      {/* Guest List */}
      <div className="space-y-2">
        {customers.map((customer: any) => {
          const card = customer.loyalty_cards?.[0];
          return (
            <div key={customer.id} className="glass-panel p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">{customer.phone}</p>
                </div>
                <div className="text-right">
                  {card && (
                    <>
                      <p className="text-xs text-primary font-medium">Visit {card.visit_count}/7</p>
                      <p className="text-[10px] text-muted-foreground">
                        {customer.last_visit ? `Last: ${new Date(customer.last_visit).toLocaleDateString()}` : 'No visits'}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {card && (
                  <>
                    <button
                      onClick={() => recordVisit.mutate(card)}
                      className="px-2 py-1 text-[10px] font-medium gold-gradient text-primary-foreground"
                    >
                      +Visit
                    </button>
                    <button
                      onClick={() => setShowVisits(card.id)}
                      className="px-2 py-1 text-[10px] font-medium border border-border text-foreground hover:border-primary"
                    >
                      <Eye className="w-3 h-3 inline mr-1" />History
                    </button>
                    <button
                      onClick={() => restartCard.mutate(card.id)}
                      className="px-2 py-1 text-[10px] font-medium border border-border text-foreground hover:border-primary"
                    >
                      <RotateCcw className="w-3 h-3 inline mr-1" />Reset
                    </button>
                    <button
                      onClick={() => openOverride(card)}
                      className={`px-2 py-1 text-[10px] font-medium border ${card.next_roulette_prize_id ? 'border-primary text-primary' : 'border-border text-foreground hover:border-primary'}`}
                    >
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      {card.next_roulette_prize_id ? 'Override Set' : 'Pick Next Reward'}
                    </button>
                  </>
                )}
                <button
                  onClick={() => sendWhatsApp(customer.phone, customer.name)}
                  className="px-2 py-1 text-[10px] font-medium border border-border text-foreground hover:border-primary"
                >
                  <MessageSquare className="w-3 h-3 inline mr-1" />WhatsApp
                </button>
              </div>
            </div>
          );
        })}
        {customers.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">No guests found</p>}
      </div>

      {/* Add Guest Dialog */}
      <Dialog open={showAddGuest} onOpenChange={setShowAddGuest}>
        <DialogContent className="glass-panel-strong border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">Add New Guest</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <input value={newGuest.name} onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })} placeholder="Guest Name *" className="w-full px-3 py-2 bg-secondary text-foreground border border-border text-sm focus:outline-none focus:border-primary" />
            <input value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} placeholder="Phone Number *" className="w-full px-3 py-2 bg-secondary text-foreground border border-border text-sm focus:outline-none focus:border-primary" />
            <button onClick={() => addGuest.mutate()} disabled={!newGuest.name || !newGuest.phone} className="w-full py-2 gold-gradient text-primary-foreground font-medium disabled:opacity-50">Add Guest</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visit History Dialog */}
      <Dialog open={!!showVisits} onOpenChange={() => setShowVisits(null)}>
        <DialogContent className="glass-panel-strong border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">Visit History</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {visitHistory.map((v) => (
              <div key={v.id} className="glass-panel p-2 flex justify-between text-sm">
                <span className="text-foreground">Visit {v.visit_number}</span>
                <span className="text-muted-foreground">{v.reward_result || 'No reward'}</span>
              </div>
            ))}
            {visitHistory.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No visits recorded yet</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Override Next Roulette Reward Dialog */}
      <Dialog open={!!overrideCard} onOpenChange={(o) => !o && setOverrideCard(null)}>
        <DialogContent className="glass-panel-strong border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Pick Next Roulette Reward
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              The wheel will land on this prize the next time the guest spins. Override is consumed after one use.
            </p>
            <input
              type="password"
              value={overridePin}
              onChange={(e) => setOverridePin(e.target.value)}
              placeholder="Staff PIN *"
              className="w-full px-3 py-2 bg-secondary text-foreground border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
            <select
              value={overridePrizeId}
              onChange={(e) => setOverridePrizeId(e.target.value)}
              className="w-full px-3 py-2 bg-secondary text-foreground border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            >
              <option value="">— Clear override (random/default) —</option>
              {roulettePrizes.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.is_better_luck ? '💀 ' : '🎁 '}{p.label}
                </option>
              ))}
            </select>
            <button
              onClick={saveOverride}
              disabled={savingOverride}
              className="w-full py-2 maroon-gradient text-primary-foreground font-medium rounded-lg disabled:opacity-50"
            >
              {savingOverride ? 'Saving…' : 'Lock In Next Reward'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffLoyalty;
