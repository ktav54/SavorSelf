import * as Notifications from "expo-notifications";
import { differenceInDays } from "date-fns";
import { Platform } from "react-native";

const CHANNEL_ID = "savorself-reminders";
const DAILY_MOOD_KEY = "daily-mood-reminder";
const LAPSE_NUDGE_KEY = "lapse-nudge";
const WEEKLY_REPORT_KEY = "weekly-report";

async function cancelScheduledByKey(key: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.savorselfId === key)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== "granted") {
    return false;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "SavorSelf Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return true;
}

export async function scheduleDailyMoodReminder(): Promise<void> {
  await cancelScheduledByKey(DAILY_MOOD_KEY);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "How are you feeling today?",
      body: "Take a moment to check in with yourself. Your gut-brain pattern is building.",
      data: {
        savorselfId: DAILY_MOOD_KEY,
      },
      sound: false,
    },
    trigger: ({
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
      repeats: true,
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    } as unknown as Notifications.NotificationTriggerInput),
  });
}

export async function scheduleLapseNudge(lastLoggedAt: string | null): Promise<void> {
  await cancelScheduledByKey(LAPSE_NUDGE_KEY);

  if (lastLoggedAt && differenceInDays(new Date(), new Date(lastLoggedAt)) <= 2) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Your streak misses you",
      body: "Even a quick mood check-in keeps your Food-Mood picture growing.",
      data: {
        savorselfId: LAPSE_NUDGE_KEY,
      },
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3600,
      repeats: false,
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
  });
}

export async function scheduleWeeklyReport(): Promise<void> {
  await cancelScheduledByKey(WEEKLY_REPORT_KEY);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Your weekly Food-Mood report is ready",
      body: "See what patterns showed up this week between what you ate and how you felt.",
      data: {
        savorselfId: WEEKLY_REPORT_KEY,
      },
      sound: false,
    },
    trigger: ({
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,
      hour: 9,
      minute: 0,
      repeats: true,
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    } as unknown as Notifications.NotificationTriggerInput),
  });
}

export async function cancelAllSavorSelfNotifications(): Promise<void> {
  await Promise.all([
    cancelScheduledByKey(DAILY_MOOD_KEY),
    cancelScheduledByKey(LAPSE_NUDGE_KEY),
    cancelScheduledByKey(WEEKLY_REPORT_KEY),
  ]);
}
