import { useStaffAuth } from '@/contexts/StaffAuthContext';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Lock, LogOut, LayoutDashboard, UtensilsCrossed, Tag, Heart, Loader2 } from 'lucide-react';

const StaffLayout = () => {
  const { staff, isLocked, logout, lock, unlock } = useStaffAuth();
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const location = useLocation();

  if (!staff) return <Navigate to="/staff/login" />;

  if (isLocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="glass-panel p-8 max-w-sm w-full text-center">
          <Lock className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="font-display text-xl text-primary mb-2">Portal Locked</h2>
          <p className="text-muted-foreground text-sm mb-4">Enter PIN to unlock</p>
          <input
            type="password"
            maxLength={6}
            value={unlockPin}
            onChange={(e) => setUnlockPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                setUnlocking(true);
                const ok = await unlock(unlockPin);
                setUnlocking(false);
                if (!ok) { setUnlockError('Wrong PIN'); setUnlockPin(''); }
              }
            }}
            placeholder="• • • •"
            className="w-full px-4 py-3 bg-secondary text-foreground text-center text-xl tracking-[0.5em] border border-border focus:outline-none focus:border-primary"
          />
          {unlockError && <p className="text-destructive text-sm mt-2">{unlockError}</p>}
        </div>
      </div>
    );
  }

  const navItems = [
    { path: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/staff/menu', label: 'Menu', icon: UtensilsCrossed },
    { path: '/staff/offers', label: 'Offers', icon: Tag },
    { path: '/staff/loyalty', label: 'Loyalty', icon: Heart },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-panel-strong sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-lg gold-text">INARA Staff</h1>
            <span className="text-xs text-muted-foreground">({staff.name})</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={lock} className="p-2 text-muted-foreground hover:text-primary" title="Lock">
              <Lock className="w-4 h-4" />
            </button>
            <button onClick={logout} className="p-2 text-muted-foreground hover:text-destructive" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <nav className="glass-panel border-t-0">
        <div className="flex overflow-x-auto">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                location.pathname === path ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
};

export default StaffLayout;
