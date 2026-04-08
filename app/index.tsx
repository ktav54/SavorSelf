import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";

export default function Index() {
  const handleSessionChange = useAppStore((state) => state.handleSessionChange);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const hasNavigated = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      console.log("[index bootstrap] starting");

      try {
        console.log("[index bootstrap] calling supabase.auth.getSession()");
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.log("[index bootstrap] getSession error", error.message);
          await handleSessionChange(null);

          if (isMounted && !hasNavigated.current) {
            hasNavigated.current = true;
            console.log("[index bootstrap] routing to /welcome because getSession failed");
            router.replace("/welcome");
          }
          return;
        }

        const session = data.session;
        console.log("[index bootstrap] getSession complete", { hasSession: Boolean(session) });

        if (!session?.user) {
          console.log("[index bootstrap] no session, routing to /welcome");
          await handleSessionChange(null);

          if (isMounted && !hasNavigated.current) {
            hasNavigated.current = true;
            router.replace("/welcome");
          }
          return;
        }

        console.log("[index bootstrap] session found for user", session.user.id);
        await handleSessionChange(session);

        console.log("[index bootstrap] querying users.onboarding_complete");
        const { data: userRow, error: userError } = await supabase
          .from("users")
          .select("onboarding_complete")
          .eq("id", session.user.id)
          .maybeSingle();

        console.log("[index bootstrap] users query complete", {
          hasRow: Boolean(userRow),
          onboardingComplete: userRow?.onboarding_complete ?? null,
          error: userError?.message ?? null,
        });

        if (!isMounted || hasNavigated.current) {
          return;
        }

        hasNavigated.current = true;

        if (userRow?.onboarding_complete) {
          console.log("[index bootstrap] routing to /(tabs)/log");
          router.replace("/(tabs)/log");
        } else {
          console.log("[index bootstrap] routing to /onboarding");
          router.replace("/onboarding");
        }
      } catch (error) {
        console.log("[index bootstrap] unexpected error", error);
        await handleSessionChange(null);

        if (isMounted && !hasNavigated.current) {
          hasNavigated.current = true;
          console.log("[index bootstrap] routing to /welcome because of unexpected error");
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
