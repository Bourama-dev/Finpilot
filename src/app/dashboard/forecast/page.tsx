"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

const ACTIVITIES: Record<string, { label: string; color: string; emoji: string }> = {
  alternance: { label: "Alternance", color: "#6366f1", emoji: "🎓" },
  cle_avenir: { label: "CléAvenir",  color: "#f59e0b", emoji: "🏢" },
  hakily:     { label: "Hakily",      color: "#10b981", emoji: "🤖" },
  personnel:  { label: "Personnel",   color: "#ec4899", emoji: "🏠" },
};

const FREQ_LABELS: Record<string, string> = {
  daily:   "Quotidien",
  weekly:  "Hebdomadaire",
  monthly: "Mensuel",
  yearly:  "Annuel",
};

type Freq = "daily" | "weekly" | "monthly" | "yearly";

type RecurringTx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  activity: string;
  date: string;
  recurring_frequency: Freq;
};

type HistTx = {
  type: "income" | "expense";
  amount: number;
  date: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function monthlyEquivalent(tx: RecurringTx, target: Date): number {
  switch (tx.recurring_frequency) {
    case "daily":   return tx.amount * 30;
    case "weekly":  return tx.amount * 4;
    case "monthly": return tx.amount;
    case "yearly": {
      const txMo = parseInt(tx.date.slice(5, 7), 10);
      return target.getMonth() + 1 === txMo ? tx.amount : 0;
    }
  }
}

export default function ForecastPage() {
  const [horizon, setHorizon] = useState(6);
  const [recurring, setRecurring] = useState<RecurringTx[]>([]);
  const [historical, setHistorical] = useState<HistTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [activeTab, setActiveTab] = useState<"chart" | "table">("chart");

  useEffect(() => {
    async function load() {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const [{ data: rec }, { data: hist }] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, type, amount, category, description, activity, date, recurring_frequency")
          .eq("is_recurring", true),
        supabase
          .from("transactions")
          .select("type, amount, date")
          .eq("is_recurring", false)
          .gte("date", threeMonthsAgo.toISOString().slice(0, 10)),
      ]);
      if (rec)  setRecurring(rec as RecurringTx[]);
      if (hist) setHistorical(hist as HistTx[]);
      setLoading(false);
    }
    load();
  }, []);

  const { months, totals, avgHistIncome, avgHistExpense } = useMemo(() => {
    const now = new Date();

    const histIncome  = historical.filter(t => t.type === "income" ).reduce((s, t) => s + t.amount, 0);
    const histExpense = historical.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const avgHistIncome  = histIncome  / 3;
    const avgHistExpense = histExpense / 3;

    let cumulative = 0;

    const months = Array.from({ length: horizon }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const label = date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

      const recurIncome  = recurring.filter(t => t.type === "income" ).reduce((s, t) => s + monthlyEquivalent(t, date), 0);
      const recurExpense = recurring.filter(t => t.type === "expense").reduce((s, t) => s + monthlyEquivalent(t, date), 0);

      const income  = recurIncome  + (includeHistory ? avgHistIncome  : 0);
      const expense = recurExpense + (includeHistory ? avgHistExpense : 0);
      const net     = income - expense;
      cumulative   += net;

      return { label, date, income, expense, net, cumulative, recurIncome, recurExpense };
    });

    const totalIncome  = months.reduce((s, m) => s + m.income,  0);
    const totalExpense = months.reduce((s, m) => s + m.expense, 0);

    return {
      months,
      totals: { income: totalIncome, expense: totalExpense, net: totalIncome - totalExpense },
      avgHistIncome,
      avgHistExpense,
    };
  }, [recurring, historical, horizon, includeHistory]);

  const maxBar = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);
  const maxCum = Math.max(...months.map(m => Math.abs(m.cumulative)), 1);

  const incomeRecurring  = recurring.filter(t => t.type === "income");
  const expenseRecurring = recurring.filter(t => t.type === "expense");

  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Prévisionnel</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Projection de vos flux financiers futurs
          </p>
        </div>

        {/* Horizon */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {[3, 6, 12].map(h => (
            <button key={h} onClick={() => setHorizon(h)}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={horizon === h
                ? { backgroundColor: "var(--accent)", color: "#fff" }
                : { backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
              {h} mois
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <p className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Calcul des projections…</p>
        </div>
      ) : recurring.length === 0 && !includeHistory ? (
        <div className="rounded-xl py-16 text-center space-y-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="text-4xl">🔮</div>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Aucune donnée de projection</p>
          <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
            Ajoutez des transactions récurrentes pour générer des prévisions automatiques.
          </p>
          <Link href="/dashboard/transactions"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium mt-2"
            style={{ backgroundColor: "var(--accent)" }}>
            + Ajouter une transaction récurrente
          </Link>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Revenus prévus",  value: totals.income,  color: "var(--success)" },
              { label: "Dépenses prévues", value: totals.expense, color: "var(--danger)"  },
              { label: "Épargne nette",    value: totals.net,     color: totals.net >= 0 ? "var(--success)" : "var(--danger)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-base sm:text-lg font-bold tabular-nums" style={{ color, fontFamily: "var(--font-dm-mono, monospace)" }}>
                  {value >= 0 ? "" : "−"}{fmt(Math.abs(value))}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>sur {horizon} mois</p>
              </div>
            ))}
          </div>

          {/* Include history toggle */}
          <button type="button" onClick={() => setIncludeHistory(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={includeHistory
              ? { backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)", border: "1px solid var(--accent)", color: "var(--accent)" }
              : { backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <span className="w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px]"
              style={includeHistory ? { backgroundColor: "var(--accent)", borderColor: "var(--accent)", color: "#fff" } : { borderColor: "currentColor" }}>
              {includeHistory ? "✓" : ""}
            </span>
            Inclure la tendance historique — moy. {fmt(avgHistIncome)}/mois revenus · {fmt(avgHistExpense)}/mois dépenses
          </button>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: "var(--bg-tertiary)" }}>
            {([["chart", "📈 Graphiques"], ["table", "📋 Détail mensuel"]] as const).map(([tab, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={activeTab === tab
                  ? { backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)", boxShadow: "var(--shadow-sm)" }
                  : { color: "var(--text-muted)" }}>
                {label}
              </button>
            ))}
          </div>

          {activeTab === "chart" && (
            <>
              {/* Bar chart — monthly flux */}
              <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <h2 className="text-sm font-semibold mb-5" style={{ color: "var(--text-primary)" }}>Flux mensuel projeté</h2>
                <div className="flex items-end gap-2" style={{ height: 160 }}>
                  {months.map((m, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <div className="w-full flex gap-0.5 items-end" style={{ height: 130 }}>
                        <div className="flex-1 rounded-t transition-all"
                          style={{ height: `${Math.max((m.income / maxBar) * 100, m.income > 0 ? 1 : 0)}%`, backgroundColor: "var(--success)", opacity: 0.75 }}
                          title={`Revenus: ${fmt(m.income)}`} />
                        <div className="flex-1 rounded-t transition-all"
                          style={{ height: `${Math.max((m.expense / maxBar) * 100, m.expense > 0 ? 1 : 0)}%`, backgroundColor: "var(--danger)", opacity: 0.75 }}
                          title={`Dépenses: ${fmt(m.expense)}`} />
                      </div>
                      <span className="text-[10px] whitespace-nowrap overflow-hidden" style={{ color: "var(--text-muted)" }}>{m.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-5 mt-3">
                  {[["var(--success)", "Revenus"], ["var(--danger)", "Dépenses"]].map(([c, l]) => (
                    <span key={l} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: c as string, opacity: 0.75 }} />{l}
                    </span>
                  ))}
                </div>
              </div>

              {/* Cumulative balance */}
              <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Solde cumulé projeté</h2>
                <div className="space-y-2">
                  {months.map((m, i) => {
                    const pct = Math.min(Math.abs(m.cumulative) / maxCum * 100, 100);
                    const isPos = m.cumulative >= 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs w-12 shrink-0 text-right" style={{ color: "var(--text-muted)" }}>{m.label}</span>
                        <div className="flex-1 h-5 rounded-lg relative overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                          <div className="h-full rounded-lg transition-all"
                            style={{ width: `${pct}%`, backgroundColor: isPos ? "var(--success)" : "var(--danger)", opacity: 0.65 }} />
                        </div>
                        <span className="text-xs font-semibold tabular-nums w-24 shrink-0 text-right"
                          style={{ color: isPos ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                          {isPos ? "+" : ""}{fmt(m.cumulative)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                  Cumul à partir de zéro — ajoutez votre solde actuel pour une projection absolue.
                </p>
              </div>
            </>
          )}

          {activeTab === "table" && (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Mois", "Revenus", "Dépenses", "Net", "Cumulé"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, i) => (
                    <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                      <td className="px-4 py-3 font-medium text-xs" style={{ color: "var(--text-primary)" }}>{m.label}</td>
                      <td className="px-4 py-3 tabular-nums text-xs font-medium" style={{ color: "var(--success)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(m.income)}</td>
                      <td className="px-4 py-3 tabular-nums text-xs font-medium" style={{ color: "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(m.expense)}</td>
                      <td className="px-4 py-3 tabular-nums text-xs font-semibold" style={{ color: m.net >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                        {m.net >= 0 ? "+" : ""}{fmt(m.net)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-xs font-semibold" style={{ color: m.cumulative >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                        {m.cumulative >= 0 ? "+" : ""}{fmt(m.cumulative)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)", backgroundColor: "var(--bg-tertiary)" }}>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: "var(--text-primary)" }}>Total {horizon} mois</td>
                    <td className="px-4 py-3 tabular-nums text-xs font-bold" style={{ color: "var(--success)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(totals.income)}</td>
                    <td className="px-4 py-3 tabular-nums text-xs font-bold" style={{ color: "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(totals.expense)}</td>
                    <td className="px-4 py-3 tabular-nums text-xs font-bold" style={{ color: totals.net >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                      {totals.net >= 0 ? "+" : ""}{fmt(totals.net)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Recurring transactions breakdown */}
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { list: incomeRecurring,  label: "Revenus récurrents",  type: "income"  as const },
              { list: expenseRecurring, label: "Dépenses récurrentes", type: "expense" as const },
            ].map(({ list, label, type }) => (
              <div key={type} className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: list.length > 0 ? "1px solid var(--border)" : undefined }}>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                    {list.length}
                  </span>
                </div>
                {list.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Aucun</p>
                ) : (
                  <ul>
                    {list.map((tx, i) => {
                      const act = ACTIVITIES[tx.activity];
                      const nextMonthEquiv = monthlyEquivalent(tx, new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1));
                      return (
                        <li key={tx.id} className="flex items-center gap-3 px-4 py-3"
                          style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                            style={{ backgroundColor: `${act?.color ?? "#888"}1a` }}>
                            {act?.emoji ?? "💶"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {tx.description ?? tx.category}
                            </p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                              style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
                              {FREQ_LABELS[tx.recurring_frequency]}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold tabular-nums"
                              style={{ color: type === "income" ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                              {fmt(tx.amount)}
                            </p>
                            {tx.recurring_frequency !== "monthly" && nextMonthEquiv > 0 && (
                              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>≈ {fmt(nextMonthEquiv)}/mois</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
