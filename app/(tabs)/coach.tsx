import { useLayoutEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, View } from "react-native";
import { useNavigation } from "expo-router";
import * as Haptics from "expo-haptics";
import { CoachChat } from "@/components/coach";
import { colors } from "@/constants/theme";
import { useAppStore, type AppState } from "@/store/useAppStore";

export default function CoachScreen() {
  const navigation = useNavigation();
  const clearConversation = useAppStore((state: AppState) => state.clearConversation);

  const resetConversation = () => {
    Alert.alert(
      "Start fresh?",
      "This will clear your current conversation.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => clearConversation(),
        },
      ]
    );
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "✦ Coach",
      headerTitleStyle: {
        fontSize: 17,
        fontWeight: "700",
        color: colors.textPrimary,
      },
      headerRight: () => (
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            resetConversation();
          }}
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CoachChat />
    </View>
  );
}
