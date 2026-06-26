import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

let _client: Client | null = null;

export function getSupabaseClient(): Client {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Missing Supabase env vars — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
    _client = createClient<Database>(url, key);
  }
  return _client;
}

export const supabase = new Proxy({} as Client, {
  get(_target, prop: keyof Client) {
    return getSupabaseClient()[prop];
  },
});
