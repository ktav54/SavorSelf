import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, Chip, Field, PrimaryButton, Screen, SectionTitle } from "@/components/ui";
import { colors, radii, spacing } from "@/constants/theme";
import {
  cancelAllSavorSelfNotifications,
  cancelSavorSelfNotification,
  scheduleDailyMoodReminder,
  scheduleLapseNudge,
  scheduleWeeklyReport,
} from "@/services/notifications";
import { useAppStore, type AppState } from "@/store/useAppStore";

export default function SettingsScreen() {
  const router = useRouter();
  const profile = useAppStore((state: AppState) => state.profile);
  const signOut = useAppStore((state: AppState) => state.signOut);
  const updateProfile = useAppStore((state: AppState) => state.updateProfile);
  const updateEmail = useAppStore((state: AppState) => state.updateEmail);
  const deleteAccount = useAppStore((state: AppState) => state.deleteAccount);

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [calorieGoal, setCalorieGoal] = useState("");
  const [proteinGoal, setProteinGoal] = useState("");
  const [carbsGoal, setCarbsGoal] = useState("");
  const [fatGoal, setFatGoal] = useState("");
  const [waterGoal, setWaterGoal] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [savingUnits, setSavingUnits] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [unitMessage, setUnitMessage] = useState("");
  const [goalsMessage, setGoalsMessage] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [dailyReminder, setDailyReminder] = useState(true);
  const [lapseNudge, setLapseNudge] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);

  useEffect(() => {
    setNameDraft(profile?.name ?? "");
    setEmailDraft(profile?.email ?? "");
    setCalorieGoal(profile?.dailyCalorieGoal != null ? String(profile.dailyCalorieGoal) : "");
    setProteinGoal(profile?.dailyProteinGoal != null ? String(profile.dailyProteinGoal) : "");
    setCarbsGoal(profile?.dailyCarbsGoal != null ? String(profile.dailyCarbsGoal) : "");
    setFatGoal(profile?.dailyFatGoal != null ? String(profile.dailyFatGoal) : "");
    setWaterGoal(profile?.dailyWaterGoal != null ? String(profile.dailyWaterGoal) : "");
  }, [profile]);

  useEffect(() => {
    if (goalsMessage !== "Goals saved.") {
      return;
    }

    const timer = setTimeout(() => {
      setGoalsMessage("");
    }, 2000);

    return () => clearTimeout(timer);
  }, [goalsMessage]);

  const waterUnitLabel = profile?.preferredUnits === "metric" ? "ml" : "oz";
  const subscriptionLabel = useMemo(() => {
    const tier = profile?.subscriptionTier ?? "free";
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  }, [profile?.subscriptionTier]);

  const handleSaveName = async () => {
    setSavingName(true);
    setProfileMessage("");

    const result = await updateProfile({
      name: nameDraft.trim(),
    });

    setSavingName(false);

    if (result.error) {
      setProfileMessage(result.error);
      return;
    }

    setIsEditingName(false);
    setProfileMessage("Name saved.");
  };

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    setEmailMessage("");

    const result = await updateEmail(emailDraft);

    setSavingEmail(false);

    if (result.error) {
      setEmailMessage(result.error);
      return;
    }

    setIsEditingEmail(false);
    setEmailMessage("Email updated.");
  };

  const handleUnitChange = async (next: "imperial" | "metric") => {
    if (!profile || profile.preferredUnits === next || savingUnits) {
      return;
    }

    setSavingUnits(true);
    setUnitMessage("");

    const result = await updateProfile({
      preferredUnits: next,
    });

    setSavingUnits(false);

    if (result.error) {
      setUnitMessage(result.error);
    }
  };

  const handleSaveGoals = async () => {
    setSavingGoals(true);
    setGoalsMessage("");

    const result = await updateProfile({
      dailyCalorieGoal: calorieGoal.trim() ? Number(calorieGoal) : undefined,
      dailyProteinGoal: proteinGoal.trim() ? Number(proteinGoal) : undefined,
      dailyCarbsGoal: carbsGoal.trim() ? Number(carbsGoal) : undefined,
      dailyFatGoal: fatGoal.trim() ? Number(fatGoal) : undefined,
      dailyWaterGoal: waterGoal.trim() ? Number(waterGoal) : undefined,
    });

    setSavingGoals(false);
    setGoalsMessage(result.error ?? "Goals saved.");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace("/welcome");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This will permanently delete your data and cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeletingAccount(true);
              setAccountMessage("");
              const result = await deleteAccount();
              setDeletingAccount(false);

              if (result.error) {
                setAccountMessage(result.error);
                return;
              }

              router.replace("/welcome");
            })();
          },
        },
      ]
    );
  };

  return (
    <Screen scroll>
      <View style={styles.page}>
        <View style={styles.topBar}>
          <Text style={styles.pageEyebrow}>Settings</Text>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={18} color={colors.accentPrimary} />
          </Pressable>
        </View>

        <SectionTitle
          eyebrow="Preferences"
          title="Your profile, goals, and defaults"
          subtitle="A quieter place to keep SavorSelf aligned with your name, your goals, and the kind of support you want from it."
        />

        <Card>
          <Text style={styles.heading}>Profile</Text>

          <View style={styles.infoBlock}>
            <View style={styles.inlineLabelRow}>
              <Text style={styles.itemLabel}>Name</Text>
              {!isEditingName ? (
                <Pressable onPress={() => setIsEditingName(true)}>
                  <Text style={styles.editLink}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
            {!isEditingName ? (
              <Text style={styles.profileValue}>{profile?.name || "Add your name"}</Text>
            ) : (
              <View style={styles.editWrap}>
                <Field label="Name" value={nameDraft} onChangeText={setNameDraft} placeholder="Your name" />
                <View style={styles.actionRow}>
                  <PrimaryButton label={savingName ? "Saving..." : "Save"} onPress={() => void handleSaveName()} />
                  <PrimaryButton
                    label="Cancel"
                    secondary
                    onPress={() => {
                      setNameDraft(profile?.name ?? "");
                      setIsEditingName(false);
                      setProfileMessage("");
                    }}
                  />
                </View>
              </View>
            )}
          </View>

          <View style={styles.infoBlock}>
            <View style={styles.inlineLabelRow}>
              <Text style={styles.itemLabel}>Email</Text>
              {!isEditingEmail ? (
                <Pressable onPress={() => setIsEditingEmail(true)}>
                  <Text style={styles.editLink}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
            {!isEditingEmail ? (
              <Text style={styles.metaValue}>{profile?.email || "No email yet"}</Text>
            ) : (
              <View style={styles.editWrap}>
                <Field label="Email" value={emailDraft} onChangeText={setEmailDraft} placeholder="you@example.com" />
                <View style={styles.actionRow}>
                  <PrimaryButton label={savingEmail ? "Saving..." : "Save"} onPress={() => void handleSaveEmail()} />
                  <PrimaryButton
                    label="Cancel"
                    secondary
                    onPress={() => {
                      setEmailDraft(profile?.email ?? "");
                      setIsEditingEmail(false);
                      setEmailMessage("");
                    }}
                  />
                </View>
              </View>
            )}
          </View>

          {profileMessage ? <Text style={styles.status}>{profileMessage}</Text> : null}
          {emailMessage ? <Text style={styles.status}>{emailMessage}</Text> : null}
        </Card>

        <Card>
          <Text style={styles.heading}>Units</Text>
          <Text style={styles.subtext}>Choose the measurement system that feels most natural when you log and review your day.</Text>
          <View style={styles.chipRow}>
            <Chip
              label="Imperial"
              active={profile?.preferredUnits === "imperial"}
              onPress={() => void handleUnitChange("imperial")}
            />
            <Chip
              label="Metric"
              active={profile?.preferredUnits === "metric"}
              onPress={() => void handleUnitChange("metric")}
            />
          </View>
          {savingUnits ? <Text style={styles.status}>Saving units...</Text> : null}
          {unitMessage ? <Text style={styles.status}>{unitMessage}</Text> : null}
        </Card>

        <Card>
          <Text style={styles.heading}>Daily Goals</Text>
          <Text style={styles.subtext}>These targets shape the nutrition and hydration context SavorSelf reflects back to you.</Text>

          <View style={styles.goalStack}>
            <View style={styles.goalRow}>
              <View style={styles.goalCopy}>
                <Text style={styles.goalLabel}>Calories</Text>
                <Text style={styles.goalHint}>calories</Text>
              </View>
              <TextInput
                value={calorieGoal}
                onChangeText={setCalorieGoal}
                keyboardType="numeric"
                placeholder="calories"
                placeholderTextColor={colors.textSecondary}
                style={styles.goalInput}
              />
            </View>

            <View style={styles.goalRow}>
              <View style={styles.goalCopy}>
                <Text style={styles.goalLabel}>Protein</Text>
                <Text style={styles.goalHint}>grams</Text>
              </View>
              <TextInput
                value={proteinGoal}
                onChangeText={setProteinGoal}
                keyboardType="numeric"
                placeholder="grams"
                placeholderTextColor={colors.textSecondary}
                style={styles.goalInput}
              />
            </View>

            <View style={styles.goalRow}>
              <View style={styles.goalCopy}>
                <Text style={styles.goalLabel}>Carbs</Text>
                <Text style={styles.goalHint}>grams</Text>
              </View>
              <TextInput
                value={carbsGoal}
                onChangeText={setCarbsGoal}
                keyboardType="numeric"
                placeholder="grams"
                placeholderTextColor={colors.textSecondary}
                style={styles.goalInput}
              />
            </View>

            <View style={styles.goalRow}>
              <View style={styles.goalCopy}>
                <Text style={styles.goalLabel}>Fat</Text>
                <Text style={styles.goalHint}>grams</Text>
              </View>
              <TextInput
                value={fatGoal}
                onChangeText={setFatGoal}
                keyboardType="numeric"
                placeholder="grams"
                placeholderTextColor={colors.textSecondary}
                style={styles.goalInput}
              />
            </View>

            <View style={styles.goalRow}>
              <View style={styles.goalCopy}>
                <Text style={styles.goalLabel}>Water</Text>
                <Text style={styles.goalHint}>{waterUnitLabel}</Text>
              </View>
              <TextInput
                value={waterGoal}
                onChangeText={setWaterGoal}
                keyboardType="numeric"
                placeholder={waterUnitLabel}
                placeholderTextColor={colors.textSecondary}
                style={styles.goalInput}
              />
            </View>
          </View>

          <PrimaryButton label={savingGoals ? "Saving..." : "Save goals"} onPress={() => void handleSaveGoals()} />
          {goalsMessage ? <Text style={styles.status}>{goalsMessage}</Text> : null}
        </Card>

        <Card>
          <Text style={styles.heading}>Subscription</Text>
          <Text style={styles.profileValue}>{subscriptionLabel}</Text>
          <Text style={styles.subtext}>Premium features coming soon.</Text>
        </Card>

        <Card>
          <Text style={styles.heading}>Notifications</Text>
          <Text style={styles.subtext}>These are local for now, but they make the settings feel real and ready for the next step.</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Daily mood check-in reminder</Text>
            <Switch
              value={dailyReminder}
              onValueChange={async (value) => {
                setDailyReminder(value);
                if (value) {
                  await scheduleDailyMoodReminder();
                } else {
                  await cancelSavorSelfNotification("daily-mood-reminder");
                  await Notifications.cancelScheduledNotificationAsync("daily-mood-reminder").catch(() => {});
                }
              }}
              trackColor={{ false: "#D9D0C7", true: "#E9D0BF" }}
              thumbColor={dailyReminder ? colors.accentPrimary : colors.white}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Two-day lapse nudge</Text>
            <Switch
              value={lapseNudge}
              onValueChange={async (value) => {
                setLapseNudge(value);
                if (!value) {
                  await cancelSavorSelfNotification("lapse-nudge");
                  await Notifications.cancelScheduledNotificationAsync("lapse-nudge").catch(() => {});
                }
              }}
              trackColor={{ false: "#D9D0C7", true: "#E9D0BF" }}
              thumbColor={lapseNudge ? colors.accentPrimary : colors.white}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Weekly Food-Mood report</Text>
            <Switch
              value={weeklyReport}
              onValueChange={async (value) => {
                setWeeklyReport(value);
                if (value) {
                  await scheduleWeeklyReport();
                } else {
                  await cancelSavorSelfNotification("weekly-report");
                  await Notifications.cancelScheduledNotificationAsync("weekly-report").catch(() => {});
                }
              }}
              trackColor={{ false: "#D9D0C7", true: "#E9D0BF" }}
              thumbColor={weeklyReport ? colors.accentPrimary : colors.white}
            />
          </View>
        </Card>

        <Card>
          <Text style={styles.heading}>Account</Text>
          <PrimaryButton label={signingOut ? "Signing out..." : "Sign out"} secondary onPress={() => void handleSignOut()} />
          <Pressable style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Text style={styles.deleteButtonText}>{deletingAccount ? "Deleting..." : "Delete account"}</Text>
          </Pressable>
          {accountMessage ? <Text style={styles.status}>{accountMessage}</Text> : null}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.md,
    marginBottom: spacing.xs,
  },
  pageEyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3EDE7",
    borderWidth: 1,
    borderColor: "rgba(196, 98, 45, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  infoBlock: {
    gap: 6,
  },
  inlineLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  itemLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  profileValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "600",
  },
  metaValue: {
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
  },
  editLink: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  editWrap: {
    gap: spacing.sm,
  },
  actionRow: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  goalStack: {
    gap: spacing.sm,
  },
  goalRow: {
    backgroundColor: "#F7F2EB",
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  goalCopy: {
    flex: 1,
    gap: 4,
  },
  goalLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  goalHint: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  goalInput: {
    minWidth: 104,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.08)",
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  switchLabel: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  status: {
    color: colors.accentPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  deleteButtonText: {
    color: "#C4622D",
    fontSize: 16,
    fontWeight: "600",
  },
});
