"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useActivities } from "@/hooks/useActivities";
import { Tooltip, TRow, TDivider } from "@/components/ui/Tooltip";

type Transaction = {
  id: string;
  description: string | null;
  amount: number;
  type: "income" | "expense";
  activity: string | null;
  date: string;
  category: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export default function DashboardPage() {
  const { activities } = useActivities();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const name =
          (user.user_metadata?.full_name as string | undefined) ??
          user.email?.split("@")[0] ??
          null;
        setUserName(name);
      }

      const { data } = await supabase
        .from("transactions")
        .select("id, description, amount, type, activity, date, category")
        .eq("excluded_from_totals", false)
        .order("date", { ascending: false })
        .limit(50);

      if (data) setTransactions(data as Transaction[]);
      setLoading(false);
    }
    load();
  }, []);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonth = transactions.filter((t) => t.date?.startsWith(currentMonth));
  const totalIncome = thisMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = thisMonth.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;

  const incomeByActivity = activities.map(a => ({
    ...a,
    amount: thisMonth.filter(t => t.type === "income" && t.activity === a.key).reduce((s, t) => s + t.amount, 0),
  })).filter(a => a.amount > 0);

  const expenseByActivity = activities.map(a => ({
    ...a,
    amount: thisMonth.filter(t => t.type === "expense" && t.activity === a.key).reduce((s, t) => s + t.amount, 0),
  })).filter(a => a.amount > 0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const monthLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5 sm:space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {greeting()}{userName ? `, ${userName.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-sm mt-0.5 capitalize" style={{ color: "var(--text-muted)" }}>{today}</p>
        </div>
        <Link
          href="/dashboard/transactions"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-opacity hover:opacity-90 shrink-0"
          style={{ backgroundColor: "var(--accent)" }}
        >
          + Nouvelle transaction
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Solde */}
        <div className="rounded-xl p-4 sm:p-5 space-y-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs sm:text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Solde ce mois</p>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-base sm:text-lg shrink-0" style={{ backgroundColor: "#4F46E51a" }}>💰</div>
          </div>
          <p className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: balance >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
            {balance >= 0 ? "+" : ""}{fmt(balance)}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Revenus – Dépenses</p>
        </div>

        {/* Revenus */}
        <div className="rounded-xl p-4 sm:p-5 space-y-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs sm:text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Revenus</p>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-base sm:text-lg shrink-0" style={{ backgroundColor: "#10b9811a" }}>📈</div>
          </div>
          <p className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: "var(--success)", fontFamily: "var(--font-dm-mono, monospace)" }}>
            <Tooltip align="center" content={
              <div className="p-3 space-y-0.5">
                <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📈 Revenus — {monthLabel}</p>
                {incomeByActivity.length > 0
                  ? incomeByActivity.map(a => <TRow key={a.key} label={`${a.emoji} ${a.label}`} value={fmt(a.amount)} color="var(--success)" />)
                  : <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Aucun revenu ce mois</p>
                }
                {incomeByActivity.length > 1 && <><TDivider /><TRow label="= Total" value={fmt(totalIncome)} color="var(--success)" /></>}
              </div>
            }>{fmt(totalIncome)}</Tooltip>
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Ce mois-ci</p>
        </div>

        {/* Dépenses */}
        <div className="rounded-xl p-4 sm:p-5 space-y-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs sm:text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Dépenses</p>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-base sm:text-lg shrink-0" style={{ backgroundColor: "#ef44441a" }}>📉</div>
          </div>
          <p className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
            <Tooltip align="center" content={
              <div className="p-3 space-y-0.5">
                <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📉 Dépenses — {monthLabel}</p>
                {expenseByActivity.length > 0
                  ? expenseByActivity.map(a => <TRow key={a.key} label={`${a.emoji} ${a.label}`} value={fmt(a.amount)} color="var(--danger)" />)
                  : <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Aucune dépense ce mois</p>
                }
                {expenseByActivity.length > 1 && <><TDivider /><TRow label="= Total" value={fmt(totalExpenses)} color="var(--danger)" /></>}
              </div>
            }>{fmt(totalExpenses)}</Tooltip>
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Ce mois-ci</p>
        </div>

        {/* Taux d'épargne */}
        <div className="rounded-xl p-4 sm:p-5 space-y-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs sm:text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Taux d'épargne</p>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-base sm:text-lg shrink-0" style={{ backgroundColor: "#f59e0b1a" }}>🎯</div>
          </div>
          <p className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: savingsRate >= 20 ? "var(--success)" : savingsRate >= 0 ? "#f59e0b" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
            {savingsRate}%
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {savingsRate >= 20 ? "Excellent ✓" : savingsRate >= 10 ? "Correct" : savingsRate >= 0 ? "À améliorer" : "Déficitaire"}
          </p>
        </div>
      </div>

      {/* Activity breakdown */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Par activité — {monthLabel}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {activities.map(act => {
            const actTx = thisMonth.filter((t) => t.activity === act.key);
            const inc = actTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
            const exp = actTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
            const net = inc - exp;
            if (inc === 0 && exp === 0) return null;
            return (
              <div key={act.key} className="rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                    <span>{act.emoji}</span>{act.label}
                  </p>
                </div>
                <div>
                  <p className="text-base font-bold tabular-nums" style={{ color: net >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                    <Tooltip align="center" content={
                      <div className="p-3 space-y-0.5">
                        <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>{act.emoji} {act.label}</p>
                        <TRow label="+ Revenus" value={fmt(inc)} color="var(--success)" />
                        <TRow label="− Dépenses" value={fmt(exp)} color="var(--danger)" />
                        <TDivider />
                        <TRow label="= Net" value={`${net >= 0 ? "+" : ""}${fmt(net)}`} color={net >= 0 ? "var(--success)" : "var(--danger)"} />
                      </div>
                    }>
                      {net >= 0 ? "+" : ""}{fmt(net)}
                    </Tooltip>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {fmt(inc)} revenus · {fmt(exp)} dép.
                  </p>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${act.color}22` }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ backgroundColor: act.color, width: `${inc + exp > 0 ? Math.round((inc / (inc + exp)) * 100) : 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="font-semibold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>Transactions récentes</h2>
          <Link href="/dashboard/transactions" className="text-sm font-medium" style={{ color: "var(--accent)" }}>Voir tout →</Link>
        </div>

        {loading ? (
          <div className="py-12 text-center space-y-2">
            <div className="text-2xl animate-pulse">⏳</div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="text-4xl">📂</div>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Aucune transaction</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Commencez par enregistrer votre première transaction.</p>
          </div>
        ) : (
          <ul>
            {transactions.slice(0, 8).map((tx) => {
              const act = activities.find(a => a.key === tx.activity);
              const color = act?.color ?? "#888";
              return (
                <li key={tx.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: `${color}1a` }}>
                    {act?.emoji ?? (tx.type === "income" ? "↑" : "↓")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {tx.description ?? tx.category}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {act?.label ?? tx.activity}{act ? " · " : ""}{tx.category} · {new Date(tx.date).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums shrink-0"
                    style={{ color: tx.type === "income" ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                    {tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
