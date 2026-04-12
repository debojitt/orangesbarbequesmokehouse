import { Plus } from 'lucide-react';
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

  // Get first gallery image for thumbnail
  const { data: thumbnailImages } = useQuery({
    queryKey: ['gallery-thumb', item.id],
    queryFn: async () => {
      const { data } = await supabase.from('gallery_images').select('image_url').eq('menu_item_id', item.id).limit(1);
      return data || [];
    },
  });

  const thumbnailUrl = thumbnailImages?.[0]?.image_url;

  const handleAdd = () => {
    if (item.variants.length > 0) {
      setShowVariants(true);
    } else {
      addItem({ menuItemId: item.id, name: item.name, price: item.discountedPrice ?? item.base_price, isVeg: item.is_veg });
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
        <div className="flex items-center gap-4">
          {/* Circular thumbnail */}
          <button
            onClick={() => setShowGallery(true)}
            className="flex-shrink-0 w-16 h-16 rounded-full overflow-hidden bg-secondary border-2 border-border hover:border-primary/50 transition-colors"
          >
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-2xl">
                {item.is_veg ? '🥬' : '🍖'}
              </div>
            )}
          </button>

          {/* Item details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className={item.is_veg ? 'veg-badge' : 'nonveg-badge'} />
              {item.is_bestseller && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold gold-gradient text-primary-foreground tracking-wider">BEST</span>
              )}
              {item.is_chef_special && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold border border-primary text-primary tracking-wider">CHEF</span>
              )}
              {item.is_daily_special && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-primary/20 text-primary tracking-wider">TODAY</span>
              )}
            </div>
            <h3 className="text-foreground font-medium text-sm truncate">{item.name}</h3>
            {item.description && (
              <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{item.description}</p>
            )}
            {item.serving_info && (
              <p className="text-muted-foreground text-[10px] mt-0.5">{item.serving_info}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {item.discountedPrice ? (
                <>
                  <span className="text-muted-foreground text-xs line-through">₹{item.base_price}</span>
                  <span className="text-primary font-semibold text-sm">₹{item.discountedPrice}</span>
                </>
              ) : (
                <span className="text-foreground font-semibold text-sm">₹{item.base_price}</span>
              )}
            </div>
          </div>

          {/* Add button */}
          {item.is_available ? (
            <button
              onClick={handleAdd}
              className="flex-shrink-0 w-10 h-10 rounded-full gold-gradient text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity shadow-md"
            >
              <Plus className="w-5 h-5" />
            </button>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">N/A</span>
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
