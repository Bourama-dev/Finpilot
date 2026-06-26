import { withSupabase } from "@supabase/server";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";

export const GET = withSupabase<Database>({ auth: "user" }, async (_req, ctx) => {
  const { data, error } = await ctx.supabase
    .from("budgets")
    .select("*")
    .order("activity");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

export const POST = withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
  const body = await req.json();
  const { data, error } = await ctx.supabase
    .from("budgets")
    .upsert(body, { onConflict: "user_id,activity,category,period" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});
