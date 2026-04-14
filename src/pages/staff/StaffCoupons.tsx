import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const StaffCoupons = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    code: '', discount_type: 'percentage', discount_value: '', min_order: '0',
    max_uses: '', expires_at: '', is_active: true,
  });

  const { data: coupons = [] } = useQuery({
    queryKey: ['coupons-staff'],
    queryFn: async () => {
      const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.toUpperCase(),
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value) || 0,
        min_order: parseFloat(form.min_order) || 0,
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        expires_at: form.expires_at || null,
        is_active: form.is_active,
      };
      if (editing) {
        await supabase.from('coupons').update(payload).eq('id', editing.id);
      } else {
        await supabase.from('coupons').insert(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons-staff'] });
      setShowForm(false);
      setEditing(null);
      toast.success(editing ? 'Coupon updated' : 'Coupon created');
    },
    onError: () => toast.error('Failed to save coupon'),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from('coupons').update({ is_active: active }).eq('id', id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coupons-staff'] }),
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('coupons').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons-staff'] });
      toast.success('Coupon deleted');
    },
  });

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      code: c.code, discount_type: c.discount_type, discount_value: String(c.discount_value),
      min_order: String(c.min_order), max_uses: c.max_uses ? String(c.max_uses) : '',
      expires_at: c.expires_at ? c.expires_at.slice(0, 16) : '', is_active: c.is_active,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({ code: '', discount_type: 'percentage', discount_value: '', min_order: '0', max_uses: '', expires_at: '', is_active: true });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" /> Coupons
        </h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold maroon-gradient text-primary-foreground rounded-full"
        >
          <Plus className="w-3 h-3" /> Create
        </button>
      </div>

      <div className="space-y-2">
        {coupons.map((c) => (
          <div key={c.id} className={`ios-card p-4 flex items-center justify-between ${!c.is_active ? 'opacity-50' : ''}`}>
            <div>
              <p className="text-sm font-bold text-foreground tracking-wider">{c.code}</p>
              <p className="text-xs text-muted-foreground">
                {c.discount_value}{c.discount_type === 'percentage' ? '%' : '₹'} off
                {Number(c.min_order) > 0 && ` • Min ₹${c.min_order}`}
                {c.max_uses && ` • ${c.used_count}/${c.max_uses} used`}
              </p>
              {c.expires_at && (
                <p className="text-[10px] text-muted-foreground">
                  Expires: {new Date(c.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleActive.mutate({ id: c.id, active: !c.is_active })} className="p-1.5 text-muted-foreground hover:text-primary">
                {c.is_active ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => openEdit(c)} className="p-1.5 text-muted-foreground hover:text-primary">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={() => deleteCoupon.mutate(c.id)} className="p-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {coupons.length === 0 && <p className="text-muted-foreground text-sm text-center py-6">No coupons yet</p>}
      </div>

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) resetForm(); setShowForm(o); }}>
        <DialogContent className="bg-white border-border rounded-3xl max-w-md shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground">{editing ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="Code (e.g. WELCOME10) *" className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
            <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary">
              <option value="percentage">Percentage (%)</option>
              <option value="flat">Flat Amount (₹)</option>
            </select>
            <input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder="Discount Value *" className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
            <input type="number" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} placeholder="Min Order (₹)" className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
            <input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Max Uses (leave empty for unlimited)" className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
            <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="w-full px-4 py-2.5 bg-secondary text-foreground border border-border rounded-xl text-sm focus:outline-none focus:border-primary" />
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-primary w-4 h-4 rounded" />
              Active
            </label>
            <button onClick={() => save.mutate()} disabled={!form.code || !form.discount_value} className="w-full py-2.5 maroon-gradient text-primary-foreground font-medium rounded-xl disabled:opacity-50">
              {editing ? 'Update Coupon' : 'Create Coupon'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffCoupons;
