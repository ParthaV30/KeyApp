import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { backendConfigured, supabase } from '@/lib/supabase';
import { isValidEmail, normalizeEmail, validateSignUp } from '@/lib/validation';
import { signUpErrorMessage } from './authErrors';

type UserRole = 'customer' | 'staff' | 'admin' | 'unknown' | null;
type BusinessPermission = 'inventory' | 'purchasing' | 'billing' | 'sales' | 'reports' | 'audit';
type AuthValue = {
  session: Session | null;
  role: UserRole;
  businessPermissions: BusinessPermission[];
  loading: boolean;
  error: string | null;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, phone: string, password: string) => Promise<{ signedIn: boolean }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

// Network failures throw instead of returning an error, so both paths end in a readable message.
async function requestSignUp(name: string, email: string, phone: string, password: string) {
  if (!supabase) throw new Error('Connect a Supabase project in the local .env file first.');
  try {
    return await supabase.auth.signUp({ email: normalizeEmail(email), password, options: { data: { display_name: name.trim(), phone: phone.trim() } } });
  } catch (cause) {
    throw new Error(signUpErrorMessage(cause));
  }
}

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(supabase ? 'unknown' : null);
  const [businessPermissions, setBusinessPermissions] = useState<BusinessPermission[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user.id;

  const latestRefresh = useRef(0);
  // Sets state only after the first await, so it is safe to call from an effect.
  const loadRole = useCallback(async () => {
    const call = ++latestRefresh.current;
    if (!supabase || !userId) return;
    try {
      const { data, error: profileError } = await supabase.from('profiles').select('role').eq('user_id', userId).maybeSingle();
      if (profileError) throw profileError;
      let permissions: BusinessPermission[] = ['inventory', 'purchasing', 'billing', 'sales', 'reports', 'audit'];
      if (data?.role !== 'admin') {
        const { data: access, error: accessError } = await supabase.rpc('get_business_permissions');
        permissions = accessError ? [] : (Array.isArray(access) ? access : []) as BusinessPermission[];
      }
      if (call !== latestRefresh.current) return; // a newer refresh (another user) owns the state
      setError(null);
      setBusinessPermissions(permissions);
      setRole(data?.role === 'admin' ? 'admin' : permissions.length ? 'staff' : 'customer');
    } catch {
      if (call !== latestRefresh.current) return;
      setRole('unknown');
      setBusinessPermissions([]);
      setError('Could not verify your account permissions. Check your connection and retry.');
    }
  }, [userId]);

  const refreshRole = useCallback(async () => {
    if (!supabase || !userId) {
      setRole(null);
      setBusinessPermissions([]);
      return;
    }
    setRole('unknown');
    setError(null);
    await loadRole();
  }, [userId, loadRole]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      // Token refreshes and tab refocus re-emit the same user; only a different user needs a fresh role check.
      setSession(current => {
        if (current?.user.id !== nextSession?.user.id) {
          setRole(nextSession ? 'unknown' : null);
          setBusinessPermissions([]);
          if (!nextSession) setError(null);
        }
        return nextSession;
      });
    });
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) throw sessionError;
      if (mounted) setSession(data.session);
    }).catch(() => {
      if (mounted) setError('Could not restore your sign-in. Check your connection and sign in again.');
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // loadRole sets state only after awaiting the network, never during the effect itself.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadRole(); }, [loadRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Connect a Supabase project in the local .env file first.');
    if (!isValidEmail(email) || password.length === 0 || password.length > 128) throw new Error('Enter a valid email and password.');
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
      if (signInError) throw signInError;
    } catch {
      throw new Error('Sign-in failed. Check your email and password, then try again.');
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, phone: string, password: string) => {
    if (!supabase) throw new Error('Connect a Supabase project in the local .env file first.');
    const validationError = validateSignUp(name, email, phone, password);
    if (validationError) throw new Error(validationError);
    setError(null);
    const result = await requestSignUp(name, email, phone, password);
    if (result.error) throw new Error(signUpErrorMessage(result.error));
    // With email confirmation on, Supabase hides existing accounts by returning a user with no identities.
    if (!result.data.session && result.data.user?.identities?.length === 0) throw new Error(signUpErrorMessage({ code: 'user_already_exists' }));
    return { signedIn: Boolean(result.data.session) };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw new Error('Could not sign out. Check your connection and try again.');
    setRole(null);
    setBusinessPermissions([]);
  }, []);

  const value = useMemo(() => ({ session, role, businessPermissions, loading, error, clearError: () => setError(null), signIn, signUp, signOut, refreshRole }), [session, role, businessPermissions, loading, error, signIn, signUp, signOut, refreshRole]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return { ...value, backendConfigured };
}
