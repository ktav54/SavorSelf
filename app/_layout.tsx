import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { AppState as RNAppState, StyleSheet, Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import {
  requestNotificationPermission,
  scheduleDailyMoodReminder,
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
  const [appReady, setAppReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    void SplashScreen.preventAutoHideAsync()
      .then(() => setAppReady(true))
      .catch(() => setAppReady(true));
  }, []);

  useEffect(() => {
    if (appReady) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [appReady]);

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
      }
    })();
  }, []);

  useEffect(() => {
    const subscription = RNAppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        return;
      }

      const store = useAppStore.getState();
      if (!store.isAuthenticated || !store.profile) {
        return;
      }

      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const shouldResetToToday =
        store.selectedDate instanceof Date &&
        store.selectedDate.getTime() !== todayDate.getTime();
      const targetDate = shouldResetToToday ? todayDate : store.selectedDate;

      void (async () => {
        if (shouldResetToToday) {
          await store.setSelectedDate(todayDate);
        }
        await store.loadTodayMoodLog(targetDate);
        await store.loadTodayFoodLogs(targetDate);
        await store.loadTodayQuickLog(targetDate);
      })();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  if (!appReady) {
    return null;
  }

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
    <View style={styles.root}>
      <StatusBar style="dark" />
      {isOffline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📡 No internet connection</Text>
        </View>
      ) : null}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade_from_bottom",
          animationDuration: 200,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  offlineBanner: {
    backgroundColor: "#C4622D",
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  offlineText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
});
