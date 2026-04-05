import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type DiscountType = Database['public']['Enums']['discount_type'];
type DiscountTarget = Database['public']['Enums']['discount_target'];

const StaffOffers = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', type: 'percentage' as DiscountType, value: '', applies_to: 'all' as DiscountTarget,
    target_id: '', start_time: '', end_time: '', is_active: true,
  });

  const { data: discounts = [] } = useQuery({
    queryKey: ['discounts-staff'],
    queryFn: async () => {
      const { data } = await supabase.from('discounts').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories-all'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').order('display_order');
      return data || [];
    },
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items-list'],
    queryFn: async () => {
      const { data } = await supabase.from('menu_items').select('id, name');
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        type: form.type,
        value: parseFloat(form.value) || 0,
        applies_to: form.applies_to,
        target_id: form.target_id || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        is_active: form.is_active,
      };
      if (editing) {
        await supabase.from('discounts').update(payload).eq('id', editing.id);
      } else {
        await supabase.from('discounts').insert(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts-staff'] });
      setShowForm(false);
      setEditing(null);
      toast.success(editing ? 'Offer updated' : 'Offer created');
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from('discounts').update({ is_active: active }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discounts-staff'] }),
  });

  const deleteDiscount = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('discounts').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts-staff'] });
      toast.success('Offer deleted');
    },
  });

  const openEdit = (d: any) => {
    setEditing(d);
    setForm({
      name: d.name, type: d.type, value: String(d.value), applies_to: d.applies_to,
      target_id: d.target_id || '', start_time: d.start_time || '', end_time: d.end_time || '', is_active: d.is_active,
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-primary">Offers & Discounts</h2>
        <button
          onClick={() => { setEditing(null); setForm({ name: '', type: 'percentage', value: '', applies_to: 'all', target_id: '', start_time: '', end_time: '', is_active: true }); setShowForm(true); }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium gold-gradient text-primary-foreground"
        >
          <Plus className="w-3 h-3" /> Create Offer
        </button>
      </div>

      <div className="space-y-2">
        {discounts.map((d) => (
          <div key={d.id} className={`glass-panel p-3 flex items-center justify-between ${!d.is_active ? 'opacity-50' : ''}`}>
            <div>
              <p className="text-sm font-medium text-foreground">{d.name}</p>
              <p className="text-xs text-muted-foreground">
                {d.value}% {d.type === 'percentage' ? 'OFF' : d.type} • {d.applies_to}
                {d.start_time && ` • ${new Date(d.start_time).toLocaleTimeString()} - ${d.end_time ? new Date(d.end_time).toLocaleTimeString() : 'ongoing'}`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleActive.mutate({ id: d.id, active: !d.is_active })} className="p-1.5 text-muted-foreground hover:text-primary">
                {d.is_active ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4" />}
              </button>
              <button onClick={() => openEdit(d)} className="p-1.5 text-muted-foreground hover:text-primary">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={() => deleteDiscount.mutate(d.id)} className="p-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {discounts.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">No offers yet</p>}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="glass-panel-strong border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">{editing ? 'Edit Offer' : 'Create Offer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Offer Name *" className="w-full px-3 py-2 bg-secondary text-foreground border border-border text-sm focus:outline-none focus:border-primary" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DiscountType })} className="w-full px-3 py-2 bg-secondary text-foreground border border-border text-sm focus:outline-none focus:border-primary">
              <option value="percentage">Percentage</option>
              <option value="combo">Combo Deal</option>
              <option value="time_based">Time-Based</option>
            </select>
            <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="Value (e.g., 20 for 20%)" className="w-full px-3 py-2 bg-secondary text-foreground border border-border text-sm focus:outline-none focus:border-primary" />
            <select value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value as DiscountTarget })} className="w-full px-3 py-2 bg-secondary text-foreground border border-border text-sm focus:outline-none focus:border-primary">
              <option value="all">All Items</option>
              <option value="category">Specific Category</option>
              <option value="item">Specific Item</option>
            </select>
            {form.applies_to === 'category' && (
              <select value={form.target_id} onChange={(e) => setForm({ ...form, target_id: e.target.value })} className="w-full px-3 py-2 bg-secondary text-foreground border border-border text-sm focus:outline-none focus:border-primary">
                <option value="">Select Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            {form.applies_to === 'item' && (
              <select value={form.target_id} onChange={(e) => setForm({ ...form, target_id: e.target.value })} className="w-full px-3 py-2 bg-secondary text-foreground border border-border text-sm focus:outline-none focus:border-primary">
                <option value="">Select Item</option>
                {menuItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            )}
            {form.type === 'time_based' && (
              <div className="flex gap-2">
                <input type="datetime-local" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="flex-1 px-3 py-2 bg-secondary text-foreground border border-border text-xs focus:outline-none focus:border-primary" />
                <input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="flex-1 px-3 py-2 bg-secondary text-foreground border border-border text-xs focus:outline-none focus:border-primary" />
              </div>
            )}
            <button onClick={() => save.mutate()} disabled={!form.name || !form.value} className="w-full py-2 gold-gradient text-primary-foreground font-medium disabled:opacity-50">
              {editing ? 'Update Offer' : 'Create Offer'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffOffers;
