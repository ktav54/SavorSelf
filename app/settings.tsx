import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import {
  cancelSavorSelfNotification,
  scheduleDailyMoodReminder,
  scheduleWeeklyReport,
} from "@/services/notifications";
import { useAppStore, type AppState } from "@/store/useAppStore";

type AboutModalKind = "how" | "science" | "terms" | null;

export default function SettingsScreen() {
  const router = useRouter();
  const profile = useAppStore((state: AppState) => state.profile);
  const foodLogs = useAppStore((state: AppState) => state.foodLogs);
  const moodLogs = useAppStore((state: AppState) => state.moodLogs);
  const analyticsFoodLogs = useAppStore((state: AppState) => state.analyticsFoodLogs);
  const analyticsMoodLogs = useAppStore((state: AppState) => state.analyticsMoodLogs);
  const loadFoodMoodInsights = useAppStore((state: AppState) => state.loadFoodMoodInsights);
  const signOut = useAppStore((state: AppState) => state.signOut);
  const updateProfile = useAppStore((state: AppState) => state.updateProfile);
  const updateEmail = useAppStore((state: AppState) => state.updateEmail);
  const deleteAccount = useAppStore((state: AppState) => state.deleteAccount);

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(profile?.avatarEmoji ?? null);
  const [aboutModal, setAboutModal] = useState<AboutModalKind>(null);
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
  const [weeklyEmailSummary, setWeeklyEmailSummary] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  useEffect(() => {
    setNameDraft(profile?.name ?? "");
    setEmailDraft(profile?.email ?? "");
    setAvatarEmoji(profile?.avatarEmoji ?? null);
    setCalorieGoal(profile?.dailyCalorieGoal != null ? String(profile.dailyCalorieGoal) : "");
    setProteinGoal(profile?.dailyProteinGoal != null ? String(profile.dailyProteinGoal) : "");
    setCarbsGoal(profile?.dailyCarbsGoal != null ? String(profile.dailyCarbsGoal) : "");
    setFatGoal(profile?.dailyFatGoal != null ? String(profile.dailyFatGoal) : "");
    setWaterGoal(profile?.dailyWaterGoal != null ? String(profile.dailyWaterGoal) : "64");
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

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (analyticsFoodLogs.length > 0 || analyticsMoodLogs.length > 0) {
      return;
    }

    void loadFoodMoodInsights();
  }, [analyticsFoodLogs.length, analyticsMoodLogs.length, loadFoodMoodInsights, profile]);

  const waterUnitLabel = profile?.preferredUnits === "metric" ? "ml" : "oz";
  const journeyFoodLogs = analyticsFoodLogs.length > 0 ? analyticsFoodLogs : foodLogs;
  const journeyMoodLogs = analyticsMoodLogs.length > 0 ? analyticsMoodLogs : moodLogs;
  const journeyMetrics = useMemo(() => {
    const foodDates = new Set(journeyFoodLogs.map((log) => log.loggedAt.slice(0, 10)));
    const moodDates = new Set(journeyMoodLogs.map((log) => log.loggedAt.slice(0, 10)));
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (foodDates.has(cursor.toISOString().slice(0, 10)) && moodDates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const avgMood =
      journeyMoodLogs.length > 0
        ? journeyMoodLogs.reduce((sum, log) => sum + log.moodScore, 0) / journeyMoodLogs.length
        : null;

    const firstTimestamp = [...journeyFoodLogs, ...journeyMoodLogs]
      .map((entry) => entry.loggedAt)
      .sort((left, right) => left.localeCompare(right))[0];

    const sinceLabel = firstTimestamp
      ? new Date(firstTimestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "Today";

    return {
      streak,
      meals: journeyFoodLogs.length,
      avgMood,
      sinceLabel: `SINCE ${sinceLabel.toUpperCase()}`,
    };
  }, [journeyFoodLogs, journeyMoodLogs]);

  const aboutSheetContent = useMemo(() => {
    if (aboutModal === "how") {
      return {
        title: "How SavorSelf works",
        body: "SavorSelf helps you discover the personal connection between what you eat and how you feel - your gut-brain axis.\n\nEach day you log your food and mood. Over time, SavorSelf finds correlations unique to you: which foods boost your energy, which ones cloud your thinking, and what patterns emerge when you feel your best.\n\nIt's not about perfect eating. It's about understanding your own body.",
      };
    }

    if (aboutModal === "science") {
      return {
        title: "The gut-brain connection",
        body: "Your gut and brain are in constant communication through the vagus nerve and gut microbiome. This is called the gut-brain axis.\n\nAbout 95% of your serotonin - your mood-regulating neurotransmitter - is produced in your gut. What you eat directly influences your microbiome, which influences your brain chemistry.\n\nResearch shows that fiber-rich foods, fermented foods, and consistent eating patterns support a healthy microbiome and more stable mood.",
      };
    }

    if (aboutModal === "terms") {
      return {
        title: "Terms of Service",
        body: "Last updated: April 2026\n\nBy using SavorSelf, you agree to these terms.\n\n1. Use of Service\nSavorSelf is a personal wellness tracking app. It is not a medical device and does not provide medical advice. Always consult a healthcare professional for medical decisions.\n\n2. Your Data\nYou own your data. We collect food logs, mood logs, and wellness data only to provide you with personalized insights. We do not sell your data to third parties.\n\n3. Account\nYou are responsible for maintaining the security of your account. You can delete your account and all data at any time from Settings.\n\n4. Limitation of Liability\nSavorSelf is provided as-is. We are not liable for any decisions made based on information in the app.\n\n5. Contact\nQuestions? Email us at savor.self.app@gmail.com",
      };
    }

    return null;
  }, [aboutModal]);

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

  const handleSaveAvatar = async (emoji: string | null) => {
    setAvatarEmoji(emoji);
    setShowAvatarPicker(false);
    setProfileMessage("");

    const result = await updateProfile({
      avatarEmoji: emoji,
    });

    if (result.error) {
      setProfileMessage(result.error);
      return;
    }

    setProfileMessage(emoji ? "Avatar updated." : "Avatar removed.");
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

  const handleAppLockPress = () => {
    Alert.alert("App lock & passcode", "This device-level protection flow is not enabled yet.");
  };

  const handleExportDataPress = () => {
    Alert.alert("Export my data", "Data export is not available in-app yet.");
  };

  const handleManagePermissionsPress = () => {
    void Linking.openSettings();
  };

  return (
    <Screen scroll>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Profile</Text>
          <View style={[styles.sectionCard, styles.profileCard]}>
            <View style={styles.profileRow}>
              <Pressable onPress={() => setShowAvatarPicker(true)} style={styles.avatarCircle}>
                {avatarEmoji ? (
                  <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
                ) : (
                  <Text style={styles.avatarInitial}>{profile?.name?.[0]?.toUpperCase() ?? "?"}</Text>
                )}
                <View style={styles.avatarEditBadge}>
                  <Text style={styles.avatarEditText}>✎</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => setProfileModalVisible(true)}
                style={({ pressed }) => [styles.profileDetailsPressable, pressed && styles.pressed]}
              >
                <View style={styles.profileCopy}>
                  <Text style={styles.profileName}>{profile?.name || "Add your name"}</Text>
                  <Text style={styles.profileEmail} numberOfLines={1} ellipsizeMode="tail">
                    {profile?.email || "No email yet"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            {profileMessage ? <Text style={styles.statusText}>{profileMessage}</Text> : null}
            {emailMessage ? <Text style={styles.statusText}>{emailMessage}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your Journey</Text>
          <View style={[styles.sectionCard, styles.journeyCard]}>
            <View style={styles.journeyHeader}>
              <Text style={styles.journeyTitle}>Your journey</Text>
              <View style={styles.journeySincePill}>
                <Text style={styles.journeySinceText}>{journeyMetrics.sinceLabel}</Text>
              </View>
            </View>
            <View style={styles.journeyStatRow}>
              <View style={styles.journeyStatCard}>
                <Text style={styles.journeyStatLabel}>Streak</Text>
                <Text style={styles.journeyStatValue}>
                  {journeyMetrics.streak}
                  <Text style={styles.journeyStatSuffix}> days</Text>
                </Text>
              </View>
              <View style={styles.journeyStatCard}>
                <Text style={styles.journeyStatLabel}>Logs</Text>
                <Text style={styles.journeyStatValue}>
                  {journeyMetrics.meals}
                  <Text style={styles.journeyStatSuffix}> meals</Text>
                </Text>
              </View>
              <View style={styles.journeyStatCard}>
                <Text style={styles.journeyStatLabel}>Avg mood</Text>
                <Text style={styles.journeyStatValue}>
                  {journeyMetrics.avgMood != null ? journeyMetrics.avgMood.toFixed(1) : "—"}
                  <Text style={styles.journeyStatSuffix}> /5</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Daily Goals</Text>
          <View style={[styles.sectionCard, styles.goalsCard]}>
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

            <Pressable
              onPress={() => void handleSaveGoals()}
              style={({ pressed }) => [styles.saveGoalsButton, pressed && styles.pressed]}
            >
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

        <View style={[styles.section, styles.aboutSection]}>
          <Text style={styles.sectionLabel}>Privacy & Data</Text>
          <View style={styles.sectionCard}>
            <Pressable style={styles.utilityRow} onPress={handleAppLockPress}>
              <View style={styles.utilityIconWrap}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={styles.utilityLabel}>App lock &amp; passcode</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.aboutDivider} />
            <Pressable style={styles.utilityRow} onPress={handleExportDataPress}>
              <View style={styles.utilityIconWrap}>
                <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={styles.utilityLabel}>Export my data</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.aboutDivider} />
            <Pressable style={styles.utilityRow} onPress={handleManagePermissionsPress}>
              <View style={styles.utilityIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={styles.utilityLabel}>Manage permissions</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.section, styles.aboutSection]}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.sectionCard}>
            <Pressable style={styles.aboutRow} onPress={() => setAboutModal("how")}>
              <View style={styles.utilityIconWrap}>
                <Ionicons name="sparkles-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={styles.utilityLabel}>How SavorSelf works</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.aboutDivider} />
            <Pressable style={styles.aboutRow} onPress={() => setAboutModal("science")}>
              <View style={styles.utilityIconWrap}>
                <Ionicons name="barbell-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={styles.utilityLabel}>The gut-brain science</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.aboutDivider} />
            <Pressable style={styles.aboutRow} onPress={() => void Linking.openURL("mailto:savor.self.app@gmail.com")}>
              <View style={styles.utilityIconWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={styles.utilityLabel}>Send feedback</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.aboutDivider} />
            <Pressable style={styles.aboutRow} onPress={() => setAboutModal("terms")}>
              <View style={styles.utilityIconWrap}>
                <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={styles.utilityLabel}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <View style={styles.aboutDivider} />
            <Pressable style={styles.aboutRow} onPress={() => void Linking.openURL("https://savorself.app/privacy")}>
              <View style={styles.utilityIconWrap}>
                <Ionicons name="shield-outline" size={16} color={colors.textSecondary} />
              </View>
              <Text style={styles.utilityLabel}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={[styles.sectionCard, styles.accountCard]}>
            <Pressable
              onPress={() => void handleSignOut()}
              style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
            >
              <View style={styles.accountButtonContent}>
                <Ionicons name="log-out-outline" size={16} color={colors.textPrimary} />
                <Text style={styles.signOutText}>{signingOut ? "Signing out..." : "Sign out"}</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={handleDeleteAccount}
              style={({ pressed }) => [styles.deleteLinkWrap, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={14} color={colors.accentPrimary} />
              <Text style={styles.deleteLink}>{deletingAccount ? "Deleting..." : "Delete account"}</Text>
            </Pressable>
            {accountMessage ? <Text style={styles.statusText}>{accountMessage}</Text> : null}
            <Text style={styles.versionText}>SavorSelf v1.0.0 • made with care 🌱</Text>
          </View>
        </View>
      </View>

      <Modal visible={showAvatarPicker} transparent animationType="slide" onRequestClose={() => setShowAvatarPicker(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.avatarBackdrop} onPress={() => setShowAvatarPicker(false)} />
          <View style={styles.avatarSheet}>
            <View style={styles.dragHandle} />
            <Text style={styles.avatarPickerTitle}>Choose your avatar</Text>
            <View style={styles.emojiGrid}>
              {[
                "😊", "🌱", "⚡", "🧠", "🌿", "🔥", "✨", "🎯",
                "💪", "🌊", "🍎", "🥑", "🌸", "🦋", "🌙", "☀️",
                "🎨", "🎵", "📚", "🏃", "🧘", "🌺", "🍃", "💫",
              ].map((emoji) => (
                <Pressable
                  key={emoji}
                  style={[styles.emojiOption, avatarEmoji === emoji && styles.emojiOptionSelected]}
                  onPress={() => {
                    void handleSaveAvatar(emoji);
                  }}
                >
                  <Text style={styles.emojiOptionText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.avatarRemove} onPress={() => void handleSaveAvatar(null)}>
              <Text style={styles.avatarRemoveText}>Remove avatar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={profileModalVisible} transparent animationType="slide" onRequestClose={() => setProfileModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalScrim} onPress={() => setProfileModalVisible(false)} />
          <View style={styles.editSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Edit profile</Text>
              <Pressable
                onPress={() => setProfileModalVisible(false)}
                style={({ pressed }) => [styles.editCloseButton, pressed && styles.pressed]}
              >
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
              <Pressable
                onPress={() => void handleSaveName()}
                style={({ pressed }) => [styles.editPrimaryButton, pressed && styles.pressed]}
              >
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
              <Pressable
                onPress={() => void handleSaveEmail()}
                style={({ pressed }) => [styles.editPrimaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.editPrimaryButtonText}>{savingEmail ? "Saving..." : "Save email"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(aboutSheetContent)} transparent animationType="slide" onRequestClose={() => setAboutModal(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalScrim} onPress={() => setAboutModal(null)} />
          <View style={styles.infoSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>{aboutSheetContent?.title ?? ""}</Text>
              <Pressable onPress={() => setAboutModal(null)} style={({ pressed }) => [styles.editCloseButton, pressed && styles.pressed]}>
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView style={styles.infoScroll} contentContainerStyle={styles.infoScrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.infoBody}>{aboutSheetContent?.body ?? ""}</Text>
            </ScrollView>
            <Pressable style={styles.editPrimaryButton} onPress={() => setAboutModal(null)}>
              <Text style={styles.editPrimaryButtonText}>Close</Text>
            </Pressable>
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    width: 36,
    height: 36,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(196, 98, 45, 0.10)",
    padding: 16,
    gap: 14,
    shadowColor: "#A2602F",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },
  profileCard: {
    paddingVertical: 14,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileDetailsPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F6EDE4",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarEmoji: {
    fontSize: 28,
  },
  avatarInitial: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.accentPrimary,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accentPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarEditText: {
    fontSize: 10,
    color: colors.white,
  },
  profileCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  profileEmail: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  journeyCard: {
    gap: 16,
  },
  journeyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  journeyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  journeySincePill: {
    backgroundColor: "#F6EDE4",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  journeySinceText: {
    color: colors.accentPrimary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  journeyStatRow: {
    flexDirection: "row",
    gap: 10,
  },
  journeyStatCard: {
    flex: 1,
    backgroundColor: "#FCF9F5",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(196, 98, 45, 0.10)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  journeyStatLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  journeyStatValue: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  journeyStatSuffix: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  goalsCard: {
    gap: 16,
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
    fontWeight: "700",
  },
  goalHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  goalValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  goalInput: {
    minWidth: 74,
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    borderWidth: 1,
    borderColor: "rgba(44, 26, 14, 0.06)",
  },
  goalUnit: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    minWidth: 28,
    textAlign: "right",
  },
  saveGoalsButton: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
  },
  saveGoalsText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F0EAE3",
    borderRadius: 14,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
  },
  segmentActive: {
    backgroundColor: colors.white,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  segmentLabelActive: {
    color: colors.textPrimary,
    fontWeight: "700",
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
  aboutSection: {
    marginTop: 8,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  utilityIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F4EEE7",
    alignItems: "center",
    justifyContent: "center",
  },
  utilityLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  aboutRowLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  accountCard: {
    alignItems: "stretch",
  },
  signOutButton: {
    backgroundColor: "#F0EAE3",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  accountButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signOutText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  deleteLinkWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  deleteLink: {
    color: colors.accentPrimary,
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
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(44, 26, 14, 0.24)",
  },
  avatarBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  avatarSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 20,
  },
  avatarPickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 20,
    textAlign: "center",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    marginBottom: 20,
  },
  emojiOption: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiOptionSelected: {
    borderColor: colors.accentPrimary,
    backgroundColor: "#FFF8F4",
  },
  emojiOptionText: {
    fontSize: 26,
  },
  avatarRemove: {
    alignItems: "center",
    paddingVertical: 12,
  },
  avatarRemoveText: {
    fontSize: 14,
    color: colors.textSecondary,
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
  infoSheet: {
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
    minHeight: "56%",
    maxHeight: "82%",
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
    flex: 1,
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
  infoScroll: {
    flex: 1,
  },
  infoScrollContent: {
    paddingBottom: 8,
  },
  infoBody: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 26,
  },
});
