import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "@/constants/theme";
import { Card, Field, PrimaryButton, SectionTitle } from "@/components/ui";
import { journalPrompts } from "@/data/journalPrompts";
import { useAppStore } from "@/store/useAppStore";

export function TodayJournalCard() {
  const entries = useAppStore((state) => state.journalEntries);
  const saveJournalEntry = useAppStore((state) => state.saveJournalEntry);
  const journalLoading = useAppStore((state) => state.journalLoading);
  const journalError = useAppStore((state) => state.journalError);
  const prompt = useMemo(
    () => journalPrompts[new Date().getDate() % journalPrompts.length],
    []
  );
  const todayEntry = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return entries.find((entry) => entry.createdAt.slice(0, 10) === today) ?? null;
  }, [entries]);
  const [body, setBody] = useState("");

  useEffect(() => {
    setBody(todayEntry?.body ?? "");
  }, [todayEntry?.id]);

  const submit = async () => {
    if (!body.trim()) {
      return;
    }

    const result = await saveJournalEntry({
      body,
      promptUsed: prompt,
    });

    if (!result.error) {
      setBody(body.trim());
    }
  };

  return (
    <Card>
      <SectionTitle
        eyebrow="Today's Prompt"
        title={prompt}
        subtitle="Free-write, or treat this as a small check-in. Nothing has to be polished."
      />
      <Field
        label="Today's entry"
        value={body}
        onChangeText={setBody}
        placeholder="What stood out in your body, mood, or meals today?"
        multiline
      />
      {journalError ? <Text style={styles.errorText}>{journalError}</Text> : null}
      <PrimaryButton
        label={journalLoading ? "Saving..." : todayEntry ? "Update entry" : "Save entry"}
        onPress={() => void submit()}
      />
    </Card>
  );
}

export function PastEntriesCard() {
  const entries = useAppStore((state) => state.journalEntries);
  const days = useMemo(() => {
    return Array.from({ length: 28 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (27 - index));
      const key = date.toISOString().slice(0, 10);
      const hasEntry = entries.some((entry) => entry.createdAt.slice(0, 10) === key);

      return {
        key,
        label: date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
        dayNumber: date.getDate(),
        hasEntry,
      };
    });
  }, [entries]);

  return (
    <Card>
      <SectionTitle
        eyebrow="Past Entries"
        title="Your reflections, without streak pressure"
        subtitle="Empty days stay quiet. Logged days simply hold what you wanted to remember."
      />
      <View style={styles.calendarGrid}>
        {days.map((day) => (
          <View key={day.key} style={styles.dayCell}>
            <Text style={styles.dayLabel}>{day.dayNumber}</Text>
            <View style={[styles.dayDot, day.hasEntry && styles.dayDotActive]} />
          </View>
        ))}
      </View>
      <View style={styles.entryList}>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.entryCard}>
            <Text style={styles.entryDate}>{new Date(entry.createdAt).toDateString()}</Text>
            <Text style={styles.entryBody}>{entry.body}</Text>
            <Text style={styles.reflectLink}>Reflect on this entry</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  dayCell: {
    width: 32,
    alignItems: "center",
    gap: 6,
  },
  dayLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  dayDot: {
    width: 18,
    height: 18,
    borderRadius: radii.round,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayDotActive: {
    backgroundColor: colors.accentSecondary,
    borderColor: colors.accentSecondary,
  },
  errorText: {
    color: colors.accentPrimary,
    fontSize: 14,
  },
  entryList: {
    gap: spacing.sm,
  },
  entryCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 8,
  },
  entryDate: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  entryBody: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 24,
  },
  reflectLink: {
    color: colors.accentPrimary,
    fontWeight: "600",
  },
});
