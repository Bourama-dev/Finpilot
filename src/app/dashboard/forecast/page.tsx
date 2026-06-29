"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useActivities, getActivity } from "@/hooks/useActivities";
import { Tooltip, TRow, TDivider } from "@/components/ui/Tooltip";

const FREQ_LABELS: Record<string, string> = {
  daily:   "Quotidien",
  weekly:  "Hebdomadaire",
  monthly: "Mensuel",
  yearly:  "Annuel",
};

// URSSAF micro-entrepreneur — taux BNC (prestations de services libéraux) 2025
const URSSAF_ACTS = new Set(["freelance", "hakily", "cle_avenir"]);
const URSSAF_RATE = 0.231;

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
  activity: string;
  category: string;
};

type Receivable = {
  id: string;
  client: string;
  amount: number;
  status: "to_invoice" | "invoiced" | "paid";
  activity: string;
  service_date: string | null;
  updated_at: string;
};

type PendingReceivable = Receivable & { status: "to_invoice" | "invoiced" };

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

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

function expectedPaymentMonth(r: PendingReceivable): Date {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  if (r.service_date) {
    const sd = new Date(r.service_date);
    if (!isNaN(sd.getTime())) {
      // Both statuses: 1 month from service date (30-day payment terms, invoice sent promptly)
      const expected = new Date(sd.getFullYear(), sd.getMonth() + 1, 1);
      return expected <= now ? nextMonth : expected;
    }
  }

  return nextMonth;
}

export default function ForecastPage() {
  const { activities } = useActivities();
  const [horizon, setHorizon] = useState(6);
  const [recurring, setRecurring] = useState<RecurringTx[]>([]);
  const [historical, setHistorical] = useState<HistTx[]>([]);
  const [allReceivables, setAllReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [activeTab, setActiveTab] = useState<"chart" | "table">("chart");

  useEffect(() => {
    async function load() {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const [{ data: rec }, { data: hist }, { data: recvData }] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, type, amount, category, description, activity, date, recurring_frequency")
          .eq("is_recurring", true),
        supabase
          .from("transactions")
          .select("type, amount, date, activity, category")
          .eq("is_recurring", false)
          .gte("date", threeMonthsAgo.toISOString().slice(0, 10)),
        supabase
          .from("receivables")
          .select("id, client, amount, status, activity, service_date, updated_at"),
      ]);
      if (rec)      setRecurring(rec as RecurringTx[]);
      if (hist)     setHistorical(hist as HistTx[]);
      if (recvData) setAllReceivables(recvData as Receivable[]);
      setLoading(false);
    }
    load();
  }, []);

  const {
    months,
    totals,
    avgHistIncome,
    avgHistExpense,
    avgHistUrssafIncome,
    estimatedUrssaf,
    totalUrssafBase,
    receivables,
  } = useMemo(() => {
    const now = new Date();

    // Paid receivables from the last 3 months count as historical income
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - 3);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const receivables = allReceivables.filter(r => r.status !== "paid") as PendingReceivable[];
    const paidReceivables = allReceivables.filter(
      r => r.status === "paid" && r.updated_at.slice(0, 10) >= cutoffStr,
    );

    // Historical income = non-recurring income transactions (excluding "Créance client" which are
    // auto-created when a receivable is paid — those are already counted via paidReceivables below)
    // + paid receivables from last 3 months (for backward compat with pre-auto-tx receivables)
    const allHistIncome: Array<{ amount: number; activity: string }> = [
      ...historical.filter(t => t.type === "income" && t.category !== "Créance client"),
      ...paidReceivables.map(r => ({ amount: r.amount, activity: r.activity })),
    ];
    const histIncomeTotal = allHistIncome.reduce((s, t) => s + t.amount, 0);
    const histExpenseTotal = historical.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const avgHistIncome  = histIncomeTotal  / 3;
    const avgHistExpense = histExpenseTotal / 3;

    // URSSAF historical average (from URSSAF activities only)
    const histUrssafIncome = allHistIncome
      .filter(t => URSSAF_ACTS.has(t.activity))
      .reduce((s, t) => s + t.amount, 0);
    const avgHistUrssafIncome = histUrssafIncome / 3;

    // Pending receivables by expected payment month
    const receivablesByMonthKey = new Map<string, PendingReceivable[]>();
    receivables.forEach(r => {
      const payDate = expectedPaymentMonth(r);
      const key = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, "0")}`;
      if (!receivablesByMonthKey.has(key)) receivablesByMonthKey.set(key, []);
      receivablesByMonthKey.get(key)!.push(r);
    });

    let cumulative = 0;
    let totalUrssafBase = 0;

    const months = Array.from({ length: horizon }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const label = date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const recurIncome  = recurring.filter(t => t.type === "income" ).reduce((s, t) => s + monthlyEquivalent(t, date), 0);
      const recurExpense = recurring.filter(t => t.type === "expense").reduce((s, t) => s + monthlyEquivalent(t, date), 0);

      const monthReceivables = receivablesByMonthKey.get(monthKey) ?? [];
      const receivableIncome = monthReceivables.reduce((s, r) => s + r.amount, 0);

      // URSSAF base for this month
      const recurUrssaf = recurring
        .filter(t => t.type === "income" && URSSAF_ACTS.has(t.activity))
        .reduce((s, t) => s + monthlyEquivalent(t, date), 0);
      const recvUrssaf = monthReceivables
        .filter(r => URSSAF_ACTS.has(r.activity))
        .reduce((s, r) => s + r.amount, 0);
      const histUrssaf = includeHistory ? avgHistUrssafIncome : 0;
      const monthUrssafBase = recurUrssaf + recvUrssaf + histUrssaf;
      totalUrssafBase += monthUrssafBase;

      const income  = recurIncome  + (includeHistory ? avgHistIncome  : 0) + receivableIncome;
      const expense = recurExpense + (includeHistory ? avgHistExpense : 0);
      const net     = income - expense;
      cumulative   += net;

      return {
        label, date, monthKey, income, expense, net, cumulative,
        recurIncome, recurExpense, receivableIncome, monthReceivables, monthUrssafBase,
      };
    });

    const totalIncome  = months.reduce((s, m) => s + m.income,  0);
    const totalExpense = months.reduce((s, m) => s + m.expense, 0);
    const estimatedUrssaf = totalUrssafBase * URSSAF_RATE;

    return {
      months,
      totals: { income: totalIncome, expense: totalExpense, net: totalIncome - totalExpense },
      avgHistIncome,
      avgHistExpense,
      avgHistUrssafIncome,
      estimatedUrssaf,
      totalUrssafBase,
      receivables,
    };
  }, [recurring, historical, allReceivables, horizon, includeHistory]);

  // Per-activity URSSAF base (recurring + receivables, excluding history component)
  const urssafActDetails = useMemo(() =>
    Array.from(URSSAF_ACTS).map(actKey => {
      const act = getActivity(actKey, activities);
      const base = months.reduce((total, m) => {
        const recurPart = recurring
          .filter(t => t.type === "income" && t.activity === actKey)
          .reduce((s, t) => s + monthlyEquivalent(t, m.date), 0);
        const recvPart = m.monthReceivables
          .filter(r => r.activity === actKey)
          .reduce((s, r) => s + r.amount, 0);
        return total + recurPart + recvPart;
      }, 0);
      return { key: actKey, label: act.label, emoji: act.emoji, color: act.color, base, cotisations: base * URSSAF_RATE };
    }).filter(a => a.base > 0),
    [months, recurring]
  );

  const maxBar = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);
  const maxCum = Math.max(...months.map(m => Math.abs(m.cumulative)), 1);

  const incomeRecurring  = recurring.filter(t => t.type === "income");
  const expenseRecurring = recurring.filter(t => t.type === "expense");
  const totalReceivableInForecast = months.reduce((s, m) => s + m.receivableIncome, 0);
  const totalRecurIncome  = months.reduce((s, m) => s + m.recurIncome,  0);
  const totalRecurExpense = months.reduce((s, m) => s + m.recurExpense, 0);
  const totalHistIncomeAmt  = includeHistory ? avgHistIncome  * horizon : 0;
  const totalHistExpenseAmt = includeHistory ? avgHistExpense * horizon : 0;

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
      ) : recurring.length === 0 && !includeHistory && receivables.length === 0 ? (
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Revenus prévus */}
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Revenus prévus</p>
              <p className="text-base sm:text-lg font-bold tabular-nums" style={{ color: "var(--success)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                <Tooltip align="left" content={
                  <div className="p-3 space-y-0.5">
                    <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>💰 Revenus sur {horizon} mois</p>
                    <TRow label="🔄 Récurrents" value={fmt(totalRecurIncome)} color="var(--success)" />
                    {includeHistory && <TRow label="📊 Moy. hist. 3 mois" value={fmt(totalHistIncomeAmt)} muted />}
                    {totalReceivableInForecast > 0 && <TRow label="📬 Créances" value={fmt(totalReceivableInForecast)} color="#f59e0b" />}
                    <TDivider />
                    <TRow label="= Total" value={fmt(totals.income)} color="var(--success)" />
                  </div>
                }>{fmt(totals.income)}</Tooltip>
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>sur {horizon} mois</p>
            </div>
            {/* Dépenses prévues */}
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Dépenses prévues</p>
              <p className="text-base sm:text-lg font-bold tabular-nums" style={{ color: "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                <Tooltip align="center" content={
                  <div className="p-3 space-y-0.5">
                    <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>💸 Dépenses sur {horizon} mois</p>
                    <TRow label="🔄 Récurrents" value={fmt(totalRecurExpense)} color="var(--danger)" />
                    {includeHistory && <TRow label="📊 Moy. hist. 3 mois" value={fmt(totalHistExpenseAmt)} muted />}
                    <TDivider />
                    <TRow label="= Total" value={fmt(totals.expense)} color="var(--danger)" />
                  </div>
                }>{fmt(totals.expense)}</Tooltip>
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>sur {horizon} mois</p>
            </div>
            {/* Épargne nette */}
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Épargne nette</p>
              <p className="text-base sm:text-lg font-bold tabular-nums" style={{ color: totals.net >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                <Tooltip align="center" content={
                  <div className="p-3 space-y-0.5">
                    <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📊 Net sur {horizon} mois</p>
                    <TRow label="+ Revenus" value={fmt(totals.income)} color="var(--success)" />
                    <TRow label="− Dépenses" value={fmt(totals.expense)} color="var(--danger)" />
                    <TDivider />
                    <TRow label="= Épargne nette" value={`${totals.net >= 0 ? "+" : ""}${fmt(totals.net)}`} color={totals.net >= 0 ? "var(--success)" : "var(--danger)"} />
                    <p className="text-[9px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                      {totals.net >= 0 ? `Bilan positif sur ${horizon} mois ✓` : `Bilan déficitaire sur ${horizon} mois`}
                    </p>
                  </div>
                }>{totals.net >= 0 ? "+" : "−"}{fmt(Math.abs(totals.net))}</Tooltip>
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>sur {horizon} mois</p>
            </div>
            {/* Créances incluses */}
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Créances incluses</p>
              <p className="text-base sm:text-lg font-bold tabular-nums" style={{ color: "#f59e0b", fontFamily: "var(--font-dm-mono, monospace)" }}>
                <Tooltip align="right" content={
                  <div className="p-3 space-y-0.5">
                    <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📬 Créances à recevoir</p>
                    {receivables.length === 0 ? (
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Aucune créance en attente</p>
                    ) : (
                      receivables.map((r, ri) => (
                        <TRow key={ri} label={r.client} value={fmtFull(r.amount)} color="#f59e0b" />
                      ))
                    )}
                    {receivables.length > 0 && <><TDivider /><TRow label="= Total" value={fmt(totalReceivableInForecast)} color="#f59e0b" /></>}
                  </div>
                }>{fmt(totalReceivableInForecast)}</Tooltip>
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>sur {horizon} mois</p>
            </div>
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
            Inclure la moy. historique 3 mois — {fmt(avgHistIncome)}/mois revenus · {fmt(avgHistExpense)}/mois dépenses
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
                          title={`Revenus: ${fmt(m.income)}${m.receivableIncome > 0 ? ` (dont ${fmt(m.receivableIncome)} créances)` : ""}`} />
                        <div className="flex-1 rounded-t transition-all"
                          style={{ height: `${Math.max((m.expense / maxBar) * 100, m.expense > 0 ? 1 : 0)}%`, backgroundColor: "var(--danger)", opacity: 0.75 }}
                          title={`Dépenses: ${fmt(m.expense)}`} />
                      </div>
                      <span className="text-[10px] whitespace-nowrap overflow-hidden" style={{ color: "var(--text-muted)" }}>{m.label}</span>
                      {m.receivableIncome > 0 && (
                        <span className="text-[9px]" style={{ color: "#f59e0b" }}>📬</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-5 mt-3">
                  {[["var(--success)", "Revenus"], ["var(--danger)", "Dépenses"]].map(([c, l]) => (
                    <span key={l} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: c as string, opacity: 0.75 }} />{l}
                    </span>
                  ))}
                  {totalReceivableInForecast > 0 && (
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span>📬</span> Mois avec créances
                    </span>
                  )}
                </div>
              </div>

              {/* Cumulative balance */}
              <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Solde cumulé projeté</h2>
                <div className="space-y-2">
                  {months.map((m, i) => {
                    const barPct = Math.min(Math.abs(m.cumulative) / maxCum * 100, 100);
                    const isPos = m.cumulative >= 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs w-12 shrink-0 text-right" style={{ color: "var(--text-muted)" }}>{m.label}</span>
                        <div className="flex-1 h-5 rounded-lg relative overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                          <div className="h-full rounded-lg transition-all"
                            style={{ width: `${barPct}%`, backgroundColor: isPos ? "var(--success)" : "var(--danger)", opacity: 0.65 }} />
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
                    {["Mois", "Revenus", "dont créances", "Dépenses", "Net", "Cumulé"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {months.map((m, i) => (
                    <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                      <td className="px-4 py-3 font-medium text-xs" style={{ color: "var(--text-primary)" }}>{m.label}</td>

                      {/* Revenus */}
                      <td className="px-4 py-3 tabular-nums text-xs font-medium" style={{ color: "var(--success)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                        <Tooltip align="left" content={
                          <div className="p-3 space-y-0.5">
                            <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>💰 Revenus — {m.label}</p>
                            <TRow label="🔄 Récurrents" value={fmt(m.recurIncome)} color="var(--success)" />
                            {includeHistory && <TRow label="📊 Moy. 3 mois hist." value={fmt(avgHistIncome)} muted />}
                            {m.receivableIncome > 0 && <TRow label="📬 Créances" value={fmt(m.receivableIncome)} color="#f59e0b" />}
                            <TDivider />
                            <TRow label="= Total" value={fmt(m.income)} color="var(--success)" />
                          </div>
                        }>{fmt(m.income)}</Tooltip>
                      </td>

                      {/* Dont créances */}
                      <td className="px-4 py-3 tabular-nums text-xs" style={{ color: m.receivableIncome > 0 ? "#f59e0b" : "var(--text-muted)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                        {m.receivableIncome > 0 ? (
                          <Tooltip align="center" content={
                            <div className="p-3 space-y-0.5">
                              <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📬 Créances — {m.label}</p>
                              {m.monthReceivables.map((r, ri) => (
                                <div key={ri}>
                                  <TRow label={r.client} value={fmtFull(r.amount)} color="#f59e0b" />
                                  {r.service_date && (
                                    <p className="text-[9px] pl-0 mb-1" style={{ color: "var(--text-muted)" }}>
                                      Prestation : {new Date(r.service_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                      {" · "}{r.status === "invoiced" ? "Facturée" : "À facturer"}
                                    </p>
                                  )}
                                </div>
                              ))}
                              <TDivider />
                              <TRow label="= Total" value={fmt(m.receivableIncome)} color="#f59e0b" />
                            </div>
                          }>{fmt(m.receivableIncome)}</Tooltip>
                        ) : "—"}
                      </td>

                      {/* Dépenses */}
                      <td className="px-4 py-3 tabular-nums text-xs font-medium" style={{ color: "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                        <Tooltip align="center" content={
                          <div className="p-3 space-y-0.5">
                            <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>💸 Dépenses — {m.label}</p>
                            <TRow label="🔄 Récurrents" value={fmt(m.recurExpense)} color="var(--danger)" />
                            {includeHistory && <TRow label="📊 Moy. 3 mois hist." value={fmt(avgHistExpense)} muted />}
                            <TDivider />
                            <TRow label="= Total" value={fmt(m.expense)} color="var(--danger)" />
                          </div>
                        }>{fmt(m.expense)}</Tooltip>
                      </td>

                      {/* Net */}
                      <td className="px-4 py-3 tabular-nums text-xs font-semibold" style={{ color: m.net >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                        <Tooltip align="right" content={
                          <div className="p-3 space-y-0.5">
                            <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📊 Net — {m.label}</p>
                            <TRow label="+ Revenus" value={fmt(m.income)} color="var(--success)" />
                            <TRow label="− Dépenses" value={fmt(m.expense)} color="var(--danger)" />
                            <TDivider />
                            <TRow label="= Net" value={`${m.net >= 0 ? "+" : ""}${fmt(m.net)}`} color={m.net >= 0 ? "var(--success)" : "var(--danger)"} />
                            <p className="text-[9px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                              {m.net >= 0 ? "Mois excédentaire ✓" : "Mois déficitaire — à surveiller"}
                            </p>
                          </div>
                        }>{m.net >= 0 ? "+" : ""}{fmt(m.net)}</Tooltip>
                      </td>

                      {/* Cumulé */}
                      <td className="px-4 py-3 tabular-nums text-xs font-semibold" style={{ color: m.cumulative >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                        <Tooltip align="right" content={
                          <div className="p-3 space-y-0.5">
                            <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📈 Cumulé — {m.label}</p>
                            <TRow label="Mois précédents" value={fmt(m.cumulative - m.net)} muted />
                            <TRow label={`+ Net ${m.label}`} value={`${m.net >= 0 ? "+" : ""}${fmt(m.net)}`} color={m.net >= 0 ? "var(--success)" : "var(--danger)"} />
                            <TDivider />
                            <TRow label="= Cumulé" value={`${m.cumulative >= 0 ? "+" : ""}${fmt(m.cumulative)}`} color={m.cumulative >= 0 ? "var(--success)" : "var(--danger)"} />
                            <p className="text-[9px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                              {m.cumulative >= 0 ? `+${fmt(m.cumulative)} d'épargne cumulée` : `Déficit cumulé de ${fmt(Math.abs(m.cumulative))}`}
                            </p>
                          </div>
                        }>{m.cumulative >= 0 ? "+" : ""}{fmt(m.cumulative)}</Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--border)", backgroundColor: "var(--bg-tertiary)" }}>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: "var(--text-primary)" }}>Total {horizon} mois</td>
                    <td className="px-4 py-3 tabular-nums text-xs font-bold" style={{ color: "var(--success)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(totals.income)}</td>
                    <td className="px-4 py-3 tabular-nums text-xs font-bold" style={{ color: "#f59e0b", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(totalReceivableInForecast)}</td>
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

          {/* Receivables in forecast */}
          {receivables.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>📬 Créances à recevoir</h3>
                <span className="text-xs font-bold tabular-nums" style={{ color: "#f59e0b", fontFamily: "var(--font-dm-mono, monospace)" }}>
                  {fmtFull(receivables.reduce((s, r) => s + r.amount, 0))}
                </span>
              </div>
              <ul>
                {receivables.map((r, i) => {
                  const act = getActivity(r.activity, activities);
                  const payDate = expectedPaymentMonth(r);
                  const payLabel = payDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-3"
                      style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ backgroundColor: `${act?.color ?? "#888"}1a` }}>
                        {act?.emoji ?? "💶"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{r.client}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          Paiement prévu : {payLabel}
                          {r.service_date && (
                            <> · Prestation : {new Date(r.service_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</>
                          )}
                          {" · "}{r.status === "invoiced" ? "Facturée" : "À facturer"}
                        </p>
                      </div>
                      <span className="text-xs font-bold tabular-nums shrink-0"
                        style={{ color: "#f59e0b", fontFamily: "var(--font-dm-mono, monospace)" }}>
                        {fmtFull(r.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* URSSAF estimate */}
          {(estimatedUrssaf > 0 || totalUrssafBase > 0) && (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-base">⚖️</span>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Cotisations URSSAF estimées</h3>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)", color: "var(--danger)" }}>
                  Taux BNC {(URSSAF_RATE * 100).toFixed(1)} %
                </span>
              </div>

              <div className="p-4 grid sm:grid-cols-3 gap-4">
                <div className="rounded-lg p-3 text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Cotisations sur {horizon} mois</p>
                  <p className="text-lg font-bold tabular-nums" style={{ color: "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                    <Tooltip align="left" content={
                      <div className="p-3 space-y-0.5">
                        <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>⚖️ Cotisations par activité</p>
                        {urssafActDetails.map(a => (
                          <TRow key={a.key} label={`${a.emoji} ${a.label}`} value={fmtFull(a.cotisations)} color="var(--danger)" />
                        ))}
                        {includeHistory && avgHistUrssafIncome > 0 && (
                          <TRow label="📊 Hist. URSSAF" value={fmtFull(avgHistUrssafIncome * horizon * URSSAF_RATE)} muted />
                        )}
                        <TDivider />
                        <TRow label="= Total" value={fmtFull(estimatedUrssaf)} color="var(--danger)" />
                        <p className="text-[9px] mt-1.5" style={{ color: "var(--text-muted)" }}>Taux BNC {(URSSAF_RATE * 100).toFixed(1)} %</p>
                      </div>
                    }>{fmtFull(estimatedUrssaf)}</Tooltip>
                  </p>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Moyenne mensuelle</p>
                  <p className="text-lg font-bold tabular-nums" style={{ color: "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                    <Tooltip align="center" content={
                      <div className="p-3 space-y-0.5">
                        <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📅 Calcul mensuel</p>
                        <TRow label={`Total ${horizon} mois`} value={fmtFull(estimatedUrssaf)} muted />
                        <TRow label={`÷ ${horizon} mois`} value="" muted />
                        <TDivider />
                        <TRow label="= Moy./mois" value={fmtFull(estimatedUrssaf / horizon)} color="var(--danger)" />
                      </div>
                    }>{fmtFull(estimatedUrssaf / horizon)}</Tooltip>
                  </p>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>CA soumis URSSAF</p>
                  <p className="text-lg font-bold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                    <Tooltip align="right" content={
                      <div className="p-3 space-y-0.5">
                        <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📋 CA soumis par activité</p>
                        {urssafActDetails.map(a => (
                          <TRow key={a.key} label={`${a.emoji} ${a.label}`} value={fmtFull(a.base)} color="var(--text-primary)" />
                        ))}
                        {includeHistory && avgHistUrssafIncome > 0 && (
                          <TRow label="📊 Hist. URSSAF" value={fmtFull(avgHistUrssafIncome * horizon)} muted />
                        )}
                        <TDivider />
                        <TRow label="= CA total" value={fmtFull(totalUrssafBase)} color="var(--text-primary)" />
                      </div>
                    }>{fmtFull(totalUrssafBase)}</Tooltip>
                  </p>
                </div>
              </div>

              {urssafActDetails.length > 0 && (
                <div className="px-4 pb-4 space-y-2">
                  {urssafActDetails.map(a => (
                    <div key={a.key} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                        style={{ backgroundColor: `${a.color}1a` }}>
                        {a.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{a.label}</span>
                          <span className="text-xs tabular-nums" style={{ color: "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                            {fmtFull(a.cotisations)}
                          </span>
                        </div>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          CA : {fmtFull(a.base)} sur {horizon} mois
                        </p>
                      </div>
                    </div>
                  ))}
                  {includeHistory && avgHistUrssafIncome > 0 && (
                    <p className="text-[10px] pt-1" style={{ color: "var(--text-muted)" }}>
                      + tendance historique incluse dans le calcul ({fmtFull(avgHistUrssafIncome)}/mois moy. URSSAF)
                    </p>
                  )}
                </div>
              )}

              <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Activités concernées : Freelance · Hakily · CléAvenir — taux micro-entrepreneur BNC 23,1 % (2025).
                  Estimation indicative, hors CFE, TVA, et impôt sur le revenu.
                </p>
              </div>
            </div>
          )}

          {/* Recurring transactions breakdown */}
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { list: incomeRecurring,  label: "Revenus récurrents",   type: "income"  as const },
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
                      const act = getActivity(tx.activity, activities);
                      const nextMonthEquiv = monthlyEquivalent(tx, new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1));
                      return (
                        <li key={tx.id} className="flex items-center gap-3 px-4 py-3"
                          style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                            style={{ backgroundColor: `${act?.color ?? "#888"}1a` }}>
                            {act?.emoji ?? "💶"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                                {tx.description ?? tx.category}
                              </p>
                              {URSSAF_ACTS.has(tx.activity) && (
                                <span className="text-[9px] px-1 py-px rounded shrink-0"
                                  style={{ backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)", color: "var(--danger)" }}>
                                  URSSAF
                                </span>
                              )}
                            </div>
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
