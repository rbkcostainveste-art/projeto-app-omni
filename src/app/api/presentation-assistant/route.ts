import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { handlePresentationAssistant } from "@/lib/presentation-assistant";
import { getPresentationKnowledge } from "@/lib/presentation-assistant-knowledge";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  return handlePresentationAssistant(request, {
    apiKey, model: process.env.PRESENTATION_ASSISTANT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini",
    enabled: process.env.PRESENTATION_ASSISTANT_ENABLED !== "false",
    getKnowledge: getPresentationKnowledge,
    consumeQuota: async () => {
      // This isolated client can only consume the public quota; no operational
      // data or visitor session is read or passed to the language model.
      const ip = (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "shared").split(",")[0].trim().slice(0, 128);
      const clientKey = createHmac("sha256", apiKey!).update(`presentation:${new Date().toISOString().slice(0, 10)}:${ip}`).digest("hex");
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ecdhhfyobalpswojaklv.supabase.co", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_dEz7yx8Uoe9AEAa3PHQFZQ_n5PYGGzs", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([request.signal, AbortSignal.timeout(7000)]) }) } });
      const { data, error } = await client.rpc("consume_presentation_assistant_quota", { p_client_key: clientKey });
      if (error || !data || typeof data.allowed !== "boolean") throw Error("quota_unavailable");
      return { allowed: data.allowed, retryAfter: Number(data.retryAfter) || 60 };
    },
  });
}
