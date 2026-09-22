import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, useTheme } from './theme';

type Variant = 'body' | 'title' | 'heading' | 'caption' | 'label';
const SIZES: Record<Variant, { fontSize: number; fontWeight: TextStyle['fontWeight'] }> = {
  title: { fontSize: 26, fontWeight: '700' },
  heading: { fontSize: 19, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 15, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400' },
};

interface AppTextProps extends TextProps {
  variant?: Variant;
  muted?: boolean;
  color?: string;
  /** Scale with the user's font size setting. On by default. */
  scale?: boolean;
}

export function AppText({
  variant = 'body',
  muted,
  color,
  scale = true,
  style,
  ...rest
}: AppTextProps) {
  const { palette, fontScale } = useTheme();
  const base = SIZES[variant];
  return (
    <Text
      {...rest}
      style={[
        {
          color: color ?? (muted ? palette.muted : palette.text),
          fontSize: base.fontSize * (scale ? fontScale : 1),
          fontWeight: base.fontWeight,
        },
        style,
      ]}
    />
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  testID,
}: ButtonProps) {
  const { palette } = useTheme();
  const colors = {
    primary: { bg: palette.primary, fg: palette.onPrimary, border: palette.primary },
    secondary: { bg: 'transparent', fg: palette.primary, border: palette.primary },
    danger: { bg: 'transparent', fg: palette.danger, border: palette.danger },
    ghost: { bg: 'transparent', fg: palette.primary, border: 'transparent' },
  }[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.fg} />
      ) : (
        <>
          {icon}
          <AppText variant="label" color={colors.fg}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: ReactNode;
  /** Read out by screen readers; there is no visible text. */
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        minWidth: 48,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}) {
  const { palette } = useTheme();
  const base = [
    styles.card,
    { backgroundColor: palette.surface, borderColor: palette.border },
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? palette.primary : palette.surfaceAlt,
          borderColor: selected ? palette.primary : palette.border,
        },
      ]}
    >
      <AppText variant="caption" color={selected ? palette.onPrimary : palette.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  style,
  ...rest
}: TextInputProps & { label?: string; hint?: string }) {
  const { palette, fontScale } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <AppText variant="label" muted>
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={palette.muted}
        {...rest}
        style={[
          styles.input,
          {
            color: palette.text,
            backgroundColor: palette.surface,
            borderColor: palette.border,
            fontSize: 16 * fontScale,
            textAlign: 'auto',
          },
          style,
        ]}
      />
      {hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** Scrollable screen body with safe-area padding. */
export function Screen({
  children,
  edges = ['bottom'],
}: {
  children: ReactNode;
  edges?: ('top' | 'bottom')[];
}) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
  };
  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: palette.bg }]}
      contentContainerStyle={[styles.content, pad]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {body ? (
        <AppText muted style={{ textAlign: 'center' }}>
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  empty: { padding: spacing.xxl, gap: spacing.sm, alignItems: 'center' },
});
