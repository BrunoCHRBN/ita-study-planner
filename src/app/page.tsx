import { getPlannerSnapshot } from "@/lib/planner-data";
import { TodayClient } from "@/components/today/TodayClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const snapshot = await getPlannerSnapshot();
  const todayData = snapshot.weekDays.find(
    (d) => d.date === snapshot.todayIso
  );

  return (
    <TodayClient
      todayIso={snapshot.todayIso}
      disciplines={snapshot.disciplines}
      disciplineMap={snapshot.disciplineMap}
      todaySessions={snapshot.todaySessions}
      nextSession={snapshot.nextSession}
      todaySlots={todayData?.slots ?? []}
      tasks={snapshot.tasks}
      todayReviews={snapshot.todayReviews}
      overdueReviews={snapshot.overdueReviews}
      plannedMinutes={todayData?.analysis.plannedMinutes ?? 0}
      completedMinutes={todayData?.analysis.completedMinutes ?? 0}
      maxDailyMinutes={snapshot.config.maxDailyMinutes}
    />
  );
}
