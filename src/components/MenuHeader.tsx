import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart, Star, Heart, Search } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useState } from 'react';

const MenuHeader = ({ onSearch }: { onSearch?: (query: string) => void }) => {
  const { itemCount } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 glass-panel-strong">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <h1 className="font-display text-2xl gold-text font-bold tracking-wider">INARA</h1>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <Link
              to="/review"
              className="flex items-center gap-1 px-3 py-1.5 gold-gradient text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Star className="w-4 h-4" />
              Review Us
            </Link>
            <Link
              to="/loyalty"
              className="p-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Heart className="w-5 h-5" />
            </Link>
            <Link to="/cart" className="relative p-2 text-muted-foreground hover:text-primary transition-colors">
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 gold-gradient text-primary-foreground text-xs font-bold flex items-center justify-center rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
        {searchOpen && (
          <div className="mt-3">
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSearch?.(e.target.value);
              }}
              autoFocus
              className="w-full px-4 py-2 bg-secondary text-foreground border border-border placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        )}
      </div>
    </header>
  );
};

export default MenuHeader;
