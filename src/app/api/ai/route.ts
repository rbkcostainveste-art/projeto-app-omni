import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RequestBody = { message?: string; image?: string; context?: unknown };

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "A IA ainda precisa da chave OPENAI_API_KEY na Vercel." }, { status: 503 });

  const body = await request.json() as RequestBody;
  if (!body.message?.trim() && !body.image) return NextResponse.json({ error: "Envie uma pergunta, comando ou fotografia." }, { status: 400 });

  const content: Array<Record<string, string>> = [{ type: "input_text", text: `${body.message ?? "Analise esta imagem."}\n\nDADOS ATUAIS DO FLIGHT IA:\n${JSON.stringify(body.context ?? {})}` }];
  if (body.image) content.push({ type: "input_image", image_url: body.image, detail: "high" });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions: "Você é o assistente operacional do Flight IA. Responda em português do Brasil. Use somente os dados fornecidos. Para comandos de lançamento, proponha voos apenas para prefixos cadastrados; nunca invente aeronaves. Se faltar informação, use null e explique. Não confirme que gravou dados: diga que preparou uma proposta para revisão.",
      input: [{ role: "user", content }],
      text: { format: { type: "json_schema", name: "flight_assistant", strict: true, schema: { type: "object", properties: { reply: { type: "string" }, proposedFlights: { type: "array", items: { type: "object", properties: { prefix: { type: ["string","null"] }, base: { type: ["string","null"] }, date: { type: ["string","null"] }, departure: { type: ["string","null"] }, duration: { type: ["number","null"] }, fuelAmount: { type: ["number","null"] }, fuelUnit: { type: ["string","null"], enum: ["L","lb","kg",null] } }, required: ["prefix","base","date","departure","duration","fuelAmount","fuelUnit"], additionalProperties: false } } }, required: ["reply","proposedFlights"], additionalProperties: false } } }
    })
  });
  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data?.error?.message || "Não foi possível consultar a IA." }, { status: response.status });
  const outputText = data.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content ?? []).find((item: { type?: string }) => item.type === "output_text")?.text;
  if (!outputText) return NextResponse.json({ error: "A IA não retornou uma resposta utilizável." }, { status: 502 });
  return NextResponse.json(JSON.parse(outputText));
}
