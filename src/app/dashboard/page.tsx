"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Tooltip, TRow, TDivider } from "@/components/ui/Tooltip";

const activityColors: Record<string, string> = {
  alternance: "#6366f1",
  cle_avenir: "#f59e0b",
  hakily: "#10b981",
  personnel: "#ec4899",
  freelance: "#0ea5e9",
};

const activityLabels: Record<string, string> = {
  alternance: "Alternance",
  cle_avenir: "CléAvenir",
  hakily: "Hakily",
  personnel: "Personnel",
  freelance: "Freelance",
};

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

function KPICard({
  title,
  value,
  subtitle,
  icon,
  accent,
  tooltipContent,
  tooltipAlign,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  accent: string;
  tooltipContent?: React.ReactNode;
  tooltipAlign?: "left" | "center" | "right";
}) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5 space-y-3"
      style={{
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs sm:text-sm font-medium leading-snug" style={{ color: "var(--text-secondary)" }}>
          {title}
        </p>
        <div
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-base sm:text-lg shrink-0"
          style={{ backgroundColor: `${accent}1a` }}
        >
          {icon}
        </div>
      </div>
      <p
        className="text-xl sm:text-2xl font-bold tabular-nums"
        style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}
      >
        {tooltipContent ? (
          <Tooltip align={tooltipAlign ?? "center"} content={tooltipContent}>{value}</Tooltip>
        ) : value}
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {subtitle}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
        .limit(20);

      if (data) setTransactions(data as Transaction[]);
      setLoading(false);
    }
    load();
  }, []);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonth = transactions.filter((t) => t.date?.startsWith(currentMonth));
  const totalIncome = thisMonth
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpenses = thisMonth
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate =
    totalIncome > 0
      ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)
      : 0;

  // Per-activity breakdown for tooltips
  const incomeByActivity = Object.entries(activityLabels).map(([key, label]) => ({
    key, label, color: activityColors[key],
    amount: thisMonth.filter(t => t.type === "income" && t.activity === key).reduce((s, t) => s + t.amount, 0),
  })).filter(a => a.amount > 0);

  const expenseByActivity = Object.entries(activityLabels).map(([key, label]) => ({
    key, label, color: activityColors[key],
    amount: thisMonth.filter(t => t.type === "expense" && t.activity === key).reduce((s, t) => s + t.amount, 0),
  })).filter(a => a.amount > 0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const monthLabel = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5 sm:space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {greeting()}{userName ? `, ${userName.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-sm mt-0.5 capitalize" style={{ color: "var(--text-muted)" }}>
            {today}
          </p>
        </div>
        <Link
          href="/dashboard/transactions"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-opacity hover:opacity-90 shrink-0"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <span>+</span>
          <span>Nouvelle transaction</span>
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          title="Solde ce mois"
          value={fmt(balance)}
          subtitle="Revenus – Dépenses"
          icon="💰"
          accent="#4F46E5"
          tooltipAlign="left"
          tooltipContent={
            <div className="p-3 space-y-0.5">
              <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>💰 Solde — {monthLabel}</p>
              <TRow label="+ Revenus" value={fmt(totalIncome)} color="var(--success)" />
              <TRow label="− Dépenses" value={fmt(totalExpenses)} color="var(--danger)" />
              <TDivider />
              <TRow label="= Solde" value={`${balance >= 0 ? "+" : ""}${fmt(balance)}`} color={balance >= 0 ? "var(--success)" : "var(--danger)"} />
            </div>
          }
        />
        <KPICard
          title="Revenus"
          value={fmt(totalIncome)}
          subtitle="Ce mois-ci"
          icon="📈"
          accent="#10b981"
          tooltipAlign="center"
          tooltipContent={
            <div className="p-3 space-y-0.5">
              <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📈 Revenus — {monthLabel}</p>
              {incomeByActivity.length > 0 ? (
                incomeByActivity.map(a => (
                  <TRow key={a.key} label={a.label} value={fmt(a.amount)} color="var(--success)" />
                ))
              ) : (
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Aucun revenu ce mois</p>
              )}
              {incomeByActivity.length > 1 && <><TDivider /><TRow label="= Total" value={fmt(totalIncome)} color="var(--success)" /></>}
            </div>
          }
        />
        <KPICard
          title="Dépenses"
          value={fmt(totalExpenses)}
          subtitle="Ce mois-ci"
          icon="📉"
          accent="#ef4444"
          tooltipAlign="center"
          tooltipContent={
            <div className="p-3 space-y-0.5">
              <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📉 Dépenses — {monthLabel}</p>
              {expenseByActivity.length > 0 ? (
                expenseByActivity.map(a => (
                  <TRow key={a.key} label={a.label} value={fmt(a.amount)} color="var(--danger)" />
                ))
              ) : (
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Aucune dépense ce mois</p>
              )}
              {expenseByActivity.length > 1 && <><TDivider /><TRow label="= Total" value={fmt(totalExpenses)} color="var(--danger)" /></>}
            </div>
          }
        />
        <KPICard
          title="Taux d'épargne"
          value={`${savingsRate}%`}
          subtitle="Ce mois-ci"
          icon="🎯"
          accent="#f59e0b"
          tooltipAlign="right"
          tooltipContent={
            <div className="p-3 space-y-0.5">
              <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>🎯 Taux d'épargne</p>
              <TRow label="Revenus" value={fmt(totalIncome)} color="var(--success)" />
              <TRow label="Dépenses" value={fmt(totalExpenses)} color="var(--danger)" />
              <TRow label="Épargne" value={fmt(balance)} muted />
              <TDivider />
              <TRow label="= Taux" value={`${savingsRate} %`} color={savingsRate >= 20 ? "var(--success)" : savingsRate >= 0 ? "#f59e0b" : "var(--danger)"} />
              <p className="text-[9px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                {savingsRate >= 20 ? "Excellent taux d'épargne ✓" : savingsRate >= 10 ? "Taux correct" : savingsRate >= 0 ? "Taux à améliorer" : "Mois déficitaire"}
              </p>
            </div>
          }
        />
      </div>

      {/* Activity breakdown */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
          PAR ACTIVITÉ
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(activityLabels).map(([key, label]) => {
            const actTx = transactions.filter((t) => t.activity === key);
            const inc = actTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
            const exp = actTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
            const net = inc - exp;
            const color = activityColors[key];
            const progress = inc + exp > 0 ? Math.round((inc / (inc + exp)) * 100) : 0;
            return (
              <div
                key={key}
                className="rounded-xl p-4 space-y-3"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {label}
                  </p>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                </div>
                <div>
                  <p
                    className="text-base font-bold tabular-nums"
                    style={{
                      color: net >= 0 ? "var(--success)" : "var(--danger)",
                      fontFamily: "var(--font-dm-mono, monospace)",
                    }}
                  >
                    <Tooltip align="center" content={
                      <div className="p-3 space-y-0.5">
                        <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>{label}</p>
                        <TRow label="+ Revenus" value={fmt(inc)} color="var(--success)" />
                        <TRow label="− Dépenses" value={fmt(exp)} color="var(--danger)" />
                        <TDivider />
                        <TRow label="= Net" value={`${net >= 0 ? "+" : ""}${fmt(net)}`} color={net >= 0 ? "var(--success)" : "var(--danger)"} />
                        <p className="text-[9px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                          {actTx.length} transaction{actTx.length !== 1 ? "s" : ""} récentes
                        </p>
                      </div>
                    }>
                      {net >= 0 ? "+" : ""}{fmt(net)}
                    </Tooltip>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {actTx.length} transaction{actTx.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: `${color}22` }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ backgroundColor: color, width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent transactions */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="font-semibold text-sm sm:text-base" style={{ color: "var(--text-primary)" }}>
            Transactions récentes
          </h2>
          <Link
            href="/dashboard/transactions"
            className="text-sm font-medium"
            style={{ color: "var(--accent)" }}
          >
            Voir tout →
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center space-y-2">
            <div className="text-2xl animate-pulse">⏳</div>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Chargement…</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="text-4xl">📂</div>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Aucune transaction
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Commencez par enregistrer votre première transaction.
            </p>
            <Link
              href="/dashboard/transactions"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: "var(--accent)" }}
            >
              + Nouvelle transaction
            </Link>
          </div>
        ) : (
          <ul>
            {transactions.slice(0, 8).map((tx) => {
              const color = tx.activity ? activityColors[tx.activity] ?? "#888" : "#888";
              const actLabel = tx.activity ? activityLabels[tx.activity] ?? tx.activity : null;
              return (
                <li
                  key={tx.id}
                  className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm shrink-0"
                    style={{ backgroundColor: `${color}1a` }}
                  >
                    {tx.type === "income" ? "↑" : "↓"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {tx.description ?? tx.category}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {actLabel && <span>{actLabel} · </span>}
                      {new Date(tx.date).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <p
                    className="text-sm font-bold tabular-nums shrink-0"
                    style={{
                      color: tx.type === "income" ? "var(--success)" : "var(--danger)",
                      fontFamily: "var(--font-dm-mono, monospace)",
                    }}
                  >
                    <Tooltip align="right" content={
                      <div className="p-3 space-y-0.5">
                        <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                          {tx.type === "income" ? "📈" : "📉"} {tx.description ?? tx.category}
                        </p>
                        <TRow label="Montant" value={fmt(tx.amount)} color={tx.type === "income" ? "var(--success)" : "var(--danger)"} />
                        <TRow label="Catégorie" value={tx.category} muted />
                        {actLabel && <TRow label="Activité" value={actLabel} muted />}
                        <TRow label="Date" value={new Date(tx.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} muted />
                      </div>
                    }>
                      {tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}
                    </Tooltip>
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
