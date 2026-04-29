import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Sparkles, ShoppingCart, Menu, X, Star, Heart, MessageSquare, Lock } from 'lucide-react';
import CategoryTabs from '@/components/CategoryTabs';
import MenuItemCard from '@/components/MenuItemCard';
import TodayOffers from '@/components/TodayOffers';
import AICravingBox from '@/components/AICravingBox';
import { useCart } from '@/contexts/CartContext';
import { Link } from 'react-router-dom';

const Index = () => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [showAI, setShowAI] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const { itemCount, approximateTotal } = useCart();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').eq('is_visible', true).order('display_order');
      return data || [];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const { data: items } = await supabase.from('menu_items').select('*');
      const { data: variants } = await supabase.from('item_variants').select('*');
      const { data: discounts } = await supabase.from('discounts').select('*').eq('is_active', true);
      const { data: galleryImages } = await supabase.from('gallery_images').select('menu_item_id, image_url');
      const { data: globalSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'images_hidden_global')
        .maybeSingle();
      const globalHidden = !!(globalSetting?.value as any)?.value;

      const imageMap = new Map<string, string>();
      (galleryImages || []).forEach((img) => {
        if (img.menu_item_id) imageMap.set(img.menu_item_id, img.image_url);
      });

      return (items || []).map((item) => {
        const itemVariants = (variants || []).filter((v) => v.menu_item_id === item.id);
        let discountedPrice: number | undefined;
        const now = new Date();
        for (const d of discounts || []) {
          if (d.start_time && new Date(d.start_time) > now) continue;
          if (d.end_time && new Date(d.end_time) < now) continue;
          if (d.applies_to === 'item' && d.target_id === item.id && d.type === 'percentage') {
            discountedPrice = Math.round(item.base_price * (1 - d.value / 100));
          } else if (d.applies_to === 'category' && d.target_id === item.category_id && d.type === 'percentage') {
            discountedPrice = Math.round(item.base_price * (1 - d.value / 100));
          } else if (d.applies_to === 'all' && d.type === 'percentage') {
            discountedPrice = Math.round(item.base_price * (1 - d.value / 100));
          }
        }
        const showImage = !globalHidden && !(item as any).image_hidden;
        return {
          ...item,
          variants: itemVariants,
          discountedPrice,
          imageUrl: showImage ? (imageMap.get(item.id) || null) : null,
        };
      });
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const shuffledItems = useMemo(() => {
    const grouped = new Map<string | null, typeof menuItems>();
    menuItems.forEach((item) => {
      const key = item.category_id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(item);
    });
    const result: typeof menuItems = [];
    grouped.forEach((items) => {
      const shuffled = [...items].sort(() => Math.random() - 0.5);
      result.push(...shuffled);
    });
    return result;
  }, [menuItems]);

  const filteredItems = shuffledItems.filter((item) => {
    if (activeCategory && item.category_id !== activeCategory) return false;
    if (vegFilter === 'veg' && !item.is_veg) return false;
    if (vegFilter === 'nonveg' && item.is_veg) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const groupedItems = useMemo(() => {
    const groups: { category: typeof categories[0] | null; items: typeof filteredItems }[] = [];
    const catMap = new Map(categories.map((c) => [c.id, c]));
    if (activeCategory) {
      groups.push({ category: catMap.get(activeCategory) || null, items: filteredItems });
    } else {
      const seen = new Set<string>();
      filteredItems.forEach((item) => {
        const catId = item.category_id || 'uncategorized';
        if (!seen.has(catId)) {
          seen.add(catId);
          groups.push({
            category: item.category_id ? catMap.get(item.category_id) || null : null,
            items: filteredItems.filter((i) => (i.category_id || 'uncategorized') === catId),
          });
        }
      });
    }
    return groups;
  }, [filteredItems, categories, activeCategory]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar Overlay */}
      {showSidebar && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSidebar(false)} />
          <div className="relative w-72 h-full bg-white border-r border-border p-6 flex flex-col" style={{ animation: 'slideIn 0.2s ease-out' }}>
            <button onClick={() => setShowSidebar(false)} className="absolute top-4 right-4 text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
            <h2 className="font-display text-2xl gold-text mb-8 mt-2">INARA</h2>
            <nav className="flex flex-col gap-1 flex-1">
              <Link to="/" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-foreground hover:bg-secondary text-sm font-medium">
                <Search className="w-4 h-4" /> Menu
              </Link>
              <Link to="/review" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-foreground hover:bg-secondary text-sm font-medium">
                <Star className="w-4 h-4" /> Review Us
              </Link>
              <Link to="/loyalty" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-foreground hover:bg-secondary text-sm font-medium">
                <Heart className="w-4 h-4" /> Loyalty Card
              </Link>
              <Link to="/cart" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-foreground hover:bg-secondary text-sm font-medium">
                <ShoppingCart className="w-4 h-4" /> Cart {itemCount > 0 && <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">{itemCount}</span>}
              </Link>
            </nav>
            <div className="border-t border-border pt-4 mt-4">
              <Link to="/staff/login" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-muted-foreground hover:bg-secondary text-xs">
                <Lock className="w-3 h-3" /> Staff Portal
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Top Nav Bar ONLY */}
      <header className="sticky top-0 z-50 glass-panel-strong">
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={() => setShowSidebar(true)} className="text-foreground p-1">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-display text-xl tracking-widest gold-text">INARA</h1>
          <Link to="/cart" className="relative p-1">
            <ShoppingCart className="w-5 h-5 text-primary" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">{itemCount}</span>
            )}
          </Link>
        </div>
      </header>

      {/* Hero Section - scrolls normally */}
      <div className="px-4 pt-4 pb-3">
        {/* Greeting */}
        <div className="mb-4">
          <p className="text-muted-foreground text-xs uppercase tracking-widest">{getGreeting()}</p>
          <h2 className="font-display text-3xl text-foreground leading-tight mt-1">Escape the<br/>ordinary</h2>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white rounded-2xl px-4 py-2.5 shadow-sm border border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Explore the menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-foreground text-sm placeholder:text-muted-foreground focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Category Grid */}
      <CategoryTabs categories={categories} activeCategory={activeCategory} onSelect={setActiveCategory} />

      {/* Filter chips */}
      <div className="px-4 pb-3 flex items-center gap-2">
        {[
          { key: 'all' as const, label: 'ALL', activeClass: 'maroon-gradient text-primary-foreground' },
          { key: 'veg' as const, label: 'Veg', activeClass: 'bg-green-600 text-white' },
          { key: 'nonveg' as const, label: 'Non-Veg', activeClass: 'bg-red-600 text-white' },
        ].map(({ key, label, activeClass }) => (
          <button
            key={key}
            onClick={() => setVegFilter(key)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
              vegFilter === key ? activeClass : 'bg-white text-muted-foreground border border-border shadow-sm'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <TodayOffers />

      {/* Menu Items */}
      <div className="px-4 py-4 space-y-6 pb-48">
        {groupedItems.map((group, idx) => (
          <div key={idx}>
            {group.category && (
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-lg text-foreground flex items-center gap-2">
                  {group.category.icon && <span>{group.category.icon}</span>}
                  {group.category.name}
                </h2>
              </div>
            )}
            <div className="space-y-3">
              {group.items.map((item) => (
                <MenuItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No items found</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="glass-panel py-6 text-center mb-20">
        <p className="text-xs text-muted-foreground">
          Powered by <span className="text-primary font-medium">JorhatStays</span> •{' '}
          <a href="https://wa.me/918474038160" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Want a menu for your restaurant? Click here
          </a>
        </p>
      </footer>

      {/* Bottom Navigation Bar - iOS frosted glass */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 ios-bottom-nav safe-area-bottom">
        <div className="flex items-center justify-around py-2">
          <Link to="/" className="flex flex-col items-center gap-0.5 py-1 px-3">
            <Search className="w-5 h-5 text-primary" />
            <span className="text-[10px] text-primary font-medium">Menu</span>
          </Link>
          <Link to="/review" className="flex flex-col items-center gap-0.5 py-1 px-3">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Review</span>
          </Link>
          <button
            onClick={() => setShowAI(!showAI)}
            className="w-14 h-14 -mt-6 rounded-full maroon-gradient text-primary-foreground flex items-center justify-center shadow-lg animate-pulse-gold"
          >
            <Sparkles className="w-6 h-6" />
          </button>
          <Link to="/loyalty" className="flex flex-col items-center gap-0.5 py-1 px-3">
            <Heart className="w-5 h-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Loyalty</span>
          </Link>
          <Link to="/cart" className="flex flex-col items-center gap-0.5 py-1 px-3 relative">
            <ShoppingCart className="w-5 h-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Cart</span>
            {itemCount > 0 && (
              <span className="absolute -top-0.5 right-1 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">{itemCount}</span>
            )}
          </Link>
        </div>
      </nav>

      {/* AI Craving Box */}
      {showAI && (
        <div className="fixed bottom-24 right-4 left-4 z-50 max-w-sm ml-auto">
          <AICravingBox onClose={() => setShowAI(false)} />
        </div>
      )}

      {/* Floating Cart Bar */}
      {itemCount > 0 && (
        <Link
          to="/cart"
          className="fixed bottom-20 left-4 right-4 z-40 maroon-gradient rounded-2xl px-5 py-3 flex items-center justify-between shadow-xl"
        >
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-primary-foreground" />
            <span className="text-primary-foreground font-semibold text-sm">
              {itemCount} item{itemCount > 1 ? 's' : ''}
            </span>
          </div>
          <span className="text-primary-foreground font-bold text-base">≈ ₹{approximateTotal}</span>
        </Link>
      )}
    </div>
  );
};

export default Index;
