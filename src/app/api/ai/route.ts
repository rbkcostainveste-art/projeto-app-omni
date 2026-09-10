import {technicalAssistantPolicy} from "@/lib/technical-case";
import {searchTechnicalLibrary} from "@/lib/technical-library";
import { NextResponse } from "next/server";
import {assistantAccess} from "@/lib/assistant-access";
import {assistantRecords} from "@/lib/assistant-records";
import {assistantConversationPolicy} from "@/lib/assistant-conversation";

export const runtime = "nodejs";

type RequestBody = { message?: string; image?: string; context?: unknown };

export async function POST(request: Request) {
  let access:Awaited<ReturnType<typeof assistantAccess>>;
  try {
    access=await assistantAccess(request);
  } catch {
    return NextResponse.json({error: "Sua sessão não permite usar o assistente. Entre novamente."}, {status: 401, headers: {"Cache-Control": "no-store"}});
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "A IA ainda precisa da chave OPENAI_API_KEY na Vercel." }, { status: 503 });

  const body = await request.json() as RequestBody;
  if (!body.message?.trim() && !body.image) return NextResponse.json({ error: "Envie uma pergunta, comando ou fotografia." }, { status: 400 });

  const sources = body.message?.trim() ? searchTechnicalLibrary(body.message,5) : [];
  const technicalReferences = sources.length ? sources.map((source,index)=>`[Fonte ${index+1}] ${source.documentNumber}; ${source.title}; página ${source.page}; biblioteca ${source.library}. Trecho: ${source.excerpt}`).join("\n\n") : "Nenhuma referência técnica foi localizada automaticamente.";
  const operational=await assistantRecords(access.client,access.employee,request.signal);
  const content: Array<Record<string, string>> = [{ type: "input_text", text: `${body.message ?? "Analise esta imagem."}\n\nCONTEXTO DA INTERFACE (não comprova ausência de registros):\n${JSON.stringify(body.context ?? {})}\n\nCONSULTA OPERACIONAL DO SERVIDOR:\n${JSON.stringify(operational)}\n\nREFERÊNCIAS PARA FUNDAMENTAÇÃO INTERNA:\n${technicalReferences}` }];
  if (body.image) content.push({ type: "input_image", image_url: body.image, detail: "high" });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
      instructions: assistantConversationPolicy+" Para propostas de voos use apenas prefixos cadastrados e null para campos ausentes. proposedFlights deve ficar vazio quando não houver pedido de lançamento de voo.",
      store:false,
      input: [{ role: "system", content: [{type:"input_text",text:technicalAssistantPolicy}] },...access.history.flatMap(turn=>[{role:'user',content:[{type:'input_text',text:turn.message}]},{role:'assistant',content:[{type:'output_text',text:turn.reply}]}]),{ role: "user", content }],
      text: { format: { type: "json_schema", name: "flight_assistant", strict: true, schema: { type: "object", properties: { reply: { type: "string" }, proposedFlights: { type: "array", items: { type: "object", properties: { prefix: { type: ["string","null"] }, base: { type: ["string","null"] }, date: { type: ["string","null"] }, departure: { type: ["string","null"] }, duration: { type: ["number","null"] }, fuelAmount: { type: ["number","null"] }, fuelUnit: { type: ["string","null"], enum: ["L","lb","kg",null] } }, required: ["prefix","base","date","departure","duration","fuelAmount","fuelUnit"], additionalProperties: false } } }, required: ["reply","proposedFlights"], additionalProperties: false } } }
    })
  });
  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data?.error?.message || "Não foi possível consultar a IA." }, { status: response.status });
  const outputText = data.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content ?? []).find((item: { type?: string }) => item.type === "output_text")?.text;
  if (!outputText) return NextResponse.json({ error: "A IA não retornou uma resposta utilizável." }, { status: 502 });
  return NextResponse.json({...JSON.parse(outputText),sources:[]},{headers:{'Cache-Control':'no-store'}});
}
