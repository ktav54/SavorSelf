import { useLayoutEffect } from "react";
import { Pressable, Text } from "react-native";
import { useNavigation } from "expo-router";
import { CoachBanner, CoachChat } from "@/components/coach";
import { Screen } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useAppStore } from "@/store/useAppStore";

export default function CoachScreen() {
  const navigation = useNavigation();
  const clearConversation = useAppStore((state) => state.clearConversation);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={clearConversation}>
          <Text style={{ color: colors.accentPrimary, fontSize: 16 }}>New conversation</Text>
        </Pressable>
      ),
    });
  }, [clearConversation, navigation]);

  return (
    <Screen scroll>
      <CoachBanner />
      <CoachChat />
    </Screen>
  );
}
