import { withSupabase } from "@supabase/server";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";
import type { Activity } from "@/types/database";

export const GET = withSupabase<Database>({ auth: "user" }, async (_req, ctx) => {
  const { data, error } = await ctx.supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
});

export const POST = withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const activity = (formData.get("activity") as Activity) || null;
  const name = (formData.get("name") as string) || file.name;

  const userId = (await ctx.supabase.auth.getUser()).data.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storagePath = `${userId}/${activity}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await ctx.supabase.storage
    .from("documents")
    .upload(storagePath, file);

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await ctx.supabase
    .from("documents")
    .insert({
      user_id: userId,
      activity: activity || null,
      name,
      type: file.type,
      size: file.size,
      storage_path: storagePath,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
});
