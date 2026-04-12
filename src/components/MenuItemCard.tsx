import { ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';

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
}

const MenuItemCard = ({ item }: { item: MenuItem }) => {
  const [expanded, setExpanded] = useState(false);
  const { addItem, items, updateQuantity } = useCart();
  const hasVariants = item.variants.length > 0;

  const cartItem = items.find(i => i.menuItemId === item.id && !i.variantId);
  const cartVariantItems = items.filter(i => i.menuItemId === item.id && i.variantId);

  const handleAddBase = () => {
    if (hasVariants) {
      setExpanded(!expanded);
    } else {
      addItem({ menuItemId: item.id, name: item.name, price: item.discountedPrice ?? item.base_price, isVeg: item.is_veg });
      supabase.from('item_selections').insert({ menu_item_id: item.id }).then(() => {});
    }
  };

  const handleAddVariant = (v: Variant) => {
    addItem({ menuItemId: item.id, name: item.name, variantId: v.id, variantName: v.name, price: v.price, isVeg: item.is_veg });
    supabase.from('item_selections').insert({ menu_item_id: item.id }).then(() => {});
  };

  return (
    <div className={`glass-panel rounded-2xl overflow-hidden transition-all ${!item.is_available ? 'opacity-40' : ''}`}>
      {/* Main row */}
      <div className="p-4 flex items-center gap-3">
        {/* Veg/Non-veg indicator */}
        <div className={`flex-shrink-0 ${item.is_veg ? 'veg-badge' : 'nonveg-badge'}`} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-foreground font-medium text-sm">{item.name}</h3>
            {item.is_bestseller && (
              <span className="px-1.5 py-0.5 text-[8px] font-bold gold-gradient text-primary-foreground rounded-md">BEST</span>
            )}
            {item.is_chef_special && (
              <span className="px-1.5 py-0.5 text-[8px] font-bold border border-primary text-primary rounded-md">CHEF</span>
            )}
            {item.is_daily_special && (
              <span className="px-1.5 py-0.5 text-[8px] font-bold bg-primary/20 text-primary rounded-md">TODAY</span>
            )}
          </div>
          {item.description && <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{item.description}</p>}
          <div className="flex items-center gap-2 mt-1">
            {item.discountedPrice ? (
              <>
                <span className="text-muted-foreground text-xs line-through">₹{item.base_price}</span>
                <span className="text-primary font-semibold text-sm">₹{item.discountedPrice}</span>
              </>
            ) : (
              <span className="text-primary font-semibold text-sm">
                {hasVariants ? `₹${Math.min(...item.variants.map(v => v.price))}+` : `₹${item.base_price}`}
              </span>
            )}
          </div>
        </div>

        {/* Action button */}
        {item.is_available ? (
          hasVariants ? (
            <button
              onClick={handleAddBase}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl border border-primary/40 text-primary text-xs font-medium hover:bg-primary/10 transition-colors"
            >
              {expanded ? 'Hide' : 'Options'}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ) : cartItem ? (
            <div className="flex items-center gap-1 border border-primary/40 rounded-xl overflow-hidden">
              <button onClick={() => updateQuantity(item.id, undefined, cartItem.quantity - 1)} className="p-1.5 text-primary hover:bg-primary/10">
                <Minus className="w-3 h-3" />
              </button>
              <span className="px-2 text-xs font-semibold text-foreground">{cartItem.quantity}</span>
              <button onClick={() => updateQuantity(item.id, undefined, cartItem.quantity + 1)} className="p-1.5 text-primary hover:bg-primary/10">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAddBase}
              className="flex-shrink-0 w-9 h-9 rounded-xl gold-gradient text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
            </button>
          )
        ) : (
          <span className="text-[10px] text-muted-foreground italic">N/A</span>
        )}
      </div>

      {/* Variants dropdown */}
      {expanded && hasVariants && (
        <div className="border-t border-border/50 bg-secondary/20 px-4 py-2 space-y-1">
          {item.variants.map((v) => {
            const cv = cartVariantItems.find(ci => ci.variantId === v.id);
            return (
              <div key={v.id} className="flex items-center justify-between py-1.5">
                <div>
                  <span className="text-foreground text-sm">{v.name}</span>
                  {v.serves_count && v.serves_count > 1 && (
                    <span className="text-muted-foreground text-xs ml-1.5">Serves {v.serves_count}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-semibold text-sm">₹{v.price}</span>
                  {cv ? (
                    <div className="flex items-center gap-0.5 border border-primary/40 rounded-lg overflow-hidden">
                      <button onClick={() => updateQuantity(item.id, v.id, cv.quantity - 1)} className="p-1 text-primary hover:bg-primary/10">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-1.5 text-xs font-semibold text-foreground">{cv.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, v.id, cv.quantity + 1)} className="p-1 text-primary hover:bg-primary/10">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddVariant(v)}
                      className="px-2 py-1 text-xs font-medium gold-gradient text-primary-foreground rounded-lg"
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
