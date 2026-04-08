import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { PastEntriesCard, TodayJournalCard } from "@/components/journal";
import { Screen } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

export default function JournalScreen() {
  const loadJournalEntries = useAppStore((state) => state.loadJournalEntries);

  useFocusEffect(
    useCallback(() => {
      void loadJournalEntries();
    }, [loadJournalEntries])
  );

  return (
    <Screen scroll>
      <TodayJournalCard />
      <PastEntriesCard />
    </Screen>
  );
}
