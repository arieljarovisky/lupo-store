import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const CART_STORAGE_KEY = 'lupo_cart_v1';

function loadCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: CartItem[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const id = String(o.id ?? '').trim();
      const name = String(o.name ?? '').trim();
      const price = Number(o.price);
      const quantity = Number(o.quantity);
      if (!id || !name || !Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity < 1) {
        continue;
      }
      const base = o as unknown as CartItem;
      out.push({
        ...base,
        id,
        name,
        price,
        image: String(o.image ?? ''),
        category: String(o.category ?? 'General'),
        quantity: Math.min(9999, Math.max(1, Math.floor(quantity))),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function saveCartToStorage(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    /* quota llena o modo privado */
  }
}

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  description?: string;
  sku?: string;
  stockQuantity?: number;
  images?: string[];
  variants?: Array<{
    id: string;
    name: string;
    price: number;
    stockQuantity: number;
    sku?: string;
    size?: string;
    colorName?: string;
    colorHex?: string;
    image?: string;
    optionValues?: Array<{
      name: string;
      value: string;
      swatch?: string;
    }>;
  }>;
}

export interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  cartTotal: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage());
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    saveCartToStorage(items);
  }, [items]);

  const addToCart = (product: Product) => {
    setItems(currentItems => {
      const existingItem = currentItems.find(item => item.id === product.id);
      if (existingItem) {
        return currentItems.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...currentItems, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setItems(currentItems => currentItems.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) {
      removeFromCart(productId);
      return;
    }
    setItems(currentItems =>
      currentItems.map(item =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const cartTotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const cartCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        cartTotal,
        cartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
