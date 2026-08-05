"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  fmt, inputStyle, monthLabel, computeMonths, creditRemaining,
  type BudgetData,
} from "./lib";

const EMPTY_FORM = { name: "", taeg: "", starting_balance: "", start_month: "" };

export default function CreditsTab({ data, reload }: { data: BudgetData; reload: () => Promise<unknown> }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const months = useMemo(() => computeMonths(data), [data]);
  const totalStarting = data.credits.reduce((s, c) => s + c.starting_balance, 0);

  async function saveRepayment(creditId: string, month: string, amount: number) {
    if (!userId) return;
    await supabase.from("budget_credit_repayments")
      .upsert({ user_id: userId, credit_id: creditId, month, amount }, { onConflict: "credit_id,month" });
    await reload();
  }

  async function addCredit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !form.name.trim() || !form.start_month) return;
    await supabase.from("budget_credits").insert({
      user_id: userId,
      name: form.name.trim(),
      taeg: form.taeg ? parseFloat(form.taeg) : null,
      starting_balance: parseFloat(form.starting_balance) || 0,
      start_month: form.start_month,
      position: data.credits.length,
    });
    setForm(EMPTY_FORM);
    setShowForm(false);
    await reload();
  }

  async function deleteCredit(id: string) {
    if (!confirm("Supprimer ce crédit et ses remboursements ?")) return;
    await supabase.from("budget_credits").delete().eq("id", id);
    await reload();
  }

  const repaymentFor = (creditId: string, month: string) =>
    data.repayments.find(r => r.credit_id === creditId && r.month === month)?.amount ?? 0;

  const totalRemainingPerMonth = (month: string) =>
    data.credits.reduce((s, c) => s + creditRemaining(c, data.repayments, month), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total à rembourser (encours de départ)</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(totalStarting)}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: "var(--accent)" }}>
          + Nouveau crédit
        </button>
      </div>

      {data.credits.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucun crédit renouvelable enregistré.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-x-auto" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <th className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: "var(--text-muted)" }}></th>
                {months.map(m => (
                  <th key={m} className="px-3 py-2.5 text-right text-xs font-semibold min-w-[110px]" style={{ color: "var(--text-muted)" }}>{monthLabel(m)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={months.length + 1} className="px-3 py-2 text-[11px] font-bold tracking-wide" style={{ color: "var(--accent)", backgroundColor: "var(--bg-tertiary)" }}>
                  REMBOURSEMENT ANTICIPÉ PAR MOIS
                </td>
              </tr>
              {data.credits.map(credit => (
                <tr key={credit.id} className="group" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-3 py-1.5 text-xs whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => deleteCredit(credit.id)} className="opacity-0 group-hover:opacity-100 text-[10px] transition-opacity" style={{ color: "var(--danger)" }}>🗑</button>
                      <span className="font-medium">{credit.name}</span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {credit.taeg != null ? `(TAEG ${credit.taeg}%)` : ""} — {fmt(credit.starting_balance)}
                      </span>
                    </div>
                  </td>
                  {months.map(m => (
                    <td key={m} className="px-3 py-1.5 text-right min-w-[110px]">
                      <input type="number" step="0.01" defaultValue={repaymentFor(credit.id, m) || ""} placeholder="0"
                        onBlur={e => saveRepayment(credit.id, m, parseFloat(e.target.value) || 0)}
                        className="w-full text-right px-2 py-1 rounded text-xs outline-none tabular-nums"
                        style={{ ...inputStyle, fontFamily: "var(--font-dm-mono, monospace)" }} />
                    </td>
                  ))}
                </tr>
              ))}

              <tr>
                <td colSpan={months.length + 1} className="px-3 py-2 text-[11px] font-bold tracking-wide" style={{ color: "var(--accent)", backgroundColor: "var(--bg-tertiary)" }}>
                  ENCOURS RESTANT (fin de mois)
                </td>
              </tr>
              {data.credits.map(credit => (
                <tr key={credit.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-3 py-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>{credit.name}</td>
                  {months.map(m => {
                    const remaining = creditRemaining(credit, data.repayments, m);
                    return (
                      <td key={m} className="px-3 py-1.5 text-right text-xs tabular-nums min-w-[110px]"
                        style={{ color: remaining === 0 ? "var(--success)" : "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                        {fmt(remaining)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <td className="px-3 py-2 text-xs font-bold" style={{ color: "var(--text-primary)" }}>RESTANT DÛ TOTAL</td>
                {months.map(m => {
                  const total = totalRemainingPerMonth(m);
                  return (
                    <td key={m} className="px-3 py-2 text-right text-xs font-bold tabular-nums min-w-[110px]"
                      style={{ color: total === 0 ? "var(--success)" : "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                      {fmt(total)}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="px-3 py-2 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Statut objectif</td>
                {months.map(m => {
                  const solde = totalRemainingPerMonth(m) === 0;
                  return (
                    <td key={m} className="px-3 py-2 text-right min-w-[110px]">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{
                        color: solde ? "var(--success)" : "var(--warning)",
                        backgroundColor: solde ? "var(--success-light)" : "var(--warning-light)",
                      }}>
                        {solde ? "SOLDÉ" : "En cours"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-secondary)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>Nouveau crédit renouvelable</h2>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-sm" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)" }}>✕</button>
            </div>
            <form onSubmit={addCredit} className="space-y-3">
              <input type="text" placeholder="Nom (ex: Sofinco, Oney…)" value={form.name} required
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              <input type="number" step="0.01" placeholder="TAEG (%)" value={form.taeg}
                onChange={e => setForm(f => ({ ...f, taeg: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              <input type="number" step="0.01" placeholder="Encours de départ (€)" value={form.starting_balance} required
                onChange={e => setForm(f => ({ ...f, starting_balance: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              <label className="block text-xs" style={{ color: "var(--text-muted)" }}>
                Mois de départ
                <input type="month" required value={form.start_month.slice(0, 7)}
                  onChange={e => setForm(f => ({ ...f, start_month: `${e.target.value}-01` }))}
                  className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
              </label>
              <button type="submit" className="w-full py-2.5 rounded-xl text-white font-semibold text-sm" style={{ backgroundColor: "var(--accent)" }}>
                Créer le crédit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
