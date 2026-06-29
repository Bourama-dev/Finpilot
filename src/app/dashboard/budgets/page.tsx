"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useActivities } from "@/hooks/useActivities";
import { Tooltip, TRow, TDivider } from "@/components/ui/Tooltip";

type Budget = {
  id: string;
  activity: string;
  category: string;
  amount: number;
  period: string;
  year: number;
  month: number | null;
};

type TX = {
  amount: number;
  activity: string;
  category: string;
  type: string;
  date: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const inputStyle = {
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

const EMPTY_FORM = { activity: "personnel", category: "", amount: "", period: "monthly" };

export default function BudgetsPage() {
  const { activities } = useActivities();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [txs, setTxs] = useState<TX[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  async function load() {
    const [{ data: bData }, { data: tData }] = await Promise.all([
      supabase.from("budgets").select("id, activity, category, amount, period, year, month").order("activity"),
      supabase.from("transactions")
        .select("amount, activity, category, type, date")
        .eq("type", "expense")
        .eq("excluded_from_totals", false)
        .gte("date", `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`),
    ]);
    if (bData) setBudgets(bData as Budget[]);
    if (tData) setTxs(tData as TX[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function getSpent(budget: Budget) {
    return txs
      .filter(t => t.activity === budget.activity && t.category === budget.category)
      .reduce((s, t) => s + t.amount, 0);
  }

  function getSpentTxs(budget: Budget) {
    return txs.filter(t => t.activity === budget.activity && t.category === budget.category);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setFormError("Non authentifié"); setSaving(false); return; }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("budgets").insert({
        user_id: user.id,
        activity: form.activity,
        category: form.category,
        amount: parseFloat(form.amount),
        period: form.period,
        year: currentYear,
        month: form.period === "monthly" ? currentMonth : null,
      } as any);
      if (error) throw error;
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce budget ?")) return;
    await supabase.from("budgets").delete().eq("id", id);
    setBudgets(prev => prev.filter(b => b.id !== id));
  }

  const actMap = Object.fromEntries(activities.map(a => [a.key, a]));

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Budgets</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Suivi pour {now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <button onClick={() => { setShowForm(true); setFormError(null); }} className="px-4 py-2.5 rounded-xl text-white font-medium text-sm hover:opacity-90 transition-opacity" style={{ backgroundColor: "var(--accent)" }}>
          + Nouveau budget
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <p className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Chargement…</p>
        </div>
      ) : budgets.length === 0 ? (
        <div className="rounded-xl p-12 text-center space-y-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="text-4xl">🎯</div>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Aucun budget défini</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Créez vos premiers budgets pour suivre vos dépenses par activité.</p>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: "var(--accent)" }}>
            + Créer un budget
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {budgets.map(budget => {
            const act = actMap[budget.activity];
            const color = act?.color ?? "#888";
            const spent = getSpent(budget);
            const spentTxs = getSpentTxs(budget);
            const pct = Math.min(100, Math.round((spent / budget.amount) * 100));
            const over = spent > budget.amount;
            const periodLabel = budget.period === "monthly" ? "Mensuel" : budget.period === "quarterly" ? "Trimestriel" : "Annuel";
            return (
              <div key={budget.id} className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)", border: `1px solid ${over ? "var(--danger)" : "var(--border)"}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{act?.emoji ?? "💶"}</span>
                      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{budget.category}</p>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {act?.label ?? budget.activity} · {periodLabel}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(budget.id)} className="p-1.5 rounded-lg hover:opacity-70 text-xs" style={{ color: "var(--danger)" }}>🗑</button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold tabular-nums" style={{ color: over ? "var(--danger)" : "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                      <Tooltip align="left" content={
                        <div className="p-3 space-y-0.5">
                          <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📊 {budget.category} — {act?.label}</p>
                          {spentTxs.length === 0 ? (
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Aucune dépense ce mois</p>
                          ) : (
                            spentTxs.map((t, i) => (
                              <TRow key={i} label={new Date(t.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} value={fmt(t.amount)} color="var(--danger)" />
                            ))
                          )}
                          {spentTxs.length > 1 && <><TDivider /><TRow label="= Total dépensé" value={fmt(spent)} color={over ? "var(--danger)" : "var(--text-primary)"} /></>}
                        </div>
                      }>{fmt(spent)}</Tooltip>
                    </p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>/ {fmt(budget.amount)}</p>
                  </div>

                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${color}22` }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: over ? "var(--danger)" : color }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium" style={{ color: over ? "var(--danger)" : "var(--text-muted)" }}>
                      {over ? `Dépassé de ${fmt(spent - budget.amount)}` : `${fmt(budget.amount - spent)} restant`}
                    </p>
                    <p className="text-xs font-bold" style={{ color: over ? "var(--danger)" : color }}>{pct}%</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-secondary)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Nouveau budget</h2>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-sm" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)" }}>✕</button>
            </div>
            {formError && <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>{formError}</p>}
            <form onSubmit={handleSave} className="space-y-3">
              <select value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle}>
                {activities.map(a => <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>)}
              </select>
              <input type="text" placeholder="Catégorie (ex: Loyer, Transport…)" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              <div className="relative">
                <input type="number" step="0.01" min="1" placeholder="Montant max" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required
                  className="w-full pl-3 pr-10 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>€</span>
              </div>
              <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="monthly">Mensuel</option>
                <option value="quarterly">Trimestriel</option>
                <option value="yearly">Annuel</option>
              </select>
              <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50" style={{ backgroundColor: "var(--accent)" }}>
                {saving ? "Sauvegarde…" : "Créer le budget"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
