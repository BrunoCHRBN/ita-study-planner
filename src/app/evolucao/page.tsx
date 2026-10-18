import { getPlannerSnapshot } from "@/lib/planner-data";
import { EvolutionClient } from "@/components/evolution/EvolutionClient";

export const dynamic = "force-dynamic";

export default async function EvolucaoPage() {
  const snapshot = await getPlannerSnapshot();

  return (
    <EvolutionClient
      todayIso={snapshot.todayIso}
      weekDays={snapshot.weekDays}
      disciplines={snapshot.disciplines}
      topics={snapshot.topics}
      allSessions={snapshot.allSessions}
      reviews={snapshot.reviews}
      overdueReviews={snapshot.overdueReviews}
      config={snapshot.config}
    />
  );
}
