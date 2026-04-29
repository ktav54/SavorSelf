import { PropsWithChildren, RefObject } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, radii, spacing } from "@/constants/theme";

export function Screen({
  children,
  scroll = false,
  scrollRef,
  onScroll,
}: PropsWithChildren<{
  scroll?: boolean;
  scrollRef?: RefObject<ScrollView | null>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}>) {
  const content = scroll ? (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.scrollContent}
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return <SafeAreaView style={styles.screen} accessible={true}>{content}</SafeAreaView>;
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionHeader}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  secondary = false,
}: {
  label: string;
  onPress?: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable style={[styles.button, secondary && styles.buttonSecondary]} onPress={onPress}>
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
        style={[styles.input, multiline && styles.textarea]}
      />
    </View>
  );
}

export function MetricPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.metricPill}>
      <View style={[styles.metricDot, { backgroundColor: accent }]} />
      <View>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    width: "100%",
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: "#2C1A0E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    gap: 4,
  },
  eyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  title: {
    fontSize: 22,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.textSecondary,
  },
  button: {
    backgroundColor: colors.accentPrimary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonSecondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  buttonTextSecondary: {
    color: colors.textPrimary,
  },
  chip: {
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: "#F6DFC9",
    borderColor: colors.accentPrimary,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  chipTextActive: {
    color: colors.accentPrimary,
    fontWeight: "600",
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricDot: {
    width: 10,
    height: 10,
    borderRadius: radii.round,
  },
  metricValue: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: "600",
  },
});
