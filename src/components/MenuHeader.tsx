import { Link } from 'react-router-dom';
import { ShoppingCart, Star, Heart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

const MenuHeader = ({ onSearch }: { onSearch?: (query: string) => void }) => {
  const { itemCount } = useCart();

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="relative overflow-hidden">
      {/* Decorative gold leaf ornaments */}
      <div className="absolute top-0 left-0 w-32 h-32 opacity-20 pointer-events-none">
        <svg viewBox="0 0 100 100" className="w-full h-full text-primary">
          <path d="M10,90 Q20,60 50,50 Q30,40 20,10 Q40,30 60,20 Q50,40 70,50 Q40,60 50,90 Q30,70 10,90Z" fill="currentColor" opacity="0.6"/>
          <path d="M5,70 Q15,50 30,45 Q20,35 15,15 Q25,30 40,25 Q35,40 50,45 Q30,50 35,70 Q20,60 5,70Z" fill="currentColor" opacity="0.4"/>
        </svg>
      </div>
      <div className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none transform scale-x-[-1]">
        <svg viewBox="0 0 100 100" className="w-full h-full text-primary">
          <path d="M10,90 Q20,60 50,50 Q30,40 20,10 Q40,30 60,20 Q50,40 70,50 Q40,60 50,90 Q30,70 10,90Z" fill="currentColor" opacity="0.6"/>
          <path d="M5,70 Q15,50 30,45 Q20,35 15,15 Q25,30 40,25 Q35,40 50,45 Q30,50 35,70 Q20,60 5,70Z" fill="currentColor" opacity="0.4"/>
        </svg>
      </div>

      {/* Top action bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-lg gold-text font-bold tracking-widest">ORANGE'S BBQ</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to="/review"
            className="p-2 text-primary hover:opacity-80 transition-opacity"
          >
            <Star className="w-5 h-5" />
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

      {/* Greeting & Restaurant Name */}
      <div className="relative z-10 text-center py-6 pb-8">
        <p className="text-primary/80 italic text-sm font-display mb-1">{getGreeting()}</p>
        <h1 className="font-display text-4xl gold-text font-bold tracking-wider">ORANGE'S BBQ</h1>
      </div>
    </div>
  );
};

export default MenuHeader;
