import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { ShopProvider } from '@/features/shop/ShopContext';
import { CatalogProvider } from '@/features/shop/CatalogContext';
import { AuthProvider } from '@/features/auth/AuthContext';
import { C } from '@/components/shop/ui';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope: require('../../assets/fonts/Manrope-Variable.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <CatalogProvider>
          <ShopProvider>
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
          </ShopProvider>
        </CatalogProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
