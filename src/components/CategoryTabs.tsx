import { useState } from 'react';
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

  return (
    <>
      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => onSelect(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              !activeCategory ? 'gold-gradient text-primary-foreground' : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          {categories.slice(0, 6).map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelect(activeCategory === cat.id ? null : cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'gold-gradient text-primary-foreground'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
          {categories.length > 6 && (
            <button
              onClick={() => setShowAll(true)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border border-primary/40 text-primary"
            >
              More →
            </button>
          )}
        </div>
      </div>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="glass-panel-strong border-border rounded-2xl max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display gold-text">All Categories</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { onSelect(cat.id); setShowAll(false); }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                  activeCategory === cat.id
                    ? 'gold-gradient text-primary-foreground'
                    : 'bg-secondary/40 text-foreground hover:border-primary/30 border border-transparent'
                }`}
              >
                <span className="text-xl mb-1">{cat.icon || '🍽️'}</span>
                <span className="text-[10px] font-medium text-center leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CategoryTabs;
