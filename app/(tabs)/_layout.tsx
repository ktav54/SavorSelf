import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text } from "react-native";
import { colors } from "@/constants/theme";

export default function TabsLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerTitleStyle: {
          color: colors.textPrimary,
          fontWeight: "600",
        },
        headerRight: () => null,
        headerLeft: () => (
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => ({
              marginLeft: 14,
              marginTop: -2,
              paddingHorizontal: 2,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <Ionicons name="settings-sharp" size={28} color={colors.accentPrimary} />
          </Pressable>
        ),
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarStyle: {
          backgroundColor: colors.accentPrimary,
          borderTopColor: "transparent",
          height: 88,
          paddingTop: 8,
          paddingBottom: 14,
        },
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: "rgba(255,255,255,0.72)",
        tabBarLabelStyle: {
          fontWeight: "600",
        },
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
