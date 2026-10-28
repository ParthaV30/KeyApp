import React from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C } from '@/components/shop/ui';

type State = { hasError: boolean };

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) console.error('Application screen failed to render.', error, info.componentStack);
  }

  private returnHome = () => {
    this.setState({ hasError: false });
    router.replace('/(tabs)');
  };

  render() {
    if (this.state.hasError) {
      return <View style={styles.screen} accessibilityRole="alert">
        <Text style={styles.eyebrow}>GIRIRAJA · KEY MACHINESALES</Text>
        <Text style={styles.title}>We hit a snag</Text>
        <Text style={styles.copy}>That screen could not be displayed. Your account and saved orders are still protected.</Text>
        <Pressable accessibilityRole="button" onPress={this.returnHome} style={styles.button}>
          <Text style={styles.buttonText}>Return to the shop</Text>
        </Pressable>
      </View>;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: '100%', alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: C.paper },
  eyebrow: { color: C.orange, fontFamily: 'Manrope', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center' },
  title: { color: C.ink, fontFamily: 'Manrope', fontSize: 26, fontWeight: '800', marginTop: 12, textAlign: 'center' },
  copy: { color: C.soft, fontFamily: 'Manrope', fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 360, textAlign: 'center' },
  button: { alignItems: 'center', backgroundColor: C.teal, borderRadius: 14, justifyContent: 'center', marginTop: 22, minHeight: 48, paddingHorizontal: 18 },
  buttonText: { color: C.white, fontFamily: 'Manrope', fontSize: 13, fontWeight: '800' },
});
