import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { secureSessionStorage } from '@/lib/secureSessionStorage';

// WebSocket for Supabase Realtime: browsers and React Native provide one,
// but Node (Expo Router server-side rendering) may not — fall back to ws.
if (typeof WebSocket === 'undefined') {
  // Direct eval keeps Metro from bundling the Node-only `ws` into native/web builds, where this branch never runs.
  try {
    globalThis.WebSocket = eval('require')('ws') as typeof WebSocket;
  } catch {
    // Realtime is unused here; a runtime without `ws` must not stop the app from starting.
  }
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function isValidBackendConfig(candidateUrl: string | undefined, candidateKey: string | undefined): boolean {
  if (!candidateUrl || !candidateKey || candidateKey.length > 4096 || /\s/.test(candidateKey)) return false;
  try {
    const parsed = new URL(candidateUrl);
    const localDevelopmentHost = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    return !parsed.username && !parsed.password && (parsed.protocol === 'https:' || (localDevelopmentHost && parsed.protocol === 'http:'));
  } catch {
    return false;
  }
}

export const backendConfigured = isValidBackendConfig(url, publishableKey);

export const supabase = backendConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: secureSessionStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', state => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
