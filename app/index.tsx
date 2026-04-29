import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useAppStore, type AppState } from "@/store/useAppStore";

export default function Index() {
  const handleSessionChange = useAppStore((state: AppState) => state.handleSessionChange);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const hasNavigated = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          await handleSessionChange(null);

          if (isMounted && !hasNavigated.current) {
            hasNavigated.current = true;
            router.replace("/welcome");
          }
          return;
        }

        const session = data.session;

        if (!session?.user) {
          await handleSessionChange(null);

          if (isMounted && !hasNavigated.current) {
            hasNavigated.current = true;
            router.replace("/welcome");
          }
          return;
        }

        await handleSessionChange(session);

        const { data: userRow, error: userError } = await supabase
          .from("users")
          .select("onboarding_complete")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!isMounted || hasNavigated.current) {
          return;
        }

        hasNavigated.current = true;

        if (userRow?.onboarding_complete) {
          router.replace("/(tabs)/log");
        } else {
          router.replace("/onboarding");
        }
      } catch (error) {
        await handleSessionChange(null);

        if (isMounted && !hasNavigated.current) {
          hasNavigated.current = true;
          router.replace("/welcome");
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontSize: 18 }}>
        {isBootstrapping ? "Loading SavorSelf..." : "Routing..."}
      </Text>
    </View>
  );
}
