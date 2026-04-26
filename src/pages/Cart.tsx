import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowLeft, Tag, X, Users, Sparkles, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { haptic } from '@/lib/haptics';

const CartPage = () => {
  const { items, updateQuantity, removeItem, clearCart, subtotal, approximateTotal } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [applying, setApplying] = useState(false);
  const [splitCount, setSplitCount] = useState(1);

  const SERVICE_THRESHOLD = 800;
  const SERVICE_FEE = 150;
  const serviceFee = subtotal > SERVICE_THRESHOLD ? SERVICE_FEE : 0;
  const amountToFreeService = serviceFee === 0 ? Math.max(0, SERVICE_THRESHOLD - subtotal + 1) : 0;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplying(true);
    haptic('selection');
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (!data) {
      haptic('error');
      toast.error('Invalid or expired coupon');
      setApplying(false);
      return;
    }
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      haptic('error');
      toast.error('This coupon has expired');
      setApplying(false);
      return;
    }
    if (data.max_uses && data.used_count >= data.max_uses) {
      haptic('error');
      toast.error('Coupon usage limit reached');
      setApplying(false);
      return;
    }
    if (data.min_order && approximateTotal < Number(data.min_order)) {
      haptic('warning');
      toast.error(`Minimum order ₹${data.min_order} required`);
      setApplying(false);
      return;
    }
    const discount = data.discount_type === 'percentage'
      ? Math.round(approximateTotal * Number(data.discount_value) / 100)
      : Number(data.discount_value);
    setAppliedCoupon({ code: data.code, discount });
    haptic('success');
    toast.success(`Coupon applied! ₹${discount} off`);
    setApplying(false);
  };

  const finalTotal = appliedCoupon ? Math.max(0, approximateTotal - appliedCoupon.discount) : approximateTotal;
  const perPerson = splitCount > 0 ? Math.ceil(finalTotal / splitCount) : finalTotal;

  const adjustSplit = (delta: number) => {
    const next = Math.max(1, Math.min(20, splitCount + delta));
    if (next !== splitCount) {
      haptic('selection');
      setSplitCount(next);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 ios-fade-up">
        <h1 className="font-display text-2xl text-foreground mb-4">Your Cart is Empty</h1>
        <p className="text-muted-foreground mb-6 text-sm">Add some delicious items from the menu!</p>
        <Link to="/" className="px-6 py-2.5 maroon-gradient text-primary-foreground font-medium rounded-full ios-press premium-shine">
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-50 glass-panel-strong">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground ios-press" onClick={() => haptic('selection')}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-display text-xl text-foreground">Your Cart</h1>
          </div>
          <button
            onClick={() => { haptic('warning'); clearCart(); }}
            className="text-xs text-destructive hover:underline ios-press"
          >
            Clear All
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3 stagger">
        {items.map((item) => (
          <div key={`${item.menuItemId}-${item.variantId || 'base'}`} className="ios-card p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`${item.isVeg ? 'veg-badge' : 'nonveg-badge'} mt-1 flex-shrink-0`} />
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-medium truncate">{item.name}</p>
                {item.variantName && (
                  <p className="text-muted-foreground text-xs mt-0.5">
                    <span className="font-medium text-foreground/70">{item.variantName}</span>
                    {item.servesCount && item.servesCount > 1 && (
                      <span> · Serves {item.servesCount}</span>
                    )}
                  </p>
                )}
                {item.description && (
                  <p className="text-muted-foreground/70 text-[11px] line-clamp-1 mt-0.5">{item.description}</p>
                )}
                <p className="text-primary text-sm font-bold mt-1">₹{item.price}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-border rounded-full overflow-hidden bg-white shadow-sm">
                <button
                  onClick={() => { haptic('selection'); updateQuantity(item.menuItemId, item.variantId, item.quantity - 1); }}
                  className="p-2 text-muted-foreground hover:text-foreground ios-press"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span key={item.quantity} className="px-3 text-sm font-bold text-foreground" style={{ animation: 'countPop 0.25s ease-out' }}>
                  {item.quantity}
                </span>
                <button
                  onClick={() => { haptic('light'); updateQuantity(item.menuItemId, item.variantId, item.quantity + 1); }}
                  className="p-2 text-muted-foreground hover:text-foreground ios-press"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="text-foreground font-bold text-sm min-w-[50px] text-right">₹{item.price * item.quantity}</span>
              <button
                onClick={() => { haptic('warning'); removeItem(item.menuItemId, item.variantId); }}
                className="text-destructive p-1 ios-press"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Coupon Section */}
      <div className="mx-4 mt-3 ios-card p-4 ios-fade-up">
        <div className="flex items-center gap-2 mb-2">
          <Tag className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Have a coupon?</span>
        </div>
        {appliedCoupon ? (
          <div className="flex items-center justify-between bg-primary/10 rounded-xl px-4 py-2 ios-spring-in">
            <span className="text-sm text-primary font-medium">{appliedCoupon.code} — ₹{appliedCoupon.discount} off</span>
            <button
              onClick={() => { haptic('selection'); setAppliedCoupon(null); }}
              className="text-muted-foreground ios-press"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="flex-1 px-4 py-2 bg-secondary text-foreground text-sm rounded-xl border border-border focus:outline-none focus:border-primary placeholder:text-muted-foreground"
            />
            <button
              onClick={handleApplyCoupon}
              disabled={applying || !couponCode.trim()}
              className="px-4 py-2 maroon-gradient text-primary-foreground text-sm font-medium rounded-xl disabled:opacity-50 ios-press premium-shine"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Bill Splitter */}
      <div className="mx-4 mt-3 ios-card p-4 ios-fade-up">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Split the bill</span>
          </div>
          <div className="flex items-center gap-0.5 border border-primary rounded-full overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => adjustSplit(-1)}
              disabled={splitCount <= 1}
              className="p-1.5 text-primary hover:bg-primary/5 ios-press disabled:opacity-40"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span key={splitCount} className="px-3 text-sm font-bold text-foreground min-w-[28px] text-center" style={{ animation: 'countPop 0.25s ease-out' }}>
              {splitCount}
            </span>
            <button
              onClick={() => adjustSplit(1)}
              disabled={splitCount >= 20}
              className="p-1.5 text-primary hover:bg-primary/5 ios-press disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => { haptic('selection'); setSplitCount(n); }}
              className={`px-3 py-1 text-xs font-medium rounded-full ios-press transition-colors ${
                splitCount === n
                  ? 'maroon-gradient text-primary-foreground shadow-sm'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {n} people
            </button>
          ))}
        </div>

        {splitCount > 1 && (
          <div className="flex items-center justify-between bg-primary/5 rounded-xl px-4 py-3 ios-spring-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Each person pays</span>
            </div>
            <span key={perPerson} className="text-primary font-bold text-lg" style={{ animation: 'countPop 0.3s ease-out' }}>
              ≈ ₹{perPerson}
            </span>
          </div>
        )}
      </div>

      {/* Bill Summary */}
      <div className="mx-4 mt-3 ios-card p-4 ios-fade-up">
        <h2 className="font-display text-lg text-foreground mb-3">Approximate Bill</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">₹{subtotal}</span>
          </div>
          {serviceFee > 0 ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                Service & taxes
                <span className="text-[9px] text-muted-foreground/70">(orders above ₹{SERVICE_THRESHOLD})</span>
              </span>
              <span className="text-foreground">+₹{SERVICE_FEE}</span>
            </div>
          ) : amountToFreeService > 0 && amountToFreeService <= 300 ? (
            <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-secondary/60 rounded-lg px-2.5 py-1.5">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>Add ₹{amountToFreeService} more and a ₹{SERVICE_FEE} service charge will apply (kicks in above ₹{SERVICE_THRESHOLD}).</span>
            </div>
          ) : null}
          {appliedCoupon && (
            <div className="flex justify-between text-sm">
              <span className="text-green-600">Coupon Discount</span>
              <span className="text-green-600">-₹{appliedCoupon.discount}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 flex justify-between text-lg font-bold">
            <span className="text-foreground">Approximate Total</span>
            <span className="text-primary">≈ ₹{finalTotal}</span>
          </div>
          {splitCount > 1 && (
            <div className="flex justify-between text-xs text-muted-foreground pt-1">
              <span>Split {splitCount} ways</span>
              <span>≈ ₹{perPerson} × {splitCount}</span>
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 italic">
          * This is an approximate estimate. Your final bill may vary.
        </p>
      </div>
    </div>
  );
};

export default CartPage;
