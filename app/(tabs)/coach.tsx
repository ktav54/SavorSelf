import { useLayoutEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useNavigation } from "expo-router";
import { CoachChat } from "@/components/coach";
import { Screen } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useAppStore, type AppState } from "@/store/useAppStore";

export default function CoachScreen() {
  const navigation = useNavigation();
  const clearConversation = useAppStore((state: AppState) => state.clearConversation);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={clearConversation}
          style={({ pressed }) => ({
            marginRight: 14,
            marginTop: -2,
            paddingHorizontal: 2,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Ionicons name="document-text" size={28} color={colors.accentPrimary} />
        </Pressable>
      ),
    });
  }, [clearConversation, navigation]);

  return (
    <Screen scroll>
      <CoachChat />
    </Screen>
  );
}
