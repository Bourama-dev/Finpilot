import { withSupabase, type SupabaseContext } from "@supabase/server";
import type { Database } from "@/types/database";

export { withSupabase };

type Handler = (req: Request, ctx: SupabaseContext<Database>) => Promise<Response>;

export const withUser = (handler: Handler) =>
  withSupabase<Database>({ auth: "user" }, handler);

export const withPublic = (handler: Handler) =>
  withSupabase<Database>({ auth: "publishable" }, handler);

export const withAdmin = (handler: Handler) =>
  withSupabase<Database>({ auth: "secret" }, handler);
