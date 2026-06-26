"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";

const ACTIVITIES = [
  { key: "alternance", label: "Alternance", color: "#6366f1", emoji: "🎓" },
  { key: "cle_avenir", label: "CléAvenir",  color: "#f59e0b", emoji: "🏢" },
  { key: "hakily",     label: "Hakily",      color: "#10b981", emoji: "🤖" },
  { key: "personnel",  label: "Personnel",   color: "#ec4899", emoji: "🏠" },
  { key: "freelance",  label: "Freelance",   color: "#0ea5e9", emoji: "💼" },
];

type TX = {
  id: string;
  activity: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  date: string;
};

type Receivable = {
  client: string;
  amount: number;
  status: "to_invoice" | "invoiced" | "paid";
  activity: string;
  service_date: string | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default function ReportsPage() {
  const [txs, setTxs] = useState<TX[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    async function load() {
      const [{ data: txData }, { data: recData }] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, activity, type, amount, category, date")
          .gte("date", `${year}-01-01`)
          .lte("date", `${year}-12-31`)
          .order("date", { ascending: true }),
        supabase
          .from("receivables")
          .select("client, amount, status, activity, service_date")
          .neq("status", "paid"),
      ]);
      if (txData) setTxs(txData as TX[]);
      if (recData) setReceivables(recData as Receivable[]);
      setLoading(false);
    }
    setLoading(true);
    load();
  }, [year]);

  const monthly = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      const monthTxs = txs.filter(t => t.date.startsWith(`${year}-${m}`));
      const income  = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = monthTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      return { month: MONTHS_FR[i], income, expense, balance: income - expense };
    });
  }, [txs, year]);

  const totals = useMemo(() => ({
    income:  txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0),
    expense: txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0),
  }), [txs]);

  const totalReceivable = useMemo(
    () => receivables.reduce((s, r) => s + r.amount, 0),
    [receivables],
  );

  const byActivity = useMemo(() =>
    ACTIVITIES.map(act => {
      const actTxs = txs.filter(t => t.activity === act.key);
      const income  = actTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = actTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const pending = receivables.filter(r => r.activity === act.key).reduce((s, r) => s + r.amount, 0);
      return { ...act, income, expense, balance: income - expense, pending };
    }), [txs, receivables]);

  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    txs.filter(t => t.type === "expense").forEach(t => {
      map[t.category] = (map[t.category] ?? 0) + t.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [txs]);

  const receivablesByClient = useMemo(() => {
    const map: Record<string, number> = {};
    receivables.forEach(r => {
      map[r.client] = (map[r.client] ?? 0) + r.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [receivables]);

  const maxMonthly = Math.max(...monthly.map(m => Math.max(m.income, m.expense)), 1);

  const hasData = txs.length > 0 || receivables.length > 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Rapports</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Analyse financière annuelle</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm hover:opacity-70"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>‹</button>
          <span className="text-sm font-semibold w-12 text-center" style={{ color: "var(--text-primary)" }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm hover:opacity-70"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>›</button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <p className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Chargement…</p>
        </div>
      ) : !hasData ? (
        <div className="rounded-xl p-12 text-center space-y-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="text-4xl">📊</div>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Aucune donnée pour {year}</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Ajoutez des transactions pour voir vos rapports.</p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Revenus",      value: totals.income,                    color: "var(--success)" },
              { label: "Dépenses",     value: totals.expense,                   color: "var(--danger)"  },
              { label: "Épargne nette",value: totals.income - totals.expense,   color: totals.income >= totals.expense ? "var(--success)" : "var(--danger)" },
              { label: "À percevoir",  value: totalReceivable,                  color: "var(--warning, #f59e0b)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3 sm:p-4 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-base sm:text-lg font-bold tabular-nums mt-1" style={{ color, fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(value)}</p>
              </div>
            ))}
          </div>

          {/* Monthly bar chart */}
          {txs.length > 0 && (
            <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Évolution mensuelle</h2>
              <div className="flex items-end gap-1 sm:gap-2 h-36">
                {monthly.map(({ month, income, expense }) => (
                  <div key={month} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex items-end gap-0.5" style={{ height: "112px" }}>
                      <div className="flex-1 rounded-t-sm transition-all duration-500"
                        style={{ height: `${pct(income, maxMonthly)}%`, backgroundColor: "var(--success)", opacity: income === 0 ? 0.2 : 1, minHeight: income > 0 ? "4px" : "0" }} />
                      <div className="flex-1 rounded-t-sm transition-all duration-500"
                        style={{ height: `${pct(expense, maxMonthly)}%`, backgroundColor: "var(--danger)", opacity: expense === 0 ? 0.2 : 1, minHeight: expense > 0 ? "4px" : "0" }} />
                    </div>
                    <span className="text-[9px] sm:text-[10px]" style={{ color: "var(--text-muted)" }}>{month}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 justify-end">
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "var(--success)" }} /> Revenus
                </span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: "var(--danger)" }} /> Dépenses
                </span>
              </div>
            </div>
          )}

          {/* By activity */}
          <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Par activité</h2>
            <div className="space-y-3">
              {byActivity.filter(a => a.income > 0 || a.expense > 0 || a.pending > 0).map(act => (
                <div key={act.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                      <span>{act.emoji}</span>{act.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {act.pending > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)", color: "#f59e0b" }}>
                          +{fmt(act.pending)} à percevoir
                        </span>
                      )}
                      <span className="text-xs font-semibold tabular-nums" style={{ color: act.balance >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                        {act.balance >= 0 ? "+" : "−"}{fmt(Math.abs(act.balance))}
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${act.color}22` }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct(act.expense, Math.max(act.income, act.expense, 1))}%`, backgroundColor: act.color }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>Revenus : {fmt(act.income)}</span>
                    <span>Dépenses : {fmt(act.expense)}</span>
                  </div>
                </div>
              ))}
              {byActivity.every(a => a.income === 0 && a.expense === 0 && a.pending === 0) && (
                <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>Aucune donnée</p>
              )}
            </div>
          </div>

          {/* Receivables by client */}
          {receivablesByClient.length > 0 && (
            <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>📬 Créances à recevoir</h2>
                <span className="text-xs font-bold tabular-nums" style={{ color: "#f59e0b", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(totalReceivable)}</span>
              </div>
              <div className="space-y-2.5">
                {receivablesByClient.map(([client, amount]) => (
                  <div key={client} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{client}</span>
                        <span className="text-sm font-semibold tabular-nums shrink-0 ml-2" style={{ color: "#f59e0b", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(amount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct(amount, receivablesByClient[0][1])}%`, backgroundColor: "#f59e0b" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {receivables.filter(r => r.status === "to_invoice").length > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full"
                    style={{ backgroundColor: "color-mix(in srgb, #f59e0b 12%, transparent)", color: "#f59e0b" }}>
                    🟡 {receivables.filter(r => r.status === "to_invoice").length} à facturer
                    · {fmt(receivables.filter(r => r.status === "to_invoice").reduce((s, r) => s + r.amount, 0))}
                  </span>
                )}
                {receivables.filter(r => r.status === "invoiced").length > 0 && (
                  <span className="text-xs px-2 py-1 rounded-full"
                    style={{ backgroundColor: "color-mix(in srgb, #8b5cf6 12%, transparent)", color: "#8b5cf6" }}>
                    🔵 {receivables.filter(r => r.status === "invoiced").length} facturées
                    · {fmt(receivables.filter(r => r.status === "invoiced").reduce((s, r) => s + r.amount, 0))}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Top expense categories */}
          {topCategories.length > 0 && (
            <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Top catégories de dépenses</h2>
              <div className="space-y-2.5">
                {topCategories.map(([cat, amount]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{cat}</span>
                        <span className="text-sm font-semibold tabular-nums shrink-0 ml-2" style={{ color: "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(amount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct(amount, topCategories[0][1])}%`, backgroundColor: "var(--danger)" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Savings rate */}
          {totals.income > 0 && (
            <div className="rounded-xl p-5 flex items-center gap-5" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-lg font-bold tabular-nums"
                style={{
                  backgroundColor: totals.income > totals.expense ? "var(--success-light)" : "var(--danger-light)",
                  color: totals.income > totals.expense ? "var(--success)" : "var(--danger)",
                }}>
                {pct(totals.income - totals.expense, totals.income)}%
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Taux d'épargne {year}</p>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {totals.income > totals.expense
                    ? `Vous avez épargné ${fmt(totals.income - totals.expense)} sur l'année.`
                    : `Déficit de ${fmt(totals.expense - totals.income)} sur l'année.`}
                </p>
                {totalReceivable > 0 && (
                  <p className="text-xs mt-1" style={{ color: "#f59e0b" }}>
                    + {fmt(totalReceivable)} en créances à recevoir non comptabilisées
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
