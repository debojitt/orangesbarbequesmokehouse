import { useCart } from '@/contexts/CartContext';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowLeft } from 'lucide-react';

const CartPage = () => {
  const { items, updateQuantity, removeItem, clearCart, subtotal, approximateTotal, itemCount } = useCart();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <h1 className="font-display text-2xl gold-text mb-4">Your Cart is Empty</h1>
        <p className="text-muted-foreground mb-6">Add some delicious items from the menu!</p>
        <Link to="/" className="px-6 py-2 gold-gradient text-primary-foreground font-medium">
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass-panel-strong">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
            <h1 className="font-display text-xl gold-text">Your Cart</h1>
          </div>
          <button onClick={clearCart} className="text-xs text-destructive hover:underline">Clear All</button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {items.map((item) => (
          <div key={`${item.menuItemId}-${item.variantId || 'base'}`} className="glass-panel p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className={item.isVeg ? 'veg-badge' : 'nonveg-badge'} />
              <div>
                <p className="text-foreground text-sm font-medium">{item.name}</p>
                {item.variantName && <p className="text-muted-foreground text-xs">{item.variantName}</p>}
                <p className="text-primary text-sm font-semibold">₹{item.price}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border">
                <button onClick={() => updateQuantity(item.menuItemId, item.variantId, item.quantity - 1)} className="p-2 text-muted-foreground hover:text-foreground">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-3 text-sm font-medium text-foreground">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.menuItemId, item.variantId, item.quantity + 1)} className="p-2 text-muted-foreground hover:text-foreground">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <span className="text-foreground font-semibold text-sm min-w-[60px] text-right">₹{item.price * item.quantity}</span>
              <button onClick={() => removeItem(item.menuItemId, item.variantId)} className="text-destructive p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bill Summary */}
      <div className="mx-4 mt-4 glass-panel-strong p-4">
        <h2 className="font-display text-lg text-primary mb-3">Approximate Bill</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
            <span className="text-foreground">₹{subtotal}</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between text-lg font-semibold">
            <span className="text-foreground">Approximate Total</span>
            <span className="text-primary">₹{approximateTotal}</span>
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
