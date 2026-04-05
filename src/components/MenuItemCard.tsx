import { Camera, Plus } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

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
  const [showVariants, setShowVariants] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const { addItem } = useCart();

  const { data: gallery } = useQuery({
    queryKey: ['gallery', item.id],
    queryFn: async () => {
      const { data } = await supabase.from('gallery_images').select('*').eq('menu_item_id', item.id);
      return data || [];
    },
    enabled: showGallery,
  });

  const handleAdd = () => {
    if (item.variants.length > 0) {
      setShowVariants(true);
    } else {
      addItem({ menuItemId: item.id, name: item.name, price: item.discountedPrice ?? item.base_price, isVeg: item.is_veg });
      // Track selection
      supabase.from('item_selections').insert({ menu_item_id: item.id }).then(() => {});
    }
  };

  const handleVariantSelect = (variant: Variant) => {
    addItem({
      menuItemId: item.id,
      name: item.name,
      variantId: variant.id,
      variantName: variant.name,
      price: variant.price,
      isVeg: item.is_veg,
    });
    supabase.from('item_selections').insert({ menu_item_id: item.id }).then(() => {});
    setShowVariants(false);
  };

  return (
    <>
      <div className={`glass-panel p-4 transition-all hover:border-primary/30 ${!item.is_available ? 'opacity-50' : ''}`}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className={item.is_veg ? 'veg-badge' : 'nonveg-badge'} />
              {item.is_bestseller && (
                <span className="px-2 py-0.5 text-[10px] font-bold gold-gradient text-primary-foreground tracking-wider">BESTSELLER</span>
              )}
              {item.is_chef_special && (
                <span className="px-2 py-0.5 text-[10px] font-bold border border-primary text-primary tracking-wider">CHEF'S SPECIAL</span>
              )}
              {item.is_daily_special && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/20 text-primary tracking-wider">TODAY'S SPECIAL</span>
              )}
            </div>
            <h3 className="text-foreground font-medium text-sm">{item.name}</h3>
            {item.description && (
              <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{item.description}</p>
            )}
            {item.serving_info && (
              <p className="text-muted-foreground text-[10px] mt-1">{item.serving_info}</p>
            )}
          </div>
          <button
            onClick={() => setShowGallery(true)}
            className="p-2 text-muted-foreground hover:text-primary transition-colors ml-2"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {item.discountedPrice ? (
              <>
                <span className="text-muted-foreground text-sm line-through">₹{item.base_price}</span>
                <span className="text-primary font-semibold">₹{item.discountedPrice}</span>
              </>
            ) : (
              <span className="text-foreground font-semibold">₹{item.base_price}</span>
            )}
          </div>
          {item.is_available ? (
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold border border-primary text-primary hover:gold-gradient hover:text-primary-foreground transition-all"
            >
              <Plus className="w-3 h-3" /> ADD
            </button>
          ) : (
            <span className="text-xs text-muted-foreground italic">Unavailable</span>
          )}
        </div>
      </div>

      {/* Variant Selection */}
      <Dialog open={showVariants} onOpenChange={setShowVariants}>
        <DialogContent className="glass-panel-strong border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">{item.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">Select a variant:</p>
          <div className="space-y-2">
            {item.variants.map((v) => (
              <button
                key={v.id}
                onClick={() => handleVariantSelect(v)}
                className="w-full flex items-center justify-between p-3 glass-panel hover:border-primary transition-all"
              >
                <div>
                  <span className="text-foreground font-medium text-sm">{v.name}</span>
                  {v.serves_count && (
                    <span className="text-muted-foreground text-xs ml-2">Serves {v.serves_count}</span>
                  )}
                </div>
                <span className="text-primary font-semibold">₹{v.price}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Gallery */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="glass-panel-strong border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">{item.name} Gallery</DialogTitle>
          </DialogHeader>
          {gallery && gallery.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {gallery.map((img) => (
                <div key={img.id} className="aspect-square bg-secondary overflow-hidden">
                  <img src={img.image_url} alt={img.caption || item.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No photos available yet</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MenuItemCard;
