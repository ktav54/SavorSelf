import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, Text } from "react-native";
import { colors } from "@/constants/theme";

export default function TabsLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        animation: "fade",
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
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 84,
          paddingTop: 8,
          paddingBottom: 28,
        },
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: "#C4A882",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="log"
        listeners={{
          tabPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
        options={{ title: "Log", tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⊕</Text> }}
      />
      <Tabs.Screen
        name="food-mood"
        listeners={{
          tabPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
        options={{ title: "Food-Mood", tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>◈</Text> }}
      />
      <Tabs.Screen
        name="coach"
        listeners={{
          tabPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          },
        }}
        options={{ title: "Coach", tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>◉</Text> }}
      />
    </Tabs>
  );
}
