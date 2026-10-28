import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader, C, DispatchNotice, contentFrame } from '@/components/shop/ui';
import { useShop } from '@/features/shop/ShopContext';
import { useAuth } from '@/features/auth/AuthContext';
import { storeContact } from '@/data/products';

export default function AccountScreen() {
  const { favorites } = useShop();
  const { session, role, signOut } = useAuth();
  const supportUrl = storeContact.whatsappUrl;
  return <SafeAreaView style={styles.safe} edges={['top']}><AppHeader /><DispatchNotice /><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <View style={styles.profile}><View style={styles.avatar}>{session?.user.email ? <Text style={styles.avatarText}>{session.user.email.slice(0, 1).toUpperCase()}</Text> : <SymbolView name={{ ios: 'person.fill', android: 'person', web: 'person' }} tintColor={C.teal} size={24} />}</View><View style={styles.profileText}><Text style={styles.kicker}>WELCOME TO KEY MITRA</Text><Text style={styles.title}>{session?.user.user_metadata?.display_name || 'Your account'}</Text><Text style={styles.caption}>{session?.user.email ?? 'Sign in to see your orders and saved items.'}</Text></View></View>
    <View style={styles.menu}>
      {session ? <Pressable onPress={() => void signOut()} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}><View style={styles.menuIcon}><SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} tintColor={C.teal} size={19} /></View><View style={styles.menuCopy}><Text style={styles.menuTitle}>Sign out</Text><Text style={styles.menuSub}>Sign out of this device</Text></View><Text style={styles.chevron}>›</Text></Pressable> : <Pressable onPress={() => router.push('/auth')} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}><View style={styles.menuIcon}><SymbolView name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }} tintColor={C.teal} size={19} /></View><View style={styles.menuCopy}><Text style={styles.menuTitle}>Sign in or create account</Text><Text style={styles.menuSub}>Keep your orders and saved items together</Text></View><Text style={styles.chevron}>›</Text></Pressable>}
      {role === 'admin' && <Pressable onPress={() => router.push('/admin')} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}><View style={styles.menuIcon}><SymbolView name={{ ios: 'rectangle.3.group', android: 'dashboard', web: 'dashboard' }} tintColor={C.teal} size={19} /></View><View style={styles.menuCopy}><Text style={styles.menuTitle}>Admin dashboard</Text><Text style={styles.menuSub}>Manage products, categories, and orders</Text></View><Text style={styles.chevron}>›</Text></Pressable>}
      <Pressable onPress={() => router.push('/orders')} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}><View style={styles.menuIcon}><SymbolView name={{ ios: 'shippingbox', android: 'inventory_2', web: 'inventory_2' }} tintColor={C.teal} size={19} /></View><View style={styles.menuCopy}><Text style={styles.menuTitle}>My orders</Text><Text style={styles.menuSub}>Track recent purchases</Text></View><Text style={styles.chevron}>›</Text></Pressable>
      <Pressable onPress={() => router.navigate('/saved')} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}><View style={styles.menuIcon}><SymbolView name={{ ios: 'heart', android: 'favorite', web: 'favorite' }} tintColor={C.teal} size={19} /></View><View style={styles.menuCopy}><Text style={styles.menuTitle}>Saved items</Text><Text style={styles.menuSub}>{favorites.length} items on your list</Text></View><Text style={styles.chevron}>›</Text></Pressable>
      <Pressable onPress={() => Linking.openURL(supportUrl)} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}><View style={styles.menuIconWa}><SymbolView name={{ ios: 'message.fill', android: 'chat', web: 'chat' }} tintColor={C.green} size={19} /></View><View style={styles.menuCopy}><Text style={styles.menuTitle}>WhatsApp support</Text><Text style={styles.menuSub}>Chat with the Giriraja team ({storeContact.displayPhone})</Text></View><Text style={styles.chevron}>↗</Text></Pressable>
      <Pressable onPress={() => Linking.openURL(`tel:${storeContact.phone}`)} style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}><View style={styles.menuIcon}><SymbolView name={{ ios: 'phone.fill', android: 'call', web: 'call' }} tintColor={C.teal} size={19} /></View><View style={styles.menuCopy}><Text style={styles.menuTitle}>Call showroom</Text><Text style={styles.menuSub}>{storeContact.displayPhone}</Text></View><Text style={styles.chevron}>↗</Text></Pressable>
    </View>
    <View style={styles.note}><Text style={styles.noteTitle}>The House of Blank Keys</Text><Text style={styles.noteBody}>15+ Authorised brand distributors · Bengaluru based · Serving locksmiths for 9+ years</Text></View>
    <Text style={styles.version}>Giriraja · Key Mitra · Bengaluru</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  content: { ...contentFrame, paddingBottom: 96 },
  profile: {
    margin: 18,
    marginTop: 20,
    padding: 17,
    borderRadius: 16,
    backgroundColor: C.teal,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: C.gold,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: C.teal, fontSize: 18, fontWeight: '800', fontFamily: 'Manrope' },
  profileText: { flex: 1 },
  kicker: { color: C.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1, fontFamily: 'Manrope' },
  title: { color: C.white, fontSize: 21, fontWeight: '900', marginTop: 5, fontFamily: 'Manrope' },
  caption: { color: 'rgba(255,255,255,.9)', fontSize: 12, marginTop: 4, lineHeight: 18, fontFamily: 'Manrope' },
  menu: { marginHorizontal: 18, gap: 9 },
  menuRow: {
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EEE8DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconWa: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EAF3ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  menuCopy: { flex: 1 },
  menuTitle: { color: C.ink, fontSize: 14, fontWeight: '800', fontFamily: 'Manrope' },
  menuSub: { color: C.soft, fontSize: 12, lineHeight: 17, marginTop: 4, fontFamily: 'Manrope' },
  chevron: { color: '#8A9396', fontSize: 20, paddingHorizontal: 4, fontFamily: 'Manrope' },
  note: {
    backgroundColor: '#EAF3ED',
    borderRadius: 11,
    padding: 13,
    marginHorizontal: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#D2E4D7',
  },
  noteTitle: { color: '#285540', fontSize: 13, fontWeight: '800', fontFamily: 'Manrope' },
  noteBody: { color: '#436E56', fontSize: 12, lineHeight: 18, marginTop: 5, fontFamily: 'Manrope' },
  version: { color: C.muted, fontSize: 11, margin: 20, marginTop: 25, fontFamily: 'Manrope' },
});
