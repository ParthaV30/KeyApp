import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C } from '@/components/shop/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { safeBack } from '@/lib/safeBack';

type Notice = { tone: 'error' | 'success'; text: string } | null;

export default function AuthScreen() {
  const { backendConfigured, signIn, signUp } = useAuth();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    try {
      if (creating) {
        const { signedIn } = await signUp(name, email, phone, password);
        if (signedIn) { safeBack('/(tabs)'); return; }
        setNotice({ tone: 'success', text: `Account created. We sent a confirmation link to ${email.trim()}. Open it, then sign in here.` });
        setCreating(false);
        setPassword('');
      } else {
        await signIn(email, password);
        safeBack('/(tabs)');
      }
    } catch (cause) {
      setNotice({ tone: 'error', text: cause instanceof Error ? cause.message : 'Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => { setCreating(!creating); setNotice(null); };
  const keyboardHeight = useKeyboardHeight();
  const revealPending = useRef(false);
  // The keyboard covers the lower fields on phones, so the form is nudged up once it has opened.
  const revealLowerFields = () => {
    revealPending.current = true;
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };
  useEffect(() => {
    if (keyboardHeight === 0) { revealPending.current = false; return; }
    if (revealPending.current) scrollRef.current?.scrollToEnd({ animated: true });
  }, [keyboardHeight]);

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView ref={scrollRef} contentContainerStyle={[styles.content, Platform.OS === 'android' && { paddingBottom: 36 + keyboardHeight }]} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => safeBack('/(tabs)')} style={styles.back}><Text style={styles.backText}>←  Back to shop</Text></Pressable>
    <View style={styles.brand}><Image source={require('../../assets/images/giriraja-logo.png')} style={styles.logo} contentFit="contain" accessibilityLabel="Giriraja" /><Text style={styles.brandSub}>Key Mitra · Bengaluru</Text></View>
    <Text style={styles.kicker}>{creating ? 'JOIN KEY MITRA' : 'WELCOME BACK'}</Text><Text style={styles.title}>{creating ? 'Create your account' : 'Sign in'}</Text><Text style={styles.caption}>{creating ? 'Save your details and keep track of your orders.' : 'Sign in to view your orders and saved products.'}</Text>
    {!backendConfigured && <View style={styles.warning}><Text style={styles.warningText}>The backend is not connected yet. Add your Supabase project URL and publishable key to the local .env file, then restart the app.</Text></View>}
    {creating && <><Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" /><Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" onFocus={revealLowerFields} /></>}
    <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" onFocus={revealLowerFields} />
    <PasswordField value={password} onChangeText={setPassword} creating={creating} onFocus={revealLowerFields} onSubmitEditing={() => void submit()} />
    {notice ? <Text accessibilityRole="alert" style={[styles.notice, notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess]}>{notice.text}</Text> : null}
    <Pressable disabled={!backendConfigured || busy} onPress={() => void submit()} style={[styles.submit, (!backendConfigured || busy) && styles.disabled]}><Text style={styles.submitText}>{busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}</Text></Pressable>
    <Pressable onPress={switchMode} style={styles.switch}><Text style={styles.switchText}>{creating ? 'Already have an account? Sign in' : 'New to Key Mitra? Create an account'}</Text></Pressable>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

// Android draws the app edge-to-edge, so the window no longer shrinks for the keyboard and
// KeyboardAvoidingView has nothing to react to; the form reserves the keyboard's height instead.
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => setHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} style={styles.input} placeholder={`Enter ${label.toLowerCase()}`} placeholderTextColor="#9BA3A6" autoCorrect={false} /></View>;
}

function PasswordField({ creating, ...props }: { creating: boolean } & React.ComponentProps<typeof TextInput>) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.label}>Password</Text>
    <View style={styles.passwordBox}>
      <TextInput {...props} accessibilityLabel="Password" secureTextEntry={!visible} style={styles.passwordInput} placeholder={creating ? 'At least 8 characters' : 'Enter password'} placeholderTextColor="#9BA3A6" autoCapitalize="none" autoCorrect={false} autoComplete={creating ? 'new-password' : 'current-password'} returnKeyType="go" />
      <Pressable onPress={() => setVisible(!visible)} hitSlop={6} accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} style={({ pressed }) => [styles.eye, pressed && styles.eyePressed]}>
        <SymbolView name={visible ? { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' } : { ios: 'eye', android: 'visibility', web: 'visibility' }} tintColor={C.soft} size={22} />
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper }, flex: { flex: 1 }, content: { paddingHorizontal: 22, paddingBottom: 36 },
  back: { minHeight: 48, justifyContent: 'center' }, backText: { color: C.soft, fontSize: 13, fontWeight: '700', fontFamily: 'Manrope' },
  brand: { alignItems: 'center', paddingVertical: 26 }, logo: { width: 180, height: 56 },
  brandSub: { color: C.muted, fontSize: 12, marginTop: 6, letterSpacing: 0.4, fontFamily: 'Manrope' },
  kicker: { color: C.orange, fontWeight: '900', letterSpacing: 1.3, fontSize: 11, marginTop: 12, fontFamily: 'Manrope' }, title: { color: C.ink, fontSize: 30, fontWeight: '900', marginTop: 6, fontFamily: 'Manrope' },
  caption: { color: C.soft, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 18, fontFamily: 'Manrope' },
  warning: { backgroundColor: '#F8EBDD', padding: 14, borderRadius: 14, marginBottom: 14 }, warningText: { color: '#714F2C', fontSize: 13, lineHeight: 19, fontFamily: 'Manrope' },
  field: { marginTop: 14, gap: 7 }, label: { color: C.ink, fontSize: 13, fontWeight: '700', fontFamily: 'Manrope' }, input: { minHeight: 52, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 14, color: C.ink, fontSize: 15, fontFamily: 'Manrope' },
  passwordBox: { minHeight: 52, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 14, flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, alignSelf: 'stretch', paddingHorizontal: 14, color: C.ink, fontSize: 15, fontFamily: 'Manrope' },
  eye: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginRight: 2 }, eyePressed: { backgroundColor: C.stone },
  notice: { marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1, fontSize: 13, lineHeight: 19, fontFamily: 'Manrope' },
  noticeError: { color: '#8A2E27', backgroundColor: '#FBECE9', borderColor: '#F0CFC9' }, noticeSuccess: { color: '#1F5A3D', backgroundColor: '#E9F4EC', borderColor: '#CBE5D3' },
  submit: { marginTop: 20, minHeight: 52, borderRadius: 14, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.5 }, submitText: { color: C.white, fontSize: 14, fontWeight: '900', fontFamily: 'Manrope' },
  switch: { minHeight: 52, padding: 14, alignItems: 'center', justifyContent: 'center' }, switchText: { color: C.teal, fontSize: 13, fontWeight: '800', fontFamily: 'Manrope' },
});
