import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface CustomerContextType {
  customer: Customer | null;
  login: (phone: string, name: string) => Promise<Customer>;
  logout: () => void;
  isLoggedIn: boolean;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('inara_customer');
    if (saved) {
      try { setCustomer(JSON.parse(saved)); } catch {}
    }
  }, []);

  const login = async (phone: string, name: string): Promise<Customer> => {
    // Check if customer exists
    const { data: existing } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (existing) {
      const c: Customer = { id: existing.id, name: existing.name, phone: existing.phone };
      setCustomer(c);
      localStorage.setItem('inara_customer', JSON.stringify(c));
      return c;
    }

    // Create new customer
    const { data: created, error } = await supabase
      .from('customers')
      .insert({ name, phone })
      .select()
      .single();

    if (error) throw error;
    const c: Customer = { id: created.id, name: created.name, phone: created.phone };
    setCustomer(c);
    localStorage.setItem('inara_customer', JSON.stringify(c));
    return c;
  };

  const logout = () => {
    setCustomer(null);
    localStorage.removeItem('inara_customer');
  };

  return (
    <CustomerContext.Provider value={{ customer, login, logout, isLoggedIn: !!customer }}>
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = () => {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomer must be used within CustomerProvider');
  return ctx;
};
