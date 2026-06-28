"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export type UserActivity = {
  id: string;
  key: string;
  label: string;
  color: string;
  emoji: string;
  position: number;
};

export const DEFAULT_ACTIVITIES: UserActivity[] = [
  { id: "d0", key: "freelance",  label: "Freelance",  color: "#0ea5e9", emoji: "💼", position: 0 },
  { id: "d1", key: "cle_avenir", label: "CléAvenir",  color: "#f59e0b", emoji: "🏢", position: 1 },
  { id: "d2", key: "hakily",     label: "Hakily",     color: "#10b981", emoji: "🤖", position: 2 },
  { id: "d3", key: "alternance", label: "Alternance", color: "#6366f1", emoji: "🎓", position: 3 },
  { id: "d4", key: "personnel",  label: "Personnel",  color: "#ec4899", emoji: "🏠", position: 4 },
];

export function getActivity(key: string, activities: UserActivity[]): UserActivity {
  return activities.find(a => a.key === key) ?? { id: "", key, label: key, color: "#6b7280", emoji: "📌", position: 99 };
}

export function useActivities() {
  const [activities, setActivities] = useState<UserActivity[]>(DEFAULT_ACTIVITIES);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from("user_activities")
      .select("*")
      .order("position")
      .order("created_at");
    if (data && data.length > 0) setActivities(data as unknown as UserActivity[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return { activities, loading, reload: load };
}
