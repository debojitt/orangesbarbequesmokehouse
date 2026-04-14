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
  const visibleCats = categories.slice(0, 7);

  return (
    <>
      <div className="px-4 py-3">
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => onSelect(null)}
            className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl transition-all border ${
              !activeCategory
                ? 'maroon-gradient text-primary-foreground border-transparent shadow-md'
                : 'bg-white text-foreground border-border shadow-sm hover:shadow-md'
            }`}
          >
            <span className="text-base">🍽️</span>
            <span className="text-[10px] font-semibold">ALL</span>
          </button>
          {visibleCats.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelect(activeCategory === cat.id ? null : cat.id)}
              className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl transition-all border ${
                activeCategory === cat.id
                  ? 'maroon-gradient text-primary-foreground border-transparent shadow-md'
                  : 'bg-white text-foreground border-border shadow-sm hover:shadow-md'
              }`}
            >
              <span className="text-base">{cat.icon || '🍽️'}</span>
              <span className="text-[10px] font-semibold leading-tight text-center line-clamp-1">{cat.name}</span>
            </button>
          ))}
          {categories.length > 7 && (
            <button
              onClick={() => setShowAll(true)}
              className="flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border border-primary/30 bg-white shadow-sm hover:shadow-md transition-all"
            >
              <span className="text-base">≡</span>
              <span className="text-[10px] font-semibold text-primary">MORE</span>
            </button>
          )}
        </div>
      </div>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="bg-white border-border rounded-3xl max-w-md max-h-[80vh] overflow-y-auto shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg text-foreground">All Categories</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { onSelect(cat.id); setShowAll(false); }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all border ${
                  activeCategory === cat.id
                    ? 'maroon-gradient text-primary-foreground border-transparent'
                    : 'bg-white text-foreground border-border shadow-sm hover:shadow-md'
                }`}
              >
                <span className="text-xl mb-1">{cat.icon || '🍽️'}</span>
                <span className="text-[10px] font-semibold text-center leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CategoryTabs;
