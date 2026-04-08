import { Tabs, Link } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerShadowVisible: false,
        headerRight: () => (
          <Link href="/settings" style={{ color: colors.accentPrimary, fontSize: 16 }}>
            Profile
          </Link>
        ),
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen name="log" options={{ title: "Log", tabBarIcon: ({ color }) => <Text style={{ color }}>*</Text> }} />
      <Tabs.Screen
        name="food-mood"
        options={{ title: "Food-Mood", tabBarIcon: ({ color }) => <Text style={{ color }}>*</Text> }}
      />
      <Tabs.Screen name="coach" options={{ title: "Coach", tabBarIcon: ({ color }) => <Text style={{ color }}>*</Text> }} />
      <Tabs.Screen
        name="journal"
        options={{ title: "Journal", tabBarIcon: ({ color }) => <Text style={{ color }}>*</Text> }}
      />
    </Tabs>
  );
}
