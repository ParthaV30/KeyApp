import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { A, Button } from './ui';

// Fourteen flat tabs are hard to scan, so sections are grouped by the job the owner is doing.
const GROUPS: readonly { label: string; items: readonly string[] }[] = [
  { label: 'Sell', items: ['Overview', 'Orders', 'Billing', 'Returns', 'Customers'] },
  { label: 'Catalog', items: ['Products', 'Categories', 'Inventory'] },
  { label: 'Money', items: ['Purchasing', 'Expenses', 'Reports'] },
  { label: 'Admin', items: ['Team', 'Audit', 'Settings'] },
];

export function AdminTopBar({ section, onViewShop }: { section?: string; onViewShop?: () => void }) {
  return (
    <View style={st.topBar}>
      <View style={st.topInner}>
        <Image source={require('../../../assets/images/giriraja-logo.png')} style={st.logo} contentFit="contain" accessibilityLabel="Giriraja" />
        <View style={st.divider} />
        <View style={st.flex}>
          <Text style={st.eyebrow}>Business</Text>
          {section ? <Text style={st.section} numberOfLines={1}>{section}</Text> : null}
        </View>
        {onViewShop ? <Button variant="secondary" label="View shop" onPress={onViewShop} /> : null}
      </View>
    </View>
  );
}

export function AdminNav<T extends string>({ items, active, onSelect, vertical }: { items: readonly T[]; active: T; onSelect: (item: T) => void; vertical: boolean }) {
  const groups = GROUPS
    .map(group => ({ label: group.label, items: items.filter(item => group.items.includes(item)) }))
    .filter(group => group.items.length);
  const ungrouped = items.filter(item => !GROUPS.some(group => group.items.includes(item)));
  if (ungrouped.length) groups.push({ label: 'More', items: ungrouped });

  if (vertical) {
    // Scrolls on its own so lower groups stay reachable on short windows while the page content scrolls separately.
    // Group headings are quiet gold labels with a rule; the items under them carry icons and an indent so the two never read alike.
    return (
      <ScrollView style={st.sidebar} contentContainerStyle={st.sidebarContent} showsVerticalScrollIndicator accessibilityRole="tablist">
        {groups.map((group, index) => (
          <View key={group.label} style={[st.group, index > 0 && st.groupSpaced]}>
            <View style={st.groupHead} accessibilityRole="header">
              <Text style={st.groupLabel}>{group.label}</Text>
              <View style={st.groupRule} />
            </View>
            {group.items.map(item => {
              const selected = item === active;
              return (
                <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onSelect(item)} style={({ hovered }: { hovered?: boolean }) => [st.sideItem, hovered && !selected && st.sideItemHover, selected && st.sideItemActive]}>
                  <View style={[st.sideAccent, selected && st.sideAccentActive]} />
                  <NavIcon item={item} selected={selected} />
                  <Text style={[st.sideText, selected && st.sideTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    );
  }

  return <NavStrip groups={groups} active={active} onSelect={onSelect} />;
}

// Narrow screens get a sideways strip. Touch users swipe it; on the web a mouse wheel only scrolls
// vertically, so the wheel is turned sideways here, and the selected item is kept in view.
function NavStrip<T extends string>({ groups, active, onSelect }: { groups: { label: string; items: T[] }[]; active: T; onSelect: (item: T) => void }) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const positions = useRef<Partial<Record<string, { x: number; width: number }>>>({});
  const [viewportWidth, setViewportWidth] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = (scrollRef.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.();
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || node.scrollWidth <= node.clientWidth) return;
      event.preventDefault();
      node.scrollLeft += event.deltaY;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const spot = positions.current[active];
    if (!spot || !viewportWidth) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, spot.x - (viewportWidth - spot.width) / 2), animated: true });
  }, [active, viewportWidth]);

  return (
    <View style={st.railWrap}>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'} contentContainerStyle={st.rail} accessibilityRole="tablist" onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}>
        {groups.map((group, index) => (
          <Fragment key={group.label}>
            {index > 0 ? <View style={st.railDivider} /> : null}
            <Text style={st.railGroup} accessibilityRole="header">{group.label}</Text>
            {group.items.map(item => (
              <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: item === active }} onPress={() => onSelect(item)} onLayout={event => { positions.current[item] = { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width }; }} style={st.railItem}>
                <View style={st.railLabelRow}>
                  <NavIcon item={item} selected={item === active} size={16} />
                  <Text style={[st.railText, item === active && st.railTextActive]}>{item}</Text>
                </View>
                <View style={[st.railBar, item === active && st.railBarActive]} />
              </Pressable>
            ))}
          </Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

type SymbolName = React.ComponentProps<typeof SymbolView>['name'];
const icon = (ios: string, material: string) => ({ ios, android: material, web: material }) as SymbolName;
const ICONS: Record<string, SymbolName> = {
  Overview: icon('square.grid.2x2', 'dashboard'),
  Orders: icon('shippingbox', 'local_shipping'),
  Billing: icon('doc.text', 'receipt_long'),
  Returns: icon('arrow.uturn.backward', 'assignment_return'),
  Customers: icon('person.2', 'group'),
  Products: icon('tag', 'sell'),
  Categories: icon('square.stack', 'category'),
  Inventory: icon('archivebox', 'inventory_2'),
  Purchasing: icon('cart', 'shopping_cart'),
  Expenses: icon('indianrupeesign', 'payments'),
  Reports: icon('chart.bar', 'bar_chart'),
  Team: icon('person.badge.key', 'badge'),
  Audit: icon('clock.arrow.circlepath', 'history'),
  Settings: icon('gearshape', 'settings'),
};

function NavIcon({ item, selected, size = 18 }: { item: string; selected: boolean; size?: number }) {
  const name = ICONS[item];
  if (!name) return <View style={{ width: size }} />;
  return <SymbolView name={name} size={size} tintColor={selected ? A.brand : A.muted} />;
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { backgroundColor: A.panel, borderBottomWidth: 1, borderBottomColor: A.line },
  topInner: { width: '100%', maxWidth: 1360, alignSelf: 'center', minHeight: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 104, height: 32 },
  divider: { width: 1, height: 28, backgroundColor: A.line },
  eyebrow: { color: A.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: A.font },
  section: { color: A.ink, fontSize: 17, fontWeight: '800', marginTop: 1, fontFamily: A.font },
  sidebar: { width: 212, flexGrow: 0, flexShrink: 0 },
  sidebarContent: { paddingTop: 20, paddingRight: 12, paddingBottom: 24, gap: 18 },
  group: { gap: 2 },
  groupSpaced: { marginTop: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, marginBottom: 6 },
  groupLabel: { color: A.goldText, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: A.font },
  groupRule: { flex: 1, height: 1, backgroundColor: A.line },
  sideItem: { minHeight: 40, paddingLeft: 14, paddingRight: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  sideItemHover: { backgroundColor: '#ECE8E0' },
  sideItemActive: { backgroundColor: A.brandSoft },
  sideAccent: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, backgroundColor: 'transparent' },
  sideAccentActive: { backgroundColor: A.brand },
  sideText: { color: A.body, fontSize: 14, fontWeight: '600', fontFamily: A.font },
  sideTextActive: { color: A.brand, fontWeight: '800' },
  railWrap: { backgroundColor: A.panel, borderBottomWidth: 1, borderBottomColor: A.line },
  rail: { paddingHorizontal: 12, alignItems: 'center' },
  railGroup: { color: A.goldText, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', paddingLeft: 4, paddingRight: 2, fontFamily: A.font },
  railItem: { paddingHorizontal: 10, paddingTop: 12, alignItems: 'center' },
  railLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  railText: { color: A.body, fontSize: 13, fontWeight: '600', fontFamily: A.font },
  railTextActive: { color: A.ink, fontWeight: '800' },
  railBar: { height: 2, alignSelf: 'stretch', marginTop: 10, borderRadius: 1, backgroundColor: 'transparent' },
  railBarActive: { backgroundColor: A.brand },
  railDivider: { width: 1, height: 18, marginHorizontal: 6, backgroundColor: A.line },
});
