import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const StaffRoulettePrizes = () => {
  const qc = useQueryClient();
  const [newPrize, setNewPrize] = useState({ label: '', winning_label: '', is_better_luck: false });

  const { data: prizes = [] } = useQuery({
    queryKey: ['roulette-prizes'],
    queryFn: async () => {
      const { data } = await supabase.from('roulette_prizes').select('*').order('display_order');
      return data || [];
    },
  });

  const addPrize = useMutation({
    mutationFn: async () => {
      const order = (prizes[prizes.length - 1]?.display_order ?? 0) + 1;
      await supabase.from('roulette_prizes').insert({
        label: newPrize.label.trim(),
        winning_label: (newPrize.winning_label.trim() || newPrize.label.trim()),
        is_better_luck: newPrize.is_better_luck,
        display_order: order,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roulette-prizes'] });
      setNewPrize({ label: '', winning_label: '', is_better_luck: false });
      toast.success('Prize added to wheel');
    },
  });

  const updatePrize = useMutation({
    mutationFn: async (p: any) => {
      await supabase.from('roulette_prizes').update({
        label: p.label,
        winning_label: p.winning_label,
        is_better_luck: p.is_better_luck,
        is_active: p.is_active,
      }).eq('id', p.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roulette-prizes'] }),
  });

  const deletePrize = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('roulette_prizes').delete().eq('id', id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roulette-prizes'] });
      toast.success('Prize removed');
    },
  });

  return (
    <div className="ios-card p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-display text-base text-primary">Roulette Wheel Prizes</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        These tiles appear on the loyalty roulette wheel. Mark "Better Luck" for losing tiles.
      </p>

      <div className="space-y-2">
        {prizes.map((p: any) => (
          <div key={p.id} className={`bg-secondary/30 rounded-xl p-3 space-y-2 ${!p.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-2">
              <input
                value={p.label}
                onChange={(e) => updatePrize.mutate({ ...p, label: e.target.value })}
                placeholder="Tile label"
                className="flex-1 px-2 py-1.5 bg-background text-foreground border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
              <button
                onClick={() => updatePrize.mutate({ ...p, is_active: !p.is_active })}
                className="p-1 text-muted-foreground hover:text-primary"
                title={p.is_active ? 'Hide' : 'Show'}
              >
                {p.is_active ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => deletePrize.mutate(p.id)} className="p-1 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <input
              value={p.winning_label}
              onChange={(e) => updatePrize.mutate({ ...p, winning_label: e.target.value })}
              placeholder="Winning announcement (e.g., 20% OFF — up to ₹300)"
              className="w-full px-2 py-1.5 bg-background text-foreground border border-border rounded-lg text-xs focus:outline-none focus:border-primary"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={p.is_better_luck}
                onChange={(e) => updatePrize.mutate({ ...p, is_better_luck: e.target.checked })}
                className="accent-primary"
              />
              "Better Luck Next Time" tile (no reward)
            </label>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Add new prize</p>
        <input
          value={newPrize.label}
          onChange={(e) => setNewPrize({ ...newPrize, label: e.target.value })}
          placeholder="Tile label *"
          className="w-full px-3 py-2 bg-secondary text-foreground border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
        />
        <input
          value={newPrize.winning_label}
          onChange={(e) => setNewPrize({ ...newPrize, winning_label: e.target.value })}
          placeholder="Winning announcement (optional, defaults to tile label)"
          className="w-full px-3 py-2 bg-secondary text-foreground border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={newPrize.is_better_luck}
            onChange={(e) => setNewPrize({ ...newPrize, is_better_luck: e.target.checked })}
            className="accent-primary"
          />
          "Better Luck Next Time" tile
        </label>
        <button
          onClick={() => addPrize.mutate()}
          disabled={!newPrize.label.trim()}
          className="w-full flex items-center justify-center gap-1 py-2 maroon-gradient text-primary-foreground rounded-lg font-medium text-sm disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> Add Prize
        </button>
      </div>
    </div>
  );
};

export default StaffRoulettePrizes;