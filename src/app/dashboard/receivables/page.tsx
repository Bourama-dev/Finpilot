"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Activity } from "@/types/database";
import { useActivities } from "@/hooks/useActivities";

const STATUS = {
  to_invoice: { label: "À facturer",             color: "#f59e0b", bg: "#fef3c7", dot: "🟡" },
  invoiced:   { label: "En attente de paiement", color: "#6366f1", bg: "#ede9fe", dot: "🔵" },
  paid:       { label: "Payé",                   color: "#10b981", bg: "#d1fae5", dot: "🟢" },
} as const;

type Status = keyof typeof STATUS;

type Receivable = {
  id: string;
  client: string;
  invoice_ref: string | null;
  amount: number;
  currency: string;
  status: Status;
  service_date: string | null;
  description: string | null;
  activity: Activity;
  created_at: string;
};

type FormState = {
  client: string;
  invoice_ref: string;
  amount: string;
  status: Status;
  service_date: string;
  description: string;
  activity: Activity;
};

const EMPTY: FormState = {
  client: "",
  invoice_ref: "",
  amount: "",
  status: "to_invoice",
  service_date: new Date().toISOString().slice(0, 10),
  description: "",
  activity: "freelance",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const inputStyle = {
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

export default function ReceivablesPage() {
  const { activities } = useActivities();
  const [items, setItems] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  async function load() {
    const { data } = await supabase
      .from("receivables")
      .select("*")
      .order("service_date", { ascending: false });
    if (data) setItems(data as Receivable[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    statusFilter === "all" ? items : items.filter(r => r.status === statusFilter),
    [items, statusFilter]);

  const totals = useMemo(() => ({
    to_invoice: items.filter(r => r.status === "to_invoice").reduce((s, r) => s + r.amount, 0),
    invoiced:   items.filter(r => r.status === "invoiced").reduce((s, r) => s + r.amount, 0),
    paid:       items.filter(r => r.status === "paid").reduce((s, r) => s + r.amount, 0),
    all:        items.filter(r => r.status !== "paid").reduce((s, r) => s + r.amount, 0),
  }), [items]);

  function openNew() {
    setForm(EMPTY);
    setEditId(null);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(r: Receivable) {
    setForm({
      client: r.client,
      invoice_ref: r.invoice_ref ?? "",
      amount: String(r.amount),
      status: r.status,
      service_date: r.service_date ?? "",
      description: r.description ?? "",
      activity: r.activity,
    });
    setEditId(r.id);
    setFormError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setFormError("Non authentifié"); setSaving(false); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      user_id: user.id,
      client: form.client.trim(),
      invoice_ref: form.invoice_ref.trim() || null,
      amount: parseFloat(form.amount),
      currency: "EUR",
      status: form.status,
      service_date: form.service_date || null,
      description: form.description.trim() || null,
      activity: form.activity,
    };

    try {
      if (editId) {
        const prev = items.find(r => r.id === editId);
        const { error } = await supabase.from("receivables").update(payload).eq("id", editId);
        if (error) throw error;
        if (form.status === "paid" && prev?.status !== "paid") {
          await createPaymentTransaction(
            { activity: form.activity, amount: parseFloat(form.amount), client: form.client.trim(), invoice_ref: form.invoice_ref.trim() || null },
            user.id,
          );
        }
      } else {
        const { error } = await supabase.from("receivables").insert(payload);
        if (error) throw error;
        if (form.status === "paid") {
          await createPaymentTransaction(
            { activity: form.activity, amount: parseFloat(form.amount), client: form.client.trim(), invoice_ref: form.invoice_ref.trim() || null },
            user.id,
          );
        }
      }
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function createPaymentTransaction(r: { activity: Activity; amount: number; client: string; invoice_ref: string | null }, userId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const desc = [r.client, r.invoice_ref].filter(Boolean).join(" – ");
    await supabase.from("transactions").insert({
      user_id: userId,
      activity: r.activity,
      type: "income",
      amount: r.amount,
      currency: "EUR",
      category: "Créance client",
      description: desc,
      date: today,
      is_recurring: false,
    });
  }

  async function markAs(id: string, status: Status) {
    await supabase.from("receivables").update({ status }).eq("id", id);

    if (status === "paid") {
      const receivable = items.find(r => r.id === id);
      if (receivable) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await createPaymentTransaction(receivable, user.id);
      }
    }

    setItems(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  async function handleDelete(id: string, client: string) {
    if (!confirm(`Supprimer la créance de ${client} ?`)) return;
    await supabase.from("receivables").delete().eq("id", id);
    setItems(prev => prev.filter(r => r.id !== id));
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Reste à percevoir</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Suivi de vos créances clients</p>
        </div>
        <button onClick={openNew}
          className="px-4 py-2.5 rounded-xl text-white font-medium text-sm"
          style={{ backgroundColor: "var(--accent)" }}>
          + Nouvelle créance
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 sm:col-span-1" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Total à percevoir</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "var(--accent)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(totals.all)}</p>
        </div>
        {(["to_invoice", "invoiced", "paid"] as Status[]).map(s => (
          <div key={s} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{STATUS[s].label}</p>
            <p className="text-base font-bold tabular-nums" style={{ color: STATUS[s].color, fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(totals[s])}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {([["all", "Tous"], ["to_invoice", "À facturer"], ["invoiced", "En attente"], ["paid", "Payés"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key as Status | "all")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={statusFilter === key
              ? { backgroundColor: "var(--accent)", color: "#fff" }
              : { backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center">
          <p className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Chargement…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl py-14 text-center space-y-2" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="text-3xl">📋</div>
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>Aucune créance</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Ajoutez vos premières créances clients.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          {/* Desktop table */}
          <table className="w-full text-sm hidden sm:table">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Client", "Référence", "Date", "Montant", "Statut", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const st = STATUS[r.status];
                return (
                  <tr key={r.id} style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{r.client}</p>
                      {r.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{r.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: r.invoice_ref ? "var(--text-secondary)" : "var(--text-muted)" }}>
                      {r.invoice_ref ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {r.service_date ? new Date(r.service_date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="px-4 py-3 font-bold tabular-nums text-sm" style={{ color: r.status === "paid" ? "var(--success)" : "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                      {fmt(r.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: st.bg, color: st.color }}>
                        {st.dot} {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {r.status === "to_invoice" && (
                          <button onClick={() => markAs(r.id, "invoiced")} title="Marquer comme facturé"
                            className="px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
                            style={{ backgroundColor: "#ede9fe", color: "#6366f1" }}>
                            Facturé
                          </button>
                        )}
                        {r.status === "invoiced" && (
                          <button onClick={() => markAs(r.id, "paid")} title="Marquer comme payé"
                            className="px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
                            style={{ backgroundColor: "#d1fae5", color: "#10b981" }}>
                            Payé ✓
                          </button>
                        )}
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>✏️</button>
                        <button onClick={() => handleDelete(r.id, r.client)} className="p-1.5 rounded-lg" style={{ color: "var(--danger)" }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--border)", backgroundColor: "var(--bg-tertiary)" }}>
                <td colSpan={3} className="px-4 py-3 text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                  Total ({filtered.length} ligne{filtered.length > 1 ? "s" : ""})
                </td>
                <td className="px-4 py-3 font-bold tabular-nums text-sm" style={{ color: "var(--accent)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                  {fmt(filtered.reduce((s, r) => s + r.amount, 0))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>

          {/* Mobile cards */}
          <ul className="sm:hidden">
            {filtered.map((r, i) => {
              const st = STATUS[r.status];
              return (
                <li key={r.id} className="px-4 py-4 space-y-2" style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{r.client}</p>
                      {r.invoice_ref && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{r.invoice_ref}</p>}
                    </div>
                    <p className="font-bold tabular-nums text-sm shrink-0" style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(r.amount)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: st.bg, color: st.color }}>
                      {st.dot} {st.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {r.status === "to_invoice" && (
                        <button onClick={() => markAs(r.id, "invoiced")} className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: "#ede9fe", color: "#6366f1" }}>Facturé</button>
                      )}
                      {r.status === "invoiced" && (
                        <button onClick={() => markAs(r.id, "paid")} className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: "#d1fae5", color: "#10b981" }}>Payé ✓</button>
                      )}
                      <button onClick={() => openEdit(r)} className="p-1 rounded" style={{ color: "var(--text-muted)" }}>✏️</button>
                      <button onClick={() => handleDelete(r.id, r.client)} className="p-1 rounded" style={{ color: "var(--danger)" }}>🗑</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4"
            style={{ backgroundColor: "var(--bg-secondary)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                {editId ? "Modifier la créance" : "Nouvelle créance"}
              </h2>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
                style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)" }}>✕</button>
            </div>

            {formError && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>{formError}</p>
            )}

            <form onSubmit={handleSave} className="space-y-3">
              <input type="text" placeholder="Client (ex: Palomano)" value={form.client}
                onChange={e => setForm(f => ({ ...f, client: e.target.value }))} required
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />

              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required
                    className="w-full pl-3 pr-8 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--text-muted)" }}>€</span>
                </div>
                <input type="date" value={form.service_date}
                  onChange={e => setForm(f => ({ ...f, service_date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              </div>

              <input type="text" placeholder="Référence facture (ex: FC2606…)" value={form.invoice_ref}
                onChange={e => setForm(f => ({ ...f, invoice_ref: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />

              <input type="text" placeholder="Description (optionnel)" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />

              <div className="grid grid-cols-2 gap-2">
                {/* Status */}
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle}>
                  <option value="to_invoice">🟡 À facturer</option>
                  <option value="invoiced">🔵 En attente de paiement</option>
                  <option value="paid">🟢 Payé</option>
                </select>
                {/* Activity */}
                <select value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value as Activity }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle}>
                  {activities.map(a => <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>)}
                </select>
              </div>

              <button type="submit" disabled={saving}
                className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
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
