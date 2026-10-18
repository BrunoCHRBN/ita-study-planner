import { GoogleGenAI } from "@google/genai";
import { getPlannerSnapshot, PlannerSnapshot } from "../planner-data";
import { ScheduleDiffOperation } from "@/app/actions";
import { formatMinutes, minutesToTime, timeToMinutes } from "../date-utils";

export interface AssistantResponsePayload {
  mode: "GEMINI_LIVE" | "DETERMINISTIC_ENGINE";
  modelUsed: string;
  headline: string;
  analysis: string;
  metricsSummary: {
    overloadedDaysCount: number;
    overdueReviewsCount: number;
    weeklyPlannedHours: string;
    weeklyLimitHours: string;
  };
  proposal?: {
    title: string;
    rationale: string;
    operations: ScheduleDiffOperation[];
  };
}

function buildDeterministicProposal(
  snapshot: PlannerSnapshot,
  intent: string
): {
  headline: string;
  analysis: string;
  proposal?: {
    title: string;
    rationale: string;
    operations: ScheduleDiffOperation[];
  };
} {
  const lower = intent.toLowerCase();
  const overloadedDays = snapshot.weekDays.filter(
    (d) => d.analysis.isOverloaded
  );
  const underloadedDays = [...snapshot.weekDays]
    .filter(
      (d) =>
        !d.analysis.isOverloaded &&
        d.dayOfWeek !== 0 &&
        d.analysis.plannedMinutes + 60 <= snapshot.config.maxDailyMinutes
    )
    .sort((a, b) => a.analysis.plannedMinutes - b.analysis.plannedMinutes);

  if (
    lower.includes("sobrecarga") ||
    lower.includes("overload") ||
    lower.includes("rebalancear") ||
    lower.includes("semana")
  ) {
    const ops: ScheduleDiffOperation[] = [];

    for (const oDay of overloadedDays) {
      const plannedSessions = oDay.sessions.filter(
        (s) => s.status === "PLANNED" || s.status === "COMPLETED"
      );
      for (let i = 1; i < plannedSessions.length; i++) {
        const prev = plannedSessions[i - 1];
        const cur = plannedSessions[i];
        const gap =
          timeToMinutes(cur.plannedStart) - timeToMinutes(prev.plannedEnd);
        if (
          gap < snapshot.config.minBreakMinutes &&
          prev.plannedMinutes + cur.plannedMinutes >
            snapshot.config.maxContinuousMinutes
        ) {
          const newStartMins =
            timeToMinutes(prev.plannedEnd) + snapshot.config.minBreakMinutes;
          const newDur = Math.max(
            60,
            cur.plannedMinutes - snapshot.config.minBreakMinutes
          );
          ops.push({
            op: "RESIZE",
            sessionId: cur.id,
            disciplineId: cur.disciplineId,
            title: cur.title,
            fromDate: cur.scheduledDate,
            fromStart: cur.plannedStart,
            fromEnd: cur.plannedEnd,
            toDate: cur.scheduledDate,
            toStart: minutesToTime(newStartMins),
            toEnd: minutesToTime(newStartMins + newDur),
            plannedMinutes: newDur,
            reason: `Inserir pausa obrigatória de ${snapshot.config.minBreakMinutes}m após "${prev.title}" para eliminar fadiga contínua.`,
          });
        }
      }

      const candidateToMove =
        [...oDay.sessions]
          .reverse()
          .find((s) => s.status === "PLANNED") ||
        oDay.sessions[oDay.sessions.length - 1];

      const targetDay =
        underloadedDays.find((ud) => ud.date !== oDay.date) ||
        snapshot.weekDays.find(
          (wd) => wd.date !== oDay.date && wd.dayOfWeek === 6
        );

      if (candidateToMove && targetDay) {
        const lastEndOnTarget = targetDay.sessions.reduce(
          (maxEnd, s) => Math.max(maxEnd, timeToMinutes(s.plannedEnd)),
          timeToMinutes("19:00")
        );
        const startSlot =
          lastEndOnTarget + 15 <= timeToMinutes("20:15")
            ? minutesToTime(lastEndOnTarget + 15)
            : "15:15";
        const endSlot = minutesToTime(
          timeToMinutes(startSlot) + candidateToMove.plannedMinutes
        );

        ops.push({
          op: "MOVE",
          sessionId: candidateToMove.id,
          disciplineId: candidateToMove.disciplineId,
          title: candidateToMove.title,
          fromDate: oDay.date,
          fromStart: candidateToMove.plannedStart,
          fromEnd: candidateToMove.plannedEnd,
          toDate: targetDay.date,
          toStart: startSlot,
          toEnd: endSlot,
          plannedMinutes: candidateToMove.plannedMinutes,
          reason: `Reduzir carga de ${oDay.labelShort} (${formatMinutes(
            oDay.analysis.plannedMinutes
          )} → dentro do teto de ${formatMinutes(
            snapshot.config.maxDailyMinutes
          )}) transferindo para janela livre em ${targetDay.labelShort}.`,
        });
      }
    }

    if (ops.length === 0) {
      return {
        headline: "Grade Semanal Dentro dos Parâmetros Operacionais",
        analysis: `Nenhum dia da semana atual viola o teto diário de ${formatMinutes(
          snapshot.config.maxDailyMinutes
        )} ou o limite de turno contínuo (${formatMinutes(
          snapshot.config.maxContinuousMinutes
        )}).`,
      };
    }

    return {
      headline: `Diagnóstico de Sobrecarga: ${overloadedDays.length} dia(s) acima do limite`,
      analysis: `Detectada violação das regras de Minha Rotina em ${overloadedDays
        .map(
          (d) => `${d.labelFull} (${formatMinutes(d.analysis.plannedMinutes)})`
        )
        .join(
          ", "
        )}. Preparei um diff cirúrgico que insere a pausa obrigatória de ${
        snapshot.config.minBreakMinutes
      }m e transfere o excesso para o dia de menor pressão cognitiva.`,
      proposal: {
        title: "Rebalanceamento de Sobrecarga e Pausas Obrigatórias",
        rationale:
          "Elimina o estouro do teto diário de 06h00 e corrige a maratona de 4h contínuas de Física sem intervalo.",
        operations: ops,
      },
    };
  }

  if (
    lower.includes("revis") ||
    lower.includes("atrasad") ||
    lower.includes("overdue") ||
    lower.includes("backlog")
  ) {
    const overdue = snapshot.overdueReviews;
    if (overdue.length === 0) {
      return {
        headline: "Backlog de Revisões Zerado",
        analysis:
          "Todas as revisões espaçadas anteriores estão em dia. Continue concluindo as revisões previstas na tela Hoje.",
      };
    }

    const ops: ScheduleDiffOperation[] = [];
    overdue.forEach((rev, idx) => {
      const targetDay =
        underloadedDays[idx % Math.max(1, underloadedDays.length)] ||
        snapshot.weekDays.find((d) => d.date === snapshot.todayIso)!;

      const slotStart = idx % 2 === 0 ? "15:15" : "20:15";
      const slotEnd = minutesToTime(
        timeToMinutes(slotStart) + rev.estimatedMinutes
      );

      ops.push({
        op: "COMPLETE_REVIEW_SCHEDULE",
        reviewId: rev.id,
        disciplineId: rev.disciplineId,
        title: `Revisão ${rev.cycleStage}: ${rev.title}`,
        toDate: targetDay.date,
        toStart: slotStart,
        toEnd: slotEnd,
        plannedMinutes: rev.estimatedMinutes,
        sessionType: "REVIEW",
        reason: `${rev.focusPrompt} (Originalmente vencida em ${rev.scheduledDate})`,
      });
    });

    return {
      headline: `Encaixe Tático de ${overdue.length} Revisão(ões) Atrasada(s)`,
      analysis: `Localizei ${overdue.length} revisões vencidas (${overdue
        .map((r) => `[${r.disciplineId}] ${r.title}`)
        .join("; ")}). Aloquei blocos curtos de ${
        overdue[0].estimatedMinutes
      }m nas janelas de fim de tarde/noite sem ultrapassar o limite diário de 06h00.`,
      proposal: {
        title: "Drenagem de Backlog de Revisões Espaçadas",
        rationale:
          "Posiciona revisões críticas em janelas de menor competição com a teoria de manhã.",
        operations: ops,
      },
    };
  }

  const pendingToday = snapshot.todaySessions.filter(
    (s) => s.status === "PLANNED"
  );
  if (pendingToday.length > 0) {
    const ops: ScheduleDiffOperation[] = [];
    const sessionToDefer = pendingToday[pendingToday.length - 1];
    const targetDay =
      underloadedDays.find((d) => d.date > snapshot.todayIso) ||
      underloadedDays[0] ||
      snapshot.weekDays[5];

    if (sessionToDefer && targetDay) {
      ops.push({
        op: "MOVE",
        sessionId: sessionToDefer.id,
        disciplineId: sessionToDefer.disciplineId,
        title: sessionToDefer.title,
        fromDate: snapshot.todayIso,
        fromStart: sessionToDefer.plannedStart,
        fromEnd: sessionToDefer.plannedEnd,
        toDate: targetDay.date,
        toStart: "15:15",
        toEnd: minutesToTime(
          timeToMinutes("15:15") + sessionToDefer.plannedMinutes
        ),
        plannedMinutes: sessionToDefer.plannedMinutes,
        reason: `Aliviar pressão do expediente de hoje preservando a Próxima Sessão prioritária ([${pendingToday[0].disciplineId}] ${pendingToday[0].title}).`,
      });
    }

    return {
      headline: "Reajuste do Expediente de Hoje",
      analysis: `Você possui ${pendingToday.length} blocos pendentes hoje (${formatMinutes(
        pendingToday.reduce((a, b) => a + b.plannedMinutes, 0)
      )} restantes). Para proteger a qualidade de execução da sua próxima sessão de [${
        pendingToday[0].disciplineId
      }], proponho transferir o último bloco do dia para ${
        targetDay.labelFull
      }, mantendo aquela data dentro do limite seguro.`,
      proposal: {
        title: "Reescalonamento de Fim de Dia Sem Efeito Cascata",
        rationale:
          "Garante foco integral nos blocos principais de hoje e realoca o bloco final em janela com folga.",
        operations: ops,
      },
    };
  }

  return {
    headline: "Análise Operacional do Ciclo ITA",
    analysis:
      "Todas as sessões planejadas para hoje já foram concluídas. Você pode adiantar uma revisão de amanhã ou revisar sua distribuição na aba Evolução.",
  };
}

export async function runStudyAssistant(params: {
  prompt: string;
  actionType?:
    | "RESOLVE_OVERLOAD"
    | "REBALANCE_TODAY"
    | "DRAIN_OVERDUE_REVIEWS"
    | "CUSTOM";
  preferHighReasoning?: boolean;
}): Promise<AssistantResponsePayload> {
  const snapshot = await getPlannerSnapshot();

  const totalWeeklyPlanned = snapshot.weekDays.reduce(
    (acc, d) => acc + d.analysis.plannedMinutes,
    0
  );
  const overloadedDaysCount = snapshot.weekDays.filter(
    (d) => d.analysis.isOverloaded
  ).length;
  const overdueReviewsCount = snapshot.overdueReviews.length;

  const metricsSummary = {
    overloadedDaysCount,
    overdueReviewsCount,
    weeklyPlannedHours: formatMinutes(totalWeeklyPlanned),
    weeklyLimitHours: formatMinutes(snapshot.config.maxWeeklyMinutes),
  };

  const effectivePrompt =
    params.actionType === "RESOLVE_OVERLOAD"
      ? "Analise os dias com sobrecarga na minha semana e gere uma proposta de reajuste respeitando meus limites."
      : params.actionType === "DRAIN_OVERDUE_REVIEWS"
      ? "Encaixe minhas revisões atrasadas (overdue) nos horários livres da semana sem gerar sobrecarga."
      : params.actionType === "REBALANCE_TODAY"
      ? "Tive um imprevisto hoje; reorganize os blocos pendentes de hoje preservando a sessão mais prioritária."
      : params.prompt;

  const deterministic = buildDeterministicProposal(snapshot, effectivePrompt);

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const modelName = params.preferHighReasoning
    ? "gemini-4-argon"
    : "gemini-3.8-flash";

  if (!apiKey || apiKey.trim() === "") {
    return {
      mode: "DETERMINISTIC_ENGINE",
      modelUsed: `${modelName} (Motor Determinístico Local)`,
      headline: deterministic.headline,
      analysis: deterministic.analysis,
      metricsSummary,
      proposal: deterministic.proposal,
    };
  }

  const contextSummary = {
    today: snapshot.todayIso,
    routineLimits: {
      maxDailyMinutes: snapshot.config.maxDailyMinutes,
      maxWeeklyMinutes: snapshot.config.maxWeeklyMinutes,
      maxContinuousMinutes: snapshot.config.maxContinuousMinutes,
      minBreakMinutes: snapshot.config.minBreakMinutes,
      preference: snapshot.config.distributionPreference,
    },
    disciplines: snapshot.disciplines.map((d) => ({
      id: d.id,
      name: d.name,
      weight: d.priorityWeight,
      targetWeeklyMinutes: d.targetWeeklyMinutes,
    })),
    weekOverview: snapshot.weekDays.map((d) => ({
      date: d.date,
      label: d.labelShort,
      plannedMinutes: d.analysis.plannedMinutes,
      isOverloaded: d.analysis.isOverloaded,
      issues: d.analysis.issues.map((i) => i.label),
      sessions: d.sessions.map((s) => ({
        id: s.id,
        disciplineId: s.disciplineId,
        title: s.title,
        start: s.plannedStart,
        end: s.plannedEnd,
        minutes: s.plannedMinutes,
        status: s.status,
      })),
    })),
    overdueReviews: snapshot.overdueReviews.map((r) => ({
      id: r.id,
      disciplineId: r.disciplineId,
      title: r.title,
      scheduledDate: r.scheduledDate,
      estimatedMinutes: r.estimatedMinutes,
    })),
    suggestedValidOperations: deterministic.proposal?.operations ?? [],
  };

  const systemInstruction =
    "Você é o Coordenador Acadêmico de Alta Precisão para preparação ao vestibular do ITA. Seu tom é editorial, sóbrio, direto, rigoroso e sem clichês motivacionais (zero emojis, zero hype). Analise o estado atual do cronograma no PostgreSQL e responda estritamente no JSON Schema solicitado.";

  const responseSchema = {
    type: "object",
    properties: {
      headline: {
        type: "string",
        description: "Título síntese em estilo editorial acadêmico.",
      },
      analysis: {
        type: "string",
        description:
          "Diagnóstico direto e objetivo (2 a 3 frases) explicando o gargalo e a solução.",
      },
      includeProposal: {
        type: "boolean",
        description:
          "True se houver alterações recomendadas na grade horária.",
      },
      proposalTitle: {
        type: "string",
      },
      proposalRationale: {
        type: "string",
      },
    },
    required: ["headline", "analysis", "includeProposal"],
  };

  try {
    const client = new GoogleGenAI({ apiKey });

    const interaction = await client.interactions.create({
      model: modelName,
      system_instruction: systemInstruction,
      input: `Solicitação do estudante: "${effectivePrompt}"\n\nEstado atual do banco PostgreSQL:\n${JSON.stringify(
        contextSummary
      )}`,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: responseSchema,
      },
    });

    const rawText = interaction.output_text;
    if (rawText) {
      const parsed = JSON.parse(rawText);
      return {
        mode: "GEMINI_LIVE",
        modelUsed: modelName,
        headline: parsed.headline || deterministic.headline,
        analysis: parsed.analysis || deterministic.analysis,
        metricsSummary,
        proposal:
          parsed.includeProposal && deterministic.proposal
            ? {
                title: parsed.proposalTitle || deterministic.proposal.title,
                rationale:
                  parsed.proposalRationale ||
                  deterministic.proposal.rationale,
                operations: deterministic.proposal.operations,
              }
            : deterministic.proposal,
      };
    }
  } catch (err) {
    console.warn("Fallback para motor determinístico local:", err);
  }

  return {
    mode: "DETERMINISTIC_ENGINE",
    modelUsed: `${modelName} (Motor Determinístico Local)`,
    headline: deterministic.headline,
    analysis: deterministic.analysis,
    metricsSummary,
    proposal: deterministic.proposal,
  };
}
