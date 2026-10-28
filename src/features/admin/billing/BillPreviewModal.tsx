import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { A, Button } from '@/features/admin/ui';
import { InvoicePreview } from './InvoicePreview';

type Props = {
  visible: boolean;
  html: string;
  loading: boolean;
  warnings: string[];
  busy: boolean;
  onClose: () => void;
  onCreate: () => void;
};

// Full-screen check of the unsaved bill, rendered with the same template the final invoice uses.
export function BillPreviewModal({ visible, html, loading, warnings, busy, onClose, onCreate }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={st.safe}>
        <View style={st.bar}>
          <View style={st.barInner}>
            <View style={st.title}>
              <Text style={st.heading}>Bill preview</Text>
              <Text style={st.sub}>Check the bill before creating it. Nothing is saved yet.</Text>
            </View>
            <Button variant="secondary" label="Back to edit" onPress={onClose} />
            <Button label={busy ? 'Creating…' : 'Create bill'} onPress={onCreate} disabled={busy || loading} />
          </View>
        </View>
        <ScrollView style={st.flex} contentContainerStyle={[st.body, Platform.OS !== 'web' && st.bodyNative]}>
          {warnings.map(warning => <Text key={warning} style={st.warning}>{warning}</Text>)}
          {loading ? <Text style={st.loading}>Preparing preview…</Text> : (
            <View style={Platform.OS === 'web' ? undefined : st.native}><InvoicePreview html={html} /></View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: A.canvas },
  bar: { backgroundColor: A.panel, borderBottomWidth: 1, borderBottomColor: A.line },
  barInner: { width: '100%', maxWidth: 860, alignSelf: 'center', minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  title: { flexGrow: 1, flexBasis: 200 },
  heading: { color: A.ink, fontSize: 16, fontWeight: '800', fontFamily: A.font },
  sub: { color: A.muted, fontSize: 12, marginTop: 2, fontFamily: A.font },
  body: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 16, gap: 12, paddingBottom: 40 },
  bodyNative: { flexGrow: 1 },
  native: { height: 640 },
  warning: { color: '#6B4F1F', backgroundColor: A.warnSoft, borderWidth: 1, borderColor: '#EED9AE', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 13, lineHeight: 19, fontFamily: A.font },
  loading: { color: A.muted, fontSize: 13, textAlign: 'center', paddingVertical: 40, fontFamily: A.font },
});
