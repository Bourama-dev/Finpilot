"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";

const ACTIVITIES = [
  { key: "alternance", label: "Alternance", color: "#6366f1", emoji: "🎓" },
  { key: "cle_avenir", label: "CléAvenir",  color: "#f59e0b", emoji: "🏢" },
  { key: "hakily",     label: "Hakily",      color: "#10b981", emoji: "🤖" },
  { key: "personnel",  label: "Personnel",   color: "#ec4899", emoji: "🏠" },
];

const CATEGORY_SUGGESTIONS = {
  income:  ["Salaire", "Freelance", "Prime", "Virement", "Remboursement", "Dividendes", "Autre"],
  expense: ["Loyer", "Alimentation", "Transport", "Abonnements", "Équipement", "Formation", "Marketing", "Charges", "Assurance", "Taxes", "Autre"],
};

const FREQUENCIES = [
  { key: "daily",   label: "Quotidien",   short: "/ jour" },
  { key: "weekly",  label: "Hebdomadaire", short: "/ sem." },
  { key: "monthly", label: "Mensuel",     short: "/ mois" },
  { key: "yearly",  label: "Annuel",      short: "/ an"   },
] as const;

type Frequency = typeof FREQUENCIES[number]["key"];

type TX = {
  id: string;
  activity: string;
  type: "income" | "expense";
  amount: number;
  currency: string;
  category: string;
  description: string | null;
  date: string;
  is_recurring: boolean;
  recurring_frequency: Frequency | null;
};

type FormState = {
  type: "income" | "expense";
  activity: string;
  amount: string;
  category: string;
  description: string;
  date: string;
  is_recurring: boolean;
  recurring_frequency: Frequency;
};

const EMPTY: FormState = {
  type: "expense",
  activity: "personnel",
  amount: "",
  category: "",
  description: "",
  date: new Date().toISOString().slice(0, 10),
  is_recurring: false,
  recurring_frequency: "monthly",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const inputStyle = {
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

export default function TransactionsPage() {
  const [txs, setTxs] = useState<TX[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [actFilter, setActFilter] = useState("all");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  async function load() {
    const { data } = await supabase
      .from("transactions")
      .select("id, activity, type, amount, currency, category, description, date, is_recurring, recurring_frequency")
      .order("date", { ascending: false });
    if (data) setTxs(data as TX[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    txs.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (actFilter !== "all" && t.activity !== actFilter) return false;
      if (month && !t.date.startsWith(month)) return false;
      return true;
    }), [txs, typeFilter, actFilter, month]);

  const totalIn = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(tx: TX) {
    setForm({ type: tx.type, activity: tx.activity, amount: String(tx.amount), category: tx.category, description: tx.description ?? "", date: tx.date, is_recurring: tx.is_recurring, recurring_frequency: tx.recurring_frequency ?? "monthly" });
    setEditId(tx.id);
    setFormError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setFormError("Non authentifié"); setSaving(false); return; }

    const payload = {
      user_id: user.id,
      type: form.type,
      activity: form.activity,
      amount: parseFloat(form.amount),
      currency: "EUR",
      category: form.category,
      description: form.description || null,
      date: form.date,
      is_recurring: form.is_recurring,
      recurring_frequency: form.is_recurring ? form.recurring_frequency : null,
    };

    try {
      if (editId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from("transactions").update(payload as any).eq("id", editId);
        if (error) throw error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from("transactions").insert(payload as any);
        if (error) throw error;
      }
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette transaction ?")) return;
    await supabase.from("transactions").delete().eq("id", id);
    setTxs(prev => prev.filter(t => t.id !== id));
  }

  const actMap = Object.fromEntries(ACTIVITIES.map(a => [a.key, a]));

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Transactions</h1>
        <button onClick={openNew} className="px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--accent)" }}>
          + Nouvelle
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Revenus", value: totalIn, color: "var(--success)" },
          { label: "Dépenses", value: totalOut, color: "var(--danger)" },
          { label: "Solde", value: totalIn - totalOut, color: totalIn >= totalOut ? "var(--success)" : "var(--danger)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-3 sm:p-4 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
            <p className="text-base sm:text-lg font-bold tabular-nums mt-1" style={{ color, fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="px-3 py-1.5 rounded-lg text-sm outline-none" style={inputStyle} />

        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {(["all", "income", "expense"] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className="px-3 py-1.5 text-xs font-medium"
              style={typeFilter === t ? { backgroundColor: "var(--accent)", color: "#fff" } : { backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
              {t === "all" ? "Tous" : t === "income" ? "↑ Revenus" : "↓ Dépenses"}
            </button>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setActFilter("all")} className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={actFilter === "all" ? { backgroundColor: "var(--accent)", color: "#fff" } : { backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            Tous
          </button>
          {ACTIVITIES.map(a => (
            <button key={a.key} onClick={() => setActFilter(a.key)} className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={actFilter === a.key ? { backgroundColor: a.color, color: "#fff" } : { backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {a.emoji} {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        {loading ? (
          <div className="py-12 text-center">
            <p className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Chargement…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="text-3xl">📭</div>
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>Aucune transaction</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Modifiez les filtres ou ajoutez une transaction.</p>
          </div>
        ) : (
          <ul>
            {filtered.map((tx, i) => {
              const act = actMap[tx.activity];
              const color = act?.color ?? "#888";
              return (
                <li key={tx.id} className="flex items-center gap-3 px-4 py-3.5 group"
                  style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ backgroundColor: `${color}1a` }}>
                    {act?.emoji ?? "💶"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {tx.description ?? tx.category}
                    </p>
                    <p className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: "var(--text-muted)" }}>
                      {act?.label ?? tx.activity} · {tx.category} · {new Date(tx.date).toLocaleDateString("fr-FR")}
                      {tx.is_recurring && tx.recurring_frequency && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>
                          🔁 {FREQUENCIES.find(f => f.key === tx.recurring_frequency)?.label}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums shrink-0"
                    style={{ color: tx.type === "income" ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                    {tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}
                  </p>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => openEdit(tx)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: "var(--text-muted)" }}>✏️</button>
                    <button onClick={() => handleDelete(tx.id)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: "var(--danger)" }}>🗑</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-secondary)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                {editId ? "Modifier" : "Nouvelle transaction"}
              </h2>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-sm" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)" }}>✕</button>
            </div>

            {formError && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>{formError}</p>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              {/* Type */}
              <div className="grid grid-cols-2 gap-2">
                {(["expense", "income"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                    className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={form.type === t
                      ? { backgroundColor: t === "income" ? "var(--success)" : "var(--danger)", color: "#fff" }
                      : { backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    {t === "income" ? "↑ Revenu" : "↓ Dépense"}
                  </button>
                ))}
              </div>

              {/* Activity */}
              <select value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))} required className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle}>
                {ACTIVITIES.map(a => <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>)}
              </select>

              {/* Amount */}
              <div className="relative">
                <input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required
                  className="w-full pl-3 pr-10 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>€</span>
              </div>

              {/* Category */}
              <input type="text" list="cat-list" placeholder="Catégorie (ex: Salaire, Loyer…)" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              <datalist id="cat-list">
                {CATEGORY_SUGGESTIONS[form.type].map(c => <option key={c} value={c} />)}
              </datalist>

              {/* Description */}
              <input type="text" placeholder="Description (optionnel)" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />

              {/* Date */}
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />

              {/* Recurring */}
              <div className="space-y-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm transition-all"
                  style={form.is_recurring
                    ? { backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)", border: "1px solid var(--accent)", color: "var(--accent)" }
                    : { ...inputStyle, color: "var(--text-secondary)" }}>
                  <span className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all text-xs"
                    style={form.is_recurring ? { backgroundColor: "var(--accent)", borderColor: "var(--accent)", color: "#fff" } : { borderColor: "var(--text-muted)" }}>
                    {form.is_recurring ? "✓" : ""}
                  </span>
                  Transaction récurrente
                </button>

                {form.is_recurring && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {FREQUENCIES.map(f => (
                      <button key={f.key} type="button" onClick={() => setForm(s => ({ ...s, recurring_frequency: f.key }))}
                        className="py-2 rounded-lg text-xs font-medium transition-all"
                        style={form.recurring_frequency === f.key
                          ? { backgroundColor: "var(--accent)", color: "#fff" }
                          : { backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)" }}>
                {saving ? "Sauvegarde…" : editId ? "Mettre à jour" : "Ajouter"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
