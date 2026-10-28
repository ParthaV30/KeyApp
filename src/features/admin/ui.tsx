import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

// Back-office palette: quiet neutrals, one brand teal for actions, colour reserved for status meaning.
export const A = {
  canvas: '#F5F3EE',
  panel: '#FFFFFF',
  sunken: '#F7F5F1',
  line: '#E6E1D8',
  lineStrong: '#D6CFC2',
  ink: '#1B2F33',
  body: '#4B5D5F',
  muted: '#65716F',
  brand: '#17383C',
  brandSoft: '#E8EEEC',
  gold: '#B98635',
  goldText: '#835C1E',
  good: '#2F7A4F',
  goodSoft: '#E6F2EA',
  warn: '#9A6512',
  warnSoft: '#FBF0DC',
  bad: '#B23A2E',
  badSoft: '#FBE9E6',
  neutralSoft: '#EFEDE8',
  font: 'Manrope',
} as const;

export const numeric = { fontVariant: ['tabular-nums'] } as const;

export type Tone = 'good' | 'warn' | 'bad' | 'neutral' | 'brand';
const toneColors: Record<Tone, { fg: string; bg: string }> = {
  good: { fg: A.good, bg: A.goodSoft },
  warn: { fg: A.warn, bg: A.warnSoft },
  bad: { fg: A.bad, bg: A.badSoft },
  neutral: { fg: A.body, bg: A.neutralSoft },
  brand: { fg: A.brand, bg: A.brandSoft },
};

export function Panel({ title, caption, action, children, style }: { title?: string; caption?: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.panel, style]}>
      {title ? (
        <View style={s.panelHead}>
          <View style={s.flex}>
            <Text style={s.panelTitle}>{title}</Text>
            {caption ? <Text style={s.panelCaption}>{caption}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ label, onPress, variant = 'primary', disabled = false, wide = false }: { label: string; onPress: () => void; variant?: ButtonVariant; disabled?: boolean; wide?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [s.button, s[variant], wide && s.wide, hovered && !disabled && s[`${variant}Hover`], pressed && !disabled && s.pressed, disabled && s.disabled]}
    >
      <Text style={[s.buttonText, s[`${variant}Text`]]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, ...props }: { label: string; hint?: string } & TextInputProps) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#A0A8A6" {...props} style={[s.input, props.multiline && s.multiline, props.style]} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: readonly { value: T; label: string; count?: number }[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={s.segmented} accessibilityRole="tablist">
      {options.map(option => {
        const active = option.value === value;
        return (
          <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onChange(option.value)} style={[s.segment, active && s.segmentActive]}>
            <Text style={[s.segmentText, active && s.segmentTextActive]} numberOfLines={1}>{option.label}</Text>
            {option.count ? <Text style={[s.segmentCount, active && s.segmentCountActive]}>{option.count}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={[s.chip, selected && s.chipSelected]}>
      <Text style={[s.chipText, selected && s.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const colors = toneColors[tone];
  return (
    <View style={[s.pill, { backgroundColor: colors.bg }]}>
      <View style={[s.pillDot, { backgroundColor: colors.fg }]} />
      <Text style={[s.pillText, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

export function Stat({ label, value, caption, tone }: { label: string; value: string; caption?: string; tone?: Tone }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, numeric, tone && { color: toneColors[tone].fg }]}>{value}</Text>
      {caption ? <Text style={s.statCaption}>{caption}</Text> : null}
    </View>
  );
}

export function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.empty}>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  panel: { backgroundColor: A.panel, borderRadius: 12, borderWidth: 1, borderColor: A.line, padding: 18, gap: 14 },
  panelHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  panelTitle: { color: A.ink, fontSize: 15, fontWeight: '800', fontFamily: A.font },
  panelCaption: { color: A.muted, fontSize: 12, lineHeight: 18, marginTop: 3, fontFamily: A.font },
  button: { minHeight: 42, paddingHorizontal: 16, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  wide: { alignSelf: 'stretch', minHeight: 50 },
  primary: { backgroundColor: A.brand, borderColor: A.brand },
  primaryHover: { backgroundColor: '#204A4F' },
  secondary: { backgroundColor: A.panel, borderColor: A.lineStrong },
  secondaryHover: { backgroundColor: A.sunken },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 8 },
  ghostHover: { backgroundColor: A.sunken },
  danger: { backgroundColor: A.panel, borderColor: '#E9C4BE' },
  dangerHover: { backgroundColor: A.badSoft },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  buttonText: { fontSize: 13, fontWeight: '700', fontFamily: A.font },
  primaryText: { color: '#FFFFFF' },
  secondaryText: { color: A.ink },
  ghostText: { color: A.brand },
  dangerText: { color: A.bad },
  field: { gap: 6 },
  label: { color: A.body, fontSize: 12, fontWeight: '700', fontFamily: A.font },
  input: { minHeight: 44, borderWidth: 1, borderColor: A.lineStrong, borderRadius: 9, paddingHorizontal: 12, backgroundColor: A.panel, color: A.ink, fontSize: 14, fontFamily: A.font },
  multiline: { minHeight: 80, paddingTop: 10, textAlignVertical: 'top' },
  hint: { color: A.muted, fontSize: 11, lineHeight: 16, fontFamily: A.font },
  segmented: { flexDirection: 'row', backgroundColor: A.neutralSoft, borderRadius: 10, padding: 3, gap: 2, alignSelf: 'flex-start', maxWidth: '100%' },
  segment: { minHeight: 36, paddingHorizontal: 14, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentActive: { backgroundColor: A.panel, borderWidth: 1, borderColor: A.line },
  segmentText: { color: A.body, fontSize: 13, fontWeight: '600', fontFamily: A.font },
  segmentTextActive: { color: A.ink, fontWeight: '800' },
  segmentCount: { color: A.muted, fontSize: 11, fontWeight: '800', backgroundColor: '#E3DFD7', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden', fontFamily: A.font },
  segmentCountActive: { color: A.panel, backgroundColor: A.brand },
  chip: { minHeight: 36, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: A.lineStrong, backgroundColor: A.panel, justifyContent: 'center' },
  chipSelected: { backgroundColor: A.brand, borderColor: A.brand },
  chipText: { color: A.body, fontSize: 13, fontWeight: '600', fontFamily: A.font },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '800', fontFamily: A.font },
  stat: { flexGrow: 1, flexBasis: 150, backgroundColor: A.panel, borderRadius: 12, borderWidth: 1, borderColor: A.line, paddingHorizontal: 16, paddingVertical: 14 },
  statLabel: { color: A.muted, fontSize: 12, fontWeight: '700', fontFamily: A.font },
  statValue: { color: A.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 6, fontFamily: A.font },
  statCaption: { color: A.muted, fontSize: 11, marginTop: 2, fontFamily: A.font },
  empty: { paddingVertical: 28, paddingHorizontal: 16, alignItems: 'center', gap: 6 },
  emptyTitle: { color: A.ink, fontSize: 14, fontWeight: '800', fontFamily: A.font },
  emptyBody: { color: A.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 360, fontFamily: A.font },
});
