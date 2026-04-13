import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowLeft, Tag, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CartPage = () => {
  const { items, updateQuantity, removeItem, clearCart, approximateTotal, itemCount } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [applying, setApplying] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplying(true);
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (!data) {
      toast.error('Invalid or expired coupon');
      setApplying(false);
      return;
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      toast.error('This coupon has expired');
      setApplying(false);
      return;
    }

    if (data.max_uses && data.used_count >= data.max_uses) {
      toast.error('Coupon usage limit reached');
      setApplying(false);
      return;
    }

    if (data.min_order && approximateTotal < Number(data.min_order)) {
      toast.error(`Minimum order ₹${data.min_order} required`);
      setApplying(false);
      return;
    }

    const discount = data.discount_type === 'percentage'
      ? Math.round(approximateTotal * Number(data.discount_value) / 100)
      : Number(data.discount_value);

    setAppliedCoupon({ code: data.code, discount });
    toast.success(`Coupon applied! ₹${discount} off`);
    setApplying(false);
  };

  const finalTotal = appliedCoupon ? Math.max(0, approximateTotal - appliedCoupon.discount) : approximateTotal;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <h1 className="font-display text-2xl gold-text mb-4">Your Cart is Empty</h1>
        <p className="text-muted-foreground mb-6 text-sm">Add some delicious items from the menu!</p>
        <Link to="/" className="px-6 py-2.5 maroon-gradient text-primary-foreground font-medium rounded-full">
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-50 glass-panel-strong">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
            <h1 className="font-display text-xl gold-text">Your Cart</h1>
          </div>
          <button onClick={clearCart} className="text-xs text-destructive hover:underline">Clear All</button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {items.map((item) => (
          <div key={`${item.menuItemId}-${item.variantId || 'base'}`} className="ios-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className={item.isVeg ? 'veg-badge' : 'nonveg-badge'} />
              <div>
                <p className="text-foreground text-sm font-medium">{item.name}</p>
                {item.variantName && <p className="text-muted-foreground text-xs">{item.variantName}</p>}
                <p className="text-primary text-sm font-semibold">₹{item.price}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border rounded-full overflow-hidden">
                <button onClick={() => updateQuantity(item.menuItemId, item.variantId, item.quantity - 1)} className="p-2 text-muted-foreground hover:text-foreground">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-3 text-sm font-medium text-foreground">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.menuItemId, item.variantId, item.quantity + 1)} className="p-2 text-muted-foreground hover:text-foreground">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="text-foreground font-semibold text-sm min-w-[50px] text-right">₹{item.price * item.quantity}</span>
              <button onClick={() => removeItem(item.menuItemId, item.variantId)} className="text-destructive p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Coupon Section */}
      <div className="mx-4 mt-3 ios-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Tag className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Have a coupon?</span>
        </div>
        {appliedCoupon ? (
          <div className="flex items-center justify-between bg-primary/10 rounded-xl px-4 py-2">
            <span className="text-sm text-primary font-medium">{appliedCoupon.code} — ₹{appliedCoupon.discount} off</span>
            <button onClick={() => setAppliedCoupon(null)} className="text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="flex-1 px-4 py-2 bg-secondary/60 text-foreground text-sm rounded-xl border border-border focus:outline-none focus:border-primary placeholder:text-muted-foreground"
            />
            <button
              onClick={handleApplyCoupon}
              disabled={applying || !couponCode.trim()}
              className="px-4 py-2 maroon-gradient text-primary-foreground text-sm font-medium rounded-xl disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Bill Summary — show only approximate total */}
      <div className="mx-4 mt-4 ios-card p-4">
        <h2 className="font-display text-lg text-primary mb-3">Approximate Bill</h2>
        <div className="space-y-2">
          {appliedCoupon && (
            <div className="flex justify-between text-sm">
              <span className="text-green-400">Coupon Discount</span>
              <span className="text-green-400">-₹{appliedCoupon.discount}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 flex justify-between text-lg font-semibold">
            <span className="text-foreground">Approximate Total</span>
            <span className="text-primary">≈ ₹{finalTotal}</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 italic">
          * This is an approximate estimate. Your final bill may vary.
        </p>
      </div>
    </div>
  );
};

export default CartPage;
