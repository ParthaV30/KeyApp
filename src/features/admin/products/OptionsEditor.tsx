import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { A, Button } from '@/features/admin/ui';
import { StockField } from './StockField';
import { parseOptionLines, serializeOptionLines, type OptionRow } from './stockMath';

const blankRow: OptionRow = { name: '', price: '', stock: '0', sku: '' };

// Table editor for product options (e.g. 3 button / 4 button), each with its own price and stock.
// `value` stays in the saved "name | price | stock | SKU" text format so the save logic is unchanged.
export function OptionsEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [rows, setRows] = useState<OptionRow[]>(() => parseOptionLines(value));

  // Re-sync when the parent loads a different product or clears the form.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(current => (serializeOptionLines(current) === value ? current : parseOptionLines(value)));
  }, [value]);

  const update = (next: OptionRow[]) => { setRows(next); onChange(serializeOptionLines(next)); };
  const edit = (index: number, key: keyof OptionRow) => (text: string) => update(rows.map((row, i) => (i === index ? { ...row, [key]: text } : row)));

  return (
    <View style={st.wrap}>
      <Text style={st.title}>Options <Text style={st.optional}>(only if this product comes in types, e.g. 3 button / 4 button)</Text></Text>
      {rows.map((row, index) => (
        <View key={index} style={st.row}>
          <View style={st.name}><Cell label="Option" value={row.name} onChangeText={edit(index, 'name')} placeholder="e.g. 3 button" /></View>
          <View style={st.price}><Cell label="Price (₹)" value={row.price} onChangeText={edit(index, 'price')} keyboardType="decimal-pad" placeholder="0" /></View>
          <View style={st.stock}><StockField compact label="In stock" value={row.stock} onChange={edit(index, 'stock')} /></View>
          <View style={st.sku}><Cell label="SKU (optional)" value={row.sku} onChangeText={edit(index, 'sku')} /></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove option ${row.name || index + 1}`} onPress={() => update(rows.filter((_, i) => i !== index))} style={st.remove}>
            <Text style={st.removeText}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <View><Button variant="secondary" label="+ Add option" onPress={() => setRows([...rows, blankRow])} /></View>
    </View>
  );
}

function Cell({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={st.cell}>
      <Text style={st.label}>{label}</Text>
      <TextInput placeholderTextColor="#A0A8A6" {...props} style={st.input} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 10 },
  title: { color: A.ink, fontSize: 13, fontWeight: '800', fontFamily: A.font },
  optional: { color: A.muted, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10, padding: 12, borderWidth: 1, borderColor: A.line, borderRadius: 10, backgroundColor: A.sunken },
  name: { flexGrow: 2, flexBasis: 160 },
  price: { flexGrow: 1, flexBasis: 90 },
  stock: { flexBasis: 150 },
  sku: { flexGrow: 1, flexBasis: 110 },
  cell: { gap: 6 },
  label: { color: A.body, fontSize: 12, fontWeight: '700', fontFamily: A.font },
  input: { minHeight: 42, borderWidth: 1, borderColor: A.lineStrong, borderRadius: 9, paddingHorizontal: 10, backgroundColor: A.panel, color: A.ink, fontSize: 14, fontFamily: A.font },
  remove: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 6 },
  removeText: { color: A.bad, fontSize: 13, fontWeight: '700', fontFamily: A.font },
});
