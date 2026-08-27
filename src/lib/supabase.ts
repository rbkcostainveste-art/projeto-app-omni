import { createClient } from "@supabase/supabase-js";

export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ecdhhfyobalpswojaklv.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_dEz7yx8Uoe9AEAa3PHQFZQ_n5PYGGzs";
  if (!url || !key) return null;
  return createClient(url, key);
}
