import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { A, Pill, numeric } from '@/features/admin/ui';
import { stockStatus } from './stockMath';

type Props = { value: string; onChange: (value: string) => void; label?: string; compact?: boolean };

// A plain "how many do you have" control: type a number or tap − / +, with a live In stock / Out of stock badge.
export function StockField({ value, onChange, label = 'In stock', compact = false }: Props) {
  const count = Number.parseInt(value, 10);
  const safeCount = Number.isFinite(count) && count > 0 ? count : 0;
  const status = stockStatus(safeCount);
  return (
    <View style={st.field}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <View style={st.row}>
        <View style={st.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel="One less" onPress={() => onChange(String(Math.max(0, safeCount - 1)))} style={st.step}><Text style={st.glyph}>−</Text></Pressable>
          <TextInput
            accessibilityLabel={label || 'Stock count'}
            value={value}
            onChangeText={text => onChange(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            selectTextOnFocus
            style={[st.input, numeric, compact && st.inputCompact]}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="One more" onPress={() => onChange(String(safeCount + 1))} style={st.step}><Text style={st.glyph}>+</Text></Pressable>
        </View>
        {compact ? null : <Pill label={status.label} tone={status.tone} />}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  field: { gap: 6 },
  label: { color: A.body, fontSize: 12, fontWeight: '700', fontFamily: A.font },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: A.lineStrong, borderRadius: 9, backgroundColor: A.panel, overflow: 'hidden' },
  step: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: A.sunken },
  glyph: { color: A.brand, fontSize: 20, fontWeight: '700', fontFamily: A.font },
  input: { width: 72, height: 42, textAlign: 'center', color: A.ink, fontSize: 16, fontWeight: '800', fontFamily: A.font, borderLeftWidth: 1, borderRightWidth: 1, borderColor: A.line },
  inputCompact: { width: 56 },
});
