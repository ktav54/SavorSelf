import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";

export default function RootLayout() {
  const initializeAuth = useAppStore((state) => state.initializeAuth);
  const handleSessionChange = useAppStore((state) => state.handleSessionChange);
  const sessionReady = useAppStore((state) => state.sessionReady);

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
