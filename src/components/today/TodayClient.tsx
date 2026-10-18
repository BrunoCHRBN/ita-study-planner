"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Check,
  CalendarClock,
  RotateCcw,
  Plus,
  Clock,
  AlertCircle,
  BookOpen,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Discipline,
  StudySession,
  TaskItem,
  ReviewItem,
  RoutineSlot,
} from "@/db/schema";
import {
  completeStudySessionAction,
  rescheduleSessionAction,
  createStudySessionAction,
  toggleTaskAction,
  createTaskAction,
  deleteTaskAction,
  completeReviewAction,
  postponeReviewAction,
} from "@/app/actions";
import {
  formatEditorialDatePtBr,
  formatMinutes,
  addDaysISO,
} from "@/lib/date-utils";

interface TodayClientProps {
  todayIso: string;
  disciplines: Discipline[];
  disciplineMap: Record<string, Discipline>;
  todaySessions: StudySession[];
  nextSession: StudySession | null;
  todaySlots: RoutineSlot[];
  tasks: TaskItem[];
  todayReviews: ReviewItem[];
  overdueReviews: ReviewItem[];
  plannedMinutes: number;
  completedMinutes: number;
  maxDailyMinutes: number;
}

export function TodayClient({
  todayIso,
  disciplines,
  disciplineMap,
  todaySessions,
  nextSession,
  todaySlots,
  tasks,
  todayReviews,
  overdueReviews,
  plannedMinutes,
  completedMinutes,
  maxDailyMinutes,
}: TodayClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Cronômetro líquido da próxima sessão
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Estado para o micro-fluxo de conclusão de uma sessão
  const [concludingSessionId, setConcludingSessionId] = useState<string | null>(
    null
  );
  const [concludeMinutes, setConcludeMinutes] = useState<number>(90);
  const [concludeRetention, setConcludeRetention] = useState<
    "SOLID" | "PARTIAL" | "CRITICAL"
  >("SOLID");
  const [concludeNotes, setConcludeNotes] = useState<string>("");

  // Estado para reagendamento rápido de sessão
  const [reschedulingSessionId, setReschedulingSessionId] = useState<
    string | null
  >(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>(
    addDaysISO(todayIso, 1)
  );
  const [rescheduleStart, setRescheduleStart] = useState<string>("15:15");

  // Formulário de nova tarefa rápida
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDiscipline, setNewTaskDiscipline] = useState("FIS");
  const [newTaskCategory, setNewTaskCategory] = useState("ERRATA_CADERNO");

  // Formulário de novo bloco rápido hoje
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [newSessionDisc, setNewSessionDisc] = useState("MAT");
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionObj, setNewSessionObj] = useState("");
  const [newSessionStart, setNewSessionStart] = useState("16:00");
  const [newSessionMins, setNewSessionMins] = useState(60);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  function formatTimer(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(
      2,
      "0"
    )}:${String(s).padStart(2, "0")}`;
  }

  function openConcludeModal(session: StudySession) {
    setConcludingSessionId(session.id);
    const timerMins = Math.round(elapsedSeconds / 60);
    setConcludeMinutes(
      timerMins >= 10 && session.id === nextSession?.id
        ? timerMins
        : session.plannedMinutes
    );
    setConcludeRetention("SOLID");
    setConcludeNotes(session.notes || "");
  }

  function handleConfirmConclude(sessionId: string) {
    startTransition(async () => {
      await completeStudySessionAction({
        sessionId,
        actualMinutes: concludeMinutes,
        retentionRating: concludeRetention,
        notes: concludeNotes,
      });
      setConcludingSessionId(null);
      setTimerRunning(false);
      setElapsedSeconds(0);
      router.refresh();
    });
  }

  function handleConfirmReschedule(sessionId: string) {
    startTransition(async () => {
      await rescheduleSessionAction({
        sessionId,
        targetDate: rescheduleDate,
        plannedStart: rescheduleStart,
      });
      setReschedulingSessionId(null);
      router.refresh();
    });
  }

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    startTransition(async () => {
      await createTaskAction({
        disciplineId: newTaskDiscipline,
        title: newTaskTitle.trim(),
        category: newTaskCategory,
        priority: "HIGH",
        dueDate: todayIso,
      });
      setNewTaskTitle("");
      router.refresh();
    });
  }

  function handleCreateQuickSession(e: React.FormEvent) {
    e.preventDefault();
    if (!newSessionTitle.trim()) return;
    startTransition(async () => {
      await createStudySessionAction({
        disciplineId: newSessionDisc,
        title: newSessionTitle.trim(),
        objective:
          newSessionObj.trim() || "Bloco complementar adicionado na tela Hoje",
        scheduledDate: todayIso,
        plannedStart: newSessionStart,
        plannedMinutes: newSessionMins,
        sessionType: "EXERCISES",
      });
      setNewSessionTitle("");
      setNewSessionObj("");
      setShowNewSessionForm(false);
      router.refresh();
    });
  }

  const progressRatio =
    plannedMinutes > 0
      ? Math.min(100, Math.round((completedMinutes / plannedMinutes) * 100))
      : 0;

  const remainingSessionsCount = todaySessions.filter(
    (s) => s.status === "PLANNED" || s.status === "IN_PROGRESS"
  ).length;

  const fixedCommitmentsToday = todaySlots.filter(
    (sl) => sl.slotType === "FIXED_COMMITMENT"
  );

  return (
    <div className="p-6 max-w-[1380px] mx-auto space-y-6">
      {/* Cabeçalho Editorial da Tela 01. Hoje */}
      <section className="border-b border-[var(--border-strong)] pb-4 flex items-end justify-between gap-4">
        <div>
          <div className="font-mono-tabular type-xs text-[var(--ink-muted)]">
            01. HOJE · MESA DE OPERAÇÃO DIÁRIA
          </div>
          <h1 className="font-editorial type-2xl text-[var(--ink-primary)] leading-tight mt-0.5">
            {formatEditorialDatePtBr(todayIso)}
          </h1>
          <p className="type-base text-[var(--ink-secondary)] mt-1">
            {remainingSessionsCount} bloco(s) pendente(s) ·{" "}
            {todayReviews.length} revisão(ões) agendada(s) para hoje
            {overdueReviews.length > 0 && (
              <span className="text-[var(--status-overload)] font-medium">
                {" "}
                · {overdueReviews.length} revisão(ões) em atraso
              </span>
            )}
          </p>
        </div>

        {/* Barra de Progresso Diário + Gatilho de Reajuste IA */}
        <div className="flex items-center gap-4">
          <div className="w-60 p-2.5 border border-[var(--border-hairline)] bg-[var(--bg-card)] rounded-[var(--radius-sm)]">
            <div className="flex items-center justify-between type-xs font-mono-tabular">
              <span className="text-[var(--ink-secondary)]">
                PROGRESSO DIÁRIO
              </span>
              <span className="font-semibold text-[var(--ink-primary)]">
                {formatMinutes(completedMinutes)} /{" "}
                {formatMinutes(plannedMinutes)} ({progressRatio}%)
              </span>
            </div>
            <div className="w-full h-2 bg-[var(--border-hairline)] mt-1.5 overflow-hidden">
              <div
                className="h-full bg-[var(--accent-primary)]"
                style={{ width: `${progressRatio}%` }}
              />
            </div>
            <div className="type-2xs font-mono-tabular text-[var(--ink-muted)] mt-1 flex justify-between">
              <span>Limite rotina: {formatMinutes(maxDailyMinutes)}</span>
              <span>
                Restam:{" "}
                {formatMinutes(Math.max(0, plannedMinutes - completedMinutes))}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("ita:trigger-assistant", {
                  detail: { actionType: "REBALANCE_TODAY" },
                })
              )
            }
            className="h-9 px-3 border border-[var(--border-strong)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] type-sm font-medium text-[var(--ink-primary)] flex items-center gap-2 rounded-[var(--radius-sm)] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Reajustar Restante do Dia</span>
          </button>
        </div>
      </section>

      {/* Grid Principal: Coluna Esquerda (Próxima Sessão + Linha do Tempo) | Coluna Direita (Revisões + Tarefas) */}
      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda (7 cols): Próxima Sessão + Cronograma do Dia */}
        <div className="col-span-7 space-y-6">
          {/* Card Principal: PRÓXIMA SESSÃO */}
          <div className="border-2 border-[var(--accent-primary)] bg-[var(--bg-card)] rounded-[var(--radius-md)] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono-tabular type-xs font-semibold px-2 py-0.5 bg-[var(--accent-primary)] text-[var(--ink-on-accent)] rounded-[var(--radius-xs)]">
                  PRÓXIMA SESSÃO EM FOCO
                </span>
                {nextSession && (
                  <span className="font-mono-tabular type-xs font-semibold px-2 py-0.5 border border-[var(--border-strong)] bg-[var(--bg-surface)]">
                    [{nextSession.disciplineId}] ·{" "}
                    {disciplineMap[nextSession.disciplineId]?.name}
                  </span>
                )}
              </div>

              {nextSession && (
                <div className="font-mono-tabular type-sm font-semibold text-[var(--ink-primary)] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>
                    {nextSession.plannedStart} – {nextSession.plannedEnd} (
                    {formatMinutes(nextSession.plannedMinutes)})
                  </span>
                </div>
              )}
            </div>

            {nextSession ? (
              <>
                <div className="space-y-1.5">
                  <h2 className="font-editorial type-xl text-[var(--ink-primary)] leading-snug">
                    {nextSession.title}
                  </h2>
                  <p className="type-base text-[var(--ink-secondary)]">
                    <strong className="font-medium text-[var(--ink-primary)]">
                      Meta objetiva:
                    </strong>{" "}
                    {nextSession.objective}
                  </p>
                </div>

                {/* Barra de Execução: Cronômetro Líquido + Botões Rápidos */}
                <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 bg-[var(--bg-surface)] px-3 py-1.5 border border-[var(--border-strong)] rounded-[var(--radius-sm)]">
                    <span className="type-xs text-[var(--ink-secondary)]">
                      Tempo Líquido:
                    </span>
                    <span className="font-mono-tabular type-lg font-semibold text-[var(--ink-primary)]">
                      {formatTimer(elapsedSeconds)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTimerRunning((prev) => !prev)}
                      className="h-7 px-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--ink-on-accent)] type-xs font-medium flex items-center gap-1 rounded-[var(--radius-xs)] cursor-pointer ml-1"
                    >
                      {timerRunning ? (
                        <>
                          <Pause className="w-3 h-3" />
                          <span>Pausar</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          <span>Iniciar</span>
                        </>
                      )}
                    </button>
                    {elapsedSeconds > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setTimerRunning(false);
                          setElapsedSeconds(0);
                        }}
                        className="p-1 text-[var(--ink-muted)] hover:text-[var(--ink-primary)] cursor-pointer"
                        title="Zerar cronômetro"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openConcludeModal(nextSession)}
                      className="h-8 px-3 border border-[var(--status-complete)] bg-[var(--status-complete)] text-white type-sm font-medium flex items-center gap-1.5 rounded-[var(--radius-sm)] cursor-pointer hover:opacity-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Concluir Sessão</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReschedulingSessionId(
                          reschedulingSessionId === nextSession.id
                            ? null
                            : nextSession.id
                        );
                        setConcludingSessionId(null);
                      }}
                      className="h-8 px-3 border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] type-sm text-[var(--ink-primary)] flex items-center gap-1.5 rounded-[var(--radius-sm)] cursor-pointer"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>Reagendar</span>
                    </button>
                  </div>
                </div>

                {/* Painel Inline de Conclusão + Agendamento Automático de Revisão */}
                {concludingSessionId === nextSession.id && (
                  <div className="p-3.5 border border-[var(--status-complete)] bg-[var(--status-complete-bg)] rounded-[var(--radius-sm)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular type-xs font-semibold text-[var(--status-complete)]">
                        REGISTRAR EXECUÇÃO E AGENDAR REVISÃO ESPAÇADA
                      </span>
                      <button
                        type="button"
                        onClick={() => setConcludingSessionId(null)}
                        className="type-xs text-[var(--ink-secondary)] underline cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block type-xs font-medium text-[var(--ink-primary)] mb-1">
                          Tempo líquido realizado (min)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={360}
                          value={concludeMinutes}
                          onChange={(e) =>
                            setConcludeMinutes(Number(e.target.value))
                          }
                          className="w-full h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] font-mono-tabular type-sm"
                        />
                      </div>
                      <div>
                        <label className="block type-xs font-medium text-[var(--ink-primary)] mb-1">
                          Grau de retenção (define próxima revisão)
                        </label>
                        <select
                          value={concludeRetention}
                          onChange={(e) =>
                            setConcludeRetention(
                              e.target.value as "SOLID" | "PARTIAL" | "CRITICAL"
                            )
                          }
                          className="w-full h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] type-sm"
                        >
                          <option value="SOLID">
                            Sólido → Agendar revisão R2 em 7 dias
                          </option>
                          <option value="PARTIAL">
                            Parcial → Agendar revisão R1 em 3 dias
                          </option>
                          <option value="CRITICAL">
                            Crítico / Erros → Revisão urgente em 24h
                          </option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block type-xs font-medium text-[var(--ink-primary)] mb-1">
                        Observações / Questões pendentes para o Caderno de Erros
                      </label>
                      <input
                        type="text"
                        value={concludeNotes}
                        onChange={(e) => setConcludeNotes(e.target.value)}
                        placeholder="Ex: Refazer questão 18 de Carnot com gás real..."
                        className="w-full h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] type-sm"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleConfirmConclude(nextSession.id)}
                      className="h-8 px-4 bg-[var(--status-complete)] text-white type-sm font-medium rounded-[var(--radius-sm)] cursor-pointer"
                    >
                      Confirmar Conclusão e Agendar Revisão
                    </button>
                  </div>
                )}

                {/* Painel Inline de Reagendamento Rápido */}
                {reschedulingSessionId === nextSession.id && (
                  <div className="p-3.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] rounded-[var(--radius-sm)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular type-xs font-semibold text-[var(--ink-primary)]">
                        REAGENDAR SESSÃO PARA NOVA JANELA
                      </span>
                      <button
                        type="button"
                        onClick={() => setReschedulingSessionId(null)}
                        className="type-xs text-[var(--ink-secondary)] underline cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-4">
                        <label className="block type-xs text-[var(--ink-secondary)] mb-1">
                          Nova Data
                        </label>
                        <input
                          type="date"
                          value={rescheduleDate}
                          onChange={(e) => setRescheduleDate(e.target.value)}
                          className="w-full h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] font-mono-tabular type-sm"
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="block type-xs text-[var(--ink-secondary)] mb-1">
                          Novo Horário Inicial
                        </label>
                        <input
                          type="time"
                          value={rescheduleStart}
                          onChange={(e) => setRescheduleStart(e.target.value)}
                          className="w-full h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] font-mono-tabular type-sm"
                        />
                      </div>
                      <div className="col-span-4 flex items-end">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleConfirmReschedule(nextSession.id)
                          }
                          className="w-full h-8 bg-[var(--accent-primary)] text-[var(--ink-on-accent)] type-sm font-medium rounded-[var(--radius-sm)] cursor-pointer"
                        >
                          Aplicar Reagendamento
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-4 type-base text-[var(--ink-secondary)]">
                Todas as sessões planejadas para hoje foram concluídas. Utilize
                o botão abaixo caso deseje adicionar um bloco extra ou adiantar
                uma revisão.
              </div>
            )}
          </div>

          {/* Lista Cronológica de Sessões de Hoje */}
          <div className="border border-[var(--border-hairline)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center justify-between">
              <div>
                <h3 className="font-editorial type-lg text-[var(--ink-primary)]">
                  Cronograma de Sessões de Hoje
                </h3>
                <p className="type-xs text-[var(--ink-secondary)]">
                  Sequência completa de blocos de estudo e compromissos fixos do
                  dia
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewSessionForm((prev) => !prev)}
                className="h-7 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] type-xs font-medium flex items-center gap-1 rounded-[var(--radius-sm)] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Bloco Hoje</span>
              </button>
            </div>

            {showNewSessionForm && (
              <form
                onSubmit={handleCreateQuickSession}
                className="p-3.5 border-b border-[var(--border-strong)] bg-[var(--bg-surface)] space-y-2.5"
              >
                <div className="font-mono-tabular type-2xs font-semibold text-[var(--ink-secondary)]">
                  ADICIONAR BLOCO DE ESTUDO EM HOJE ({todayIso})
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <select
                    value={newSessionDisc}
                    onChange={(e) => setNewSessionDisc(e.target.value)}
                    className="h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] type-sm"
                  >
                    {disciplines.map((d) => (
                      <option key={d.id} value={d.id}>
                        [{d.code}] {d.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    value={newSessionTitle}
                    onChange={(e) => setNewSessionTitle(e.target.value)}
                    placeholder="Tópico (ex: Óptica Geométrica)"
                    className="col-span-2 h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] type-sm"
                  />
                  <div className="flex gap-1">
                    <input
                      type="time"
                      value={newSessionStart}
                      onChange={(e) => setNewSessionStart(e.target.value)}
                      className="w-1/2 h-8 px-1.5 border border-[var(--border-strong)] bg-[var(--bg-card)] font-mono-tabular type-xs"
                    />
                    <input
                      type="number"
                      min={15}
                      step={15}
                      value={newSessionMins}
                      onChange={(e) =>
                        setNewSessionMins(Number(e.target.value))
                      }
                      className="w-1/2 h-8 px-1.5 border border-[var(--border-strong)] bg-[var(--bg-card)] font-mono-tabular type-xs"
                      title="Duração em minutos"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSessionObj}
                    onChange={(e) => setNewSessionObj(e.target.value)}
                    placeholder="Meta da sessão (ex: 10 questões nível ITA 1ª fase)..."
                    className="flex-1 h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] type-sm"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="h-8 px-3 bg-[var(--accent-primary)] text-[var(--ink-on-accent)] type-sm font-medium rounded-[var(--radius-sm)] cursor-pointer"
                  >
                    Salvar Bloco
                  </button>
                </div>
              </form>
            )}

            <div className="divide-y divide-[var(--border-hairline)]">
              {todaySessions.map((s) => {
                const isDone = s.status === "COMPLETED";
                const isNext = nextSession?.id === s.id;
                const disc = disciplineMap[s.disciplineId];

                return (
                  <div
                    key={s.id}
                    className={`p-3.5 flex items-center justify-between gap-4 ${
                      isDone
                        ? "bg-[var(--bg-canvas)]/60 opacity-80"
                        : isNext
                        ? "bg-[var(--accent-subtle)]/40"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="w-1 self-stretch shrink-0"
                        style={{
                          backgroundColor: disc?.accentTone || "#1B365D",
                        }}
                      />
                      <div className="font-mono-tabular type-sm text-[var(--ink-secondary)] w-24 shrink-0 pt-0.5">
                        <div>
                          {s.plannedStart}–{s.plannedEnd}
                        </div>
                        <div className="type-2xs text-[var(--ink-muted)]">
                          {formatMinutes(s.plannedMinutes)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tabular type-2xs font-semibold px-1.5 py-0.5 border border-[var(--border-strong)] bg-[var(--bg-surface)]">
                            [{s.disciplineId}]
                          </span>
                          <span className="font-mono-tabular type-2xs text-[var(--ink-muted)]">
                            {s.sessionType}
                          </span>
                          {s.rescheduledCount > 0 && (
                            <span className="font-mono-tabular type-2xs text-[var(--status-warning)]">
                              Reagendado {s.rescheduledCount}x
                            </span>
                          )}
                        </div>
                        <div
                          className={`type-base font-medium mt-0.5 ${
                            isDone
                              ? "line-through text-[var(--ink-secondary)]"
                              : "text-[var(--ink-primary)]"
                          }`}
                        >
                          {s.title}
                        </div>
                        <div className="type-xs text-[var(--ink-secondary)] truncate">
                          {s.objective}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDone ? (
                        <span className="font-mono-tabular type-xs px-2 py-1 border border-[var(--status-complete)] bg-[var(--status-complete-bg)] text-[var(--status-complete)] font-medium rounded-[var(--radius-xs)]">
                          CONCLUÍDO ({formatMinutes(s.actualMinutes)})
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              completeStudySessionAction({
                                sessionId: s.id,
                                actualMinutes: s.plannedMinutes,
                                retentionRating: "SOLID",
                              })
                            }
                            className="h-7 px-2.5 border border-[var(--status-complete)] bg-[var(--status-complete-bg)] text-[var(--status-complete)] hover:opacity-90 type-xs font-medium rounded-[var(--radius-xs)] cursor-pointer flex items-center gap-1"
                            title="Concluir com retenção sólida (agenda revisão em 7d)"
                          >
                            <Check className="w-3 h-3" />
                            <span>Concluir</span>
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              rescheduleSessionAction({
                                sessionId: s.id,
                                targetDate: addDaysISO(todayIso, 1),
                                plannedStart: s.plannedStart,
                              })
                            }
                            className="h-7 px-2 border border-[var(--border-strong)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] type-xs text-[var(--ink-secondary)] rounded-[var(--radius-xs)] cursor-pointer"
                            title="Reagendar para amanhã no mesmo horário"
                          >
                            Adiar +1d
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {fixedCommitmentsToday.length > 0 && (
              <div className="px-4 py-2.5 border-t border-[var(--border-hairline)] pattern-fixed-slot flex items-center justify-between type-xs text-[var(--ink-secondary)]">
                <span className="font-mono-tabular font-medium">
                  COMPROMISSOS FIXOS DE HOJE:
                </span>
                <div className="flex items-center gap-3 font-mono-tabular">
                  {fixedCommitmentsToday.map((fc) => (
                    <span key={fc.id}>
                      {fc.startTime}–{fc.endTime} ({fc.title})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita (5 cols): Revisões do Dia/Atrasadas + Tarefas Pendentes */}
        <div className="col-span-5 space-y-6">
          {/* Painel de Revisões (Hoje + Atrasadas) */}
          <div className="border border-[var(--border-hairline)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[var(--accent-primary)]" />
                <div>
                  <h3 className="font-editorial type-lg text-[var(--ink-primary)]">
                    Revisões Espaçadas
                  </h3>
                  <p className="type-xs text-[var(--ink-secondary)]">
                    Manutenção ativa de memória (Ciclos 24h · 7d · 21d)
                  </p>
                </div>
              </div>
              {overdueReviews.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("ita:trigger-assistant", {
                        detail: { actionType: "DRAIN_OVERDUE_REVIEWS" },
                      })
                    )
                  }
                  className="h-7 px-2 border border-[var(--status-overload)] bg-[var(--status-overload-bg)] text-[var(--status-overload)] font-mono-tabular type-2xs font-medium rounded-[var(--radius-xs)] cursor-pointer"
                >
                  Encaixar {overdueReviews.length} atrasada(s) com IA
                </button>
              )}
            </div>

            <div className="divide-y divide-[var(--border-hairline)]">
              {[...overdueReviews, ...todayReviews].length === 0 ? (
                <div className="p-4 type-sm text-[var(--ink-muted)]">
                  Nenhuma revisão pendente para hoje.
                </div>
              ) : (
                [...overdueReviews, ...todayReviews].map((rev) => {
                  const isOverdue =
                    rev.status === "OVERDUE" || rev.scheduledDate < todayIso;
                  return (
                    <div key={rev.id} className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-tabular type-2xs font-semibold px-1.5 py-0.5 border border-[var(--border-strong)] bg-[var(--bg-surface)]">
                            [{rev.disciplineId}]
                          </span>
                          <span className="font-mono-tabular type-2xs px-1.5 py-0.5 border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--ink-secondary)]">
                            {rev.cycleStage} · ~{rev.estimatedMinutes}m
                          </span>
                          {isOverdue && (
                            <span className="font-mono-tabular type-2xs px-1.5 py-0.5 border border-[var(--status-overload)] bg-[var(--status-overload-bg)] text-[var(--status-overload)] font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              ATRASADA ({rev.scheduledDate})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="type-base font-medium text-[var(--ink-primary)]">
                        {rev.title}
                      </div>
                      <p className="type-xs text-[var(--ink-secondary)]">
                        {rev.focusPrompt}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              completeReviewAction({
                                reviewId: rev.id,
                                retentionRating: "SOLID",
                              })
                            }
                            className="h-6 px-2 border border-[var(--status-complete)] bg-[var(--status-complete-bg)] text-[var(--status-complete)] type-xs font-medium rounded-[var(--radius-xs)] cursor-pointer"
                          >
                            Concluir (Sólido)
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              completeReviewAction({
                                reviewId: rev.id,
                                retentionRating: "PARTIAL",
                              })
                            }
                            className="h-6 px-2 border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--ink-primary)] type-xs rounded-[var(--radius-xs)] cursor-pointer"
                          >
                            Parcial
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            postponeReviewAction({
                              reviewId: rev.id,
                              addDays: 1,
                            })
                          }
                          className="h-6 px-2 type-xs text-[var(--ink-muted)] hover:text-[var(--ink-primary)] underline cursor-pointer"
                        >
                          Reagendar +1d
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Painel de Tarefas Pendentes Operacionais */}
          <div className="border border-[var(--border-hairline)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <h3 className="font-editorial type-lg text-[var(--ink-primary)]">
                Tarefas Pendentes
              </h3>
              <p className="type-xs text-[var(--ink-secondary)]">
                Ações táticas de curto prazo (Caderno de Erros, Redação e
                Listas)
              </p>
            </div>

            <form
              onSubmit={handleAddTask}
              className="p-3 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)] flex items-center gap-1.5"
            >
              <select
                value={newTaskDiscipline}
                onChange={(e) => setNewTaskDiscipline(e.target.value)}
                className="h-7 px-1.5 border border-[var(--border-strong)] bg-[var(--bg-card)] font-mono-tabular type-xs"
              >
                {disciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code}
                  </option>
                ))}
              </select>
              <select
                value={newTaskCategory}
                onChange={(e) => setNewTaskCategory(e.target.value)}
                className="h-7 px-1.5 border border-[var(--border-strong)] bg-[var(--bg-card)] font-mono-tabular type-2xs"
              >
                <option value="ERRATA_CADERNO">CADERNO ERROS</option>
                <option value="LISTA_PENDENTE">LISTA</option>
                <option value="REDACAO">REDAÇÃO</option>
                <option value="ORGANIZACAO">PREPARO</option>
              </select>
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Adicionar tarefa pendente..."
                className="flex-1 h-7 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] type-sm"
              />
              <button
                type="submit"
                disabled={isPending || !newTaskTitle.trim()}
                className="h-7 px-2.5 bg-[var(--accent-primary)] text-[var(--ink-on-accent)] type-xs font-medium rounded-[var(--radius-xs)] cursor-pointer"
              >
                Incluir
              </button>
            </form>

            <div className="divide-y divide-[var(--border-hairline)]">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="px-3.5 py-2.5 flex items-start justify-between gap-2 hover:bg-[var(--bg-hover)]/50"
                >
                  <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={t.isCompleted}
                      onChange={(e) =>
                        startTransition(() => {
                          toggleTaskAction(t.id, e.target.checked);
                        })
                      }
                      className="mt-0.5 accent-[var(--accent-primary)] cursor-pointer"
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-tabular type-2xs font-semibold text-[var(--ink-secondary)]">
                          [{t.disciplineId}]
                        </span>
                        <span className="font-mono-tabular type-2xs text-[var(--ink-muted)]">
                          {t.category}
                        </span>
                      </div>
                      <div
                        className={`type-sm ${
                          t.isCompleted
                            ? "line-through text-[var(--ink-muted)]"
                            : "text-[var(--ink-primary)]"
                        }`}
                      >
                        {t.title}
                      </div>
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      startTransition(() => {
                        deleteTaskAction(t.id);
                      })
                    }
                    className="p-1 text-[var(--ink-muted)] hover:text-[var(--status-overload)] cursor-pointer"
                    title="Remover tarefa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
