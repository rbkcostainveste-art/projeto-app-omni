import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export async function consumePresentationRequestQuota(request: Request, apiKey: string) {
  const ip = (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "shared")
    .split(",")[0].trim().slice(0, 128);
  const clientKey = createHmac("sha256", apiKey)
    .update(`presentation:${new Date().toISOString().slice(0, 10)}:${ip}`)
    .digest("hex");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ecdhhfyobalpswojaklv.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_dEz7yx8Uoe9AEAa3PHQFZQ_n5PYGGzs",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([request.signal, AbortSignal.timeout(7000)]) }) },
    },
  );
  const { data, error } = await client.rpc("consume_presentation_assistant_quota", { p_client_key: clientKey });
  if (error || !data || typeof data.allowed !== "boolean") throw Error("quota_unavailable");
  return { allowed: data.allowed, retryAfter: Number(data.retryAfter) || 60 };
}
