import { Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { haptic } from '@/lib/haptics';
import MenuItemDetailModal from './MenuItemDetailModal';

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
  const [detailOpen, setDetailOpen] = useState(false);
  const { addItem, items, updateQuantity } = useCart();
  const hasVariants = item.variants.length > 0;

  const badgeClass = hasVariants ? 'neutral-badge' : item.is_veg ? 'veg-badge' : 'nonveg-badge';

  const cartItem = items.find(i => i.menuItemId === item.id && !i.variantId);

  const handleAddBase = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasVariants) {
      haptic('selection');
      setDetailOpen(true);
    } else {
      haptic('medium');
      addItem({
        menuItemId: item.id,
        name: item.name,
        price: item.discountedPrice ?? item.base_price,
        isVeg: item.is_veg,
        description: item.description,
        servesCount: null,
      });
      supabase.from('item_selections').insert({ menu_item_id: item.id }).then(() => {});
    }
  };

  const bumpQty = (e: React.MouseEvent, qty: number, isInc: boolean) => {
    e.stopPropagation();
    haptic(isInc ? 'light' : 'selection');
    updateQuantity(item.id, undefined, qty);
  };

  const openDetail = () => {
    haptic('selection');
    setDetailOpen(true);
  };

  return (
    <>
      <div
        onClick={openDetail}
        className={`ios-card cursor-pointer active:scale-[0.98] transition-transform ${!item.is_available ? 'opacity-40' : ''}`}
      >
        <div className="p-4 flex items-start gap-3">
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
                className="flex-shrink-0 px-3 py-1.5 rounded-full border border-primary text-primary text-xs font-semibold hover:bg-primary/5 active:scale-95"
              >
                Options
              </button>
            ) : cartItem ? (
              <div className="flex items-center gap-0.5 border border-primary rounded-full overflow-hidden bg-white shadow-sm ios-spring-in" onClick={(e) => e.stopPropagation()}>
                <button onClick={(e) => bumpQty(e, cartItem.quantity - 1, false)} className="p-1.5 text-primary hover:bg-primary/5 ios-press">
                  <Minus className="w-3 h-3" />
                </button>
                <span key={cartItem.quantity} className="px-2 text-xs font-bold text-foreground min-w-[20px] text-center" style={{ animation: 'countPop 0.25s ease-out' }}>{cartItem.quantity}</span>
                <button onClick={(e) => bumpQty(e, cartItem.quantity + 1, true)} className="p-1.5 text-primary hover:bg-primary/5 ios-press">
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
      </div>

      <MenuItemDetailModal item={item} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  );
};

export default MenuItemCard;
