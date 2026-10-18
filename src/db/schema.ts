import {
  pgTable,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

export const disciplines = pgTable("disciplines", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: text("name").notNull(),
  code: varchar("code", { length: 8 }).notNull(),
  priorityWeight: integer("priority_weight").notNull().default(5),
  targetWeeklyMinutes: integer("target_weekly_minutes").notNull().default(300),
  preferredShift: varchar("preferred_shift", { length: 16 })
    .notNull()
    .default("ANY"), // MORNING | AFTERNOON | EVENING | ANY
  accentTone: varchar("accent_tone", { length: 16 })
    .notNull()
    .default("#1B365D"),
});

export const topics = pgTable("topics", {
  id: varchar("id", { length: 64 }).primaryKey(),
  disciplineId: varchar("discipline_id", { length: 32 })
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  front: text("front").notNull(),
  name: text("name").notNull(),
  bibliography: text("bibliography").notNull(),
  difficultyWeight: integer("difficulty_weight").notNull().default(3),
  status: varchar("status", { length: 24 }).notNull().default("PENDING"), // PENDING | IN_PROGRESS | MASTERED
});

export const routineConfig = pgTable("routine_config", {
  id: varchar("id", { length: 32 }).primaryKey(),
  maxDailyMinutes: integer("max_daily_minutes").notNull().default(360), // 6h00
  maxWeeklyMinutes: integer("max_weekly_minutes").notNull().default(2160), // 36h00
  defaultBlockMinutes: integer("default_block_minutes").notNull().default(90), // 1h30
  maxContinuousMinutes: integer("max_continuous_minutes").notNull().default(150), // 2h30
  minBreakMinutes: integer("min_break_minutes").notNull().default(15),
  maxSingleSubjectDailyMinutes: integer("max_single_subject_daily_minutes")
    .notNull()
    .default(210), // 3h30
  minDailyBufferMinutes: integer("min_daily_buffer_minutes")
    .notNull()
    .default(30),
  distributionPreference: text("distribution_preference").notNull(),
});

export const routineSlots = pgTable("routine_slots", {
  id: varchar("id", { length: 64 }).primaryKey(),
  dayOfWeek: integer("day_of_week").notNull(), // 0 (Dom) a 6 (Sab)
  startTime: varchar("start_time", { length: 5 }).notNull(), // HH:MM
  endTime: varchar("end_time", { length: 5 }).notNull(), // HH:MM
  slotType: varchar("slot_type", { length: 24 }).notNull(), // AVAILABLE_STUDY | FIXED_COMMITMENT | MANDATORY_BREAK
  title: text("title").notNull(),
});

export const routineExceptions = pgTable("routine_exceptions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  exceptionDate: varchar("exception_date", { length: 10 }).notNull(), // YYYY-MM-DD
  startTime: varchar("start_time", { length: 5 }).notNull(),
  endTime: varchar("end_time", { length: 5 }).notNull(),
  exceptionType: varchar("exception_type", { length: 24 }).notNull(), // BLOCKED | SIMULADO | EXTRA_AVAILABLE
  reason: text("reason").notNull(),
});

export const studySessions = pgTable("study_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  disciplineId: varchar("discipline_id", { length: 32 })
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  topicId: varchar("topic_id", { length: 64 }).references(() => topics.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  objective: text("objective").notNull(),
  scheduledDate: varchar("scheduled_date", { length: 10 }).notNull(), // YYYY-MM-DD
  plannedStart: varchar("planned_start", { length: 5 }).notNull(), // HH:MM
  plannedEnd: varchar("planned_end", { length: 5 }).notNull(), // HH:MM
  plannedMinutes: integer("planned_minutes").notNull(),
  actualMinutes: integer("actual_minutes").notNull().default(0),
  sessionType: varchar("session_type", { length: 24 }).notNull(), // THEORY | EXERCISES | ITA_PROVA | REVIEW | SIMULADO
  status: varchar("status", { length: 24 }).notNull().default("PLANNED"), // PLANNED | IN_PROGRESS | COMPLETED | RESCHEDULED | SKIPPED
  rescheduledCount: integer("rescheduled_count").notNull().default(0),
  notes: text("notes").default(""),
});

export const tasks = pgTable("tasks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  disciplineId: varchar("discipline_id", { length: 32 })
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 64 }).references(
    () => studySessions.id,
    { onDelete: "set null" }
  ),
  dueDate: varchar("due_date", { length: 10 }).notNull(), // YYYY-MM-DD
  title: text("title").notNull(),
  category: varchar("category", { length: 24 })
    .notNull()
    .default("LISTA_PENDENTE"), // ERRATA_CADERNO | REDACAO | LISTA_PENDENTE | ORGANIZACAO
  priority: varchar("priority", { length: 16 }).notNull().default("NORMAL"), // HIGH | NORMAL
  isCompleted: boolean("is_completed").notNull().default(false),
});

export const reviews = pgTable("reviews", {
  id: varchar("id", { length: 64 }).primaryKey(),
  disciplineId: varchar("discipline_id", { length: 32 })
    .notNull()
    .references(() => disciplines.id, { onDelete: "cascade" }),
  topicId: varchar("topic_id", { length: 64 }).references(() => topics.id, {
    onDelete: "set null",
  }),
  originSessionId: varchar("origin_session_id", { length: 64 }).references(
    () => studySessions.id,
    { onDelete: "set null" }
  ),
  title: text("title").notNull(),
  focusPrompt: text("focus_prompt").notNull(),
  scheduledDate: varchar("scheduled_date", { length: 10 }).notNull(), // YYYY-MM-DD
  cycleStage: varchar("cycle_stage", { length: 16 }).notNull().default("R1_24H"), // R1_24H | R2_7D | R3_21D | R4_45D
  intervalDays: integer("interval_days").notNull().default(1),
  estimatedMinutes: integer("estimated_minutes").notNull().default(35),
  status: varchar("status", { length: 24 }).notNull().default("PENDING"), // PENDING | COMPLETED | OVERDUE
  retentionRating: varchar("retention_rating", { length: 16 }), // SOLID | PARTIAL | CRITICAL
});

export type Discipline = typeof disciplines.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type RoutineConfig = typeof routineConfig.$inferSelect;
export type RoutineSlot = typeof routineSlots.$inferSelect;
export type RoutineException = typeof routineExceptions.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type TaskItem = typeof tasks.$inferSelect;
export type ReviewItem = typeof reviews.$inferSelect;
