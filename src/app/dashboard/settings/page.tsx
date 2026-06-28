"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { useActivities, type UserActivity } from "@/hooks/useActivities";

const COLOR_PALETTE = [
  "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#6366f1", "#ec4899", "#8b5cf6", "#f97316",
];

function slugify(str: string) {
  return str.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const inputStyle = {
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

export default function SettingsPage() {
  const router = useRouter();
  const { activities, reload: reloadActivities } = useActivities();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Activity management
  const [showActForm, setShowActForm] = useState(false);
  const [actForm, setActForm] = useState({ label: "", emoji: "💼", color: COLOR_PALETTE[0] });
  const [actSaving, setActSaving] = useState(false);
  const [actError, setActError] = useState<string | null>(null);
  const [deletingAct, setDeletingAct] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", user.id)
        .single();

      const p: Profile = {
        id: user.id,
        full_name: data?.full_name ?? user.user_metadata?.full_name ?? null,
        email: data?.email ?? user.email ?? null,
      };
      setProfile(p);
      setFullName(p.full_name ?? "");
      setEmail(p.email ?? "");
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName.trim() || null,
        email: email.trim() || null,
      } as any, { onConflict: "id" });

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    setActSaving(true);
    setActError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const key = slugify(actForm.label);
      if (!key) throw new Error("Nom invalide");
      const pos = activities.length > 0 ? Math.max(...activities.map(a => a.position)) + 1 : 0;
      const { error } = await supabase.from("user_activities").insert({
        user_id: user.id,
        key,
        label: actForm.label.trim(),
        emoji: actForm.emoji || "💼",
        color: actForm.color,
        position: pos,
      });
      if (error) throw error;
      setShowActForm(false);
      setActForm({ label: "", emoji: "💼", color: COLOR_PALETTE[0] });
      await reloadActivities();
    } catch (err: unknown) {
      setActError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setActSaving(false);
    }
  }

  async function handleDeleteActivity(act: UserActivity) {
    if (!confirm(`Supprimer l'activité "${act.label}" ? Les données existantes conserveront leur activité.`)) return;
    setDeletingAct(act.id);
    await supabase.from("user_activities").delete().eq("id", act.id);
    setDeletingAct(null);
    await reloadActivities();
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Paramètres</h1>

      {/* Profile */}
      <section className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Profil</h2>

        {saveError && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>{saveError}</p>
        )}
        {saved && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--success-light)", color: "var(--success)" }}>Profil mis à jour</p>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Nom complet</label>
            <input
              type="text"
              placeholder="Jean Dupont"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Email</label>
            <input
              type="email"
              placeholder="jean@exemple.fr"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {saving ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </form>
      </section>

      {/* Activities */}
      <section className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Activités</h2>
          <button onClick={() => { setShowActForm(v => !v); setActError(null); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: "var(--accent)" }}>
            {showActForm ? "Annuler" : "+ Ajouter"}
          </button>
        </div>

        {showActForm && (
          <form onSubmit={handleAddActivity} className="space-y-3 p-3 rounded-xl" style={{ backgroundColor: "var(--bg-tertiary)" }}>
            {actError && (
              <p className="text-xs px-2 py-1.5 rounded-lg" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>{actError}</p>
            )}
            <div className="flex gap-2">
              <input type="text" placeholder="Emoji" value={actForm.emoji} maxLength={4}
                onChange={e => setActForm(f => ({ ...f, emoji: e.target.value }))}
                className="w-16 px-2 py-2 rounded-lg text-center text-lg outline-none" style={inputStyle} />
              <input type="text" placeholder="Nom de l'activité" required value={actForm.label}
                onChange={e => setActForm(f => ({ ...f, label: e.target.value }))}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PALETTE.map(c => (
                <button key={c} type="button" onClick={() => setActForm(f => ({ ...f, color: c }))}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: c, outline: actForm.color === c ? `3px solid ${c}` : undefined, outlineOffset: "2px" }} />
              ))}
            </div>
            <button type="submit" disabled={actSaving}
              className="w-full py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)" }}>
              {actSaving ? "Ajout…" : "Créer l'activité"}
            </button>
          </form>
        )}

        <ul className="space-y-1">
          {activities.map(act => (
            <li key={act.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              style={{ backgroundColor: "var(--bg-tertiary)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ backgroundColor: `${act.color}22` }}>
                {act.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{act.label}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{act.key}</p>
              </div>
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: act.color }} />
              <button onClick={() => handleDeleteActivity(act)} disabled={deletingAct === act.id}
                className="p-1.5 rounded-lg disabled:opacity-40 hover:opacity-70 transition-opacity"
                style={{ color: "var(--danger)" }} title="Supprimer">
                🗑
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Appearance */}
      <section className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Apparence</h2>
        <ThemeSwitcher />
      </section>

      {/* Account */}
      <section className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Compte</h2>

        {profile && (
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: "var(--accent)" }}>
              {(profile.full_name ?? profile.email ?? "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              {profile.full_name && <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{profile.full_name}</p>}
              {profile.email && <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{profile.email}</p>}
            </div>
          </div>
        )}

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full py-2.5 rounded-xl font-medium text-sm disabled:opacity-50 hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)", border: "1px solid var(--danger)" }}
        >
          {signingOut ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </section>
    </div>
  );
}
