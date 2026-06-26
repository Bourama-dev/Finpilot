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

type TX = {
  id: string;
  activity: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  date: string;
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
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("transactions")
        .select("id, activity, type, amount, category, date")
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`)
        .order("date", { ascending: true });
      if (data) setTxs(data as TX[]);
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

  const byActivity = useMemo(() =>
    ACTIVITIES.map(act => {
      const actTxs = txs.filter(t => t.activity === act.key);
      const income  = actTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = actTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      return { ...act, income, expense, balance: income - expense };
    }), [txs]);

  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    txs.filter(t => t.type === "expense").forEach(t => {
      map[t.category] = (map[t.category] ?? 0) + t.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [txs]);

  const maxMonthly = Math.max(...monthly.map(m => Math.max(m.income, m.expense)), 1);

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
      ) : txs.length === 0 ? (
        <div className="rounded-xl p-12 text-center space-y-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="text-4xl">📊</div>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Aucune donnée pour {year}</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Ajoutez des transactions pour voir vos rapports.</p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Revenus", value: totals.income, color: "var(--success)" },
              { label: "Dépenses", value: totals.expense, color: "var(--danger)" },
              { label: "Épargne nette", value: totals.income - totals.expense, color: totals.income >= totals.expense ? "var(--success)" : "var(--danger)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3 sm:p-4 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-base sm:text-lg font-bold tabular-nums mt-1" style={{ color, fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(value)}</p>
              </div>
            ))}
          </div>

          {/* Monthly bar chart */}
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

          {/* By activity */}
          <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Par activité</h2>
            <div className="space-y-3">
              {byActivity.filter(a => a.income > 0 || a.expense > 0).map(act => (
                <div key={act.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                      <span>{act.emoji}</span>{act.label}
                    </span>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: act.balance >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                      {act.balance >= 0 ? "+" : "−"}{fmt(Math.abs(act.balance))}
                    </span>
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
              {byActivity.every(a => a.income === 0 && a.expense === 0) && (
                <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>Aucune donnée</p>
              )}
            </div>
          </div>

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
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
