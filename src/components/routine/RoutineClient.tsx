"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Plus,
  Trash2,
  Check,
  Sliders,
  CalendarOff,
  Clock,
  Layers,
} from "lucide-react";
import {
  Discipline,
  RoutineConfig,
  RoutineSlot,
  RoutineException,
} from "@/db/schema";
import {
  updateRoutineConfigAction,
  updateDisciplinePriorityAction,
  createRoutineSlotAction,
  deleteRoutineSlotAction,
  createRoutineExceptionAction,
  deleteRoutineExceptionAction,
} from "@/app/actions";
import { formatMinutes } from "@/lib/date-utils";

interface RoutineClientProps {
  todayIso: string;
  config: RoutineConfig;
  disciplines: Discipline[];
  slots: RoutineSlot[];
  exceptions: RoutineException[];
}

export function RoutineClient({
  todayIso,
  config,
  disciplines,
  slots,
  exceptions,
}: RoutineClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Estado dos limites de estudo e preferências
  const [maxDaily, setMaxDaily] = useState(config.maxDailyMinutes);
  const [maxWeekly, setMaxWeekly] = useState(config.maxWeeklyMinutes);
  const [defaultBlock, setDefaultBlock] = useState(config.defaultBlockMinutes);
  const [maxContinuous, setMaxContinuous] = useState(
    config.maxContinuousMinutes
  );
  const [minBreak, setMinBreak] = useState(config.minBreakMinutes);
  const [maxSingleSubject, setMaxSingleSubject] = useState(
    config.maxSingleSubjectDailyMinutes
  );
  const [minBuffer, setMinBuffer] = useState(config.minDailyBufferMinutes);
  const [distPreference, setDistPreference] = useState(
    config.distributionPreference
  );

  // Estado local das disciplinas (pesos, metas e turnos)
  const [discState, setDiscState] = useState(
    disciplines.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      priorityWeight: d.priorityWeight,
      targetWeeklyMinutes: d.targetWeeklyMinutes,
      preferredShift: d.preferredShift,
      accentTone: d.accentTone,
    }))
  );

  // Filtro de dia da semana na matriz de disponibilidade
  const [activeDayFilter, setActiveDayFilter] = useState<number>(1); // 1 = Segunda
  const [newSlotDay, setNewSlotDay] = useState<number>(1);
  const [newSlotStart, setNewSlotStart] = useState("08:00");
  const [newSlotEnd, setNewSlotEnd] = useState("12:00");
  const [newSlotType, setNewSlotType] = useState("AVAILABLE_STUDY");
  const [newSlotTitle, setNewSlotTitle] = useState("");

  // Formulário de nova exceção
  const [excDate, setExcDate] = useState(todayIso);
  const [excStart, setExcStart] = useState("14:00");
  const [excEnd, setExcEnd] = useState("18:00");
  const [excType, setExcType] = useState("BLOCKED");
  const [excReason, setExcReason] = useState("");

  const dayNames = [
    { dow: 1, short: "Seg", full: "Segunda-feira" },
    { dow: 2, short: "Ter", full: "Terça-feira" },
    { dow: 3, short: "Qua", full: "Quarta-feira" },
    { dow: 4, short: "Qui", full: "Quinta-feira" },
    { dow: 5, short: "Sex", full: "Sexta-feira" },
    { dow: 6, short: "Sáb", full: "Sábado" },
    { dow: 0, short: "Dom", full: "Domingo" },
  ];

  function handleSaveLimits(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateRoutineConfigAction({
        maxDailyMinutes: maxDaily,
        maxWeeklyMinutes: maxWeekly,
        defaultBlockMinutes: defaultBlock,
        maxContinuousMinutes: maxContinuous,
        minBreakMinutes: minBreak,
        maxSingleSubjectDailyMinutes: maxSingleSubject,
        minDailyBufferMinutes: minBuffer,
        distributionPreference: distPreference,
      });
      setSavedBanner(
        "Limites de estudo e regras de distribuição salvos no PostgreSQL."
      );
      router.refresh();
    });
  }

  function handleSaveDisciplines() {
    startTransition(async () => {
      for (const d of discState) {
        await updateDisciplinePriorityAction({
          id: d.id,
          priorityWeight: d.priorityWeight,
          targetWeeklyMinutes: d.targetWeeklyMinutes,
          preferredShift: d.preferredShift,
        });
      }
      setSavedBanner("Pesos e metas semanais da matriz ITA atualizados.");
      router.refresh();
    });
  }

  function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!newSlotTitle.trim()) return;
    startTransition(async () => {
      await createRoutineSlotAction({
        dayOfWeek: newSlotDay,
        startTime: newSlotStart,
        endTime: newSlotEnd,
        slotType: newSlotType,
        title: newSlotTitle.trim(),
      });
      setNewSlotTitle("");
      setActiveDayFilter(newSlotDay);
      router.refresh();
    });
  }

  function handleAddException(e: React.FormEvent) {
    e.preventDefault();
    if (!excReason.trim()) return;
    startTransition(async () => {
      await createRoutineExceptionAction({
        exceptionDate: excDate,
        startTime: excStart,
        endTime: excEnd,
        exceptionType: excType,
        reason: excReason.trim(),
      });
      setExcReason("");
      router.refresh();
    });
  }

  const totalDisciplineTarget = discState.reduce(
    (acc, d) => acc + d.targetWeeklyMinutes,
    0
  );

  const filteredSlots = slots.filter((s) => s.dayOfWeek === activeDayFilter);

  return (
    <div className="p-6 max-w-[1380px] mx-auto space-y-6">
      {/* Cabeçalho Editorial da Tela 03. Minha rotina */}
      <section className="border-b border-[var(--border-strong)] pb-4 flex items-end justify-between gap-4">
        <div>
          <div className="font-mono-tabular type-xs text-[var(--ink-muted)]">
            03. MINHA ROTINA · PARÂMETROS E RESTRIÇÕES DO CRONOGRAMA
          </div>
          <h1 className="font-editorial type-2xl text-[var(--ink-primary)] leading-tight mt-0.5">
            Engenharia da Rotina e Limites Operacionais
          </h1>
          <p className="type-base text-[var(--ink-secondary)] mt-1">
            Defina sua disponibilidade recorrente, exceções de calendário,
            tetos de carga e prioridades por disciplina do ITA.
          </p>
        </div>

        {savedBanner && (
          <div className="px-3 py-2 border border-[var(--status-complete)] bg-[var(--status-complete-bg)] text-[var(--status-complete)] type-sm flex items-center gap-2 rounded-[var(--radius-sm)]">
            <Check className="w-4 h-4" />
            <span>{savedBanner}</span>
          </div>
        )}
      </section>

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda (6 cols): Limites de Estudo + Prioridades por Disciplina */}
        <div className="col-span-6 space-y-6">
          {/* Painel 1: Limites de Estudo & Preferências de Distribuição */}
          <form
            onSubmit={handleSaveLimits}
            className="border border-[var(--border-hairline)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[var(--accent-primary)]" />
                <div>
                  <h2 className="font-editorial type-lg text-[var(--ink-primary)]">
                    Limites de Estudo e Preferências de Distribuição
                  </h2>
                  <p className="type-xs text-[var(--ink-secondary)]">
                    Parâmetros usados para detectar sobrecarga na grade semanal
                  </p>
                </div>
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="h-8 px-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--ink-on-accent)] type-sm font-medium flex items-center gap-1.5 rounded-[var(--radius-sm)] cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Limites</span>
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block type-xs font-medium text-[var(--ink-primary)] mb-1">
                    Limite Máximo Diário (min) · Atual:{" "}
                    <span className="font-mono-tabular text-[var(--accent-primary)]">
                      {formatMinutes(maxDaily)}
                    </span>
                  </label>
                  <input
                    type="number"
                    step={15}
                    min={60}
                    max={720}
                    value={maxDaily}
                    onChange={(e) => setMaxDaily(Number(e.target.value))}
                    className="w-full h-8 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] font-mono-tabular type-sm"
                  />
                </div>

                <div>
                  <label className="block type-xs font-medium text-[var(--ink-primary)] mb-1">
                    Limite Máximo Semanal (min) · Atual:{" "}
                    <span className="font-mono-tabular text-[var(--accent-primary)]">
                      {formatMinutes(maxWeekly)}
                    </span>
                  </label>
                  <input
                    type="number"
                    step={30}
                    min={300}
                    max={3600}
                    value={maxWeekly}
                    onChange={(e) => setMaxWeekly(Number(e.target.value))}
                    className="w-full h-8 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] font-mono-tabular type-sm"
                  />
                </div>

                <div>
                  <label className="block type-xs font-medium text-[var(--ink-primary)] mb-1">
                    Duração Padrão de Bloco (min)
                  </label>
                  <input
                    type="number"
                    step={15}
                    min={30}
                    max={240}
                    value={defaultBlock}
                    onChange={(e) => setDefaultBlock(Number(e.target.value))}
                    className="w-full h-8 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] font-mono-tabular type-sm"
                  />
                </div>

                <div>
                  <label className="block type-xs font-medium text-[var(--ink-primary)] mb-1">
                    Turno Contínuo Máx. s/ Pausa (min)
                  </label>
                  <input
                    type="number"
                    step={15}
                    min={60}
                    max={300}
                    value={maxContinuous}
                    onChange={(e) => setMaxContinuous(Number(e.target.value))}
                    className="w-full h-8 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] font-mono-tabular type-sm"
                  />
                </div>

                <div>
                  <label className="block type-xs font-medium text-[var(--ink-primary)] mb-1">
                    Pausa Obrigatória Entre Blocos (min)
                  </label>
                  <input
                    type="number"
                    step={5}
                    min={5}
                    max={60}
                    value={minBreak}
                    onChange={(e) => setMinBreak(Number(e.target.value))}
                    className="w-full h-8 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] font-mono-tabular type-sm"
                  />
                </div>

                <div>
                  <label className="block type-xs font-medium text-[var(--ink-primary)] mb-1">
                    Teto de Uma Mesma Matéria/Dia (min)
                  </label>
                  <input
                    type="number"
                    step={15}
                    min={60}
                    max={480}
                    value={maxSingleSubject}
                    onChange={(e) =>
                      setMaxSingleSubject(Number(e.target.value))
                    }
                    className="w-full h-8 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] font-mono-tabular type-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block type-xs font-medium text-[var(--ink-primary)] mb-1">
                  Preferências de Distribuição Cognitiva (Instrução para o
                  Assistente de IA)
                </label>
                <textarea
                  rows={3}
                  value={distPreference}
                  onChange={(e) => setDistPreference(e.target.value)}
                  className="w-full p-2.5 border border-[var(--border-strong)] bg-[var(--bg-canvas)] type-sm leading-relaxed"
                />
              </div>
            </div>
          </form>

          {/* Painel 2: Prioridades e Metas por Disciplina (Matriz ITA) */}
          <div className="border border-[var(--border-hairline)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
                <div>
                  <h2 className="font-editorial type-lg text-[var(--ink-primary)]">
                    Prioridades e Distribuição por Disciplina (ITA)
                  </h2>
                  <p className="type-xs text-[var(--ink-secondary)]">
                    Soma das metas semanais:{" "}
                    <strong className="font-mono-tabular">
                      {formatMinutes(totalDisciplineTarget)}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveDisciplines}
                className="h-8 px-3 border border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--ink-on-accent)] type-sm font-medium flex items-center gap-1.5 rounded-[var(--radius-sm)] cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Pesos</span>
              </button>
            </div>

            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/60 font-mono-tabular type-2xs text-[var(--ink-secondary)]">
                  <th className="py-2 px-3">DISCIPLINA</th>
                  <th className="py-2 px-2">PESO (1–10)</th>
                  <th className="py-2 px-2">META SEMANAL (MIN)</th>
                  <th className="py-2 px-3">TURNO PREFERENCIAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)] type-sm">
                {discState.map((d, idx) => (
                  <tr key={d.id}>
                    <td className="py-2.5 px-3 font-medium">
                      <span className="font-mono-tabular type-2xs px-1.5 py-0.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] mr-2">
                        [{d.code}]
                      </span>
                      {d.name}
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={d.priorityWeight}
                        onChange={(e) => {
                          const next = [...discState];
                          next[idx].priorityWeight = Number(e.target.value);
                          setDiscState(next);
                        }}
                        className="w-16 h-7 px-2 border border-[var(--border-strong)] bg-[var(--bg-canvas)] font-mono-tabular type-sm"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step={30}
                          min={60}
                          max={1200}
                          value={d.targetWeeklyMinutes}
                          onChange={(e) => {
                            const next = [...discState];
                            next[idx].targetWeeklyMinutes = Number(
                              e.target.value
                            );
                            setDiscState(next);
                          }}
                          className="w-20 h-7 px-2 border border-[var(--border-strong)] bg-[var(--bg-canvas)] font-mono-tabular type-sm"
                        />
                        <span className="font-mono-tabular type-2xs text-[var(--ink-muted)]">
                          ({formatMinutes(d.targetWeeklyMinutes)})
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={d.preferredShift}
                        onChange={(e) => {
                          const next = [...discState];
                          next[idx].preferredShift = e.target.value;
                          setDiscState(next);
                        }}
                        className="w-full h-7 px-2 border border-[var(--border-strong)] bg-[var(--bg-canvas)] type-xs"
                      >
                        <option value="MORNING">Manhã (08h–12h)</option>
                        <option value="AFTERNOON">Tarde (13h–18h)</option>
                        <option value="EVENING">Noite (19h–22h)</option>
                        <option value="ANY">Flexível</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coluna Direita (6 cols): Disponibilidade Recorrente + Exceções de Calendário */}
        <div className="col-span-6 space-y-6">
          {/* Painel 3: Disponibilidade Recorrente e Compromissos Fixos */}
          <div className="border border-[var(--border-hairline)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--accent-primary)]" />
              <div>
                <h2 className="font-editorial type-lg text-[var(--ink-primary)]">
                  Disponibilidade Recorrente e Compromissos Fixos
                </h2>
                <p className="type-xs text-[var(--ink-secondary)]">
                  Janelas livres para alocação de estudo vs. horários travados
                </p>
              </div>
            </div>

            {/* Abas de Dia da Semana */}
            <div className="grid grid-cols-7 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/50">
              {dayNames.map((dn) => (
                <button
                  key={dn.dow}
                  type="button"
                  onClick={() => {
                    setActiveDayFilter(dn.dow);
                    setNewSlotDay(dn.dow);
                  }}
                  className={`py-2 font-mono-tabular type-xs border-r last:border-r-0 border-[var(--border-hairline)] cursor-pointer ${
                    activeDayFilter === dn.dow
                      ? "bg-[var(--accent-primary)] text-[var(--ink-on-accent)] font-semibold"
                      : "text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  {dn.short}
                </button>
              ))}
            </div>

            {/* Formulário de Novo Slot Recorrente */}
            <form
              onSubmit={handleAddSlot}
              className="p-3 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)] space-y-2"
            >
              <div className="grid grid-cols-5 gap-2">
                <input
                  type="time"
                  value={newSlotStart}
                  onChange={(e) => setNewSlotStart(e.target.value)}
                  className="h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] font-mono-tabular type-xs"
                />
                <input
                  type="time"
                  value={newSlotEnd}
                  onChange={(e) => setNewSlotEnd(e.target.value)}
                  className="h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] font-mono-tabular type-xs"
                />
                <select
                  value={newSlotType}
                  onChange={(e) => setNewSlotType(e.target.value)}
                  className="col-span-2 h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] type-xs"
                >
                  <option value="AVAILABLE_STUDY">Janela Livre Estudo</option>
                  <option value="FIXED_COMMITMENT">
                    Compromisso Fixo (Bloqueado)
                  </option>
                </select>
                <button
                  type="submit"
                  disabled={isPending || !newSlotTitle.trim()}
                  className="h-8 bg-[var(--accent-primary)] text-[var(--ink-on-accent)] type-xs font-medium flex items-center justify-center gap-1 rounded-[var(--radius-xs)] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>
              <input
                type="text"
                value={newSlotTitle}
                onChange={(e) => setNewSlotTitle(e.target.value)}
                placeholder="Descrição da janela (ex: Manhã Livre Exatas, Aula Turma ITA, Treino Físico)..."
                className="w-full h-8 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-card)] type-sm"
              />
            </form>

            {/* Lista de Slots do Dia Selecionado */}
            <div className="divide-y divide-[var(--border-hairline)]">
              {filteredSlots.map((sl) => (
                <div
                  key={sl.id}
                  className={`px-4 py-2.5 flex items-center justify-between ${
                    sl.slotType === "FIXED_COMMITMENT"
                      ? "pattern-fixed-slot"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono-tabular type-sm font-semibold text-[var(--ink-primary)] w-24">
                      {sl.startTime} – {sl.endTime}
                    </span>
                    <div>
                      <span
                        className={`font-mono-tabular type-2xs px-1.5 py-0.5 border mr-2 ${
                          sl.slotType === "AVAILABLE_STUDY"
                            ? "border-[var(--status-complete)] bg-[var(--status-complete-bg)] text-[var(--status-complete)]"
                            : "border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--ink-secondary)]"
                        }`}
                      >
                        {sl.slotType === "AVAILABLE_STUDY"
                          ? "JANELA LIVRE"
                          : "COMPROMISSO FIXO"}
                      </span>
                      <span className="type-sm font-medium text-[var(--ink-primary)]">
                        {sl.title}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      startTransition(() => {
                        deleteRoutineSlotAction(sl.id);
                      })
                    }
                    className="p-1 text-[var(--ink-muted)] hover:text-[var(--status-overload)] cursor-pointer"
                    title="Remover janela"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Painel 4: Exceções de Calendário (Feriados, Simulados, Imprevistos) */}
          <div className="border border-[var(--border-hairline)] bg-[var(--bg-card)] rounded-[var(--radius-sm)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center gap-2">
              <CalendarOff className="w-4 h-4 text-[var(--accent-primary)]" />
              <div>
                <h2 className="font-editorial type-lg text-[var(--ink-primary)]">
                  Exceções Pontuais de Calendário
                </h2>
                <p className="type-xs text-[var(--ink-secondary)]">
                  Datas com bloqueios médicos, viagens ou Simulados Oficiais ITA
                </p>
              </div>
            </div>

            <form
              onSubmit={handleAddException}
              className="p-3 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)] space-y-2"
            >
              <div className="grid grid-cols-5 gap-2">
                <input
                  type="date"
                  value={excDate}
                  onChange={(e) => setExcDate(e.target.value)}
                  className="col-span-2 h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] font-mono-tabular type-xs"
                />
                <input
                  type="time"
                  value={excStart}
                  onChange={(e) => setExcStart(e.target.value)}
                  className="h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] font-mono-tabular type-xs"
                />
                <input
                  type="time"
                  value={excEnd}
                  onChange={(e) => setExcEnd(e.target.value)}
                  className="h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] font-mono-tabular type-xs"
                />
                <select
                  value={excType}
                  onChange={(e) => setExcType(e.target.value)}
                  className="h-8 px-2 border border-[var(--border-strong)] bg-[var(--bg-card)] type-xs"
                >
                  <option value="BLOCKED">Indisponível</option>
                  <option value="SIMULADO">Simulado ITA</option>
                  <option value="EXTRA_AVAILABLE">Janela Extra</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={excReason}
                  onChange={(e) => setExcReason(e.target.value)}
                  placeholder="Motivo da exceção (ex: Simulado 2ª Fase Discursiva, Consulta Médica)..."
                  className="flex-1 h-8 px-2.5 border border-[var(--border-strong)] bg-[var(--bg-card)] type-sm"
                />
                <button
                  type="submit"
                  disabled={isPending || !excReason.trim()}
                  className="h-8 px-3 bg-[var(--accent-primary)] text-[var(--ink-on-accent)] type-xs font-medium rounded-[var(--radius-xs)] cursor-pointer"
                >
                  Registrar Exceção
                </button>
              </div>
            </form>

            <div className="divide-y divide-[var(--border-hairline)]">
              {exceptions.map((ex) => (
                <div
                  key={ex.id}
                  className="px-4 py-2.5 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-mono-tabular type-xs">
                      <span className="font-semibold text-[var(--ink-primary)]">
                        {ex.exceptionDate} ({ex.startTime}–{ex.endTime})
                      </span>
                      <span className="px-1.5 py-0.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] type-2xs">
                        {ex.exceptionType}
                      </span>
                    </div>
                    <div className="type-sm text-[var(--ink-secondary)]">
                      {ex.reason}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(() => {
                        deleteRoutineExceptionAction(ex.id);
                      })
                    }
                    className="p-1 text-[var(--ink-muted)] hover:text-[var(--status-overload)] cursor-pointer"
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
