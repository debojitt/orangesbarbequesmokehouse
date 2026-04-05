import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface CategoryTabsProps {
  categories: Category[];
  activeCategory: string | null;
  onSelect: (id: string | null) => void;
}

const CategoryTabs = ({ categories, activeCategory, onSelect }: CategoryTabsProps) => {
  const [showAll, setShowAll] = useState(false);
  const visibleCategories = categories.slice(0, 4);
  const hasMore = categories.length > 4;

  return (
    <>
      <div className="sticky top-[60px] z-40 glass-panel-strong">
        <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => onSelect(null)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === null
                ? 'gold-gradient text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            All
          </button>
          {visibleCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'gold-gradient text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              {cat.icon && <span className="mr-1">{cat.icon}</span>}
              {cat.name}
            </button>
          ))}
          {hasMore && (
            <button
              onClick={() => setShowAll(true)}
              className="px-4 py-2 text-sm font-medium whitespace-nowrap text-primary border border-primary hover:gold-gradient hover:text-primary-foreground transition-all flex items-center gap-1"
            >
              More <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="glass-panel-strong border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">All Categories</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { onSelect(cat.id); setShowAll(false); }}
                className={`p-3 text-sm font-medium text-left transition-all ${
                  activeCategory === cat.id
                    ? 'gold-gradient text-primary-foreground'
                    : 'glass-panel text-foreground hover:border-primary'
                }`}
              >
                {cat.icon && <span className="mr-2">{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CategoryTabs;
