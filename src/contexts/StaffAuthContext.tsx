import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StaffUser {
  id: string;
  name: string;
  role: 'admin' | 'staff';
}

interface StaffAuthContextType {
  staff: StaffUser | null;
  isLocked: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  lock: () => void;
  unlock: (pin: string) => Promise<boolean>;
}

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

export const StaffAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('inara_staff');
    if (saved) {
      try { setStaff(JSON.parse(saved)); } catch {}
    }
  }, []);

  const login = async (pin: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('staff')
      .select('id, name, role, pin')
      .eq('pin', pin)
      .maybeSingle();
    if (error || !data) return false;
    const user: StaffUser = { id: data.id, name: data.name, role: data.role };
    setStaff(user);
    setIsLocked(false);
    localStorage.setItem('inara_staff', JSON.stringify(user));
    return true;
  };

  const logout = () => {
    setStaff(null);
    setIsLocked(false);
    localStorage.removeItem('inara_staff');
  };

  const lock = () => setIsLocked(true);

  const unlock = async (pin: string): Promise<boolean> => {
    if (!staff) return false;
    const { data } = await supabase
      .from('staff')
      .select('pin')
      .eq('id', staff.id)
      .eq('pin', pin)
      .maybeSingle();
    if (!data) return false;
    setIsLocked(false);
    return true;
  };

  return (
    <StaffAuthContext.Provider value={{ staff, isLocked, login, logout, lock, unlock }}>
      {children}
    </StaffAuthContext.Provider>
  );
};

export const useStaffAuth = () => {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error('useStaffAuth must be used within StaffAuthProvider');
  return ctx;
};
