import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { A } from '@/features/admin/ui';
import { ORDER_STEPS, orderStepStates, type StepState } from './orderFlow';

const DOT: Record<StepState, { bg: string; border: string; fg: string }> = {
  done: { bg: A.good, border: A.good, fg: '#FFFFFF' },
  current: { bg: A.panel, border: A.brand, fg: A.brand },
  upcoming: { bg: A.panel, border: A.lineStrong, fg: A.muted },
  cancelled: { bg: A.neutralSoft, border: A.line, fg: A.muted },
};

// Full tracker with labels for the detail view; `compact` is the thin bar used in list rows.
export function OrderStepper({ status, compact = false }: { status: string; compact?: boolean }) {
  const states = orderStepStates(status);
  if (compact) {
    return (
      <View style={st.bar} accessibilityLabel={`Progress: step ${Math.max(1, states.filter(s => s === 'done').length + (states.includes('current') ? 1 : 0))} of ${ORDER_STEPS.length}`}>
        {states.map((state, index) => <View key={ORDER_STEPS[index].status} style={[st.barSegment, { backgroundColor: state === 'done' ? A.good : state === 'current' ? A.brand : A.line }]} />)}
      </View>
    );
  }
  return (
    <View style={st.row}>
      {ORDER_STEPS.map((step, index) => {
        const state = states[index];
        const colors = DOT[state];
        return (
          <Fragment key={step.status}>
            {index > 0 ? <View style={[st.line, { backgroundColor: state === 'done' || state === 'current' ? A.good : A.line }]} /> : null}
            <View style={st.step} accessibilityLabel={`${step.label}: ${state}`}>
              <View style={[st.dot, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <Text style={[st.dotText, { color: colors.fg }]}>{state === 'done' ? '✓' : String(index + 1)}</Text>
              </View>
              <Text style={[st.label, state === 'current' && st.labelCurrent, state === 'upcoming' && st.labelMuted]} numberOfLines={1}>{step.label}</Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { alignItems: 'center', width: 64, gap: 6 },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontSize: 13, fontWeight: '800', fontFamily: A.font },
  line: { flex: 1, height: 2, marginTop: 14, marginHorizontal: -14, borderRadius: 1 },
  label: { color: A.ink, fontSize: 12, fontWeight: '700', fontFamily: A.font },
  labelCurrent: { color: A.brand, fontWeight: '800' },
  labelMuted: { color: A.muted, fontWeight: '600' },
  bar: { flexDirection: 'row', gap: 3, width: 120 },
  barSegment: { flex: 1, height: 4, borderRadius: 2 },
});
