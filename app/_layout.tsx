import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import {
  requestNotificationPermission,
  scheduleDailyMoodReminder,
  scheduleLapseNudge,
  scheduleWeeklyReport,
} from "@/services/notifications";
import { useAppStore, type AppState } from "@/store/useAppStore";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const initializeAuth = useAppStore((state: AppState) => state.initializeAuth);
  const handleSessionChange = useAppStore((state: AppState) => state.handleSessionChange);
  const sessionReady = useAppStore((state: AppState) => state.sessionReady);

  useEffect(() => {
    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        void handleSessionChange(session);
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [handleSessionChange, initializeAuth]);

  useEffect(() => {
    void (async () => {
      const granted = await requestNotificationPermission();
      if (granted) {
        await scheduleDailyMoodReminder();
        await scheduleWeeklyReport();
        await scheduleLapseNudge(null);
      }
    })();
  }, []);

  if (!sessionReady) {
    return (
      <>
        <StatusBar style="dark" />
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 18 }}>Loading SavorSelf...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
