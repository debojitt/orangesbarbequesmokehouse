import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Minus } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { haptic } from '@/lib/haptics';

interface Variant {
  id: string;
  name: string;
  price: number;
  serves_count: number | null;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  serving_info: string | null;
  base_price: number;
  is_veg: boolean;
  is_bestseller: boolean;
  is_chef_special: boolean;
  is_available: boolean;
  is_daily_special: boolean;
  variants: Variant[];
  discountedPrice?: number;
  imageUrl?: string | null;
}

interface Props {
  item: MenuItem | null;
  open: boolean;
  onClose: () => void;
}

const MenuItemDetailModal = ({ item, open, onClose }: Props) => {
  const { addItem, items, updateQuantity } = useCart();
  if (!item) return null;

  const hasVariants = item.variants.length > 0;
  const cartItem = items.find(i => i.menuItemId === item.id && !i.variantId);
  const cartVariantItems = items.filter(i => i.menuItemId === item.id && i.variantId);
  const badgeClass = item.is_veg ? 'veg-badge' : 'nonveg-badge';

  const handleAddBase = () => {
    haptic('medium');
    addItem({ menuItemId: item.id, name: item.name, price: item.discountedPrice ?? item.base_price, isVeg: item.is_veg });
    supabase.from('item_selections').insert({ menu_item_id: item.id }).then(() => {});
  };

  const handleAddVariant = (v: Variant) => {
    haptic('medium');
    addItem({ menuItemId: item.id, name: item.name, variantId: v.id, variantName: v.name, price: v.price, isVeg: item.is_veg });
    supabase.from('item_selections').insert({ menu_item_id: item.id }).then(() => {});
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-panel-strong border-border max-w-md p-0 overflow-hidden gap-0 rounded-3xl">
        {/* Header */}
        <div className="relative">
          {item.imageUrl ? (
            <div className="relative h-56 w-full overflow-hidden">
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </div>
          ) : (
            <div className="h-32 maroon-gradient" />
          )}
          <button
            onClick={() => { haptic('selection'); onClose(); }}
            className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-md ios-press"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto ios-fade-up">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className={badgeClass} />
            <h2 className="font-display text-2xl text-foreground leading-tight flex-1 min-w-0">{item.name}</h2>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {item.is_bestseller && (
              <span className="px-2 py-0.5 text-[10px] font-bold maroon-gradient text-primary-foreground rounded-full">BESTSELLER</span>
            )}
            {item.is_chef_special && (
              <span className="px-2 py-0.5 text-[10px] font-bold border border-primary text-primary rounded-full">CHEF'S SPECIAL</span>
            )}
            {item.is_daily_special && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded-full">TODAY'S PICK</span>
            )}
          </div>

          {item.description && (
            <p className="text-foreground/80 text-sm leading-relaxed mb-3">{item.description}</p>
          )}

          {item.serving_info && (
            <p className="text-muted-foreground text-xs mb-4 italic">🍽️ {item.serving_info}</p>
          )}

          {/* Pricing */}
          {!hasVariants ? (
            <div className="flex items-center justify-between p-4 bg-secondary/60 rounded-2xl mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Price</p>
                <div className="flex items-center gap-2">
                  {item.discountedPrice ? (
                    <>
                      <span className="text-muted-foreground text-sm line-through">₹{item.base_price}</span>
                      <span className="text-primary font-bold text-2xl">₹{item.discountedPrice}</span>
                    </>
                  ) : (
                    <span className="text-primary font-bold text-2xl">₹{item.base_price}</span>
                  )}
                </div>
              </div>
              {item.is_available && (
                cartItem ? (
                  <div className="flex items-center gap-1 border border-primary rounded-full overflow-hidden bg-white">
                    <button onClick={() => { haptic('selection'); updateQuantity(item.id, undefined, cartItem.quantity - 1); }} className="p-2 text-primary ios-press">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-3 text-base font-bold text-foreground min-w-[24px] text-center">{cartItem.quantity}</span>
                    <button onClick={() => { haptic('light'); updateQuantity(item.id, undefined, cartItem.quantity + 1); }} className="p-2 text-primary ios-press">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleAddBase}
                    className="px-5 py-2.5 maroon-gradient text-primary-foreground font-semibold rounded-full ios-press premium-shine flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                )
              )}
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Choose your option</p>
              {item.variants.map((v) => {
                const cv = cartVariantItems.find(ci => ci.variantId === v.id);
                return (
                  <div key={v.id} className="flex items-center justify-between p-3 bg-secondary/60 rounded-2xl">
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground text-sm font-semibold">{v.name}</p>
                      {v.serves_count && v.serves_count > 1 && (
                        <p className="text-muted-foreground text-xs">Serves {v.serves_count}</p>
                      )}
                      <p className="text-primary font-bold text-base mt-0.5">₹{v.price}</p>
                    </div>
                    {item.is_available && (cv ? (
                      <div className="flex items-center gap-1 border border-primary rounded-full overflow-hidden bg-white">
                        <button onClick={() => { haptic('selection'); updateQuantity(item.id, v.id, cv.quantity - 1); }} className="p-1.5 text-primary ios-press">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2 text-sm font-bold text-foreground min-w-[20px] text-center">{cv.quantity}</span>
                        <button onClick={() => { haptic('light'); updateQuantity(item.id, v.id, cv.quantity + 1); }} className="p-1.5 text-primary ios-press">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddVariant(v)}
                        className="px-4 py-1.5 text-xs font-semibold maroon-gradient text-primary-foreground rounded-full ios-press premium-shine"
                      >
                        ADD
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {!item.is_available && (
            <p className="text-center text-sm text-muted-foreground py-3">Currently unavailable</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MenuItemDetailModal;
