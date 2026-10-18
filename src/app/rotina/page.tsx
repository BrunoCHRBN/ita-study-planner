import { getPlannerSnapshot } from "@/lib/planner-data";
import { RoutineClient } from "@/components/routine/RoutineClient";

export const dynamic = "force-dynamic";

export default async function RotinaPage() {
  const snapshot = await getPlannerSnapshot();

  return (
    <RoutineClient
      todayIso={snapshot.todayIso}
      config={snapshot.config}
      disciplines={snapshot.disciplines}
      slots={snapshot.slots}
      exceptions={snapshot.exceptions}
    />
  );
}
