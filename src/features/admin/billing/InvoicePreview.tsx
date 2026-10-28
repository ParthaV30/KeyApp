import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { A } from '@/features/admin/ui';

// Native preview renders the same HTML that gets printed, scaled to the phone width.
export function InvoicePreview({ html }: { html: string }) {
  return (
    <View style={st.frame}>
      <WebView originWhitelist={['about:*']} source={{ html }} style={st.web} scalesPageToFit setBuiltInZoomControls={false} />
    </View>
  );
}

const st = StyleSheet.create({
  frame: { flex: 1, backgroundColor: A.panel, borderWidth: 1, borderColor: A.line, borderRadius: 12, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: '#FFFFFF' },
});
