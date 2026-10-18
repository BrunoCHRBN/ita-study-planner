import { NextRequest, NextResponse } from "next/server";
import { runStudyAssistant } from "@/lib/ai/assistant-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await runStudyAssistant({
      prompt: body.prompt || "Analise minha semana de estudos para o ITA.",
      actionType: body.actionType || "CUSTOM",
      preferHighReasoning: Boolean(body.preferHighReasoning),
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json(
      { error: "Falha ao processar solicitação do assistente", detail: msg },
      { status: 500 }
    );
  }
}
