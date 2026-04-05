import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CartItem {
  menuItemId: string;
  name: string;
  variantId?: string;
  variantName?: string;
  price: number;
  quantity: number;
  isVeg: boolean;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (menuItemId: string, variantId?: string) => void;
  updateQuantity: (menuItemId: string, variantId: string | undefined, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  approximateTotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const getKey = (menuItemId: string, variantId?: string) => `${menuItemId}-${variantId || 'base'}`;

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>) => {
    setItems(prev => {
      const key = getKey(item.menuItemId, item.variantId);
      const existing = prev.find(i => getKey(i.menuItemId, i.variantId) === key);
      if (existing) {
        return prev.map(i => getKey(i.menuItemId, i.variantId) === key ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((menuItemId: string, variantId?: string) => {
    setItems(prev => prev.filter(i => getKey(i.menuItemId, i.variantId) !== getKey(menuItemId, variantId)));
  }, []);

  const updateQuantity = useCallback((menuItemId: string, variantId: string | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId, variantId);
      return;
    }
    setItems(prev => prev.map(i => getKey(i.menuItemId, i.variantId) === getKey(menuItemId, variantId) ? { ...i, quantity } : i));
  }, [removeItem]);

  const clearCart = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const approximateTotal = subtotal > 800 ? subtotal + 150 : subtotal;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, subtotal, approximateTotal, itemCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
