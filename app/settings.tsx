import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { Alert, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui";
import { colors, radii, spacing } from "@/constants/theme";
import {
  cancelSavorSelfNotification,
  scheduleDailyMoodReminder,
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

  const [profileModalVisible, setProfileModalVisible] = useState(false);
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
  const avatarLetter = (profile?.name?.trim()?.charAt(0) ?? "S").toUpperCase();

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

    setProfileMessage("Name saved.");
    setProfileModalVisible(false);
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

    setEmailMessage("Email updated.");
    setProfileModalVisible(false);
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
      return;
    }

    setUnitMessage("Units updated.");
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
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <Ionicons name="close" size={18} color={colors.accentPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Profile</Text>
          <View style={styles.sectionCard}>
            <Pressable onPress={() => setProfileModalVisible(true)} style={({ pressed }) => [styles.profileRow, pressed && styles.pressed]}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>{avatarLetter}</Text>
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileName}>{profile?.name || "Add your name"}</Text>
                <Text style={styles.profileEmail} numberOfLines={1} ellipsizeMode="tail">
                  {profile?.email || "No email yet"}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            {profileMessage ? <Text style={styles.statusText}>{profileMessage}</Text> : null}
            {emailMessage ? <Text style={styles.statusText}>{emailMessage}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Daily Goals</Text>
          <View style={styles.sectionCard}>
            <View style={styles.goalStack}>
              <View style={styles.goalRow}>
                <View style={styles.goalCopy}>
                  <Text style={styles.goalLabel}>Calories</Text>
                  <Text style={styles.goalHint}>Daily target</Text>
                </View>
                <View style={styles.goalValueWrap}>
                  <TextInput
                    value={calorieGoal}
                    onChangeText={setCalorieGoal}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.goalInput}
                  />
                  <Text style={styles.goalUnit}>kcal</Text>
                </View>
              </View>

              <View style={styles.goalRow}>
                <View style={styles.goalCopy}>
                  <Text style={styles.goalLabel}>Protein</Text>
                  <Text style={styles.goalHint}>Mood steadiness</Text>
                </View>
                <View style={styles.goalValueWrap}>
                  <TextInput
                    value={proteinGoal}
                    onChangeText={setProteinGoal}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.goalInput}
                  />
                  <Text style={styles.goalUnit}>g</Text>
                </View>
              </View>

              <View style={styles.goalRow}>
                <View style={styles.goalCopy}>
                  <Text style={styles.goalLabel}>Carbs</Text>
                  <Text style={styles.goalHint}>Energy support</Text>
                </View>
                <View style={styles.goalValueWrap}>
                  <TextInput
                    value={carbsGoal}
                    onChangeText={setCarbsGoal}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.goalInput}
                  />
                  <Text style={styles.goalUnit}>g</Text>
                </View>
              </View>

              <View style={styles.goalRow}>
                <View style={styles.goalCopy}>
                  <Text style={styles.goalLabel}>Fat</Text>
                  <Text style={styles.goalHint}>Fullness & fuel</Text>
                </View>
                <View style={styles.goalValueWrap}>
                  <TextInput
                    value={fatGoal}
                    onChangeText={setFatGoal}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.goalInput}
                  />
                  <Text style={styles.goalUnit}>g</Text>
                </View>
              </View>

              <View style={styles.goalRow}>
                <View style={styles.goalCopy}>
                  <Text style={styles.goalLabel}>Water</Text>
                  <Text style={styles.goalHint}>Hydration target</Text>
                </View>
                <View style={styles.goalValueWrap}>
                  <TextInput
                    value={waterGoal}
                    onChangeText={setWaterGoal}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.goalInput}
                  />
                  <Text style={styles.goalUnit}>{waterUnitLabel}</Text>
                </View>
              </View>
            </View>

            <Pressable onPress={() => void handleSaveGoals()} style={({ pressed }) => [styles.saveGoalsButton, pressed && styles.pressed]}>
              <Text style={styles.saveGoalsText}>{savingGoals ? "Saving..." : "Save goals"}</Text>
            </Pressable>
            {goalsMessage ? <Text style={styles.statusText}>{goalsMessage}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Units</Text>
          <View style={styles.sectionCard}>
            <View style={styles.segmentedControl}>
              {(["imperial", "metric"] as const).map((option) => {
                const active = profile?.preferredUnits === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => void handleUnitChange(option)}
                    style={({ pressed }) => [
                      styles.segment,
                      active && styles.segmentActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                      {option === "imperial" ? "Imperial" : "Metric"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {savingUnits ? <Text style={styles.statusText}>Saving units...</Text> : null}
            {unitMessage ? <Text style={styles.statusText}>{unitMessage}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Subscription</Text>
          <View style={styles.subscriptionCard}>
            <Text style={styles.subscriptionTitle}>{`SavorSelf ${subscriptionLabel}`}</Text>
            <Text style={styles.subscriptionSubtitle}>
              Unlock premium insights, trends, and nutrition analysis
            </Text>
            <View style={styles.subscriptionBadge}>
              <Text style={styles.subscriptionBadgeText}>Coming Soon</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notifications</Text>
          <View style={styles.sectionCard}>
            <View style={styles.notificationRows}>
              <View style={styles.notificationRow}>
                <Text style={styles.notificationLabel}>Daily mood check-in reminder</Text>
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
                  trackColor={{ false: "#E5D9CE", true: colors.accentPrimary }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={styles.notificationRow}>
                <Text style={styles.notificationLabel}>Two-day lapse nudge</Text>
                <Switch
                  value={lapseNudge}
                  onValueChange={async (value) => {
                    setLapseNudge(value);
                    if (!value) {
                      await cancelSavorSelfNotification("lapse-nudge");
                      await Notifications.cancelScheduledNotificationAsync("lapse-nudge").catch(() => {});
                    }
                  }}
                  trackColor={{ false: "#E5D9CE", true: colors.accentPrimary }}
                  thumbColor={colors.white}
                />
              </View>

              <View style={[styles.notificationRow, styles.notificationRowLast]}>
                <Text style={styles.notificationLabel}>Weekly Food-Mood report</Text>
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
                  trackColor={{ false: "#E5D9CE", true: colors.accentPrimary }}
                  thumbColor={colors.white}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.sectionCard}>
            <Pressable onPress={() => void handleSignOut()} style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
              <Text style={styles.signOutText}>{signingOut ? "Signing out..." : "Sign out"}</Text>
            </Pressable>
            <Pressable onPress={handleDeleteAccount} style={({ pressed }) => [styles.deleteLinkWrap, pressed && styles.pressed]}>
              <Text style={styles.deleteLink}>{deletingAccount ? "Deleting..." : "Delete account"}</Text>
            </Pressable>
            {accountMessage ? <Text style={styles.statusText}>{accountMessage}</Text> : null}
            <Text style={styles.versionText}>SavorSelf v1.0.0</Text>
          </View>
        </View>
      </View>

      <Modal visible={profileModalVisible} transparent animationType="slide" onRequestClose={() => setProfileModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalScrim} onPress={() => setProfileModalVisible(false)} />
          <View style={styles.editSheet}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Edit profile</Text>
              <Pressable onPress={() => setProfileModalVisible(false)} style={({ pressed }) => [styles.editCloseButton, pressed && styles.pressed]}>
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.editBlock}>
              <Text style={styles.editLabel}>Name</Text>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Your name"
                placeholderTextColor={colors.textSecondary}
                style={styles.editInput}
              />
              <Pressable onPress={() => void handleSaveName()} style={({ pressed }) => [styles.editPrimaryButton, pressed && styles.pressed]}>
                <Text style={styles.editPrimaryButtonText}>{savingName ? "Saving..." : "Save name"}</Text>
              </Pressable>
            </View>

            <View style={styles.editBlock}>
              <Text style={styles.editLabel}>Email</Text>
              <TextInput
                value={emailDraft}
                onChangeText={setEmailDraft}
                placeholder="you@example.com"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.editInput}
              />
              <Pressable onPress={() => void handleSaveEmail()} style={({ pressed }) => [styles.editPrimaryButton, pressed && styles.pressed]}>
                <Text style={styles.editPrimaryButtonText}>{savingEmail ? "Saving..." : "Save email"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 18,
    paddingBottom: spacing.xl,
  },
  pressed: {
    opacity: 0.78,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    marginBottom: 2,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3EDE7",
    borderWidth: 1,
    borderColor: "rgba(196, 98, 45, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F6EDE4",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.accentPrimary,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "600",
  },
  profileEmail: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 20,
  },
  goalStack: {
    gap: 10,
  },
  goalRow: {
    backgroundColor: "#F7F2EB",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
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
    fontSize: 13,
    lineHeight: 22,
  },
  goalValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  goalInput: {
    minWidth: 92,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.08)",
  },
  goalUnit: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    minWidth: 30,
    textAlign: "right",
  },
  saveGoalsButton: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  saveGoalsText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F0EAE3",
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  segmentActive: {
    backgroundColor: colors.white,
    shadowColor: "#2C1A0E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: "400",
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  subscriptionCard: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  subscriptionTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "700",
  },
  subscriptionSubtitle: {
    color: colors.white,
    fontSize: 14,
    opacity: 0.85,
    lineHeight: 22,
  },
  subscriptionBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  subscriptionBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  notificationRows: {
    gap: 0,
  },
  notificationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 16,
  },
  notificationRowLast: {
    borderBottomWidth: 0,
  },
  notificationLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
  },
  signOutButton: {
    backgroundColor: "#F0EAE3",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  signOutText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  deleteLinkWrap: {
    alignItems: "center",
    marginTop: 12,
  },
  deleteLink: {
    color: "#C4622D",
    fontSize: 14,
    textAlign: "center",
  },
  versionText: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
  statusText: {
    color: colors.accentPrimary,
    fontSize: 14,
    lineHeight: 22,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(44, 26, 14, 0.24)",
  },
  modalScrim: {
    flex: 1,
  },
  editSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 18,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  editCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editBlock: {
    gap: 10,
  },
  editLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  editInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  editPrimaryButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentPrimary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  editPrimaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
});
