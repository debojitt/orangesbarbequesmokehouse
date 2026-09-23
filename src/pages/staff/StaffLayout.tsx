import { useStaffAuth } from '@/contexts/StaffAuthContext';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Lock, LogOut, LayoutDashboard, UtensilsCrossed, Tag, Heart, Menu, X, ChevronRight, Ticket } from 'lucide-react';

const StaffLayout = () => {
  const { staff, isLocked, logout, lock, unlock } = useStaffAuth();
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (!staff) return <Navigate to="/staff/login" />;

  if (isLocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="ios-card p-8 max-w-sm w-full text-center">
          <Lock className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="font-display text-xl text-foreground mb-2">Portal Locked</h2>
          <p className="text-muted-foreground text-sm mb-4">Enter PIN to unlock</p>
          <input
            type="password"
            maxLength={6}
            value={unlockPin}
            onChange={(e) => setUnlockPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                const ok = await unlock(unlockPin);
                if (!ok) { setUnlockError('Wrong PIN'); setUnlockPin(''); }
              }
            }}
            placeholder="• • • •"
            className="w-full px-4 py-3 bg-secondary text-foreground text-center text-xl tracking-[0.5em] border border-border rounded-xl focus:outline-none focus:border-primary"
          />
          {unlockError && <p className="text-destructive text-sm mt-2">{unlockError}</p>}
        </div>
      </div>
    );
  }

  const navItems = [
    { path: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/staff/menu', label: 'Menu Manager', icon: UtensilsCrossed },
    { path: '/staff/offers', label: 'Offers & Discounts', icon: Tag },
    { path: '/staff/coupons', label: 'Coupons', icon: Ticket },
    { path: '/staff/loyalty', label: 'Loyalty Program', icon: Heart },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Collapsible Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-72 h-full bg-white border-r border-border flex flex-col" style={{ animation: 'slideIn 0.2s ease-out' }}>
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl gold-text">Staff Panel</h2>
                <button onClick={() => setSidebarOpen(false)} className="text-muted-foreground"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Logged in as {staff.name}</p>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {navItems.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                    location.pathname === path ? 'maroon-gradient text-primary-foreground' : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-border space-y-1">
              <button onClick={lock} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-muted-foreground hover:bg-secondary w-full">
                <Lock className="w-4 h-4" /> Lock Portal
              </button>
              <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-destructive hover:bg-secondary w-full">
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="glass-panel-strong sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="text-foreground p-1"><Menu className="w-5 h-5" /></button>
            <h1 className="font-display text-lg gold-text">Your Restaurant Name Staff</h1>
          </div>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">{staff.name}</span>
        </div>
      </header>

      {/* Bottom nav for quick access */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 ios-bottom-nav safe-area-bottom">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 4).map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 ${
                location.pathname === path ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-medium">{label.split(' ')[0]}</span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="px-4 py-6 pb-24">
        <Outlet />
      </div>
    </div>
  );
};

export default StaffLayout;
