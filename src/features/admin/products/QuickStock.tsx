import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { AdminVariant } from '@/features/admin/types';
import { A, Button, Pill, numeric } from '@/features/admin/ui';
import { stockStatus } from './stockMath';

type Target = { variantId: string | null; label: string; current: number };
type Props = {
  productId: string;
  productStock: number;
  hasVariants: boolean;
  variants: AdminVariant[];
  busy: boolean;
  onSet: (productId: string, variantId: string | null, current: number, input: string) => Promise<boolean>;
};

// Shows "In stock · 24" on each catalog row and lets staff type the new count directly.
export function QuickStock({ productId, productStock, hasVariants, variants, busy, onSet }: Props) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const targets: Target[] = hasVariants
    ? variants.map(variant => ({ variantId: variant.id, label: variant.name, current: variant.stock_quantity }))
    : [{ variantId: null, label: 'In stock', current: productStock }];
  const total = targets.reduce((sum, target) => sum + target.current, 0);
  const status = stockStatus(total);

  const save = async (target: Target) => {
    const key = target.variantId ?? 'product';
    if (await onSet(productId, target.variantId, target.current, drafts[key] ?? String(target.current))) {
      setDrafts(current => ({ ...current, [key]: '' }));
      if (!hasVariants) setOpen(false);
    }
  };

  return (
    <View style={st.wrap}>
      <View style={st.head}>
        <Pill label={hasVariants && targets.length ? `${status.label} (${targets.length} options)` : status.label} tone={status.tone} />
        <Button variant="ghost" label={open ? 'Done' : 'Update stock'} onPress={() => setOpen(value => !value)} />
      </View>
      {open ? (
        <View style={st.panel}>
          {targets.length ? targets.map(target => {
            const key = target.variantId ?? 'product';
            return (
              <View key={key} style={st.row}>
                <Text style={st.name} numberOfLines={1}>{target.label}</Text>
                <Text style={[st.now, numeric]}>Now {target.current}</Text>
                <TextInput
                  accessibilityLabel={`New stock count for ${target.label}`}
                  value={drafts[key] ?? String(target.current)}
                  onChangeText={text => setDrafts(current => ({ ...current, [key]: text.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  style={[st.input, numeric]}
                />
                <Button label="Save" onPress={() => void save(target)} disabled={busy} />
              </View>
            );
          }) : <Text style={st.note}>Add options in Edit to track stock for this product.</Text>}
          <Text style={st.note}>Type how many you have now. The change is saved to stock history automatically.</Text>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 8, marginTop: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  panel: { gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: A.line, backgroundColor: A.sunken },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: A.ink, fontSize: 13, fontWeight: '700', fontFamily: A.font },
  now: { color: A.muted, fontSize: 12, fontFamily: A.font },
  input: { width: 72, height: 40, borderWidth: 1, borderColor: A.lineStrong, borderRadius: 8, textAlign: 'center', backgroundColor: A.panel, color: A.ink, fontSize: 15, fontWeight: '800', fontFamily: A.font },
  note: { color: A.muted, fontSize: 12, lineHeight: 17, fontFamily: A.font },
});
