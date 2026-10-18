import { db, conn } from "./index";
import {
  disciplines,
  topics,
  routineConfig,
  routineSlots,
  routineExceptions,
  studySessions,
  tasks,
  reviews,
} from "./schema";
import { getTodayISO, getWeekDatesISO, addDaysISO } from "../lib/date-utils";
import { sql } from "drizzle-orm";

let schemaInitPromise: Promise<void> | null = null;

export async function ensureSchemaAndSeed(forceReseed = false) {
  if (!forceReseed && schemaInitPromise) {
    return schemaInitPromise;
  }

  const runInit = async () => {
    if (!forceReseed) {
      try {
        const existingCheck = await db.select().from(studySessions).limit(1);
        if (existingCheck.length > 0) return;
      } catch {
        // Tabela ainda não existe; prosseguir com criação do schema
      }
    }

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS disciplines (
        id VARCHAR(32) PRIMARY KEY,
        name TEXT NOT NULL,
        code VARCHAR(8) NOT NULL,
        priority_weight INTEGER NOT NULL DEFAULT 5,
        target_weekly_minutes INTEGER NOT NULL DEFAULT 300,
        preferred_shift VARCHAR(16) NOT NULL DEFAULT 'ANY',
        accent_tone VARCHAR(16) NOT NULL DEFAULT '#1B365D'
      );

      CREATE TABLE IF NOT EXISTS topics (
        id VARCHAR(64) PRIMARY KEY,
        discipline_id VARCHAR(32) NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
        front TEXT NOT NULL,
        name TEXT NOT NULL,
        bibliography TEXT NOT NULL,
        difficulty_weight INTEGER NOT NULL DEFAULT 3,
        status VARCHAR(24) NOT NULL DEFAULT 'PENDING'
      );

      CREATE TABLE IF NOT EXISTS routine_config (
        id VARCHAR(32) PRIMARY KEY,
        max_daily_minutes INTEGER NOT NULL DEFAULT 360,
        max_weekly_minutes INTEGER NOT NULL DEFAULT 2160,
        default_block_minutes INTEGER NOT NULL DEFAULT 90,
        max_continuous_minutes INTEGER NOT NULL DEFAULT 150,
        min_break_minutes INTEGER NOT NULL DEFAULT 15,
        max_single_subject_daily_minutes INTEGER NOT NULL DEFAULT 210,
        min_daily_buffer_minutes INTEGER NOT NULL DEFAULT 30,
        distribution_preference TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS routine_slots (
        id VARCHAR(64) PRIMARY KEY,
        day_of_week INTEGER NOT NULL,
        start_time VARCHAR(5) NOT NULL,
        end_time VARCHAR(5) NOT NULL,
        slot_type VARCHAR(24) NOT NULL,
        title TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS routine_exceptions (
        id VARCHAR(64) PRIMARY KEY,
        exception_date VARCHAR(10) NOT NULL,
        start_time VARCHAR(5) NOT NULL,
        end_time VARCHAR(5) NOT NULL,
        exception_type VARCHAR(24) NOT NULL,
        reason TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS study_sessions (
        id VARCHAR(64) PRIMARY KEY,
        discipline_id VARCHAR(32) NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
        topic_id VARCHAR(64) REFERENCES topics(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        scheduled_date VARCHAR(10) NOT NULL,
        planned_start VARCHAR(5) NOT NULL,
        planned_end VARCHAR(5) NOT NULL,
        planned_minutes INTEGER NOT NULL,
        actual_minutes INTEGER NOT NULL DEFAULT 0,
        session_type VARCHAR(24) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'PLANNED',
        rescheduled_count INTEGER NOT NULL DEFAULT 0,
        notes TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(64) PRIMARY KEY,
        discipline_id VARCHAR(32) NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
        session_id VARCHAR(64) REFERENCES study_sessions(id) ON DELETE SET NULL,
        due_date VARCHAR(10) NOT NULL,
        title TEXT NOT NULL,
        category VARCHAR(24) NOT NULL DEFAULT 'LISTA_PENDENTE',
        priority VARCHAR(16) NOT NULL DEFAULT 'NORMAL',
        is_completed BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(64) PRIMARY KEY,
        discipline_id VARCHAR(32) NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
        topic_id VARCHAR(64) REFERENCES topics(id) ON DELETE SET NULL,
        origin_session_id VARCHAR(64) REFERENCES study_sessions(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        focus_prompt TEXT NOT NULL,
        scheduled_date VARCHAR(10) NOT NULL,
        cycle_stage VARCHAR(16) NOT NULL DEFAULT 'R1_24H',
        interval_days INTEGER NOT NULL DEFAULT 1,
        estimated_minutes INTEGER NOT NULL DEFAULT 35,
        status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
        retention_rating VARCHAR(16)
      );
    `);

    const existingSessions = await db.select().from(studySessions).limit(1);
    if (existingSessions.length > 0 && !forceReseed) {
      return;
    }

    await db.delete(reviews);
    await db.delete(tasks);
    await db.delete(studySessions);
    await db.delete(routineExceptions);
    await db.delete(routineSlots);
    await db.delete(routineConfig);
    await db.delete(topics);
    await db.delete(disciplines);

  // 1. Disciplinas da Matriz ITA
  await db.insert(disciplines).values([
    {
      id: "MAT",
      name: "Matemática",
      code: "MAT",
      priorityWeight: 10,
      targetWeeklyMinutes: 630, // 10h30
      preferredShift: "MORNING",
      accentTone: "#1B365D", // Azul Prússia
    },
    {
      id: "FIS",
      name: "Física",
      code: "FIS",
      priorityWeight: 10,
      targetWeeklyMinutes: 630, // 10h30
      preferredShift: "MORNING",
      accentTone: "#26463B", // Verde Mineral Escuro
    },
    {
      id: "QUI",
      name: "Química",
      code: "QUI",
      priorityWeight: 8,
      targetWeeklyMinutes: 480, // 8h00
      preferredShift: "AFTERNOON",
      accentTone: "#6E3524", // Terracota Escuro
    },
    {
      id: "POR",
      name: "Português & Redação",
      code: "POR",
      priorityWeight: 5,
      targetWeeklyMinutes: 210, // 3h30
      preferredShift: "EVENING",
      accentTone: "#524636", // Sépia Grafite
    },
    {
      id: "ING",
      name: "Inglês",
      code: "ING",
      priorityWeight: 3,
      targetWeeklyMinutes: 150, // 2h30
      preferredShift: "EVENING",
      accentTone: "#4A525D", // Ardósia Frio
    },
  ]);

  // 2. Tópicos e Frentes do Edital ITA
  await db.insert(topics).values([
    {
      id: "TOP_MAT_POL",
      disciplineId: "MAT",
      front: "Álgebra & Análise",
      name: "Polinômios: Relações de Girard e Teorema de Bolzano",
      bibliography: "FME Vol. 6 (Iezzi) + Caio Guimarães Vol. 1",
      difficultyWeight: 5,
      status: "IN_PROGRESS",
    },
    {
      id: "TOP_MAT_GEO_AN",
      disciplineId: "MAT",
      front: "Geometria Analítica",
      name: "Cônicas no Plano: Elipse, Hipérbole e Parábola (Rotação de Eixos)",
      bibliography: "FME Vol. 7 + Provas Discursivas ITA 2016–2025",
      difficultyWeight: 5,
      status: "IN_PROGRESS",
    },
    {
      id: "TOP_MAT_COMP",
      disciplineId: "MAT",
      front: "Álgebra",
      name: "Números Complexos e Raízes da Unidade na Geometria",
      bibliography: "Caio Guimarães + Rufino Vol. 1",
      difficultyWeight: 5,
      status: "MASTERED",
    },
    {
      id: "TOP_FIS_TERMO",
      disciplineId: "FIS",
      front: "Física II · Termodinâmica",
      name: "2ª Lei da Termodinâmica, Entropia e Ciclo de Carnot",
      bibliography: "Tópicos de Física Vol. 2 + Problemas Selecionados Saraeva",
      difficultyWeight: 5,
      status: "IN_PROGRESS",
    },
    {
      id: "TOP_FIS_ELETRO",
      disciplineId: "FIS",
      front: "Física III · Eletromagnetismo",
      name: "Indução Eletromagnética: Lei de Faraday-Lenz e Indutância",
      bibliography: "Tópicos de Física Vol. 3 + Irodov Cap. 3",
      difficultyWeight: 5,
      status: "IN_PROGRESS",
    },
    {
      id: "TOP_FIS_MEC",
      disciplineId: "FIS",
      front: "Física I · Mecânica",
      name: "Dinâmica Impulsiva, Colisões Oblíquas e Centro de Massa",
      bibliography: "Renato Brito + Saraeva",
      difficultyWeight: 4,
      status: "MASTERED",
    },
    {
      id: "TOP_QUI_ELETRO",
      disciplineId: "QUI",
      front: "Química II · Físico-Química",
      name: "Eletroquímica: Equação de Nernst e Eletrólise Quantitativa",
      bibliography: "Atkins Princípios de Química + Martha Reis",
      difficultyWeight: 5,
      status: "IN_PROGRESS",
    },
    {
      id: "TOP_QUI_EQUIL",
      disciplineId: "QUI",
      front: "Química II · Físico-Química",
      name: "Equilíbrio Iônico: Hidrólise Salina, Soluções Tampão e Curvas de Titulação",
      bibliography: "Atkins + Provas ITA 1ª/2ª Fase",
      difficultyWeight: 5,
      status: "IN_PROGRESS",
    },
    {
      id: "TOP_POR_RED",
      disciplineId: "POR",
      front: "Redação & Literatura",
      name: "Dissertação Argumentativa Padrão Banca ITA + Coesão Referencial",
      bibliography: "Coletânea Temas ITA + Obras Literárias Edital",
      difficultyWeight: 3,
      status: "IN_PROGRESS",
    },
    {
      id: "TOP_ING_TECH",
      disciplineId: "ING",
      front: "Leitura Instrumental",
      name: "Interpretação de Artigos Científicos (IEEE/Nature) e Phrasal Verbs",
      bibliography: "Provas Anteriores ITA 2015–2025",
      difficultyWeight: 2,
      status: "IN_PROGRESS",
    },
  ]);

  // 3. Configuração da Minha Rotina
  await db.insert(routineConfig).values({
    id: "default",
    maxDailyMinutes: 360, // 6h00 líquidas/dia
    maxWeeklyMinutes: 2100, // 35h00 líquidas/semana
    defaultBlockMinutes: 90, // Blocos padrão de 1h30
    maxContinuousMinutes: 150, // Máx 2h30 sem pausa obrigatória
    minBreakMinutes: 15, // Pausa mínima de 15m
    maxSingleSubjectDailyMinutes: 210, // Máx 3h30 da mesma matéria no dia
    minDailyBufferMinutes: 30, // 30m de buffer diário contra imprevistos
    distributionPreference:
      "Alocar Matemática e Física nas primeiras janelas da manhã (maior rigor analítico). Reservar o início da tarde para Físico-Química e listas discursivas de 2ª fase. Posicionar Revisões Espaçadas, Redação e Inglês no bloco noturno (19h–21h30). Nunca agendar mais de 2h30 contínuas sem intervalo mínimo de 15 minutos.",
  });

  // 4. Slots Recorrentes da Semana (Seg a Dom)
  const slotsToInsert = [];
  for (let dow = 1; dow <= 5; dow++) {
    slotsToInsert.push(
      {
        id: `SLOT_${dow}_M1`,
        dayOfWeek: dow,
        startTime: "08:00",
        endTime: "12:00",
        slotType: "AVAILABLE_STUDY",
        title: "Bloco Manhã · Alta Concentração (Exatas)",
      },
      {
        id: `SLOT_${dow}_LUNCH`,
        dayOfWeek: dow,
        startTime: "12:00",
        endTime: "13:30",
        slotType: "FIXED_COMMITMENT",
        title: "Almoço & Descanso Fisiológico",
      },
      {
        id: `SLOT_${dow}_A1`,
        dayOfWeek: dow,
        startTime: "13:30",
        endTime: "16:00",
        slotType: "AVAILABLE_STUDY",
        title: "Bloco Tarde · Listas & Aprofundamento",
      },
      {
        id: `SLOT_${dow}_CLASS`,
        dayOfWeek: dow,
        startTime: "16:00",
        endTime: "18:30",
        slotType: "FIXED_COMMITMENT",
        title: "Plantão / Aulas Turma ITA + Treino Físico",
      },
      {
        id: `SLOT_${dow}_E1`,
        dayOfWeek: dow,
        startTime: "19:00",
        endTime: "21:30",
        slotType: "AVAILABLE_STUDY",
        title: "Bloco Noite · Revisões & Fechamento",
      }
    );
  }
  // Sábado (6) e Domingo (0)
  slotsToInsert.push(
    {
      id: "SLOT_6_M1",
      dayOfWeek: 6,
      startTime: "08:00",
      endTime: "12:30",
      slotType: "AVAILABLE_STUDY",
      title: "Manhã Sábado · Provas Antigas ITA/IME",
    },
    {
      id: "SLOT_6_LUNCH",
      dayOfWeek: 6,
      startTime: "12:30",
      endTime: "14:00",
      slotType: "FIXED_COMMITMENT",
      title: "Almoço Livre",
    },
    {
      id: "SLOT_6_A1",
      dayOfWeek: 6,
      startTime: "14:00",
      endTime: "18:00",
      slotType: "AVAILABLE_STUDY",
      title: "Tarde Sábado · Revisão Geral & Redação",
    },
    {
      id: "SLOT_0_SIM",
      dayOfWeek: 0,
      startTime: "08:00",
      endTime: "13:00",
      slotType: "AVAILABLE_STUDY",
      title: "Manhã Domingo · Simulado & Correção de Erros",
    }
  );
  await db.insert(routineSlots).values(slotsToInsert);

  const todayIso = getTodayISO();
  const weekDays = getWeekDatesISO(todayIso);

  // 5. Exceções de Rotina na semana atual
  const sundayIso = weekDays[6].date;
  const fridayIso = weekDays[4].date;
  await db.insert(routineExceptions).values([
    {
      id: "EXC_SIMULADO_DOM",
      exceptionDate: sundayIso,
      startTime: "08:00",
      endTime: "13:00",
      exceptionType: "SIMULADO",
      reason: "Simulado Oficial ITA 1ª Fase (48 questões objetivas · 5h cronometradas)",
    },
    {
      id: "EXC_MEDICO_SEX",
      exceptionDate: fridayIso,
      startTime: "14:00",
      endTime: "16:00",
      exceptionType: "BLOCKED",
      reason: "Consulta Oftalmologista + Deslocamento",
    },
  ]);

  // 6. Sessões de Estudo na Semana Atual (incluindo Hoje detalhado e um dia com Sobrecarga para demonstração)
  const sessionsData = [];

  for (const dayInfo of weekDays) {
    const dIso = dayInfo.date;
    const isToday = dIso === todayIso;
    const isPast = dIso < todayIso;

    if (isToday) {
      // HOJE: 2 blocos já concluídos de manhã, 1 bloco PRÓXIMA SESSÃO agora à tarde, 1 bloco mais tarde e 1 revisão
      sessionsData.push(
        {
          id: `SES_${dIso}_1`,
          disciplineId: "MAT",
          topicId: "TOP_MAT_GEO_AN",
          title: "Cônicas no Plano: Rotação de Eixos e Reta Tangente",
          objective: "Teoria FME Vol. 7 Cap. 9 + 10 questões discursivas de 2ª fase",
          scheduledDate: dIso,
          plannedStart: "08:00",
          plannedEnd: "09:45",
          plannedMinutes: 105,
          actualMinutes: 105,
          sessionType: "EXERCISES",
          status: "COMPLETED",
          rescheduledCount: 0,
          notes: "Questão ITA 2021 de hipérbole rotacionada exigiu revisão da matriz de rotação.",
        },
        {
          id: `SES_${dIso}_2`,
          disciplineId: "QUI",
          topicId: "TOP_QUI_ELETRO",
          title: "Equação de Nernst em Condições Não-Padrão e Pilhas de Concentração",
          objective: "Resolução de 14 questões ITA/IME + registro de armadilhas de logaritmo",
          scheduledDate: dIso,
          plannedStart: "10:00",
          plannedEnd: "11:30",
          plannedMinutes: 90,
          actualMinutes: 85,
          sessionType: "EXERCISES",
          status: "COMPLETED",
          rescheduledCount: 0,
          notes: "Boa velocidade; atenção ao sinal do potencial de redução.",
        },
        {
          id: `SES_${dIso}_3`,
          disciplineId: "FIS",
          topicId: "TOP_FIS_TERMO",
          title: "2ª Lei da Termodinâmica, Entropia e Ciclo de Carnot",
          objective: "Tópicos de Física Vol. 2 + 12 questões nível ITA/Saraeva (foco em rendimento máximo)",
          scheduledDate: dIso,
          plannedStart: "14:00",
          plannedEnd: "15:30",
          plannedMinutes: 90,
          actualMinutes: 0,
          sessionType: "ITA_PROVA",
          status: "PLANNED",
          rescheduledCount: 0,
          notes: "Próxima sessão prioritária do dia.",
        },
        {
          id: `SES_${dIso}_4`,
          disciplineId: "MAT",
          topicId: "TOP_MAT_POL",
          title: "Polinômios: Relações de Girard e Raízes Múltiplas",
          objective: "Lista de aprofundamento Caio Guimarães (Q. 15 a 25)",
          scheduledDate: dIso,
          plannedStart: "19:00",
          plannedEnd: "20:30",
          plannedMinutes: 90,
          actualMinutes: 0,
          sessionType: "EXERCISES",
          status: "PLANNED",
          rescheduledCount: 1,
          notes: "Movido de ontem após estouro na lista de Geometria.",
        },
        {
          id: `SES_${dIso}_5`,
          disciplineId: "ING",
          topicId: "TOP_ING_TECH",
          title: "Leitura Crítica Prova ITA 2023 + Vocabulário Técnico",
          objective: "Resolver 12 questões da prova 2023 em 35 minutos",
          scheduledDate: dIso,
          plannedStart: "20:45",
          plannedEnd: "21:30",
          plannedMinutes: 45,
          actualMinutes: 0,
          sessionType: "ITA_PROVA",
          status: "PLANNED",
          rescheduledCount: 0,
          notes: "",
        }
      );
      continue;
    }

    // Se for Quarta-feira (ou Terça caso hoje seja Quarta): criamos um cenário real de SOBRECARGA (420 min > 360 min limite + maratona sem pausa)
    const isOverloadDemoDay =
      dayInfo.dayOfWeek === (weekDays.find((w) => w.date === todayIso)?.dayOfWeek === 3 ? 4 : 3);

    if (isOverloadDemoDay) {
      sessionsData.push(
        {
          id: `SES_${dIso}_1`,
          disciplineId: "FIS",
          topicId: "TOP_FIS_ELETRO",
          title: "Lei de Faraday-Lenz: Barras Móveis em Campo Magnético",
          objective: "Lista Irodov + 10 questões discursivas ITA",
          scheduledDate: dIso,
          plannedStart: "08:00",
          plannedEnd: "10:00",
          plannedMinutes: 120,
          actualMinutes: isPast ? 115 : 0,
          sessionType: "ITA_PROVA",
          status: isPast ? "COMPLETED" : "PLANNED",
          rescheduledCount: 0,
          notes: "",
        },
        {
          id: `SES_${dIso}_2`,
          disciplineId: "FIS",
          topicId: "TOP_FIS_TERMO",
          title: "Transformações Politrópicas e Gases Reais",
          objective: "Saraeva problemas 210 a 225 (sem intervalo após bloco anterior)",
          scheduledDate: dIso,
          plannedStart: "10:00",
          plannedEnd: "12:00",
          plannedMinutes: 120,
          actualMinutes: isPast ? 110 : 0,
          sessionType: "EXERCISES",
          status: isPast ? "COMPLETED" : "PLANNED",
          rescheduledCount: 1,
          notes: "Gera sobrecarga contínua (4h seguidas de Física sem pausa).",
        },
        {
          id: `SES_${dIso}_3`,
          disciplineId: "MAT",
          topicId: "TOP_MAT_POL",
          title: "Teorema Fundamental da Álgebra e Polinômios Recíprocos",
          objective: "Teoria + 15 questões nível ITA",
          scheduledDate: dIso,
          plannedStart: "13:30",
          plannedEnd: "15:30",
          plannedMinutes: 120,
          actualMinutes: isPast ? 120 : 0,
          sessionType: "EXERCISES",
          status: isPast ? "COMPLETED" : "PLANNED",
          rescheduledCount: 0,
          notes: "",
        },
        {
          id: `SES_${dIso}_4`,
          disciplineId: "QUI",
          topicId: "TOP_QUI_EQUIL",
          title: "Equilíbrio Iônico: Soluções Tampão e Hidrólise",
          objective: "Atkins Cap. 15 + 10 questões ITA",
          scheduledDate: dIso,
          plannedStart: "19:00",
          plannedEnd: "20:30",
          plannedMinutes: 90,
          actualMinutes: isPast ? 60 : 0,
          sessionType: "THEORY",
          status: isPast ? "COMPLETED" : "PLANNED",
          rescheduledCount: 1,
          notes: "Estoura o teto diário (7h30 planejadas vs 6h00 limite).",
        }
      );
      continue;
    }

    if (dayInfo.dayOfWeek === 0) {
      // Domingo: Simulado + Revisão
      sessionsData.push({
        id: `SES_${dIso}_SIM`,
        disciplineId: "MAT",
        topicId: "TOP_MAT_COMP",
        title: "Simulado Integrado 1ª Fase ITA (MAT/FIS/QUI/POR/ING)",
        objective: "48 questões objetivas em condições reais de prova (5h00)",
        scheduledDate: dIso,
        plannedStart: "08:00",
        plannedEnd: "13:00",
        plannedMinutes: 300,
        actualMinutes: isPast ? 300 : 0,
        sessionType: "SIMULADO",
        status: isPast ? "COMPLETED" : "PLANNED",
        rescheduledCount: 0,
        notes: "",
      });
      continue;
    }

    // Demais dias normais da semana (equilibrados dentro do limite de 6h00)
    sessionsData.push(
      {
        id: `SES_${dIso}_1`,
        disciplineId: "MAT",
        topicId: "TOP_MAT_COMP",
        title: "Números Complexos: Interpretação Geométrica e Lugar Geométrico",
        objective: "Lista Rufino + 12 questões ITA",
        scheduledDate: dIso,
        plannedStart: "08:00",
        plannedEnd: "09:30",
        plannedMinutes: 90,
        actualMinutes: isPast ? 90 : 0,
        sessionType: "EXERCISES",
        status: isPast ? "COMPLETED" : "PLANNED",
        rescheduledCount: 0,
        notes: "",
      },
      {
        id: `SES_${dIso}_2`,
        disciplineId: "FIS",
        topicId: "TOP_FIS_MEC",
        title: "Dinâmica Impulsiva e Conservação do Momento Angular",
        objective: "Resolução comentada de 10 questões de 2ª fase",
        scheduledDate: dIso,
        plannedStart: "09:45",
        plannedEnd: "11:15",
        plannedMinutes: 90,
        actualMinutes: isPast ? 90 : 0,
        sessionType: "ITA_PROVA",
        status: isPast ? "COMPLETED" : "PLANNED",
        rescheduledCount: 0,
        notes: "",
      },
      {
        id: `SES_${dIso}_3`,
        disciplineId: "QUI",
        topicId: "TOP_QUI_EQUIL",
        title: "Curvas de Titulação Ácido-Base e Indicadores",
        objective: "Teoria + 10 problemas numéricos sem calculadora",
        scheduledDate: dIso,
        plannedStart: "13:30",
        plannedEnd: "15:00",
        plannedMinutes: 90,
        actualMinutes: isPast ? 80 : 0,
        sessionType: "THEORY",
        status: isPast ? "COMPLETED" : "PLANNED",
        rescheduledCount: 0,
        notes: "",
      },
      {
        id: `SES_${dIso}_4`,
        disciplineId: dayInfo.dayOfWeek % 2 === 0 ? "POR" : "ING",
        topicId: dayInfo.dayOfWeek % 2 === 0 ? "TOP_POR_RED" : "TOP_ING_TECH",
        title:
          dayInfo.dayOfWeek % 2 === 0
            ? "Redação Dissertativa ITA: Rascunho Cronometrado (50m)"
            : "Inglês: Resolução de Prova Anterior ITA + Anotação de Idioms",
        objective:
          dayInfo.dayOfWeek % 2 === 0
            ? "Escrever tese e 2 parágrafos de desenvolvimento sobre tema filosófico-científico"
            : "15 questões objetivas com controle de tempo",
        scheduledDate: dIso,
        plannedStart: "19:00",
        plannedEnd: "20:00",
        plannedMinutes: 60,
        actualMinutes: isPast ? 60 : 0,
        sessionType: "REVIEW",
        status: isPast ? "COMPLETED" : "PLANNED",
        rescheduledCount: 0,
        notes: "",
      }
    );
  }

  await db.insert(studySessions).values(sessionsData);

  // 7. Revisões Espaçadas (Hoje, Atrasadas e Próximos Dias)
  await db.insert(reviews).values([
    {
      id: "REV_HOJE_1",
      disciplineId: "MAT",
      topicId: "TOP_MAT_POL",
      title: "Polinômios: Relações de Girard e Raízes Complexas",
      focusPrompt: "Refazer sem consulta as 3 questões erradas na lista da semana passada (ITA 2019 Q14, 2021 Q08).",
      scheduledDate: todayIso,
      cycleStage: "R2_7D",
      intervalDays: 7,
      estimatedMinutes: 35,
      status: "PENDING",
    },
    {
      id: "REV_HOJE_2",
      disciplineId: "FIS",
      topicId: "TOP_FIS_MEC",
      title: "Colisões Oblíquas no Referencial do Centro de Massa",
      focusPrompt: "Revisar dedução rápida de velocidades pós-colisão e resolver 2 problemas do Saraeva.",
      scheduledDate: todayIso,
      cycleStage: "R3_21D",
      intervalDays: 21,
      estimatedMinutes: 30,
      status: "PENDING",
    },
    {
      id: "REV_ATRASADA_1",
      disciplineId: "QUI",
      topicId: "TOP_QUI_EQUIL",
      title: "Produto de Solubilidade (Kps) e Efeito do Íon Comum",
      focusPrompt: "Revisar condição de precipitação seletiva e refazer questão discursiva ITA 2020.",
      scheduledDate: addDaysISO(todayIso, -2),
      cycleStage: "R2_7D",
      intervalDays: 7,
      estimatedMinutes: 40,
      status: "OVERDUE",
    },
    {
      id: "REV_ATRASADA_2",
      disciplineId: "FIS",
      topicId: "TOP_FIS_ELETRO",
      title: "Circuitos RC Asssimétricos em Regime Transitório",
      focusPrompt: "Revisar método de redução de Thévenin e constante de tempo.",
      scheduledDate: addDaysISO(todayIso, -1),
      cycleStage: "R1_24H",
      intervalDays: 1,
      estimatedMinutes: 30,
      status: "OVERDUE",
    },
    {
      id: "REV_AMANHA_1",
      disciplineId: "MAT",
      topicId: "TOP_MAT_GEO_AN",
      title: "Propriedade Refletora das Cônicas (Elipse e Parábola)",
      focusPrompt: "Demonstrar propriedade geométrica da bissetriz na tangente à elipse.",
      scheduledDate: addDaysISO(todayIso, 1),
      cycleStage: "R1_24H",
      intervalDays: 1,
      estimatedMinutes: 30,
      status: "PENDING",
    },
    {
      id: "REV_CONCLUIDA_1",
      disciplineId: "MAT",
      topicId: "TOP_MAT_COMP",
      title: "Fórmula de De Moivre e Soma de Séries Trigonométricas",
      focusPrompt: "Revisão de 7 dias concluída com retenção sólida.",
      scheduledDate: addDaysISO(todayIso, -1),
      cycleStage: "R2_7D",
      intervalDays: 7,
      estimatedMinutes: 30,
      status: "COMPLETED",
      retentionRating: "SOLID",
    },
  ]);

  // 8. Tarefas Pendentes Operacionais
  await db.insert(tasks).values([
    {
      id: "TSK_1",
      disciplineId: "FIS",
      dueDate: todayIso,
      title: "Registrar no Caderno de Erros a solução formal da Q.24 (ITA 2022 · Termodinâmica)",
      category: "ERRATA_CADERNO",
      priority: "HIGH",
      isCompleted: false,
    },
    {
      id: "TSK_2",
      disciplineId: "POR",
      dueDate: todayIso,
      title: "Passar a limpo a redação quinzenal na folha oficial de 30 linhas (controle de caligrafia)",
      category: "REDACAO",
      priority: "HIGH",
      isCompleted: false,
    },
    {
      id: "TSK_3",
      disciplineId: "QUI",
      dueDate: todayIso,
      title: "Finalizar os 4 últimos itens da lista de Eletroquímica (pilhas de concentração)",
      category: "LISTA_PENDENTE",
      priority: "NORMAL",
      isCompleted: false,
    },
    {
      id: "TSK_4",
      disciplineId: "MAT",
      dueDate: todayIso,
      title: "Imprimir caderno de prova ITA 2024 (1ª fase) para o simulado de domingo",
      category: "ORGANIZACAO",
      priority: "NORMAL",
      isCompleted: true,
    },
  ]);
  };

  if (forceReseed) {
    await runInit();
    return;
  }

  schemaInitPromise = runInit();
  try {
    await schemaInitPromise;
  } finally {
    schemaInitPromise = null;
  }
}

// Permite rodar via `npm run db:seed`
if (require.main === module) {
  ensureSchemaAndSeed(true)
    .then(async () => {
      console.log("Seed do Organizador de Estudos ITA concluído com sucesso.");
      await conn.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Erro ao executar seed:", err);
      await conn.end();
      process.exit(1);
    });
}
