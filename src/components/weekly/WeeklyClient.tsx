"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Lock,
  Sparkles,
  Plus,
  Check,
  Trash2,
  Coffee,
  ArrowRightLeft,
} from "lucide-react";
import {
  Discipline,
  StudySession,
  RoutineSlot,
  RoutineException,
  RoutineConfig,
} from "@/db/schema";
import { DayLoadAnalysis } from "@/lib/overload-engine";
import {
  formatMinutes,
  timeToMinutes,
  minutesToTime,
} from "@/lib/date-utils";
import {
  createStudySessionAction,
  deleteStudySessionAction,
  completeStudySessionAction,
  rescheduleSessionAction,
} from "@/app/actions";

interface WeeklyDayColumn {
  date: string;
  dayOfWeek: number;
  labelShort: string;
  labelFull: string;
  dayNumber: string;
  analysis: DayLoadAnalysis;
  sessions: StudySession[];
  slots: RoutineSlot[];
  exceptions: RoutineException[];
}

interface WeeklyClientProps {
  todayIso: string;
  weekDays: WeeklyDayColumn[];
  disciplines: Discipline[];
  disciplineMap: Record<string, Discipline>;
  config: RoutineConfig;
}

export function WeeklyClient({
  todayIso,
  weekDays,
  disciplines,
  disciplineMap,
  config,
}: WeeklyClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [selectedDisc, setSelectedDisc] = useState("MAT");
  const [newTitle, setNewTitle] = useState("");
  const [newObjective, setNewObjective] = useState("");
  const [newStart, setNewStart] = useState("08:00");
  const [newDuration, setNewDuration] = useState(config.defaultBlockMinutes);
  const [newType, setNewType] = useState("EXERCISES");

  const [movingSession, setMovingSession] = useState<StudySession | null>(null);
  const [moveTargetDate, setMoveTargetDate] = useState(todayIso);
  const [moveTargetStart, setMoveTargetStart] = useState("19:00");

  const totalWeeklyPlanned = weekDays.reduce(
    (acc, d) => acc + d.analysis.plannedMinutes,
    0
  );
  const overloadedDays = weekDays.filter((d) => d.analysis.isOverloaded);

  function handleCreateBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    startTransition(async () => {
      await createStudySessionAction({
        disciplineId: selectedDisc,
        title: newTitle.trim(),
        objective: newObjective.trim() || "Bloco alocado no Planejamento Semanal",
        scheduledDate: selectedDate,
        plannedStart: newStart,
        plannedMinutes: newDuration,
        sessionType: newType,
      });
      setNewTitle("");
      setNewObjective("");
      setShowAddModal(false);
      router.refresh();
    });
  }

  function handleMoveSession(e: React.FormEvent) {
    e.preventDefault();
    if (!movingSession) return;
    startTransition(async () => {
      await rescheduleSessionAction({
        sessionId: movingSession.id,
        targetDate: moveTargetDate,
        plannedStart: moveTargetStart,
      });
      setMovingSession(null);
      router.refresh();
    });
  }

  return (
    <div className="p-6 max-w-[1540px] mx-auto space-y-5">
      {/* Cabeçalho Editorial da Tela 02. Planejamento semanal */}
      <section className="border-b border-[var(--border-strong)] pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono-tabular type-xs text-[var(--ink-muted)]">
            02. PLANEJAMENTO SEMANAL · GRADE HORÁRIA E CARGA COGNITIVA
          </div>
          <h1 className="font-editorial type-2xl text-[var(--ink-primary)] leading-tight mt-0.5">
            Arquitetura da Semana Tática
          </h1>
          <p className="type-base text-[var(--ink-secondary)] mt-1">
            Visão integrada de blocos de estudo, pausas obrigatórias (
            {config.minBreakMinutes}m), compromissos fixos e auditoria de
            sobrecarga.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-2 border border-[var(--border-hairline)] bg-[var(--bg-card)] font-mono-tabular type-xs">
            <span className="text-[var(--ink-secondary)]">CARGA SEMANAL: </span>
            <span className="font-semibold text-[var(--ink-primary)]">
              {formatMinutes(totalWeeklyPlanned)} /{" "}
              {formatMinutes(config.maxWeeklyMinutes)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal((prev) => !prev)}
            className="h-9 px-3 border border-[var(--border-strong)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] type-sm font-medium flex items-center gap-1.5 rounded-[var(--radius-sm)] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Alocar Bloco</span>
          </button>

          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("ita:trigger-assistant", {
                  detail: { actionType: "RESOLVE_OVERLOAD" },
                })
              )
            }
            className="h-9 px-3.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--ink-on-accent)] type-sm font-medium flex items-center gap-1.5 rounded-[var(--radius-sm)] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Rebalancear Sobrecarga com IA</span>
          </button>
        </div>
      </section>

      {/* Banner de Alerta de Sobrecarga (Quando houver dias violando Minha Rotina) */}
      {overloadedDays.length > 0 && (
        <div className="p-3.5 border border-[var(--status-overload)] bg-[var(--status-overload-bg)] rounded-[var(--radius-sm)] flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-[var(--status-overload)] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="type-sm font-semibold text-[var(--status-overload)]">
                Indicação de Sobrecarga Detectada em {overloadedDays.length}{" "}
                dia(s):{" "}
                {overloadedDays
                  .map(
                    (d) =>
                      `${d.labelFull} (${formatMinutes(
                        d.analysis.plannedMinutes
                      )} / limite ${formatMinutes(config.maxDailyMinutes)})`
                  )
                  .join(" · ")}
              </div>
              <div className="type-xs text-[var(--ink-secondary)]">
                {overloadedDays
                  .flatMap((d) =>
                    d.analysis.issues.map(
                      (iss) => `[${d.labelShort}] ${iss.label}: ${iss.detail}`
                    )
                  )
                  .join(" | ")}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("ita:trigger-assistant", {
                  detail: { actionType: "RESOLVE_OVERLOAD" },
                })
              )
            }
            className="shrink-0 h-8 px-3 border border-[var(--status-overload)] bg-[var(--bg-card)] text-[var(--status-overload)] type-xs font-mono-tabular font-semibold rounded-[var(--radius-xs)] cursor-pointer hover:bg-[var(--bg-hover)]"
          >
            Gerar Diff de Correção →
          </button>
        </div>
      )}

      {/* Formulário Inline para Alocar Novo Bloco */}
      {showAddModal && (
        <form
          onSubmit={handleCreateBlock}
          className="p-4 border border-[var(--border-strong)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono-tabular type-xs font-semibold text-[var(--ink-primary)]">
              ALOCAR NOVO BLOCO DE ESTUDO NA GRADE SEMANAL
            </span>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="type-xs text-[var(--ink-secondary)] underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
          <div className="grid grid-cols-6 gap-2.5">
            <div>
              <label className="block type-xs text-[var(--ink-secondary)] mb-1">
                Dia da Semana
              </label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-canvas)] type-sm"
              >
                {weekDays.map((wd) => (
                  <option key={wd.date} value={wd.date}>
                    {wd.labelShort} ({wd.dayNumber})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block type-xs text-[var(--ink-secondary)] mb-1">
                Disciplina ITA
              </label>
              <select
                value={selectedDisc}
                onChange={(e) => setSelectedDisc(e.target.value)}
                className="w-full h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-canvas)] type-sm"
              >
                {disciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    [{d.code}] {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block type-xs text-[var(--ink-secondary)] mb-1">
                Tópico / Frente
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Eletrostática — Lei de Gauss e Condutores"
                className="w-full h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-canvas)] type-sm"
              />
            </div>
            <div>
              <label className="block type-xs text-[var(--ink-secondary)] mb-1">
                Início & Duração
              </label>
              <div className="flex gap-1">
                <input
                  type="time"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="w-1/2 h-8 px-1.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] font-mono-tabular type-xs"
                />
                <input
                  type="number"
                  step={15}
                  min={30}
                  max={300}
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="w-1/2 h-8 px-1.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] font-mono-tabular type-xs"
                />
              </div>
            </div>
            <div>
              <label className="block type-xs text-[var(--ink-secondary)] mb-1">
                Modalidade
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-canvas)] type-sm"
              >
                <option value="EXERCISES">Lista Fixação/ITA</option>
                <option value="THEORY">Teoria Base</option>
                <option value="ITA_PROVA">Prova Antiga ITA</option>
                <option value="REVIEW">Revisão Espaçada</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
              placeholder="Meta específica do bloco (ex: Resolver questões 1 a 15 do Saraeva)..."
              className="flex-1 h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-canvas)] type-sm"
            />
            <button
              type="submit"
              disabled={isPending}
              className="h-8 px-4 bg-[var(--accent-primary)] text-[var(--ink-on-accent)] type-sm font-medium rounded-[var(--radius-sm)] cursor-pointer"
            >
              Confirmar Alocação
            </button>
          </div>
        </form>
      )}

      {/* Modal Rápido para Mover Bloco entre Dias */}
      {movingSession && (
        <form
          onSubmit={handleMoveSession}
          className="p-3.5 border border-[var(--accent-primary)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] flex items-center justify-between gap-4"
        >
          <div className="type-sm">
            <span className="font-mono-tabular font-semibold text-[var(--accent-primary)]">
              MOVER BLOCO:{" "}
            </span>
            <strong>
              [{movingSession.disciplineId}] {movingSession.title}
            </strong>{" "}
            ({movingSession.plannedStart}–{movingSession.plannedEnd})
          </div>
          <div className="flex items-center gap-2">
            <select
              value={moveTargetDate}
              onChange={(e) => setMoveTargetDate(e.target.value)}
              className="h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-canvas)] type-sm"
            >
              {weekDays.map((wd) => (
                <option key={wd.date} value={wd.date}>
                  {wd.labelFull} ({wd.dayNumber})
                </option>
              ))}
            </select>
            <input
              type="time"
              value={moveTargetStart}
              onChange={(e) => setMoveTargetStart(e.target.value)}
              className="h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-canvas)] font-mono-tabular type-sm"
            />
            <button
              type="submit"
              disabled={isPending}
              className="h-8 px-3 bg-[var(--accent-primary)] text-[var(--ink-on-accent)] type-sm font-medium rounded-[var(--radius-sm)] cursor-pointer"
            >
              Transferir
            </button>
            <button
              type="button"
              onClick={() => setMovingSession(null)}
              className="h-8 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] type-sm rounded-[var(--radius-sm)] cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Legenda Editorial da Grade */}
      <div className="flex items-center justify-between type-xs text-[var(--ink-secondary)] px-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-[var(--border-strong)] bg-[var(--bg-card)] inline-block" />
            <span>Bloco de Estudo</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] inline-block" />
            <span>Revisão / Pausa Obrigatória</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-[var(--border-strong)] pattern-fixed-slot inline-block" />
            <span>Compromisso Fixo (Imutável)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 border border-[var(--status-overload)] bg-[var(--status-overload-bg)] inline-block" />
            <span>Sobrecarga Detectada</span>
          </span>
        </div>
        <span className="font-mono-tabular text-[var(--ink-muted)]">
          Teto diário padrão: {formatMinutes(config.maxDailyMinutes)} · Pausa
          mínima: {config.minBreakMinutes}m
        </span>
      </div>

      {/* Grade de 7 Colunas (Segunda a Domingo) */}
      <div className="grid grid-cols-7 border border-[var(--border-strong)] bg-[var(--bg-card)] divide-x divide-[var(--border-hairline)]">
        {weekDays.map((day) => {
          const isToday = day.date === todayIso;
          const { analysis } = day;
          const fixedSlots = day.slots.filter(
            (sl) => sl.slotType === "FIXED_COMMITMENT"
          );

          // Construir linha do tempo combinada (Sessões + Compromissos Fixos ordenados por horário)
          type TimelineEntry =
            | { kind: "SESSION"; startMins: number; session: StudySession; missingBreakBefore: boolean; breakBeforeMins: number }
            | { kind: "FIXED"; startMins: number; slot: RoutineSlot };

          const entries: TimelineEntry[] = [];

          day.sessions.forEach((s, idx) => {
            let missingBreakBefore = false;
            let breakBeforeMins = 0;
            if (idx > 0) {
              const prev = day.sessions[idx - 1];
              const gap =
                timeToMinutes(s.plannedStart) - timeToMinutes(prev.plannedEnd);
              if (
                gap === 0 &&
                prev.plannedMinutes + s.plannedMinutes >
                  config.maxContinuousMinutes
              ) {
                missingBreakBefore = true;
              } else if (gap >= config.minBreakMinutes && gap <= 30) {
                breakBeforeMins = gap;
              }
            }
            entries.push({
              kind: "SESSION",
              startMins: timeToMinutes(s.plannedStart),
              session: s,
              missingBreakBefore,
              breakBeforeMins,
            });
          });

          fixedSlots.forEach((sl) => {
            entries.push({
              kind: "FIXED",
              startMins: timeToMinutes(sl.startTime),
              slot: sl,
            });
          });

          entries.sort((a, b) => a.startMins - b.startMins);

          return (
            <div
              key={day.date}
              className={`flex flex-col min-h-[620px] ${
                analysis.isOverloaded
                  ? "bg-[var(--status-overload-bg)]/25"
                  : isToday
                  ? "bg-[var(--accent-subtle)]/25"
                  : "bg-[var(--bg-canvas)]/40"
              }`}
            >
              {/* Cabeçalho do Dia + Indicador de Carga / Sobrecarga */}
              <div
                className={`p-2.5 border-b ${
                  analysis.isOverloaded
                    ? "border-[var(--status-overload)] bg-[var(--status-overload-bg)]"
                    : isToday
                    ? "border-[var(--accent-primary)] bg-[var(--bg-card)]"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-editorial type-lg font-medium text-[var(--ink-primary)]">
                      {day.labelShort}
                    </span>
                    <span className="font-mono-tabular type-sm text-[var(--ink-secondary)]">
                      {day.dayNumber}
                    </span>
                  </div>
                  {isToday && (
                    <span className="font-mono-tabular type-2xs font-semibold px-1.5 py-0.5 bg-[var(--accent-primary)] text-[var(--ink-on-accent)]">
                      HOJE
                    </span>
                  )}
                  {analysis.isOverloaded && (
                    <span className="font-mono-tabular type-2xs font-semibold px-1.5 py-0.5 border border-[var(--status-overload)] bg-[var(--bg-card)] text-[var(--status-overload)]">
                      SOBRECARGA
                    </span>
                  )}
                </div>

                {/* Medidor de Horas Planejadas vs Limite */}
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between font-mono-tabular type-2xs">
                    <span className="text-[var(--ink-secondary)]">Carga:</span>
                    <span
                      className={`font-semibold ${
                        analysis.isOverloaded
                          ? "text-[var(--status-overload)]"
                          : "text-[var(--ink-primary)]"
                      }`}
                    >
                      {formatMinutes(analysis.plannedMinutes)} /{" "}
                      {formatMinutes(config.maxDailyMinutes)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--border-hairline)] overflow-hidden">
                    <div
                      className={`h-full ${
                        analysis.isOverloaded
                          ? "bg-[var(--status-overload)]"
                          : analysis.isNearLimit
                          ? "bg-[var(--status-warning)]"
                          : "bg-[var(--accent-primary)]"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(analysis.utilizationRatio * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Lista de Violações de Sobrecarga no Topo do Dia */}
                {analysis.issues.length > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-[var(--border-hairline)] space-y-1">
                    {analysis.issues.map((iss, i) => (
                      <div
                        key={i}
                        className={`type-2xs leading-tight flex items-start gap-1 ${
                          iss.severity === "CRITICAL"
                            ? "text-[var(--status-overload)] font-medium"
                            : "text-[var(--status-warning)]"
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{iss.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Exceções do Dia (Simulado / Bloqueio) */}
              {day.exceptions.map((ex) => (
                <div
                  key={ex.id}
                  className="mx-2 mt-2 p-2 border border-[var(--accent-primary)] bg-[var(--accent-subtle)] type-2xs space-y-0.5"
                >
                  <div className="font-mono-tabular font-semibold text-[var(--accent-primary)]">
                    EXCEÇÃO · {ex.exceptionType} ({ex.startTime}–{ex.endTime})
                  </div>
                  <div className="text-[var(--ink-primary)] font-medium">
                    {ex.reason}
                  </div>
                </div>
              ))}

              {/* Corpo de Blocos do Dia */}
              <div className="p-2 space-y-2 flex-1">
                {entries.map((entry, idx) => {
                  if (entry.kind === "FIXED") {
                    const sl = entry.slot;
                    return (
                      <div
                        key={`fixed-${sl.id}-${idx}`}
                        className="p-2 border border-[var(--border-strong)] pattern-fixed-slot rounded-[var(--radius-xs)] type-2xs space-y-0.5"
                      >
                        <div className="flex items-center justify-between font-mono-tabular text-[var(--ink-secondary)]">
                          <span>
                            {sl.startTime}–{sl.endTime}
                          </span>
                          <Lock className="w-2.5 h-2.5 text-[var(--ink-muted)]" />
                        </div>
                        <div className="font-medium text-[var(--ink-secondary)] truncate">
                          {sl.title}
                        </div>
                      </div>
                    );
                  }

                  const s = entry.session;
                  const disc = disciplineMap[s.disciplineId];
                  const isCompleted = s.status === "COMPLETED";
                  const isReview = s.sessionType === "REVIEW";

                  return (
                    <React.Fragment key={s.id}>
                      {/* Pausa Obrigatória Intercalada */}
                      {entry.breakBeforeMins > 0 && (
                        <div className="px-2 py-1 border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)]/70 type-2xs font-mono-tabular text-[var(--ink-muted)] flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Coffee className="w-2.5 h-2.5" />
                            <span>Pausa obrigatória</span>
                          </span>
                          <span>{entry.breakBeforeMins}m</span>
                        </div>
                      )}

                      {/* Alerta de Ausência de Pausa entre Blocos */}
                      {entry.missingBreakBefore && (
                        <div className="px-2 py-1 border border-[var(--status-overload)] bg-[var(--status-overload-bg)] type-2xs font-mono-tabular text-[var(--status-overload)] font-medium">
                          ! Sem pausa mínima ({config.minBreakMinutes}m)
                        </div>
                      )}

                      {/* Card do Bloco de Estudo */}
                      <div
                        className={`p-2 border rounded-[var(--radius-xs)] space-y-1.5 group relative ${
                          isReview
                            ? "border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)]"
                            : "border-[var(--border-hairline)] bg-[var(--bg-card)]"
                        } ${isCompleted ? "opacity-75" : ""}`}
                        style={{
                          borderLeftWidth: "3px",
                          borderLeftColor: disc?.accentTone || "#1B365D",
                        }}
                      >
                        <div className="flex items-center justify-between font-mono-tabular type-2xs">
                          <span className="font-semibold text-[var(--ink-primary)]">
                            [{s.disciplineId}] {s.plannedStart}–{s.plannedEnd}
                          </span>
                          <span className="text-[var(--ink-muted)]">
                            {formatMinutes(s.plannedMinutes)}
                          </span>
                        </div>

                        <div
                          className={`type-xs font-medium leading-snug ${
                            isCompleted
                              ? "line-through text-[var(--ink-secondary)]"
                              : "text-[var(--ink-primary)]"
                          }`}
                        >
                          {s.title}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[var(--border-hairline)]">
                          <span className="font-mono-tabular type-2xs text-[var(--ink-muted)]">
                            {isCompleted ? "CONCLUÍDO" : s.sessionType}
                          </span>

                          <div className="flex items-center gap-1">
                            {!isCompleted && (
                              <button
                                type="button"
                                onClick={() =>
                                  startTransition(() => {
                                    completeStudySessionAction({
                                      sessionId: s.id,
                                      actualMinutes: s.plannedMinutes,
                                      retentionRating: "SOLID",
                                    });
                                  })
                                }
                                className="p-0.5 text-[var(--status-complete)] hover:bg-[var(--status-complete-bg)] rounded-[var(--radius-xs)] cursor-pointer"
                                title="Marcar como concluído"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setMovingSession(s);
                                setMoveTargetDate(s.scheduledDate);
                                setMoveTargetStart(s.plannedStart);
                              }}
                              className="p-0.5 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] cursor-pointer"
                              title="Mover bloco para outro dia/horário"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                startTransition(() => {
                                  deleteStudySessionAction(s.id);
                                })
                              }
                              className="p-0.5 text-[var(--ink-muted)] hover:text-[var(--status-overload)] cursor-pointer"
                              title="Remover bloco"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
