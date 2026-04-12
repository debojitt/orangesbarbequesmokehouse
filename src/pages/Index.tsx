import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search } from 'lucide-react';
import MenuHeader from '@/components/MenuHeader';
import AICravingBox from '@/components/AICravingBox';
import CategoryTabs from '@/components/CategoryTabs';
import MenuItemCard from '@/components/MenuItemCard';
import TodayOffers from '@/components/TodayOffers';

const Index = () => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').eq('is_visible', true).order('display_order');
      return data || [];
    },
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const { data: items } = await supabase.from('menu_items').select('*');
      const { data: variants } = await supabase.from('item_variants').select('*');
      const { data: discounts } = await supabase.from('discounts').select('*').eq('is_active', true);

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

        return { ...item, variants: itemVariants, discountedPrice };
      });
    },
  });

  // Shuffle items within categories on each load
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

  // Group items by category for display
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

  return (
    <div className="min-h-screen bg-background">
      <MenuHeader />

      {/* Search bar */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-3 glass-panel px-4 py-2.5">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Search dishes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-foreground text-sm placeholder:text-muted-foreground focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 mb-4 flex items-center gap-2">
        <span className="text-muted-foreground text-xs mr-1">₹</span>
        <button
          onClick={() => setVegFilter('all')}
          className={`px-3 py-1 text-xs font-medium transition-all rounded-full ${
            vegFilter === 'all'
              ? 'bg-foreground text-background'
              : 'glass-panel text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setVegFilter('veg')}
          className={`px-3 py-1 text-xs font-medium transition-all rounded-full flex items-center gap-1 ${
            vegFilter === 'veg'
              ? 'bg-green-600 text-white'
              : 'glass-panel text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-green-500" /> Veg
        </button>
        <button
          onClick={() => setVegFilter('nonveg')}
          className={`px-3 py-1 text-xs font-medium transition-all rounded-full flex items-center gap-1 ${
            vegFilter === 'nonveg'
              ? 'bg-red-600 text-white'
              : 'glass-panel text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500" /> Non
        </button>
      </div>

      <CategoryTabs categories={categories} activeCategory={activeCategory} onSelect={setActiveCategory} />
      <AICravingBox />
      <TodayOffers />

      <div className="px-4 py-4 space-y-6 pb-24">
        {groupedItems.map((group, idx) => (
          <div key={idx}>
            {group.category && (
              <h2 className="font-display text-lg text-primary mb-3 flex items-center gap-2">
                {group.category.icon && <span>{group.category.icon}</span>}
                {group.category.name}
              </h2>
            )}
            <div className="space-y-3">
              {group.items.map((item) => (
                <MenuItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No items found</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="glass-panel py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by <span className="text-primary font-medium">JorhatStays</span> •{' '}
          <a
            href="https://wa.me/918474038160"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Want a menu for your restaurant? Click here
          </a>
        </p>
      </footer>
    </div>
  );
};

export default Index;
