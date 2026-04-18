import { ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
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

const MenuItemCard = ({ item }: { item: MenuItem }) => {
  const [expanded, setExpanded] = useState(false);
  const { addItem, items, updateQuantity } = useCart();
  const hasVariants = item.variants.length > 0;

  const badgeClass = hasVariants ? 'neutral-badge' : item.is_veg ? 'veg-badge' : 'nonveg-badge';

  const cartItem = items.find(i => i.menuItemId === item.id && !i.variantId);
  const cartVariantItems = items.filter(i => i.menuItemId === item.id && i.variantId);

  const handleAddBase = () => {
    if (hasVariants) {
      haptic('selection');
      setExpanded(!expanded);
    } else {
      haptic('medium');
      addItem({ menuItemId: item.id, name: item.name, price: item.discountedPrice ?? item.base_price, isVeg: item.is_veg });
      supabase.from('item_selections').insert({ menu_item_id: item.id }).then(() => {});
    }
  };

  const handleAddVariant = (v: Variant) => {
    haptic('medium');
    addItem({ menuItemId: item.id, name: item.name, variantId: v.id, variantName: v.name, price: v.price, isVeg: item.is_veg });
    supabase.from('item_selections').insert({ menu_item_id: item.id }).then(() => {});
  };

  const bumpQty = (variantId: string | undefined, qty: number, isInc: boolean) => {
    haptic(isInc ? 'light' : 'selection');
    updateQuantity(item.id, variantId, qty);
  };

  return (
    <div className={`ios-card ${!item.is_available ? 'opacity-40' : ''}`}>
      <div className="p-4 flex items-start gap-3">
        {/* Image or Veg/NonVeg badge */}
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-sm"
            loading="lazy"
          />
        ) : (
          <div className={`flex-shrink-0 mt-1 ${badgeClass}`} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.imageUrl && <div className={`${badgeClass} mr-0.5`} />}
            <h3 className="text-foreground font-semibold text-sm">{item.name}</h3>
            {item.is_bestseller && (
              <span className="px-1.5 py-0.5 text-[8px] font-bold maroon-gradient text-primary-foreground rounded-full">BEST</span>
            )}
            {item.is_chef_special && (
              <span className="px-1.5 py-0.5 text-[8px] font-bold border border-primary text-primary rounded-full">CHEF</span>
            )}
            {item.is_daily_special && (
              <span className="px-1.5 py-0.5 text-[8px] font-bold bg-primary/10 text-primary rounded-full">TODAY</span>
            )}
          </div>
          {item.description && <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{item.description}</p>}
          {item.serving_info && <p className="text-muted-foreground/60 text-[10px] mt-0.5">{item.serving_info}</p>}
          <div className="flex items-center gap-2 mt-1.5">
            {item.discountedPrice ? (
              <>
                <span className="text-muted-foreground text-xs line-through">₹{item.base_price}</span>
                <span className="text-primary font-bold text-sm">₹{item.discountedPrice}</span>
              </>
            ) : (
              <span className="text-primary font-bold text-sm">
                {hasVariants ? `₹${Math.min(...item.variants.map(v => v.price))}+` : `₹${item.base_price}`}
              </span>
            )}
          </div>
        </div>

        {item.is_available ? (
          hasVariants ? (
            <button
              onClick={handleAddBase}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-primary text-primary text-xs font-semibold hover:bg-primary/5 active:scale-95"
            >
              {expanded ? 'Hide' : 'Options'}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ) : cartItem ? (
            <div className="flex items-center gap-0.5 border border-primary rounded-full overflow-hidden bg-white shadow-sm ios-spring-in">
              <button onClick={() => bumpQty(undefined, cartItem.quantity - 1, false)} className="p-1.5 text-primary hover:bg-primary/5 ios-press">
                <Minus className="w-3 h-3" />
              </button>
              <span key={cartItem.quantity} className="px-2 text-xs font-bold text-foreground min-w-[20px] text-center" style={{ animation: 'countPop 0.25s ease-out' }}>{cartItem.quantity}</span>
              <button onClick={() => bumpQty(undefined, cartItem.quantity + 1, true)} className="p-1.5 text-primary hover:bg-primary/5 ios-press">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddBase}
              className="flex-shrink-0 w-9 h-9 rounded-full maroon-gradient text-primary-foreground flex items-center justify-center shadow-md hover:shadow-lg ios-press premium-shine"
            >
              <Plus className="w-4 h-4" />
            </button>
          )
        ) : (
          <span className="text-[10px] text-muted-foreground italic">N/A</span>
        )}
      </div>

      {expanded && hasVariants && (
        <div className="border-t border-border bg-secondary/30 px-4 py-2 space-y-1 ios-fade-up">
          {item.variants.map((v) => {
            const cv = cartVariantItems.find(ci => ci.variantId === v.id);
            return (
              <div key={v.id} className="flex items-center justify-between py-2 px-2 rounded-xl hover:bg-white/60">
                <div>
                  <span className="text-foreground text-sm font-medium">{v.name}</span>
                  {v.serves_count && v.serves_count > 1 && (
                    <span className="text-muted-foreground text-xs ml-1.5">• Serves {v.serves_count}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-bold text-sm">₹{v.price}</span>
                  {cv ? (
                    <div className="flex items-center gap-0.5 border border-primary rounded-full overflow-hidden bg-white ios-spring-in">
                      <button onClick={() => bumpQty(v.id, cv.quantity - 1, false)} className="p-1 text-primary hover:bg-primary/5 ios-press">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span key={cv.quantity} className="px-1.5 text-xs font-bold text-foreground" style={{ animation: 'countPop 0.25s ease-out' }}>{cv.quantity}</span>
                      <button onClick={() => bumpQty(v.id, cv.quantity + 1, true)} className="p-1 text-primary hover:bg-primary/5 ios-press">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddVariant(v)}
                      className="px-3 py-1 text-xs font-semibold maroon-gradient text-primary-foreground rounded-full ios-press premium-shine"
                    >
                      ADD
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MenuItemCard;
