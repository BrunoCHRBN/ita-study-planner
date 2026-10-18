import { getPlannerSnapshot } from "@/lib/planner-data";
import { WeeklyClient } from "@/components/weekly/WeeklyClient";

export const dynamic = "force-dynamic";

export default async function SemanalPage() {
  const snapshot = await getPlannerSnapshot();

  return (
    <WeeklyClient
      todayIso={snapshot.todayIso}
      weekDays={snapshot.weekDays}
      disciplines={snapshot.disciplines}
      disciplineMap={snapshot.disciplineMap}
      config={snapshot.config}
    />
  );
}
