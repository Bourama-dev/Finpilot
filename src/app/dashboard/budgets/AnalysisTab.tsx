"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend,
} from "recharts";
import { fmt, monthLabel, computeMonths, computeMonthly, creditRemaining, type BudgetData } from "./lib";

const PALETTE = ["#4F46E5", "#059669", "#D97706", "#DC2626", "#0EA5E9", "#EC4899", "#8B5CF6", "#14B8A6", "#F59E0B", "#6366F1", "#10B981", "#F43F5E"];

export default function AnalysisTab({ data }: { data: BudgetData }) {
  const months = useMemo(() => computeMonths(data), [data]);
  const monthly = useMemo(() => computeMonthly(data, months), [data, months]);

  const surplusSeries = monthly.map(m => ({
    month: monthLabel(m.month).replace(" ", "\n"),
    Revenus: m.totalRevenue,
    Charges: m.totalCharges,
    Excédent: m.grossSurplus,
  }));

  const cumulSeries = monthly.map(m => ({
    month: monthLabel(m.month).replace(" ", "\n"),
    "Cumul remboursé": m.cumulativeRepaid,
  }));

  const creditsSeries = months.map(m => {
    const row: Record<string, string | number> = { month: monthLabel(m).replace(" ", "\n") };
    data.credits.forEach(c => { row[c.name] = creditRemaining(c, data.repayments, m); });
    return row;
  });

  const chargeLines = data.lines.filter(l => l.section === "fixed_charge");
  const chargeBreakdown = chargeLines
    .map(l => ({ name: l.label, value: data.values.filter(v => v.line_id === l.id).reduce((s, v) => s + v.amount, 0) }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalRemainingNow = data.credits.reduce((s, c) => s + creditRemaining(c, data.repayments, months[months.length - 1]), 0);
  const totalStarting = data.credits.reduce((s, c) => s + c.starting_balance, 0);
  const progressPct = totalStarting > 0 ? Math.round(((totalStarting - totalRemainingNow) / totalStarting) * 100) : 0;

  if (months.length === 0) {
    return (
      <div className="rounded-xl p-10 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Pas encore de données à analyser.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Restant dû total" value={fmt(totalRemainingNow)} color="var(--danger)" />
        <StatCard label="Déjà remboursé" value={fmt(totalStarting - totalRemainingNow)} color="var(--success)" />
        <StatCard label="Progression vers 0€" value={`${progressPct}%`} color="var(--accent)" />
      </div>

      <ChartCard title="Revenus, charges & excédent par mois">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={surplusSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
            <RTooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="Revenus" stroke="#059669" fill="#059669" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="Charges" stroke="#DC2626" fill="#DC2626" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="Excédent" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Encours restant par crédit">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={creditsSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
              <RTooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {data.credits.map((c, i) => (
                <Line key={c.id} type="monotone" dataKey={c.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Répartition des charges fixes (cumul)">
          {chargeBreakdown.length === 0 ? (
            <p className="text-sm text-center py-16" style={{ color: "var(--text-muted)" }}>Aucune charge saisie.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={chargeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}>
                  {chargeBreakdown.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <RTooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Cumul remboursé depuis le début">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={cumulSeries} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
            <RTooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="Cumul remboursé" fill="#4F46E5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-xl font-bold tabular-nums mt-1" style={{ color, fontFamily: "var(--font-dm-mono, monospace)" }}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
      <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{title}</p>
      {children}
    </div>
  );
}
