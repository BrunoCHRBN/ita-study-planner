import { db } from "@/db";
import {
  disciplines,
  topics,
  routineConfig,
  routineSlots,
  routineExceptions,
  studySessions,
  tasks,
  reviews,
  Discipline,
  Topic,
  RoutineConfig,
  RoutineSlot,
  RoutineException,
  StudySession,
  TaskItem,
  ReviewItem,
} from "@/db/schema";
import { ensureSchemaAndSeed } from "@/db/seed";
import { getTodayISO, getWeekDatesISO, timeToMinutes } from "./date-utils";
import { analyzeDayOverload, DayLoadAnalysis } from "./overload-engine";

export interface PlannerSnapshot {
  todayIso: string;
  weekDays: {
    date: string;
    dayOfWeek: number;
    labelShort: string;
    labelFull: string;
    dayNumber: string;
    analysis: DayLoadAnalysis;
    sessions: StudySession[];
    slots: RoutineSlot[];
    exceptions: RoutineException[];
  }[];
  disciplines: Discipline[];
  disciplineMap: Record<string, Discipline>;
  topics: Topic[];
  config: RoutineConfig;
  slots: RoutineSlot[];
  exceptions: RoutineException[];
  allSessions: StudySession[];
  todaySessions: StudySession[];
  nextSession: StudySession | null;
  tasks: TaskItem[];
  reviews: ReviewItem[];
  todayReviews: ReviewItem[];
  overdueReviews: ReviewItem[];
}

export async function getPlannerSnapshot(): Promise<PlannerSnapshot> {
  await ensureSchemaAndSeed(false);

  const todayIso = getTodayISO();
  const rawWeekDays = getWeekDatesISO(todayIso);

  const [
    allDisciplines,
    allTopics,
    configs,
    allSlots,
    allExceptions,
    allSessions,
    allTasks,
    allReviews,
  ] = await Promise.all([
    db.select().from(disciplines),
    db.select().from(topics),
    db.select().from(routineConfig),
    db.select().from(routineSlots),
    db.select().from(routineExceptions),
    db.select().from(studySessions),
    db.select().from(tasks),
    db.select().from(reviews),
  ]);

  const config: RoutineConfig = configs[0] ?? {
    id: "default",
    maxDailyMinutes: 360,
    maxWeeklyMinutes: 2100,
    defaultBlockMinutes: 90,
    maxContinuousMinutes: 150,
    minBreakMinutes: 15,
    maxSingleSubjectDailyMinutes: 210,
    minDailyBufferMinutes: 30,
    distributionPreference:
      "Alocar Matemática e Física pela manhã; Química à tarde; Revisões e Humanidades à noite.",
  };

  const disciplineMap: Record<string, Discipline> = {};
  for (const d of allDisciplines) {
    disciplineMap[d.id] = d;
  }

  const sortedSessions = [...allSessions].sort((a, b) => {
    if (a.scheduledDate !== b.scheduledDate) {
      return a.scheduledDate.localeCompare(b.scheduledDate);
    }
    return timeToMinutes(a.plannedStart) - timeToMinutes(b.plannedStart);
  });

  const weekDays = rawWeekDays.map((wd) => {
    const daySessions = sortedSessions.filter(
      (s) => s.scheduledDate === wd.date
    );
    const daySlots = allSlots
      .filter((sl) => sl.dayOfWeek === wd.dayOfWeek)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const dayExceptions = allExceptions.filter(
      (ex) => ex.exceptionDate === wd.date
    );
    const analysis = analyzeDayOverload({
      date: wd.date,
      dayOfWeek: wd.dayOfWeek,
      sessions: daySessions,
      config,
      slots: allSlots,
      exceptions: allExceptions,
    });

    return {
      ...wd,
      analysis,
      sessions: daySessions,
      slots: daySlots,
      exceptions: dayExceptions,
    };
  });

  const todaySessions = sortedSessions.filter(
    (s) => s.scheduledDate === todayIso
  );

  // Próxima sessão = primeira IN_PROGRESS de hoje, ou primeira PLANNED de hoje
  const nextSession =
    todaySessions.find((s) => s.status === "IN_PROGRESS") ||
    todaySessions.find((s) => s.status === "PLANNED") ||
    null;

  const todayReviews = allReviews.filter(
    (r) => r.scheduledDate === todayIso && r.status !== "COMPLETED"
  );

  const overdueReviews = allReviews.filter(
    (r) =>
      (r.status === "OVERDUE" || r.scheduledDate < todayIso) &&
      r.status !== "COMPLETED"
  );

  return {
    todayIso,
    weekDays,
    disciplines: allDisciplines.sort(
      (a, b) => b.priorityWeight - a.priorityWeight
    ),
    disciplineMap,
    topics: allTopics,
    config,
    slots: allSlots,
    exceptions: allExceptions,
    allSessions: sortedSessions,
    todaySessions,
    nextSession,
    tasks: allTasks,
    reviews: allReviews,
    todayReviews,
    overdueReviews,
  };
}
