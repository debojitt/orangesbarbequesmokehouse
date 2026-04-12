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
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-foreground font-semibold text-sm tracking-wide uppercase">Categories</h2>
          {categories.length > 4 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-primary text-xs font-medium hover:underline"
            >
              Swipe List →
            </button>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelect(activeCategory === cat.id ? null : cat.id)}
              className={`flex-shrink-0 flex flex-col items-center justify-center w-20 h-20 transition-all ${
                activeCategory === cat.id
                  ? 'gold-gradient text-primary-foreground shadow-lg'
                  : 'glass-panel text-muted-foreground hover:text-foreground hover:border-primary/30'
              }`}
            >
              <span className="text-2xl mb-1">{cat.icon || '🍽️'}</span>
              <span className="text-[10px] font-medium uppercase tracking-wide truncate w-full text-center px-1">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="glass-panel-strong border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-primary">All Categories</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { onSelect(cat.id); setShowAll(false); }}
                className={`flex flex-col items-center justify-center p-4 transition-all ${
                  activeCategory === cat.id
                    ? 'gold-gradient text-primary-foreground'
                    : 'glass-panel text-foreground hover:border-primary/30'
                }`}
              >
                <span className="text-2xl mb-1">{cat.icon || '🍽️'}</span>
                <span className="text-xs font-medium">{cat.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CategoryTabs;
