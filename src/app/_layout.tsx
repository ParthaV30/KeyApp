import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { ShopProvider } from '@/features/shop/ShopContext';
import { CatalogProvider, useCatalog } from '@/features/shop/CatalogContext';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { C } from '@/components/shop/ui';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

void SplashScreen.preventAutoHideAsync();

// Keeps the splash up until session and catalog resolve; the timeout stops a hung network from trapping the user.
function SplashGate({ children }: React.PropsWithChildren) {
  const { loading: authLoading } = useAuth();
  const { loading: catalogLoading } = useCatalog();
  const [timedOut, setTimedOut] = useState(false);
  const ready = !authLoading && !catalogLoading;
  const show = ready || timedOut;
  useEffect(() => {
    if (show) { void SplashScreen.hideAsync(); return; }
    const timer = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, [show]);
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope: require('../../assets/fonts/Manrope-Variable.ttf'),
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <CatalogProvider>
          <ShopProvider>
            <SplashGate>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.paper } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="product/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="orders" options={{ presentation: 'card' }} />
              <Stack.Screen name="checkout" options={{ presentation: 'card' }} />
              <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
              <Stack.Screen name="admin" options={{ presentation: 'card' }} />
              <Stack.Screen name="invoice" options={{ presentation: 'card' }} />
            </Stack>
            </SplashGate>
          </ShopProvider>
        </CatalogProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
