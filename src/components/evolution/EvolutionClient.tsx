"use client";

import React, { useTransition } from "react";
import {
  AlertCircle,
  Check,
  Sparkles,
  TrendingUp,
  BookOpen,
  Clock,
  Activity,
} from "lucide-react";
import {
  Discipline,
  StudySession,
  ReviewItem,
  RoutineConfig,
  Topic,
} from "@/db/schema";
import { DayLoadAnalysis } from "@/lib/overload-engine";
import { formatMinutes } from "@/lib/date-utils";
import {
  completeReviewAction,
  postponeReviewAction,
} from "@/app/actions";

interface EvolutionDay {
  date: string;
  dayOfWeek: number;
  labelShort: string;
  labelFull: string;
  dayNumber: string;
  analysis: DayLoadAnalysis;
  sessions: StudySession[];
}

interface EvolutionClientProps {
  todayIso: string;
  weekDays: EvolutionDay[];
  disciplines: Discipline[];
  topics: Topic[];
  allSessions: StudySession[];
  reviews: ReviewItem[];
  overdueReviews: ReviewItem[];
  config: RoutineConfig;
}

export function EvolutionClient({
  todayIso,
  weekDays,
  disciplines,
  topics,
  allSessions,
  reviews,
  overdueReviews,
  config,
}: EvolutionClientProps) {
  const [isPending, startTransition] = useTransition();

  const totalPlannedWeek = weekDays.reduce(
    (acc, d) => acc + d.analysis.plannedMinutes,
    0
  );
  const totalCompletedWeek = weekDays.reduce(
    (acc, d) => acc + d.analysis.completedMinutes,
    0
  );
  const executionRate =
    totalPlannedWeek > 0
      ? Math.round((totalCompletedWeek / totalPlannedWeek) * 100)
      : 0;

  // Consistência: sessões concluídas sem reagendamento vs total de sessões
  const totalSessionsCount = allSessions.length;
  const completedSessionsCount = allSessions.filter(
    (s) => s.status === "COMPLETED"
  ).length;
  const rescheduledSessionsCount = allSessions.filter(
    (s) => (s.rescheduledCount || 0) > 0
  ).length;
  const stabilityRate =
    totalSessionsCount > 0
      ? Math.round(
          ((totalSessionsCount - rescheduledSessionsCount) /
            totalSessionsCount) *
            100
        )
      : 100;

  // Distribuição por disciplina
  const disciplineStats = disciplines.map((d) => {
    const discSessions = allSessions.filter((s) => s.disciplineId === d.id);
    const plannedMins = discSessions.reduce(
      (acc, s) => acc + s.plannedMinutes,
      0
    );
    const completedMins = discSessions
      .filter((s) => s.status === "COMPLETED")
      .reduce((acc, s) => acc + (s.actualMinutes || s.plannedMinutes), 0);
    const targetMins = d.targetWeeklyMinutes;
    const deltaPlannedVsTarget = plannedMins - targetMins;
    const shareOfPlanned =
      totalPlannedWeek > 0
        ? Math.round((plannedMins / totalPlannedWeek) * 100)
        : 0;

    return {
      discipline: d,
      targetMins,
      plannedMins,
      completedMins,
      deltaPlannedVsTarget,
      shareOfPlanned,
    };
  });

  const completedReviewsCount = reviews.filter(
    (r) => r.status === "COMPLETED"
  ).length;

  return (
    <div className="p-6 max-w-[1380px] mx-auto space-y-6">
      {/* Cabeçalho Editorial da Tela 04. Evolução */}
      <section className="border-b border-[var(--border-strong)] pb-4 flex items-end justify-between gap-4">
        <div>
          <div className="font-mono-tabular type-xs text-[var(--ink-muted)]">
            04. EVOLUÇÃO · AUDITORIA DE DESEMPENHO E CONSISTÊNCIA
          </div>
          <h1 className="font-editorial type-2xl text-[var(--ink-primary)] leading-tight mt-0.5">
            Balanço de Horas, Cobertura ITA e Consistência
          </h1>
          <p className="type-base text-[var(--ink-secondary)] mt-1">
            Comparativo rigoroso entre horas planejadas e realizadas,
            distribuição por disciplina e saúde das revisões.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("ita:trigger-assistant", {
                detail: {
                  actionType: "CUSTOM",
                  prompt:
                    "Analise minha evolução semanal, identifique desvios entre planejado e realizado nas matérias do ITA e proponha ajustes.",
                },
              })
            )
          }
          className="h-9 px-3.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--ink-on-accent)] type-sm font-medium flex items-center gap-1.5 rounded-[var(--radius-sm)] cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Auditar Semana com IA</span>
        </button>
      </section>

      {/* Strip de 4 KPIs Editoriais */}
      <section className="grid grid-cols-4 border border-[var(--border-strong)] bg-[var(--bg-card)] divide-x divide-[var(--border-hairline)]">
        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between type-xs font-mono-tabular text-[var(--ink-muted)]">
            <span>HORAS REALIZADAS / PLANEJADAS</span>
            <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          </div>
          <div className="font-mono-tabular type-xl font-semibold text-[var(--ink-primary)]">
            {formatMinutes(totalCompletedWeek)}{" "}
            <span className="type-md font-normal text-[var(--ink-secondary)]">
              / {formatMinutes(totalPlannedWeek)}
            </span>
          </div>
          <div className="type-xs text-[var(--ink-secondary)]">
            Taxa de cumprimento acumulado:{" "}
            <strong className="font-mono-tabular">{executionRate}%</strong>
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between type-xs font-mono-tabular text-[var(--ink-muted)]">
            <span>CONSISTÊNCIA DA GRADE</span>
            <Activity className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          </div>
          <div className="font-mono-tabular type-xl font-semibold text-[var(--ink-primary)]">
            {stabilityRate}%{" "}
            <span className="type-base font-normal text-[var(--ink-secondary)]">
              estabilidade
            </span>
          </div>
          <div className="type-xs text-[var(--ink-secondary)]">
            {completedSessionsCount} blocos concluídos ·{" "}
            {rescheduledSessionsCount} reagendados
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between type-xs font-mono-tabular text-[var(--ink-muted)]">
            <span>SAÚDE DAS REVISÕES</span>
            <BookOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          </div>
          <div
            className={`font-mono-tabular type-xl font-semibold ${
              overdueReviews.length > 0
                ? "text-[var(--status-overload)]"
                : "text-[var(--status-complete)]"
            }`}
          >
            {overdueReviews.length} atrasada(s)
          </div>
          <div className="type-xs text-[var(--ink-secondary)]">
            {completedReviewsCount} concluída(s) ·{" "}
            {reviews.length - completedReviewsCount - overdueReviews.length} no
            prazo
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="flex items-center justify-between type-xs font-mono-tabular text-[var(--ink-muted)]">
            <span>TETO SEMANAL CONFIGURADO</span>
            <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          </div>
          <div className="font-mono-tabular type-xl font-semibold text-[var(--ink-primary)]">
            {formatMinutes(config.maxWeeklyMinutes)}
          </div>
          <div className="type-xs text-[var(--ink-secondary)]">
            Margem semanal livre:{" "}
            <strong className="font-mono-tabular">
              {formatMinutes(
                Math.max(0, config.maxWeeklyMinutes - totalPlannedWeek)
              )}
            </strong>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda (7 cols): Planejado vs Realizado por Dia + Distribuição por Disciplina */}
        <div className="col-span-7 space-y-6">
          {/* Painel 1: Horas Planejadas vs Realizadas por Dia da Semana */}
          <div className="border border-[var(--border-hairline)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center justify-between">
              <div>
                <h2 className="font-editorial type-lg text-[var(--ink-primary)]">
                  Horas Planejadas vs. Realizadas por Dia
                </h2>
                <p className="type-xs text-[var(--ink-secondary)]">
                  Comparativo diário frente ao teto de{" "}
                  {formatMinutes(config.maxDailyMinutes)} definido em Minha
                  Rotina
                </p>
              </div>
              <div className="flex items-center gap-3 type-xs font-mono-tabular">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[var(--border-strong)] inline-block" />
                  <span>Planejado</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[var(--accent-primary)] inline-block" />
                  <span>Realizado</span>
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {weekDays.map((day) => {
                const plannedRatio = Math.min(
                  100,
                  Math.round(
                    (day.analysis.plannedMinutes /
                      Math.max(1, config.maxDailyMinutes * 1.25)) *
                      100
                  )
                );
                const completedRatio = Math.min(
                  100,
                  Math.round(
                    (day.analysis.completedMinutes /
                      Math.max(1, config.maxDailyMinutes * 1.25)) *
                      100
                  )
                );
                const isPastOrToday = day.date <= todayIso;

                return (
                  <div key={day.date} className="space-y-1">
                    <div className="flex items-center justify-between type-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular font-semibold text-[var(--ink-primary)] w-16">
                          {day.labelShort} ({day.dayNumber})
                        </span>
                        {day.date === todayIso && (
                          <span className="font-mono-tabular type-2xs px-1.5 py-0.5 bg-[var(--accent-primary)] text-[var(--ink-on-accent)]">
                            HOJE
                          </span>
                        )}
                        {day.analysis.isOverloaded && (
                          <span className="font-mono-tabular type-2xs text-[var(--status-overload)] font-medium">
                            Sobrecarga (+
                            {formatMinutes(
                              day.analysis.plannedMinutes -
                                config.maxDailyMinutes
                            )}
                            )
                          </span>
                        )}
                      </div>

                      <div className="font-mono-tabular type-xs text-[var(--ink-secondary)]">
                        Realizado:{" "}
                        <strong className="text-[var(--ink-primary)]">
                          {formatMinutes(day.analysis.completedMinutes)}
                        </strong>{" "}
                        / Planejado:{" "}
                        <strong>
                          {formatMinutes(day.analysis.plannedMinutes)}
                        </strong>
                      </div>
                    </div>

                    {/* Barra Dupla Sobposta Editorial */}
                    <div className="w-full h-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)] relative overflow-hidden">
                      <div
                        className={`h-full ${
                          day.analysis.isOverloaded
                            ? "bg-[var(--status-overload)]/30"
                            : "bg-[var(--border-strong)]"
                        }`}
                        style={{ width: `${plannedRatio}%` }}
                      />
                      {isPastOrToday && (
                        <div
                          className="h-2.5 bg-[var(--accent-primary)] absolute top-[2px] left-0"
                          style={{ width: `${completedRatio}%` }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Painel 2: Distribuição por Disciplina da Matriz ITA */}
          <div className="border border-[var(--border-hairline)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <h2 className="font-editorial type-lg text-[var(--ink-primary)]">
                Distribuição de Carga por Disciplina (Matriz ITA)
              </h2>
              <p className="type-xs text-[var(--ink-secondary)]">
                Auditoria de aderência às metas semanais de Matemática, Física,
                Química, Português e Inglês
              </p>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/60 font-mono-tabular type-2xs text-[var(--ink-secondary)]">
                  <th className="py-2.5 px-3.5">DISCIPLINA</th>
                  <th className="py-2.5 px-2 text-right">META ROTINA</th>
                  <th className="py-2.5 px-2 text-right">PLANEJADO</th>
                  <th className="py-2.5 px-2 text-right">REALIZADO</th>
                  <th className="py-2.5 px-2 text-right">SALDO / DESVIO</th>
                  <th className="py-2.5 px-3.5 w-36">% CARGA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)] type-sm">
                {disciplineStats.map((st) => {
                  const isDeficit = st.deltaPlannedVsTarget < -30;
                  return (
                    <tr key={st.discipline.id}>
                      <td className="py-3 px-3.5 font-medium">
                        <span
                          className="inline-block w-2 h-2 mr-2"
                          style={{ backgroundColor: st.discipline.accentTone }}
                        />
                        <span className="font-mono-tabular type-2xs font-semibold mr-1.5">
                          [{st.discipline.code}]
                        </span>
                        {st.discipline.name}
                      </td>
                      <td className="py-3 px-2 text-right font-mono-tabular text-[var(--ink-secondary)]">
                        {formatMinutes(st.targetMins)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono-tabular font-medium text-[var(--ink-primary)]">
                        {formatMinutes(st.plannedMins)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono-tabular text-[var(--status-complete)] font-medium">
                        {formatMinutes(st.completedMins)}
                      </td>
                      <td
                        className={`py-3 px-2 text-right font-mono-tabular type-xs font-medium ${
                          isDeficit
                            ? "text-[var(--status-overload)]"
                            : "text-[var(--ink-secondary)]"
                        }`}
                      >
                        {st.deltaPlannedVsTarget >= 0 ? "+" : ""}
                        {formatMinutes(st.deltaPlannedVsTarget)}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[var(--border-hairline)] overflow-hidden">
                            <div
                              className="h-full"
                              style={{
                                width: `${st.shareOfPlanned}%`,
                                backgroundColor: st.discipline.accentTone,
                              }}
                            />
                          </div>
                          <span className="font-mono-tabular type-2xs w-8 text-right">
                            {st.shareOfPlanned}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coluna Direita (5 cols): Revisões Atrasadas + Consistência Semanal e Frentes do Edital */}
        <div className="col-span-5 space-y-6">
          {/* Painel 3: Fila de Revisões Atrasadas (Backlog) */}
          <div className="border border-[var(--border-hairline)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center justify-between">
              <div>
                <h2 className="font-editorial type-lg text-[var(--ink-primary)]">
                  Revisões Atrasadas ({overdueReviews.length})
                </h2>
                <p className="type-xs text-[var(--ink-secondary)]">
                  Tópicos com janela de esquecimento crítica vencida
                </p>
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
                  className="h-7 px-2.5 border border-[var(--status-overload)] bg-[var(--status-overload-bg)] text-[var(--status-overload)] font-mono-tabular type-2xs font-semibold rounded-[var(--radius-xs)] cursor-pointer"
                >
                  Alocar Todas na Grade via IA
                </button>
              )}
            </div>

            <div className="divide-y divide-[var(--border-hairline)]">
              {overdueReviews.length === 0 ? (
                <div className="p-4 type-sm text-[var(--status-complete)] font-medium">
                  Nenhuma revisão em atraso. Sua fila de retenção espaçada está
                  100% em dia.
                </div>
              ) : (
                overdueReviews.map((rev) => (
                  <div key={rev.id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular type-2xs font-semibold px-1.5 py-0.5 border border-[var(--status-overload)] bg-[var(--status-overload-bg)] text-[var(--status-overload)] flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />[{rev.disciplineId}]{" "}
                        {rev.cycleStage} · Vencida em {rev.scheduledDate}
                      </span>
                      <span className="font-mono-tabular type-2xs text-[var(--ink-muted)]">
                        ~{rev.estimatedMinutes}m
                      </span>
                    </div>
                    <div className="type-base font-medium text-[var(--ink-primary)]">
                      {rev.title}
                    </div>
                    <p className="type-xs text-[var(--ink-secondary)]">
                      {rev.focusPrompt}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(() => {
                            completeReviewAction({
                              reviewId: rev.id,
                              retentionRating: "SOLID",
                            });
                          })
                        }
                        className="h-6 px-2.5 border border-[var(--status-complete)] bg-[var(--status-complete-bg)] text-[var(--status-complete)] type-xs font-medium rounded-[var(--radius-xs)] cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Concluir Agora</span>
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(() => {
                            postponeReviewAction({
                              reviewId: rev.id,
                              addDays: 0,
                            });
                          })
                        }
                        className="h-6 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] type-xs text-[var(--ink-primary)] rounded-[var(--radius-xs)] cursor-pointer"
                      >
                        Trazer para Hoje
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Painel 4: Matriz de Consistência Semanal e Domínio de Frentes */}
          <div className="border border-[var(--border-hairline)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
              <h2 className="font-editorial type-lg text-[var(--ink-primary)]">
                Consistência Semanal e Cobertura do Edital
              </h2>
              <p className="type-xs text-[var(--ink-secondary)]">
                Aderência diária aos blocos planejados e status das frentes do
                ITA
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* Grade dos 7 dias da semana */}
              <div className="grid grid-cols-7 gap-1.5">
                {weekDays.map((d) => {
                  const pct =
                    d.analysis.plannedMinutes > 0
                      ? Math.round(
                          (d.analysis.completedMinutes /
                            d.analysis.plannedMinutes) *
                            100
                        )
                      : 0;
                  const isFuture = d.date > todayIso;
                  return (
                    <div
                      key={d.date}
                      className={`p-2 border text-left space-y-1 ${
                        d.analysis.isOverloaded
                          ? "border-[var(--status-overload)] bg-[var(--status-overload-bg)]"
                          : pct >= 80
                          ? "border-[var(--status-complete)] bg-[var(--status-complete-bg)]"
                          : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                      }`}
                    >
                      <div className="font-mono-tabular type-2xs text-[var(--ink-secondary)]">
                        {d.labelShort}
                      </div>
                      <div className="font-mono-tabular type-sm font-semibold text-[var(--ink-primary)]">
                        {isFuture ? "—" : `${pct}%`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lista das Frentes Cadastradas no Edital */}
              <div className="space-y-1.5 pt-2 border-t border-[var(--border-hairline)]">
                <div className="font-mono-tabular type-2xs font-semibold text-[var(--ink-muted)]">
                  FRENTES PRIORITÁRIAS MONITORADAS ({topics.length})
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-[var(--border-hairline)] border border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
                  {topics.map((top) => (
                    <div
                      key={top.id}
                      className="px-3 py-2 flex items-center justify-between gap-2 type-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-mono-tabular type-2xs text-[var(--ink-muted)]">
                          [{top.disciplineId}] {top.front}
                        </div>
                        <div className="font-medium text-[var(--ink-primary)] truncate">
                          {top.name}
                        </div>
                      </div>
                      <span
                        className={`font-mono-tabular type-2xs px-1.5 py-0.5 border shrink-0 ${
                          top.status === "MASTERED"
                            ? "border-[var(--status-complete)] bg-[var(--status-complete-bg)] text-[var(--status-complete)]"
                            : "border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--ink-secondary)]"
                        }`}
                      >
                        {top.status === "MASTERED" ? "CONSOLIDADO" : "EM CURSO"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
