import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { InvoiceProfile } from './invoiceDocument';
import { emptyInvoiceProfile, loadInvoiceProfile, saveInvoiceProfile, validateInvoiceProfile } from './invoiceProfile';
import { adminErrorMessage } from '@/features/admin/errors';
import { A, Button, Field, Panel } from '@/features/admin/ui';

type Props = {
  busy: boolean;
  runAction: (action: () => Promise<void>) => Promise<void>;
  setMessage: (message: string) => void;
};

export function InvoiceProfilePanel({ busy, runAction, setMessage }: Props) {
  const [profile, setProfile] = useState<Required<InvoiceProfile>>(emptyInvoiceProfile);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    void loadInvoiceProfile().then(result => {
      if (!active) return;
      setProfile(result.profile);
      setAvailable(result.available);
    });
    return () => { active = false; };
  }, []);

  const set = (key: keyof InvoiceProfile) => (value: string) => setProfile(current => ({ ...current, [key]: key === 'bankIfsc' ? value.toUpperCase() : value }));

  const save = () => runAction(async () => {
    const problem = validateInvoiceProfile(profile);
    if (problem) { setMessage(problem); return; }
    const { error } = await saveInvoiceProfile(profile);
    setMessage(error ? adminErrorMessage(error, 'Could not save invoice details. Check the connection and retry.') : 'Invoice details saved. New and reprinted bills will use them.');
  });

  if (!available) {
    return (
      <Panel title="Invoice contact & bank details" caption="Mobile, email and bank details on bills need the latest database update. Ask your developer to apply the Supabase migration “invoice_contact_and_bank”, then reopen Settings." >
        <Text style={st.note}>Until then, bills show the store support phone only.</Text>
      </Panel>
    );
  }

  return (
    <Panel title="Invoice contact & bank details" caption="Printed on every bill. Leave a field blank to hide it.">
      <View style={st.grid}>
        <View style={st.cell}><Field label="Mobile on bill" value={profile.phone} onChangeText={set('phone')} keyboardType="phone-pad" /></View>
        <View style={st.cell}><Field label="Email on bill" value={profile.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" /></View>
      </View>
      <Text style={st.group}>Bank details</Text>
      <View style={st.grid}>
        <View style={st.cell}><Field label="Account name" value={profile.bankAccountName} onChangeText={set('bankAccountName')} /></View>
        <View style={st.cell}><Field label="Bank" value={profile.bankName} onChangeText={set('bankName')} /></View>
        <View style={st.cell}><Field label="Branch" value={profile.bankBranch} onChangeText={set('bankBranch')} /></View>
        <View style={st.cell}><Field label="Account number" value={profile.bankAccountNumber} onChangeText={set('bankAccountNumber')} keyboardType="number-pad" /></View>
        <View style={st.cell}><Field label="IFSC" value={profile.bankIfsc} onChangeText={set('bankIfsc')} autoCapitalize="characters" maxLength={11} /></View>
        <View style={st.cell}><Field label="UPI ID" value={profile.upiId} onChangeText={set('upiId')} autoCapitalize="none" /></View>
      </View>
      <Field label="Terms printed at the bottom" value={profile.terms} onChangeText={set('terms')} multiline placeholder="e.g. Goods once sold will not be taken back." maxLength={500} />
      <View><Button label={busy ? 'Saving…' : 'Save invoice details'} onPress={() => void save()} disabled={busy} /></View>
    </Panel>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexGrow: 1, flexBasis: 220 },
  group: { color: A.ink, fontSize: 13, fontWeight: '800', marginTop: 4, fontFamily: A.font },
  note: { color: A.body, fontSize: 13, fontFamily: A.font },
});
