"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { fmt, inputStyle, type BudgetData } from "./lib";

const EMPTY_FORM = { expense_date: "", description: "", amount: "", notes: "" };

export default function ExceptionalTab({ data, reload }: { data: BudgetData; reload: () => Promise<unknown> }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const total = data.exceptional.reduce((s, e) => s + e.amount, 0);

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !form.expense_date || !form.description.trim()) return;
    await supabase.from("budget_exceptional_expenses").insert({
      user_id: userId,
      expense_date: form.expense_date,
      description: form.description.trim(),
      amount: parseFloat(form.amount) || 0,
      notes: form.notes.trim() || null,
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    await reload();
  }

  async function deleteExpense(id: string) {
    if (!confirm("Supprimer cette dépense ?")) return;
    await supabase.from("budget_exceptional_expenses").delete().eq("id", id);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total des imprévus</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(total)}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: "var(--accent)" }}>
          + Nouvel imprévu
        </button>
      </div>

      {data.exceptional.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucune dépense exceptionnelle enregistrée.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-x-auto" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <th className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Date</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Description</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Montant</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Notes</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {data.exceptional.map(e => (
                <tr key={e.id} className="group" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                    {new Date(e.expense_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ color: "var(--text-primary)" }}>{e.description}</td>
                  <td className="px-3 py-2 text-xs text-right font-semibold tabular-nums" style={{ color: "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(e.amount)}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: "var(--text-muted)" }}>{e.notes ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => deleteExpense(e.id)} className="opacity-0 group-hover:opacity-100 text-xs transition-opacity" style={{ color: "var(--danger)" }}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <td colSpan={2} className="px-3 py-2 text-xs font-bold" style={{ color: "var(--text-primary)" }}>TOTAL</td>
                <td className="px-3 py-2 text-right text-xs font-bold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(total)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-secondary)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Nouvelle dépense exceptionnelle</h2>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-sm" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)" }}>✕</button>
            </div>
            <form onSubmit={addExpense} className="space-y-3">
              <input type="date" required value={form.expense_date}
                onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              <input type="text" placeholder="Description (ex: Révision auto)" required value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              <input type="number" step="0.01" placeholder="Montant (€)" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              <textarea placeholder="Notes (optionnel)" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" rows={2} style={inputStyle} />
              <button type="submit" className="w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: "var(--accent)" }}>
                Ajouter
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
