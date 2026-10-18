"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  disciplines,
  routineConfig,
  routineSlots,
  routineExceptions,
  studySessions,
  tasks,
  reviews,
} from "@/db/schema";
import { ensureSchemaAndSeed } from "@/db/seed";
import { eq } from "drizzle-orm";
import { addDaysISO, getTodayISO, timeToMinutes, minutesToTime } from "@/lib/date-utils";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/semanal");
  revalidatePath("/rotina");
  revalidatePath("/evolucao");
}

export async function completeStudySessionAction(input: {
  sessionId: string;
  actualMinutes: number;
  retentionRating: "SOLID" | "PARTIAL" | "CRITICAL";
  notes?: string;
}) {
  const existing = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.id, input.sessionId));

  if (!existing.length) return { ok: false };
  const s = existing[0];

  await db
    .update(studySessions)
    .set({
      status: "COMPLETED",
      actualMinutes: input.actualMinutes > 0 ? input.actualMinutes : s.plannedMinutes,
      notes: input.notes ?? s.notes,
    })
    .where(eq(studySessions.id, input.sessionId));

  // Gera automaticamente a revisão espaçada correspondente ao nível de retenção
  const intervalDays =
    input.retentionRating === "CRITICAL"
      ? 1
      : input.retentionRating === "PARTIAL"
      ? 3
      : 7;
  const cycleStage =
    intervalDays === 1 ? "R1_24H" : intervalDays === 3 ? "R1_72H" : "R2_7D";

  const reviewDate = addDaysISO(getTodayISO(), intervalDays);
  const reviewId = `REV_AUTO_${Date.now().toString(36).toUpperCase()}`;

  await db.insert(reviews).values({
    id: reviewId,
    disciplineId: s.disciplineId,
    topicId: s.topicId,
    originSessionId: s.id,
    title: s.title,
    focusPrompt:
      input.retentionRating === "CRITICAL"
        ? `Revisão urgente (24h): refazer questões-chave e consolidar base teórica de "${s.title}".`
        : input.retentionRating === "PARTIAL"
        ? `Revisão de consolidação (3d): resolver 4 questões similares sem consulta.`
        : `Revisão espaçada (7d): validar retenção rápida e velocidade de resolução.`,
    scheduledDate: reviewDate,
    cycleStage,
    intervalDays,
    estimatedMinutes: input.retentionRating === "CRITICAL" ? 45 : 30,
    status: "PENDING",
  });

  revalidateAll();
  return { ok: true, scheduledReviewDate: reviewDate };
}

export async function toggleSessionStatusAction(input: {
  sessionId: string;
  status: "PLANNED" | "IN_PROGRESS";
}) {
  await db
    .update(studySessions)
    .set({ status: input.status })
    .where(eq(studySessions.id, input.sessionId));
  revalidateAll();
}

export async function rescheduleSessionAction(input: {
  sessionId: string;
  targetDate: string;
  plannedStart: string;
  plannedEnd?: string;
}) {
  const existing = await db
    .select()
    .from(studySessions)
    .where(eq(studySessions.id, input.sessionId));
  if (!existing.length) return { ok: false };
  const s = existing[0];

  const startMins = timeToMinutes(input.plannedStart);
  const endMins = input.plannedEnd
    ? timeToMinutes(input.plannedEnd)
    : startMins + s.plannedMinutes;
  const duration = Math.max(15, endMins - startMins);

  await db
    .update(studySessions)
    .set({
      scheduledDate: input.targetDate,
      plannedStart: input.plannedStart,
      plannedEnd: minutesToTime(endMins),
      plannedMinutes: duration,
      status: "PLANNED",
      rescheduledCount: (s.rescheduledCount || 0) + 1,
    })
    .where(eq(studySessions.id, input.sessionId));

  revalidateAll();
  return { ok: true };
}

export async function createStudySessionAction(input: {
  disciplineId: string;
  title: string;
  objective: string;
  scheduledDate: string;
  plannedStart: string;
  plannedMinutes: number;
  sessionType: string;
}) {
  const startMins = timeToMinutes(input.plannedStart);
  const endTime = minutesToTime(startMins + input.plannedMinutes);
  const id = `SES_MAN_${Date.now().toString(36).toUpperCase()}`;

  await db.insert(studySessions).values({
    id,
    disciplineId: input.disciplineId,
    title: input.title,
    objective: input.objective || "Estudo dirigido e resolução de lista",
    scheduledDate: input.scheduledDate,
    plannedStart: input.plannedStart,
    plannedEnd: endTime,
    plannedMinutes: input.plannedMinutes,
    actualMinutes: 0,
    sessionType: input.sessionType || "EXERCISES",
    status: "PLANNED",
    rescheduledCount: 0,
    notes: "",
  });

  revalidateAll();
  return { ok: true, id };
}

export async function deleteStudySessionAction(sessionId: string) {
  await db.delete(studySessions).where(eq(studySessions.id, sessionId));
  revalidateAll();
}

export async function toggleTaskAction(taskId: string, isCompleted: boolean) {
  await db
    .update(tasks)
    .set({ isCompleted })
    .where(eq(tasks.id, taskId));
  revalidateAll();
}

export async function createTaskAction(input: {
  disciplineId: string;
  title: string;
  category: string;
  priority: string;
  dueDate?: string;
}) {
  const id = `TSK_${Date.now().toString(36).toUpperCase()}`;
  await db.insert(tasks).values({
    id,
    disciplineId: input.disciplineId,
    title: input.title,
    category: input.category || "LISTA_PENDENTE",
    priority: input.priority || "NORMAL",
    dueDate: input.dueDate || getTodayISO(),
    isCompleted: false,
  });
  revalidateAll();
}

export async function deleteTaskAction(taskId: string) {
  await db.delete(tasks).where(eq(tasks.id, taskId));
  revalidateAll();
}

export async function completeReviewAction(input: {
  reviewId: string;
  retentionRating: "SOLID" | "PARTIAL" | "CRITICAL";
}) {
  const existing = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, input.reviewId));
  if (!existing.length) return { ok: false };
  const r = existing[0];

  await db
    .update(reviews)
    .set({
      status: "COMPLETED",
      retentionRating: input.retentionRating,
    })
    .where(eq(reviews.id, input.reviewId));

  // Agenda próximo ciclo de revisão espaçada
  const nextDays =
    input.retentionRating === "CRITICAL"
      ? 1
      : input.retentionRating === "PARTIAL"
      ? 7
      : r.intervalDays <= 1
      ? 7
      : r.intervalDays <= 7
      ? 21
      : 45;

  const nextStage =
    nextDays === 1
      ? "R1_24H"
      : nextDays === 7
      ? "R2_7D"
      : nextDays === 21
      ? "R3_21D"
      : "R4_45D";

  await db.insert(reviews).values({
    id: `REV_NEXT_${Date.now().toString(36).toUpperCase()}`,
    disciplineId: r.disciplineId,
    topicId: r.topicId,
    originSessionId: r.originSessionId,
    title: r.title,
    focusPrompt: `Ciclo ${nextStage}: validar retenção ativa e resolver questões selecionadas.`,
    scheduledDate: addDaysISO(getTodayISO(), nextDays),
    cycleStage: nextStage,
    intervalDays: nextDays,
    estimatedMinutes: 30,
    status: "PENDING",
  });

  revalidateAll();
  return { ok: true };
}

export async function postponeReviewAction(input: {
  reviewId: string;
  addDays: number;
}) {
  const existing = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, input.reviewId));
  if (!existing.length) return { ok: false };

  const baseDate =
    existing[0].scheduledDate < getTodayISO()
      ? getTodayISO()
      : existing[0].scheduledDate;
  const newDate = addDaysISO(baseDate, input.addDays);

  await db
    .update(reviews)
    .set({
      scheduledDate: newDate,
      status: "PENDING",
    })
    .where(eq(reviews.id, input.reviewId));

  revalidateAll();
  return { ok: true, newDate };
}

export async function updateRoutineConfigAction(input: {
  maxDailyMinutes: number;
  maxWeeklyMinutes: number;
  defaultBlockMinutes: number;
  maxContinuousMinutes: number;
  minBreakMinutes: number;
  maxSingleSubjectDailyMinutes: number;
  minDailyBufferMinutes: number;
  distributionPreference: string;
}) {
  await db
    .update(routineConfig)
    .set(input)
    .where(eq(routineConfig.id, "default"));
  revalidateAll();
}

export async function updateDisciplinePriorityAction(input: {
  id: string;
  priorityWeight: number;
  targetWeeklyMinutes: number;
  preferredShift: string;
}) {
  await db
    .update(disciplines)
    .set({
      priorityWeight: input.priorityWeight,
      targetWeeklyMinutes: input.targetWeeklyMinutes,
      preferredShift: input.preferredShift,
    })
    .where(eq(disciplines.id, input.id));
  revalidateAll();
}

export async function createRoutineSlotAction(input: {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotType: string;
  title: string;
}) {
  const id = `SLOT_${Date.now().toString(36).toUpperCase()}`;
  await db.insert(routineSlots).values({
    id,
    ...input,
  });
  revalidateAll();
}

export async function deleteRoutineSlotAction(slotId: string) {
  await db.delete(routineSlots).where(eq(routineSlots.id, slotId));
  revalidateAll();
}

export async function createRoutineExceptionAction(input: {
  exceptionDate: string;
  startTime: string;
  endTime: string;
  exceptionType: string;
  reason: string;
}) {
  const id = `EXC_${Date.now().toString(36).toUpperCase()}`;
  await db.insert(routineExceptions).values({
    id,
    ...input,
  });
  revalidateAll();
}

export async function deleteRoutineExceptionAction(exceptionId: string) {
  await db
    .delete(routineExceptions)
    .where(eq(routineExceptions.id, exceptionId));
  revalidateAll();
}

export interface ScheduleDiffOperation {
  op: "MOVE" | "CREATE" | "RESIZE" | "COMPLETE_REVIEW_SCHEDULE";
  sessionId?: string;
  reviewId?: string;
  disciplineId: string;
  title: string;
  fromDate?: string;
  fromStart?: string;
  fromEnd?: string;
  toDate: string;
  toStart: string;
  toEnd: string;
  plannedMinutes: number;
  sessionType?: string;
  reason: string;
}

export async function applyScheduleDiffAction(
  operations: ScheduleDiffOperation[]
) {
  for (const op of operations) {
    if (op.op === "MOVE" && op.sessionId) {
      const existing = await db
        .select()
        .from(studySessions)
        .where(eq(studySessions.id, op.sessionId));
      const prevCount = existing[0]?.rescheduledCount || 0;
      await db
        .update(studySessions)
        .set({
          scheduledDate: op.toDate,
          plannedStart: op.toStart,
          plannedEnd: op.toEnd,
          plannedMinutes: op.plannedMinutes,
          rescheduledCount: prevCount + 1,
          status: "PLANNED",
        })
        .where(eq(studySessions.id, op.sessionId));
    } else if (op.op === "RESIZE" && op.sessionId) {
      await db
        .update(studySessions)
        .set({
          plannedStart: op.toStart,
          plannedEnd: op.toEnd,
          plannedMinutes: op.plannedMinutes,
        })
        .where(eq(studySessions.id, op.sessionId));
    } else if (
      op.op === "CREATE" ||
      op.op === "COMPLETE_REVIEW_SCHEDULE"
    ) {
      const newId = `SES_AI_${Date.now().toString(36).toUpperCase()}_${Math.floor(
        Math.random() * 999
      )}`;
      await db.insert(studySessions).values({
        id: newId,
        disciplineId: op.disciplineId,
        title: op.title,
        objective: op.reason,
        scheduledDate: op.toDate,
        plannedStart: op.toStart,
        plannedEnd: op.toEnd,
        plannedMinutes: op.plannedMinutes,
        actualMinutes: 0,
        sessionType:
          op.op === "COMPLETE_REVIEW_SCHEDULE"
            ? "REVIEW"
            : op.sessionType || "EXERCISES",
        status: "PLANNED",
        rescheduledCount: 0,
        notes: "Alocado pelo Assistente de Planejamento ITA",
      });

      if (op.reviewId) {
        await db
          .update(reviews)
          .set({
            scheduledDate: op.toDate,
            status: "PENDING",
          })
          .where(eq(reviews.id, op.reviewId));
      }
    }
  }

  revalidateAll();
  return { ok: true, appliedCount: operations.length };
}

export async function resetDemoDatabaseAction() {
  await ensureSchemaAndSeed(true);
  revalidateAll();
  return { ok: true };
}
