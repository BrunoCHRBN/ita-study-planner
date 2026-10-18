import {
  StudySession,
  RoutineConfig,
  RoutineSlot,
  RoutineException,
} from "../db/schema";
import { timeToMinutes, formatMinutes } from "./date-utils";

export interface OverloadIssue {
  code:
    | "OVERLOAD_DAILY_HOURS"
    | "OVERLOAD_CONTINUOUS_SPRINT"
    | "OVERLOAD_SINGLE_SUBJECT"
    | "OVERLOAD_NO_BUFFER";
  severity: "CRITICAL" | "WARNING";
  label: string;
  detail: string;
  excessMinutes: number;
}

export interface DayLoadAnalysis {
  date: string;
  dayOfWeek: number;
  plannedMinutes: number;
  completedMinutes: number;
  availableMinutes: number;
  maxAllowedMinutes: number;
  utilizationRatio: number; // plannedMinutes / maxAllowedMinutes
  bufferMinutes: number;
  isOverloaded: boolean;
  isNearLimit: boolean;
  issues: OverloadIssue[];
}

export function analyzeDayOverload(params: {
  date: string;
  dayOfWeek: number;
  sessions: StudySession[];
  config: RoutineConfig;
  slots: RoutineSlot[];
  exceptions: RoutineException[];
}): DayLoadAnalysis {
  const { date, dayOfWeek, sessions, config, slots, exceptions } = params;

  const activeSessions = sessions
    .filter(
      (s) =>
        s.scheduledDate === date &&
        s.status !== "RESCHEDULED" &&
        s.status !== "SKIPPED"
    )
    .sort(
      (a, b) => timeToMinutes(a.plannedStart) - timeToMinutes(b.plannedStart)
    );

  const plannedMinutes = activeSessions.reduce(
    (acc, s) => acc + s.plannedMinutes,
    0
  );
  const completedMinutes = activeSessions
    .filter((s) => s.status === "COMPLETED")
    .reduce((acc, s) => acc + (s.actualMinutes || s.plannedMinutes), 0);

  // Calcula disponibilidade teórica no dia a partir de routine_slots e exceções
  const daySlots = slots.filter(
    (sl) => sl.dayOfWeek === dayOfWeek && sl.slotType === "AVAILABLE_STUDY"
  );
  let availableMinutes = daySlots.reduce(
    (acc, sl) => acc + (timeToMinutes(sl.endTime) - timeToMinutes(sl.startTime)),
    0
  );

  const dayExceptions = exceptions.filter((ex) => ex.exceptionDate === date);
  const hasSimuladoException = dayExceptions.some(
    (ex) => ex.exceptionType === "SIMULADO"
  );

  for (const ex of dayExceptions) {
    const dur = timeToMinutes(ex.endTime) - timeToMinutes(ex.startTime);
    if (ex.exceptionType === "BLOCKED") {
      availableMinutes = Math.max(0, availableMinutes - dur);
    } else if (ex.exceptionType === "EXTRA_AVAILABLE") {
      availableMinutes += dur;
    }
  }

  const maxAllowedMinutes = Math.min(
    config.maxDailyMinutes,
    availableMinutes > 0 ? availableMinutes : config.maxDailyMinutes
  );

  const issues: OverloadIssue[] = [];

  // Regra 1: Estouro do limite diário
  if (plannedMinutes > config.maxDailyMinutes) {
    const excess = plannedMinutes - config.maxDailyMinutes;
    issues.push({
      code: "OVERLOAD_DAILY_HOURS",
      severity: "CRITICAL",
      label: `Teto diário excedido (+${formatMinutes(excess)})`,
      detail: `${formatMinutes(plannedMinutes)} alocadas para um limite máximo de ${formatMinutes(config.maxDailyMinutes)}.`,
      excessMinutes: excess,
    });
  }

  // Regra 2: Maratona contínua sem pausa obrigatória
  let currentStreak = 0;
  for (let i = 0; i < activeSessions.length; i++) {
    const cur = activeSessions[i];
    if (i === 0) {
      currentStreak = cur.plannedMinutes;
    } else {
      const prev = activeSessions[i - 1];
      const gap =
        timeToMinutes(cur.plannedStart) - timeToMinutes(prev.plannedEnd);
      if (gap < config.minBreakMinutes) {
        currentStreak += cur.plannedMinutes;
      } else {
        currentStreak = cur.plannedMinutes;
      }
    }

    if (
      currentStreak > config.maxContinuousMinutes &&
      !hasSimuladoException &&
      cur.sessionType !== "SIMULADO"
    ) {
      const excess = currentStreak - config.maxContinuousMinutes;
      if (!issues.some((iss) => iss.code === "OVERLOAD_CONTINUOUS_SPRINT")) {
        issues.push({
          code: "OVERLOAD_CONTINUOUS_SPRINT",
          severity: "CRITICAL",
          label: `Turno contínuo sem pausa (${formatMinutes(currentStreak)})`,
          detail: `Blocos seguidos excedem o limite contínuo de ${formatMinutes(config.maxContinuousMinutes)} sem pausa mínima de ${config.minBreakMinutes}m.`,
          excessMinutes: excess,
        });
      }
    }
  }

  // Regra 3: Saturação de uma única disciplina no dia
  if (!hasSimuladoException) {
    const byDiscipline: Record<string, number> = {};
    for (const s of activeSessions) {
      if (s.sessionType === "SIMULADO") continue;
      byDiscipline[s.disciplineId] =
        (byDiscipline[s.disciplineId] || 0) + s.plannedMinutes;
    }
    for (const [discId, mins] of Object.entries(byDiscipline)) {
      if (mins > config.maxSingleSubjectDailyMinutes) {
        const excess = mins - config.maxSingleSubjectDailyMinutes;
        issues.push({
          code: "OVERLOAD_SINGLE_SUBJECT",
          severity: "WARNING",
          label: `Saturação em [${discId}] (${formatMinutes(mins)})`,
          detail: `Mais de ${formatMinutes(config.maxSingleSubjectDailyMinutes)} da mesma matéria no mesmo dia reduz retenção.`,
          excessMinutes: excess,
        });
      }
    }
  }

  // Regra 4: Ausência de buffer (margem para atrasos)
  const bufferMinutes = Math.max(0, availableMinutes - plannedMinutes);
  if (
    plannedMinutes >= 180 &&
    availableMinutes > 0 &&
    bufferMinutes < config.minDailyBufferMinutes &&
    !issues.some((i) => i.code === "OVERLOAD_DAILY_HOURS")
  ) {
    issues.push({
      code: "OVERLOAD_NO_BUFFER",
      severity: "WARNING",
      label: `Margem de absorção baixa (${bufferMinutes}m livre)`,
      detail: `Recomendado manter ao menos ${config.minDailyBufferMinutes}m de buffer no dia para absorver listas mais longas.`,
      excessMinutes: config.minDailyBufferMinutes - bufferMinutes,
    });
  }

  const isOverloaded = issues.some((i) => i.severity === "CRITICAL");
  const isNearLimit =
    !isOverloaded &&
    (issues.length > 0 || plannedMinutes >= config.maxDailyMinutes * 0.88);

  return {
    date,
    dayOfWeek,
    plannedMinutes,
    completedMinutes,
    availableMinutes,
    maxAllowedMinutes,
    utilizationRatio:
      config.maxDailyMinutes > 0 ? plannedMinutes / config.maxDailyMinutes : 0,
    bufferMinutes,
    isOverloaded,
    isNearLimit,
    issues,
  };
}
