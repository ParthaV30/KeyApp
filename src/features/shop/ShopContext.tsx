import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { parseStoredCart, parseStoredFavorites } from '@/lib/validation';

type ShopContextValue = {
  cart: Record<string, number>;
  favorites: string[];
  addToCart: (id: string, quantity?: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  toggleFavorite: (id: string) => void;
  cartCount: number;
};

const ShopContext = createContext<ShopContextValue | null>(null);
const CART_KEY = '@keymitra/cart';
const FAVORITES_KEY = '@keymitra/favorites';

export function ShopProvider({ children }: React.PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const storageScope = userId ?? 'guest';
  const [cart, setCart] = useState<Record<string, number>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hydratedScope, setHydratedScope] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cartKey = `${CART_KEY}:${storageScope}`;
    const favoritesKey = `${FAVORITES_KEY}:${storageScope}`;
    Promise.all([AsyncStorage.getItem(cartKey), AsyncStorage.getItem(favoritesKey)])
      .then(([savedCart, savedFavorites]) => {
        if (cancelled) return;
        setCart(parseStoredCart(savedCart));
        setFavorites(parseStoredFavorites(savedFavorites));
      })
      .catch(() => {
        if (cancelled) return;
        setCart({});
        setFavorites([]);
      })
      .finally(() => { if (!cancelled) setHydratedScope(storageScope); });
    return () => { cancelled = true; };
  }, [storageScope]);

  useEffect(() => {
    if (!supabase || !userId || hydratedScope !== storageScope) return;
    let cancelled = false;
    Promise.resolve(supabase.from('favorites').select('product_id').eq('customer_id', userId))
      .then(({ data, error }) => {
        if (!cancelled && !error) setFavorites((data ?? []).map(row => row.product_id));
      }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [userId, storageScope, hydratedScope]);

  useEffect(() => {
    if (hydratedScope !== storageScope) return;
    AsyncStorage.multiSet([[`${CART_KEY}:${storageScope}`, JSON.stringify(cart)], [`${FAVORITES_KEY}:${storageScope}`, JSON.stringify(favorites)]]).catch(() => undefined);
  }, [cart, favorites, hydratedScope, storageScope]);

  const addToCart = useCallback((id: string, quantity = 1) => {
    if (hydratedScope !== storageScope || !id.trim() || id.length > 160 || !Number.isSafeInteger(quantity) || quantity < 1) return;
    setCart(current => ({ ...current, [id]: Math.min(99, (current[id] ?? 0) + quantity) }));
  }, [hydratedScope, storageScope]);

  const setQuantity = useCallback((id: string, quantity: number) => {
    if (hydratedScope !== storageScope || !id.trim() || id.length > 160 || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 99) return;
    setCart(current => {
      const next = { ...current };
      if (quantity <= 0) delete next[id];
      else next[id] = quantity;
      return next;
    });
  }, [hydratedScope, storageScope]);

  const toggleFavorite = useCallback((id: string) => {
    if (hydratedScope !== storageScope || !id.trim() || id.length > 160 || (!favorites.includes(id) && favorites.length >= 2000)) return;
    const removing = favorites.includes(id);
    setFavorites(current => removing ? current.filter(item => item !== id) : [...current, id]);
    if (supabase && userId) {
      const change = removing
        ? supabase.from('favorites').delete().eq('customer_id', userId).eq('product_id', id)
        : supabase.from('favorites').upsert({ customer_id: userId, product_id: id });
      void Promise.resolve(change).then(({ error }) => { if (error && __DEV__) console.warn('Favorite sync failed.'); }).catch(() => {
        if (__DEV__) console.warn('Favorite sync failed.');
      });
    }
  }, [favorites, userId, hydratedScope, storageScope]);

  const scopeReady = hydratedScope === storageScope;

  const value = useMemo(() => ({
    cart: scopeReady ? cart : {},
    favorites: scopeReady ? favorites : [],
    addToCart,
    setQuantity,
    toggleFavorite,
    cartCount: scopeReady ? Object.values(cart).reduce((sum, quantity) => sum + quantity, 0) : 0,
  }), [scopeReady, cart, favorites, addToCart, setQuantity, toggleFavorite]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const value = useContext(ShopContext);
  if (!value) throw new Error('useShop must be used inside ShopProvider');
  return value;
}
