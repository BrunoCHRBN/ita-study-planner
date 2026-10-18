"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  CheckSquare,
  Sliders,
  BarChart2,
  Terminal,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Check,
  X,
  RotateCcw,
  Clock,
  Database,
  ChevronRight,
} from "lucide-react";
import {
  applyScheduleDiffAction,
  resetDemoDatabaseAction,
  ScheduleDiffOperation,
} from "@/app/actions";
import type { AssistantResponsePayload } from "@/lib/ai/assistant-engine";

interface AppShellProps {
  children: React.ReactNode;
  summary: {
    todayFormatted: string;
    todayPlannedStr: string;
    todayCompletedStr: string;
    todayPercent: number;
    nextSessionTitle: string | null;
    nextSessionDiscipline: string | null;
    overloadedDaysCount: number;
    overdueReviewsCount: number;
    todayReviewsCount: number;
  };
}

export function AppShell({ children, summary }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [assistantOpen, setAssistantOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");

  const [promptInput, setPromptInput] = useState("");
  const [preferHighReasoning, setPreferHighReasoning] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AssistantResponsePayload | null>(
    null
  );
  const [diffAppliedBanner, setDiffAppliedBanner] = useState<string | null>(
    null
  );

  // Atalhos globais Desktop-First: Ctrl+K (Command Palette), Ctrl+J (Assistente IA), Esc (Fechar)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAssistantOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
      } else if (e.altKey && e.key === "1") {
        e.preventDefault();
        router.push("/");
      } else if (e.altKey && e.key === "2") {
        e.preventDefault();
        router.push("/semanal");
      } else if (e.altKey && e.key === "3") {
        e.preventDefault();
        router.push("/rotina");
      } else if (e.altKey && e.key === "4") {
        e.preventDefault();
        router.push("/evolucao");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paletteOpen, router]);

  // Escuta eventos disparados pelas telas internas para acionar o Assistente IA diretamente
  useEffect(() => {
    function handleTriggerAssistant(e: Event) {
      const custom = e as CustomEvent<{
        actionType?:
          | "RESOLVE_OVERLOAD"
          | "REBALANCE_TODAY"
          | "DRAIN_OVERDUE_REVIEWS"
          | "CUSTOM";
        prompt?: string;
      }>;
      setAssistantOpen(true);
      triggerAssistantCall({
        actionType: custom.detail?.actionType || "CUSTOM",
        prompt: custom.detail?.prompt || "",
      });
    }
    window.addEventListener("ita:trigger-assistant", handleTriggerAssistant);
    return () =>
      window.removeEventListener(
        "ita:trigger-assistant",
        handleTriggerAssistant
      );
  });

  async function triggerAssistantCall(params: {
    actionType:
      | "RESOLVE_OVERLOAD"
      | "REBALANCE_TODAY"
      | "DRAIN_OVERDUE_REVIEWS"
      | "CUSTOM";
    prompt?: string;
  }) {
    setAiLoading(true);
    setDiffAppliedBanner(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: params.actionType,
          prompt: params.prompt || promptInput,
          preferHighReasoning,
        }),
      });
      const data = await res.json();
      setAiResponse(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  }

  function handleApplyProposal(ops: ScheduleDiffOperation[]) {
    startTransition(async () => {
      const res = await applyScheduleDiffAction(ops);
      if (res.ok) {
        setDiffAppliedBanner(
          `${res.appliedCount} ajuste(s) gravados com sucesso no PostgreSQL.`
        );
        setAiResponse((prev) =>
          prev ? { ...prev, proposal: undefined } : null
        );
        router.refresh();
      }
    });
  }

  function handleResetDemo() {
    startTransition(async () => {
      await resetDemoDatabaseAction();
      setDiffAppliedBanner("Base de demonstração ITA restaurada.");
      router.refresh();
    });
  }

  const navItems = [
    {
      num: "01",
      label: "Hoje",
      sub: "Próxima sessão, tarefas e revisões",
      href: "/",
      icon: CheckSquare,
      badge:
        summary.todayReviewsCount > 0 ? `${summary.todayReviewsCount} rev` : null,
      badgeTone: "neutral" as const,
    },
    {
      num: "02",
      label: "Planejamento semanal",
      sub: "Grade horária, pausas e sobrecarga",
      href: "/semanal",
      icon: Calendar,
      badge:
        summary.overloadedDaysCount > 0
          ? `${summary.overloadedDaysCount} sobrecarga`
          : null,
      badgeTone: "overload" as const,
    },
    {
      num: "03",
      label: "Minha rotina",
      sub: "Disponibilidade, limites e prioridades",
      href: "/rotina",
      icon: Sliders,
      badge: null,
      badgeTone: "neutral" as const,
    },
    {
      num: "04",
      label: "Evolução",
      sub: "Horas realizadas, matérias e consistência",
      href: "/evolucao",
      icon: BarChart2,
      badge:
        summary.overdueReviewsCount > 0
          ? `${summary.overdueReviewsCount} atraso`
          : null,
      badgeTone: "warning" as const,
    },
  ];

  const paletteActions = [
    {
      id: "nav-hoje",
      label: "Ir para 01. Hoje (Mesa de Operação Diária)",
      shortcut: "Alt+1",
      run: () => router.push("/"),
    },
    {
      id: "nav-semanal",
      label: "Ir para 02. Planejamento semanal (Grade e Sobrecarga)",
      shortcut: "Alt+2",
      run: () => router.push("/semanal"),
    },
    {
      id: "nav-rotina",
      label: "Ir para 03. Minha rotina (Regras e Prioridades ITA)",
      shortcut: "Alt+3",
      run: () => router.push("/rotina"),
    },
    {
      id: "nav-evolucao",
      label: "Ir para 04. Evolução (Horas Realizadas e Consistência)",
      shortcut: "Alt+4",
      run: () => router.push("/evolucao"),
    },
    {
      id: "ai-overload",
      label: "Assistente IA: Resolver sobrecarga da semana atual",
      shortcut: "IA",
      run: () => {
        setAssistantOpen(true);
        triggerAssistantCall({ actionType: "RESOLVE_OVERLOAD" });
      },
    },
    {
      id: "ai-today",
      label: "Assistente IA: Reajustar blocos restantes de hoje",
      shortcut: "IA",
      run: () => {
        setAssistantOpen(true);
        triggerAssistantCall({ actionType: "REBALANCE_TODAY" });
      },
    },
    {
      id: "ai-reviews",
      label: "Assistente IA: Encaixar revisões atrasadas na semana",
      shortcut: "IA",
      run: () => {
        setAssistantOpen(true);
        triggerAssistantCall({ actionType: "DRAIN_OVERDUE_REVIEWS" });
      },
    },
    {
      id: "db-reset",
      label: "Sistema: Restaurar dados iniciais de demonstração no PostgreSQL",
      shortcut: "DB",
      run: () => handleResetDemo(),
    },
  ].filter((a) =>
    a.label.toLowerCase().includes(paletteQuery.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden select-none bg-[var(--bg-canvas)] text-[var(--ink-primary)]">
      {/* Barra Superior Editorial Fixa (40px) */}
      <header className="h-10 shrink-0 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono-tabular type-xs font-semibold px-1.5 py-0.5 border border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--ink-primary)]">
            ITA · 2027
          </span>
          <span className="type-sm font-medium text-[var(--ink-primary)]">
            Caderno de Engenharia & Planejamento de Estudos
          </span>
          <span className="text-[var(--border-strong)]">|</span>
          <span className="type-sm text-[var(--ink-secondary)]">
            {summary.todayFormatted}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="h-7 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] type-sm text-[var(--ink-secondary)] flex items-center gap-2 rounded-[var(--radius-sm)] cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
            <span>Comandos</span>
            <kbd className="font-mono-tabular type-2xs px-1 border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-muted)]">
              Ctrl+K
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => setAssistantOpen((prev) => !prev)}
            className={`h-7 px-2.5 border type-sm flex items-center gap-1.5 rounded-[var(--radius-sm)] cursor-pointer ${
              assistantOpen
                ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--ink-on-accent)]"
                : "border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Assistente IA</span>
            <kbd
              className={`font-mono-tabular type-2xs px-1 border ${
                assistantOpen
                  ? "border-white/30 text-white/90"
                  : "border-[var(--border-hairline)] text-[var(--ink-muted)]"
              }`}
            >
              Ctrl+J
            </kbd>
          </button>
        </div>
      </header>

      {/* Corpo Central: Sidebar Esquerda + Painel Principal (Scroll) + Gaveta IA Direita */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar de Navegação (236px) */}
        <aside className="w-[236px] shrink-0 border-r border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col justify-between">
          <div className="p-3 space-y-4">
            <div className="px-2 pt-1 pb-2 border-b border-[var(--border-hairline)]">
              <div className="type-2xs font-mono-tabular text-[var(--ink-muted)]">
                NAVEGAÇÃO ESTRUTURAL
              </div>
              <div className="font-editorial type-lg text-[var(--ink-primary)] leading-tight mt-0.5">
                Ciclo Preparatório
              </div>
            </div>

            <nav className="space-y-1" aria-label="Visões principais">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-2.5 py-2 rounded-[var(--radius-sm)] border transition-colors ${
                      isActive
                        ? "border-[var(--accent-primary)] bg-[var(--bg-card)] text-[var(--ink-primary)]"
                        : "border-transparent hover:bg-[var(--bg-hover)] text-[var(--ink-secondary)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono-tabular type-xs font-semibold ${
                            isActive
                              ? "text-[var(--accent-primary)]"
                              : "text-[var(--ink-muted)]"
                          }`}
                        >
                          {item.num}.
                        </span>
                        <Icon
                          className={`w-3.5 h-3.5 ${
                            isActive
                              ? "text-[var(--accent-primary)]"
                              : "text-[var(--ink-muted)]"
                          }`}
                        />
                        <span className="type-base font-medium text-[var(--ink-primary)]">
                          {item.label}
                        </span>
                      </div>

                      {item.badge && (
                        <span
                          className={`font-mono-tabular type-2xs px-1.5 py-0.5 rounded-[var(--radius-xs)] border ${
                            item.badgeTone === "overload"
                              ? "border-[var(--status-overload)] bg-[var(--status-overload-bg)] text-[var(--status-overload)] font-medium"
                              : item.badgeTone === "warning"
                              ? "border-[var(--status-warning)] bg-[var(--status-warning-bg)] text-[var(--status-warning)] font-medium"
                              : "border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--ink-secondary)]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="type-xs text-[var(--ink-muted)] mt-0.5 pl-5 line-clamp-1">
                      {item.sub}
                    </p>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Resumo Operacional no Rodapé da Sidebar */}
          <div className="p-3 border-t border-[var(--border-hairline)] space-y-3 bg-[var(--bg-canvas)]/50">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between type-xs">
                <span className="text-[var(--ink-secondary)]">
                  Execução Diária
                </span>
                <span className="font-mono-tabular font-medium text-[var(--ink-primary)]">
                  {summary.todayCompletedStr} / {summary.todayPlannedStr}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[var(--border-hairline)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent-primary)]"
                  style={{
                    width: `${Math.min(100, Math.max(0, summary.todayPercent))}%`,
                  }}
                />
              </div>
            </div>

            {summary.overloadedDaysCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setAssistantOpen(true);
                  triggerAssistantCall({ actionType: "RESOLVE_OVERLOAD" });
                }}
                className="w-full text-left p-2 border border-[var(--status-overload)] bg-[var(--status-overload-bg)] rounded-[var(--radius-sm)] cursor-pointer hover:opacity-90"
              >
                <div className="flex items-center justify-between type-xs font-medium text-[var(--status-overload)]">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {summary.overloadedDaysCount} dia com sobrecarga
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
                <div className="type-2xs text-[var(--ink-secondary)] mt-0.5">
                  Clique para rebalancear com IA
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetDemo}
              disabled={isPending}
              className="w-full h-7 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] type-xs text-[var(--ink-secondary)] flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restaurar Base Demo</span>
            </button>
          </div>
        </aside>

        {/* Painel Central de Conteúdo (Única área com rolagem independente) */}
        <main className="flex-1 min-w-0 overflow-y-auto select-text bg-[var(--bg-canvas)]">
          {children}
        </main>

        {/* Painel Lateral Retrátil do Assistente de IA (355px) */}
        {assistantOpen && (
          <aside className="w-[355px] shrink-0 border-l border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col h-full select-text">
            <div className="p-3 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[var(--bg-card)]">
              <div>
                <div className="type-2xs font-mono-tabular text-[var(--ink-muted)]">
                  COORDENADOR ALGORÍTMICO · GEMINI API
                </div>
                <h2 className="font-editorial type-lg text-[var(--ink-primary)]">
                  Assistente de Planejamento ITA
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAssistantOpen(false)}
                className="p-1 text-[var(--ink-muted)] hover:text-[var(--ink-primary)] cursor-pointer"
                title="Fechar painel (Ctrl+J)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Seletor de Modelo Gemini (3.8 Flash vs 4 Argon) */}
            <div className="px-3 py-2 border-b border-[var(--border-hairline)] flex items-center justify-between type-xs">
              <span className="text-[var(--ink-secondary)]">Motor ativo:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPreferHighReasoning(false)}
                  className={`px-2 py-0.5 border font-mono-tabular type-2xs rounded-[var(--radius-xs)] cursor-pointer ${
                    !preferHighReasoning
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--ink-on-accent)]"
                      : "border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--ink-secondary)]"
                  }`}
                >
                  gemini-3.8-flash
                </button>
                <button
                  type="button"
                  onClick={() => setPreferHighReasoning(true)}
                  className={`px-2 py-0.5 border font-mono-tabular type-2xs rounded-[var(--radius-xs)] cursor-pointer ${
                    preferHighReasoning
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--ink-on-accent)]"
                      : "border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--ink-secondary)]"
                  }`}
                >
                  gemini-4-argon
                </button>
              </div>
            </div>

            {/* Ações Táticas Rápidas */}
            <div className="p-3 border-b border-[var(--border-hairline)] space-y-1.5">
              <div className="type-xs font-medium text-[var(--ink-secondary)]">
                Operações de Reescalonamento (1-Clique)
              </div>
              <button
                type="button"
                disabled={aiLoading}
                onClick={() =>
                  triggerAssistantCall({ actionType: "RESOLVE_OVERLOAD" })
                }
                className="w-full text-left px-2.5 py-1.5 border border-[var(--border-strong)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] rounded-[var(--radius-sm)] type-sm flex items-center justify-between cursor-pointer"
              >
                <span>1. Resolver sobrecarga na grade semanal</span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
              </button>
              <button
                type="button"
                disabled={aiLoading}
                onClick={() =>
                  triggerAssistantCall({ actionType: "REBALANCE_TODAY" })
                }
                className="w-full text-left px-2.5 py-1.5 border border-[var(--border-strong)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] rounded-[var(--radius-sm)] type-sm flex items-center justify-between cursor-pointer"
              >
                <span>2. Imprevisto hoje: reajustar blocos restantes</span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
              </button>
              <button
                type="button"
                disabled={aiLoading}
                onClick={() =>
                  triggerAssistantCall({ actionType: "DRAIN_OVERDUE_REVIEWS" })
                }
                className="w-full text-left px-2.5 py-1.5 border border-[var(--border-strong)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] rounded-[var(--radius-sm)] type-sm flex items-center justify-between cursor-pointer"
              >
                <span>3. Encaixar revisões atrasadas na semana</span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--ink-muted)]" />
              </button>
            </div>

            {/* Área de Resposta e Proposta de Diff */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {diffAppliedBanner && (
                <div className="p-2.5 border border-[var(--status-complete)] bg-[var(--status-complete-bg)] text-[var(--status-complete)] type-sm flex items-center gap-2 rounded-[var(--radius-sm)]">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{diffAppliedBanner}</span>
                </div>
              )}

              {aiLoading ? (
                <div className="p-4 border border-[var(--border-hairline)] bg-[var(--bg-card)] space-y-2">
                  <div className="font-mono-tabular type-xs text-[var(--ink-muted)]">
                    ANALISANDO RESTRIÇÕES NO POSTGRESQL...
                  </div>
                  <div className="h-3 bg-[var(--border-hairline)] w-3/4" />
                  <div className="h-3 bg-[var(--border-hairline)] w-full" />
                  <div className="h-3 bg-[var(--border-hairline)] w-5/6" />
                </div>
              ) : aiResponse ? (
                <div className="space-y-3">
                  <div className="p-3 border border-[var(--border-strong)] bg-[var(--bg-card)] space-y-2 rounded-[var(--radius-sm)]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-tabular type-2xs text-[var(--ink-muted)]">
                        DIAGNÓSTICO DO COORDENADOR
                      </span>
                      <span className="font-mono-tabular type-2xs px-1.5 py-0.5 border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
                        {aiResponse.mode === "GEMINI_LIVE"
                          ? aiResponse.modelUsed
                          : "Solver Determinístico"}
                      </span>
                    </div>
                    <h3 className="font-editorial type-lg text-[var(--ink-primary)] leading-snug">
                      {aiResponse.headline}
                    </h3>
                    <p className="type-sm text-[var(--ink-secondary)] leading-relaxed">
                      {aiResponse.analysis}
                    </p>
                  </div>

                  {aiResponse.proposal &&
                    aiResponse.proposal.operations.length > 0 && (
                      <div className="p-3 border border-[var(--accent-primary)] bg-[var(--bg-card)] space-y-3 rounded-[var(--radius-sm)]">
                        <div>
                          <div className="font-mono-tabular type-2xs font-semibold text-[var(--accent-primary)]">
                            PROPOSTA DE DIFF NA GRADE ({aiResponse.proposal.operations.length}{" "}
                            OPERAÇÕES)
                          </div>
                          <div className="type-base font-semibold text-[var(--ink-primary)] mt-0.5">
                            {aiResponse.proposal.title}
                          </div>
                          <p className="type-xs text-[var(--ink-secondary)] mt-0.5">
                            {aiResponse.proposal.rationale}
                          </p>
                        </div>

                        <div className="space-y-2 border-t border-[var(--border-hairline)] pt-2">
                          {aiResponse.proposal.operations.map((op, i) => (
                            <div
                              key={i}
                              className="p-2 border border-[var(--border-hairline)] bg-[var(--bg-surface)] type-xs space-y-1"
                            >
                              <div className="flex items-center justify-between font-mono-tabular">
                                <span className="font-semibold text-[var(--accent-primary)]">
                                  [{op.op}] · [{op.disciplineId}]
                                </span>
                                <span>{ op.plannedMinutes }m</span>
                              </div>
                              <div className="font-medium text-[var(--ink-primary)]">
                                {op.title}
                              </div>
                              {op.fromDate && (
                                <div className="font-mono-tabular type-2xs text-[var(--ink-muted)]">
                                  De: {op.fromDate} ({op.fromStart}–{op.fromEnd})
                                </div>
                              )}
                              <div className="font-mono-tabular type-2xs text-[var(--status-complete)] font-medium">
                                Para: {op.toDate} ({op.toStart}–{op.toEnd})
                              </div>
                              <div className="type-2xs text-[var(--ink-secondary)]">
                                {op.reason}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              handleApplyProposal(
                                aiResponse.proposal!.operations
                              )
                            }
                            className="flex-1 h-8 px-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--ink-on-accent)] type-sm font-medium flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Aplicar Alterações</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAiResponse({
                                ...aiResponse,
                                proposal: undefined,
                              })
                            }
                            className="h-8 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] type-sm text-[var(--ink-secondary)] rounded-[var(--radius-sm)] cursor-pointer"
                          >
                            Descartar
                          </button>
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="p-3 border border-[var(--border-hairline)] bg-[var(--bg-card)] type-sm text-[var(--ink-secondary)] space-y-2 rounded-[var(--radius-sm)]">
                  <div className="font-mono-tabular type-2xs text-[var(--ink-muted)]">
                    ESTADO ATUAL DA SEMANA
                  </div>
                  <p>
                    O assistente monitora sua grade semanal contra as regras de{" "}
                    <strong>Minha rotina</strong>. Nenhuma alteração é feita no
                    PostgreSQL sem sua aprovação explícita no card de Diff.
                  </p>
                  <ul className="space-y-1 type-xs font-mono-tabular pt-1 border-t border-[var(--border-hairline)]">
                    <li>
                      • Dias com sobrecarga: {summary.overloadedDaysCount}
                    </li>
                    <li>
                      • Revisões em atraso: {summary.overdueReviewsCount}
                    </li>
                    <li>
                      • Revisões para hoje: {summary.todayReviewsCount}
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Input de Comando em Linguagem Natural */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!promptInput.trim()) return;
                triggerAssistantCall({
                  actionType: "CUSTOM",
                  prompt: promptInput,
                });
              }}
              className="p-3 border-t border-[var(--border-hairline)] bg-[var(--bg-card)] space-y-2"
            >
              <label
                htmlFor="assistant-prompt"
                className="block type-xs font-medium text-[var(--ink-secondary)]"
              >
                Solicitação personalizada ao Coordenador IA
              </label>
              <textarea
                id="assistant-prompt"
                rows={2}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="Ex: Tive imprevisto à tarde, mova Polinômios para sexta..."
                className="w-full p-2 type-sm border border-[var(--border-strong)] bg-[var(--bg-canvas)] text-[var(--ink-primary)] rounded-[var(--radius-sm)] resize-none"
              />
              <button
                type="submit"
                disabled={aiLoading || !promptInput.trim()}
                className="w-full h-8 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--ink-on-accent)] type-sm font-medium rounded-[var(--radius-sm)] cursor-pointer"
              >
                Gerar Diagnóstico & Proposta
              </button>
            </form>
          </aside>
        )}
      </div>

      {/* Barra de Status Inferior Desktop (26px) */}
      <footer className="h-[26px] shrink-0 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 flex items-center justify-between type-xs text-[var(--ink-secondary)] font-mono-tabular">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[var(--status-complete)]">
            <Database className="w-3 h-3" />
            <span>PostgreSQL 16 · Conectado</span>
          </span>
          <span>|</span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-[var(--ink-muted)]" />
            <span>
              Próxima:{" "}
              {summary.nextSessionTitle
                ? `[${summary.nextSessionDiscipline}] ${summary.nextSessionTitle}`
                : "Expediente diário concluído"}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span>
            Hoje: {summary.todayCompletedStr} / {summary.todayPlannedStr} (
            {summary.todayPercent}%)
          </span>
          <span>|</span>
          <span className="text-[var(--ink-muted)]">
            Atalhos: Alt+1..4 Visões · Ctrl+K Comandos · Ctrl+J IA
          </span>
        </div>
      </footer>

      {/* Modal Command Palette (Ctrl+K) */}
      {paletteOpen && (
        <div
          className="fixed inset-0 z-50 modal-scrim flex items-start justify-center pt-20"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-[540px] border border-[var(--border-strong)] bg-[var(--bg-card)] rounded-[var(--radius-md)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-[var(--border-hairline)] flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[var(--ink-muted)]" />
              <input
                type="text"
                autoFocus
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Digite um comando ou navegue para uma tela (Esc para fechar)..."
                className="flex-1 bg-transparent type-base text-[var(--ink-primary)] focus-visible:outline-2"
              />
              <kbd className="font-mono-tabular type-2xs px-1.5 py-0.5 border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-muted)]">
                ESC
              </kbd>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-hairline)]">
              {paletteActions.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    setPaletteOpen(false);
                    act.run();
                  }}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--bg-hover)] flex items-center justify-between type-sm cursor-pointer"
                >
                  <span className="text-[var(--ink-primary)] font-medium">
                    {act.label}
                  </span>
                  <kbd className="font-mono-tabular type-2xs px-1.5 py-0.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--ink-secondary)]">
                    {act.shortcut}
                  </kbd>
                </button>
              ))}
              {paletteActions.length === 0 && (
                <div className="p-4 text-left type-sm text-[var(--ink-muted)]">
                  Nenhum comando correspondente.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
