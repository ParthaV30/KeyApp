import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C } from '@/components/shop/ui';

type Destination = {
  name: string;
  href: '/' | '/categories' | '/cart' | '/saved' | '/account';
  label: string;
  icon: string;
};

const destinations: readonly Destination[] = [
  { name: 'index', href: '/', label: 'Home', icon: 'home' },
  { name: 'categories', href: '/categories', label: 'Categories', icon: 'grid_view' },
  { name: 'cart', href: '/cart', label: 'Cart', icon: 'shopping_bag' },
  { name: 'saved', href: '/saved', label: 'Saved', icon: 'favorite' },
  { name: 'account', href: '/account', label: 'Account', icon: 'account_circle' },
];

// expo-router types `ref` against the View class, which no longer matches React Native's element type;
// the ref is still passed through at runtime via the props spread.
type TabButtonProps = Omit<TabTriggerSlotProps, 'ref'> & { label: string; icon: string };

function TabButton({ label, icon, isFocused, ...props }: TabButtonProps) {
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} style={styles.tab}>
      <View style={[styles.indicator, isFocused && styles.indicatorActive]} />
      <SymbolView name={{ web: icon } as React.ComponentProps<typeof SymbolView>['name']} tintColor={isFocused ? C.teal : C.muted} size={22} />
      <Text style={[styles.label, isFocused && styles.labelActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export default function WebTabLayout() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList style={styles.tabList}>
        {destinations.map((destination) => (
          <TabTrigger key={destination.name} name={destination.name} href={destination.href} asChild>
            <TabButton label={destination.label} icon={destination.icon} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // TabSlot defaults to flexShrink: 0, which lets screens grow past the viewport and blocks ScrollView scrolling.
  slot: {
    flex: 1,
    minHeight: 0,
  },
  tabList: {
    position: 'fixed',
    zIndex: 20,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 6,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  tab: {
    flex: 1,
    maxWidth: 120,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  indicatorActive: { backgroundColor: C.orange },
  label: {
    color: C.muted,
    fontFamily: 'Manrope',
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: { color: C.teal, fontWeight: '800' },
});
