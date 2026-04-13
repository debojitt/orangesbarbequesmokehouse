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
  const visibleCats = categories.slice(0, 5);

  return (
    <>
      <div className="px-4 py-3">
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => onSelect(null)}
            className={`flex flex-col items-center gap-1.5 min-w-[56px] transition-all ${!activeCategory ? 'opacity-100' : 'opacity-50'}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${!activeCategory ? 'maroon-gradient text-primary-foreground' : 'bg-secondary/60'}`}>
              ✕
            </div>
            <span className="text-[10px] font-medium text-foreground">ALL</span>
          </button>
          {visibleCats.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelect(activeCategory === cat.id ? null : cat.id)}
              className={`flex flex-col items-center gap-1.5 min-w-[56px] transition-all ${activeCategory === cat.id ? 'opacity-100' : 'opacity-60'}`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${
                activeCategory === cat.id ? 'maroon-gradient text-primary-foreground' : 'bg-secondary/60'
              }`}>
                {cat.icon || '🍽️'}
              </div>
              <span className="text-[10px] font-medium text-foreground truncate max-w-[56px]">{cat.name}</span>
            </button>
          ))}
          {categories.length > 5 && (
            <button
              onClick={() => setShowAll(true)}
              className="flex flex-col items-center gap-1.5 min-w-[56px]"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg bg-secondary/60 border border-primary/30">
                ≡
              </div>
              <span className="text-[10px] font-medium text-primary">MORE</span>
            </button>
          )}
        </div>
      </div>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="glass-panel-strong border-border rounded-2xl max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display gold-text">All Categories</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { onSelect(cat.id); setShowAll(false); }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all ${
                  activeCategory === cat.id
                    ? 'maroon-gradient text-primary-foreground'
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
