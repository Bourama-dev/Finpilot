"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type TX = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  date: string;
  activity: string;
};

type RecurTX = {
  type: "income" | "expense";
  amount: number;
  category: string;
  activity: string;
  recurring_frequency: "daily" | "weekly" | "monthly" | "yearly";
  date: string;
};

type Receivable = {
  id: string;
  client: string;
  amount: number;
  status: "to_invoice" | "invoiced" | "paid";
  activity: string;
  service_date: string | null;
  created_at: string;
};

type Purchase = {
  id: string;
  name: string;
  amount: number;
  installment_fees_pct: number;
  payment_mode: string;
  priority: "high" | "medium" | "low";
  status: string;
  target_date: string | null;
};

type Budget = {
  category: string;
  amount: number;
  period: string;
};

type AlertLevel = "critical" | "warning" | "info";

type Alert = {
  id: string;
  level: AlertLevel;
  icon: string;
  title: string;
  description: string;
};

type Recommendation = {
  id: string;
  impact: "high" | "medium" | "low";
  icon: string;
  title: string;
  description: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const URSSAF_ACTS = new Set(["freelance", "hakily", "cle_avenir"]);
const URSSAF_RATE = 0.231;

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const ALERT_STYLE: Record<AlertLevel, { border: string; bg: string; badgeLabel: string }> = {
  critical: { border: "var(--danger)",  bg: "color-mix(in srgb, var(--danger) 7%, var(--bg-secondary))",  badgeLabel: "Critique" },
  warning:  { border: "#f59e0b",        bg: "color-mix(in srgb, #f59e0b 7%, var(--bg-secondary))",        badgeLabel: "Attention" },
  info:     { border: "var(--accent)",  bg: "color-mix(in srgb, var(--accent) 7%, var(--bg-secondary))",  badgeLabel: "Info"      },
};

const IMPACT_COLOR: Record<"high" | "medium" | "low", string> = {
  high:   "var(--danger)",
  medium: "#f59e0b",
  low:    "var(--success)",
};

const IMPACT_LABEL: Record<"high" | "medium" | "low", string> = {
  high:   "Impact fort",
  medium: "Impact moyen",
  low:    "Impact faible",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

// ─── Score circle ─────────────────────────────────────────────────────────────

function ScoreCircle({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(score / 100, 1) * circ;
  const color = score >= 70 ? "var(--success)" : score >= 45 ? "#f59e0b" : "var(--danger)";
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" aria-label={`Score ${score}/100`}>
      <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" stroke="var(--bg-tertiary)" />
      <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" stroke={color}
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform="rotate(-90 64 64)"
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <text x="64" y="58" textAnchor="middle" dominantBaseline="middle"
        fontSize="26" fontWeight="bold" fill={color} fontFamily="var(--font-dm-mono, monospace)">
        {score}
      </text>
      <text x="64" y="80" textAnchor="middle" dominantBaseline="middle"
        fontSize="11" fill="var(--text-muted)">
        / 100
      </text>
    </svg>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const [now] = useState(() => new Date());
  const [txs,          setTxs]          = useState<TX[]>([]);
  const [recur,        setRecur]        = useState<RecurTX[]>([]);
  const [receivables,  setReceivables]  = useState<Receivable[]>([]);
  const [purchases,    setPurchases]    = useState<Purchase[]>([]);
  const [budgets,      setBudgets]      = useState<Budget[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [aiAdvice,     setAiAdvice]     = useState<string | null>(null);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiError,      setAiError]      = useState<string | null>(null);

  const currentMonthPrefix = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [now]);

  useEffect(() => {
    async function load() {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const [{ data: txData }, { data: recurData }, { data: recvData }, { data: purchData }, { data: budgetData }] =
        await Promise.all([
          supabase
            .from("transactions")
            .select("id, type, amount, category, date, activity")
            .eq("is_recurring", false)
            .gte("date", threeMonthsAgo.toISOString().slice(0, 10))
            .order("date"),
          supabase
            .from("transactions")
            .select("type, amount, category, activity, recurring_frequency, date")
            .eq("is_recurring", true),
          supabase
            .from("receivables")
            .select("id, client, amount, status, activity, service_date, created_at"),
          supabase
            .from("purchases")
            .select("id, name, amount, installment_fees_pct, payment_mode, priority, status, target_date")
            .in("status", ["planned", "in_progress"]),
          supabase
            .from("budgets")
            .select("category, amount, period")
            .eq("year", now.getFullYear())
            .eq("month", now.getMonth() + 1),
        ]);

      if (txData)     setTxs(txData as TX[]);
      if (recurData)  setRecur(recurData as RecurTX[]);
      if (recvData)   setReceivables(recvData as Receivable[]);
      if (purchData)  setPurchases(purchData as Purchase[]);
      if (budgetData) setBudgets(budgetData as Budget[]);
      setLoading(false);
    }
    load();
  }, [now]);

  // ── Core statistics ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const currentTxs = txs.filter(t => t.date.startsWith(currentMonthPrefix));

    // Monthly recurring (approximate monthly equivalent)
    const recurMonthIncome  = recur.filter(t => t.type === "income"  && t.recurring_frequency === "monthly").reduce((s, t) => s + t.amount, 0);
    const recurMonthExpense = recur.filter(t => t.type === "expense" && t.recurring_frequency === "monthly").reduce((s, t) => s + t.amount, 0);

    const currentIncome  = currentTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0) + recurMonthIncome;
    const currentExpense = currentTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0) + recurMonthExpense;

    // 3-month averages (non-recurring)
    const inc3m = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0) / 3 + recurMonthIncome;
    const exp3m = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0) / 3 + recurMonthExpense;
    const savingsRate = inc3m > 0 ? (inc3m - exp3m) / inc3m : 0;

    // URSSAF estimate
    const recurUrssafIncome = recur
      .filter(t => t.type === "income" && t.recurring_frequency === "monthly" && URSSAF_ACTS.has(t.activity))
      .reduce((s, t) => s + t.amount, 0);
    const urssafMonthly    = recurUrssafIncome * URSSAF_RATE;
    const urssafQuarterly  = urssafMonthly * 3;

    // Top expenses this month
    const expByCat: Record<string, number> = {};
    currentTxs.filter(t => t.type === "expense").forEach(t => {
      expByCat[t.category] = (expByCat[t.category] ?? 0) + t.amount;
    });
    const topExpenses = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Budget overruns
    const overruns = budgets
      .map(b => ({ ...b, actual: expByCat[b.category] ?? 0 }))
      .filter(b => b.actual > b.amount)
      .map(b => ({ ...b, overrun: b.actual - b.amount }));

    // Receivables
    const pending    = receivables.filter(r => r.status !== "paid");
    const paid       = receivables.filter(r => r.status === "paid");
    const toInvoice  = pending.filter(r => r.status === "to_invoice");
    const oldPending = pending.filter(r => {
      const ref = r.service_date ?? r.created_at;
      return daysSince(ref) > 45;
    });

    return {
      currentIncome, currentExpense,
      currentNet: currentIncome - currentExpense,
      inc3m, exp3m, savingsRate,
      urssafMonthly, urssafQuarterly, recurUrssafIncome,
      topExpenses,
      overruns,
      pending, paid, toInvoice, oldPending,
      totalPending: pending.reduce((s, r) => s + r.amount, 0),
      totalPaid:    paid.reduce((s, r)    => s + r.amount, 0),
      budgetTotal:  budgets.length,
    };
  }, [txs, recur, receivables, budgets, currentMonthPrefix]);

  // ── Health score ───────────────────────────────────────────────────────────

  const health = useMemo(() => {
    const sr   = stats.savingsRate * 100;
    const cashScore  = sr >= 20 ? 100 : sr >= 10 ? 70 : sr >= 0 ? 40 : 0;
    const monthScore = stats.currentNet >= 0 ? 100 : stats.currentNet > -200 ? 50 : 0;
    const totalRec   = stats.totalPending + stats.totalPaid;
    const recvScore  = totalRec === 0 ? 100 : Math.round((stats.totalPaid / totalRec) * 100);
    const bdgScore   = stats.budgetTotal === 0 ? 80
      : Math.max(0, Math.round((1 - stats.overruns.length / stats.budgetTotal) * 100));

    const total = Math.round(cashScore * 0.35 + monthScore * 0.25 + recvScore * 0.20 + bdgScore * 0.20);
    const label = total >= 80 ? "Excellent" : total >= 65 ? "Bonne santé" : total >= 45 ? "À améliorer" : "Attention requise";
    const color = total >= 70 ? "var(--success)" : total >= 45 ? "#f59e0b" : "var(--danger)";

    return {
      total, label, color,
      components: [
        { label: "Flux de trésorerie", score: cashScore  },
        { label: "Solde du mois",      score: monthScore },
        { label: "Recouvrement",       score: recvScore  },
        { label: "Budgets",            score: bdgScore   },
      ],
    };
  }, [stats]);

  // ── Alerts ─────────────────────────────────────────────────────────────────

  const alerts = useMemo<Alert[]>(() => {
    const list: Alert[] = [];

    if (stats.currentNet < 0) {
      list.push({
        id: "neg-month", level: "critical", icon: "🔴",
        title: "Solde mensuel négatif",
        description: `Vos dépenses dépassent vos revenus de ${fmt(Math.abs(stats.currentNet))} ce mois-ci.`,
      });
    }

    stats.overruns.forEach(b => {
      list.push({
        id: `bdg-${b.category}`,
        level: b.overrun > b.amount * 0.5 ? "critical" : "warning",
        icon: "📊",
        title: `Budget "${b.category}" dépassé`,
        description: `Budget : ${fmt(b.amount)} · Dépensé : ${fmt(b.actual)} · Dépassement : +${fmt(b.overrun)}`,
      });
    });

    stats.oldPending.forEach(r => {
      const days = daysSince(r.service_date ?? r.created_at);
      list.push({
        id: `old-${r.id}`,
        level: days > 90 ? "critical" : "warning",
        icon: "📬",
        title: `Créance en retard — ${r.client}`,
        description: `${fmt(r.amount)} en attente depuis ${days} jours (${r.status === "to_invoice" ? "pas encore facturée" : "facturée, non réglée"}).`,
      });
    });

    if (stats.toInvoice.length > 0) {
      const total = stats.toInvoice.reduce((s, r) => s + r.amount, 0);
      list.push({
        id: "to-invoice", level: "warning", icon: "🧾",
        title: `${stats.toInvoice.length} prestation${stats.toInvoice.length > 1 ? "s" : ""} non encore facturée${stats.toInvoice.length > 1 ? "s" : ""}`,
        description: `${fmt(total)} à facturer dès que possible pour déclencher le délai de paiement.`,
      });
    }

    if (stats.urssafQuarterly > 0) {
      list.push({
        id: "urssaf", level: "info", icon: "⚖️",
        title: "Cotisations URSSAF à provisionner",
        description: `Estimé à ${fmt(stats.urssafQuarterly)} pour ce trimestre — soit ${fmt(stats.urssafMonthly)}/mois à mettre de côté.`,
      });
    }

    const sortOrder: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 };
    return list.sort((a, b) => sortOrder[a.level] - sortOrder[b.level]);
  }, [stats]);

  // ── Recommendations ────────────────────────────────────────────────────────

  const recommendations = useMemo<Recommendation[]>(() => {
    const list: Recommendation[] = [];

    if (stats.oldPending.length > 0) {
      const total = stats.oldPending.reduce((s, r) => s + r.amount, 0);
      list.push({
        id: "relance", impact: "high", icon: "📨",
        title: "Relancer vos clients en retard",
        description: `${stats.oldPending.length} créance${stats.oldPending.length > 1 ? "s" : ""} (${fmt(total)}) mérite${stats.oldPending.length > 1 ? "nt" : ""} une relance urgente. Un simple e-mail peut suffire.`,
      });
    }

    if (stats.toInvoice.length > 0) {
      const total = stats.toInvoice.reduce((s, r) => s + r.amount, 0);
      list.push({
        id: "invoice", impact: "high", icon: "🧾",
        title: "Émettre vos factures en attente",
        description: `Facturez ${fmt(total)} maintenant — le délai de paiement (30 j.) ne commence qu'à réception de la facture.`,
      });
    }

    if (stats.urssafMonthly > 0) {
      list.push({
        id: "urssaf-prov", impact: "high", icon: "🏛️",
        title: "Provisionner les cotisations URSSAF",
        description: `Mettez ${fmt(stats.urssafMonthly)}/mois de côté (${fmt(stats.urssafQuarterly)} par trimestre) pour éviter une surprise lors de l'échéance URSSAF.`,
      });
    }

    const sr = stats.savingsRate;
    if (sr >= 0.25) {
      list.push({
        id: "invest", impact: "low", icon: "📈",
        title: "Taux d'épargne élevé — envisagez un placement",
        description: `Avec ${Math.round(sr * 100)}% d'épargne, vous pouvez placer l'excédent (PEA, livret A, assurance-vie) pour faire fructifier votre trésorerie.`,
      });
    } else if (sr < 0) {
      if (stats.topExpenses.length > 0) {
        const [cat, amt] = stats.topExpenses[0];
        list.push({
          id: "cut-exp", impact: "high", icon: "✂️",
          title: `Réduire les dépenses "${cat}"`,
          description: `C'est votre plus grosse dépense ce mois (${fmt(amt)}). Une réduction de 20 % libérerait ${fmt(amt * 0.2)}/mois.`,
        });
      }
    } else if (sr < 0.10) {
      list.push({
        id: "save-more", impact: "medium", icon: "💰",
        title: "Augmenter votre taux d'épargne",
        description: `Votre taux de ${Math.round(sr * 100)}% est en dessous des 20% recommandés. Automatisez un virement épargne dès réception de vos revenus.`,
      });
    }

    const urgentPurchases = purchases.filter(p => p.priority === "high");
    if (urgentPurchases.length > 0 && stats.currentNet < urgentPurchases[0].amount * 0.5) {
      const p = urgentPurchases[0];
      const total = p.amount * (1 + p.installment_fees_pct / 100);
      list.push({
        id: `purch-${p.id}`, impact: "medium", icon: "🛒",
        title: `Planifier la trésorerie pour "${p.name}"`,
        description: `Achat prioritaire de ${fmt(total)} prévu. Votre solde actuel (${fmt(stats.currentNet)}) ne couvre pas encore cet achat — commencez à épargner dès maintenant.`,
      });
    }

    const sortOrder: Record<"high" | "medium" | "low", number> = { high: 0, medium: 1, low: 2 };
    return list.sort((a, b) => sortOrder[a.impact] - sortOrder[b.impact]);
  }, [stats, purchases]);

  // ── AI context ─────────────────────────────────────────────────────────────

  const aiContext = useMemo(() => ({
    periode: now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    score_sante: health.total,
    revenus_mois: Math.round(stats.currentIncome),
    depenses_mois: Math.round(stats.currentExpense),
    solde_mois: Math.round(stats.currentNet),
    revenu_moyen_3m: Math.round(stats.inc3m),
    depense_moyenne_3m: Math.round(stats.exp3m),
    taux_epargne_3m_pct: Math.round(stats.savingsRate * 100),
    creances_en_attente: stats.pending.map(r => ({
      client: r.client,
      montant: r.amount,
      statut: r.status === "to_invoice" ? "à facturer" : "facturée",
      jours: daysSince(r.service_date ?? r.created_at),
    })),
    top_categories_depenses: stats.topExpenses.map(([cat, amt]) => ({ categorie: cat, montant: Math.round(amt) })),
    achats_planifies: purchases.map(p => ({ nom: p.name, montant: Math.round(p.amount), priorite: p.priority })),
    urssaf_mensuel_estime: Math.round(stats.urssafMonthly),
    budgets_depasses: stats.overruns.map(b => ({ categorie: b.category, depassement: Math.round(b.overrun) })),
  }), [stats, purchases, health, now]);

  const callAI = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    setAiAdvice(null);
    try {
      const res = await fetch("/api/ai-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: aiContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur inconnue");
      setAiAdvice(data.advice);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Erreur lors de l'analyse");
    } finally {
      setAiLoading(false);
    }
  }, [aiContext]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Analyse en cours…</p>
      </div>
    );
  }

  const monthLabel = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Recommandations</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Analyse personnalisée · {monthLabel}
        </p>
      </div>

      {/* Health score */}
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>Score de santé financière</h2>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <ScoreCircle score={health.total} />
            <span className="text-sm font-semibold" style={{ color: health.color }}>{health.label}</span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4 w-full">
            {health.components.map(c => {
              const cColor = c.score >= 70 ? "var(--success)" : c.score >= 45 ? "#f59e0b" : "var(--danger)";
              return (
                <div key={c.label} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{c.label}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: cColor }}>{c.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${c.score}%`, backgroundColor: cColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI mini-row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Revenus (mois)",      value: stats.currentIncome,  color: "var(--success)" },
          { label: "Dépenses (mois)",     value: stats.currentExpense, color: "var(--danger)"  },
          { label: "Net du mois",         value: stats.currentNet,     color: stats.currentNet >= 0 ? "var(--success)" : "var(--danger)" },
          { label: "Créances en attente", value: stats.totalPending,   color: "#f59e0b"        },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-3 sm:p-4 text-center"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
            <p className="text-base sm:text-lg font-bold tabular-nums mt-1"
              style={{ color, fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          ⚠️ Points d&apos;attention {alerts.length > 0 && <span style={{ color: "var(--text-muted)" }}>({alerts.length})</span>}
        </h2>
        {alerts.length === 0 ? (
          <div className="rounded-xl p-6 text-center"
            style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--success)" }}>
            <div className="text-3xl mb-2">✅</div>
            <p className="font-semibold text-sm" style={{ color: "var(--success)" }}>Aucune alerte ce mois</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Votre situation financière est saine.</p>
          </div>
        ) : (
          alerts.map(alert => {
            const s = ALERT_STYLE[alert.level];
            return (
              <div key={alert.id} className="rounded-xl p-4 flex gap-3"
                style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
                <span className="text-xl shrink-0 mt-0.5">{alert.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{alert.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                      style={{ backgroundColor: `color-mix(in srgb, ${s.border} 15%, transparent)`, color: s.border }}>
                      {s.badgeLabel}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{alert.description}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
            💡 Actions recommandées <span style={{ color: "var(--text-muted)" }}>({recommendations.length})</span>
          </h2>
          {recommendations.map(rec => {
            const ic = IMPACT_COLOR[rec.impact];
            return (
              <div key={rec.id} className="rounded-xl p-4 flex gap-3"
                style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <span className="text-xl shrink-0 mt-0.5">{rec.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{rec.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                      style={{ backgroundColor: `color-mix(in srgb, ${ic} 12%, transparent)`, color: ic }}>
                      {IMPACT_LABEL[rec.impact]}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{rec.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Advisor */}
      <div className="rounded-xl p-5 space-y-4"
        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>🤖 Conseiller IA</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Analyse approfondie et conseils personnalisés par GPT-4o
            </p>
          </div>
          <button onClick={callAI} disabled={aiLoading}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90 shrink-0"
            style={{ backgroundColor: "var(--accent)" }}>
            {aiLoading ? "Analyse en cours…" : aiAdvice ? "Relancer l'analyse" : "Analyser ma situation"}
          </button>
        </div>

        {aiError && (
          <div className="rounded-lg px-3 py-2 text-sm"
            style={{ color: "var(--danger)", backgroundColor: "color-mix(in srgb, var(--danger) 10%, var(--bg-tertiary))" }}>
            Erreur : {aiError}
          </div>
        )}

        {!aiAdvice && !aiLoading && !aiError && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Cliquez sur &quot;Analyser ma situation&quot; pour obtenir une analyse personnalisée :
            opportunités d&apos;optimisation, conseils adaptés au régime micro-entrepreneur, et
            recommandations sur la gestion de votre trésorerie.
          </p>
        )}

        {aiAdvice && (
          <div className="rounded-xl p-4"
            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
            <p className="text-[11px] font-semibold mb-3 flex items-center gap-1.5"
              style={{ color: "var(--text-muted)" }}>
              <span>🤖</span> Analyse de GPT-4o · {monthLabel}
            </p>
            <div className="text-sm space-y-2" style={{ color: "var(--text-primary)", lineHeight: "1.75" }}>
              {aiAdvice.split("\n").map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return null;
                const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("• ");
                const text = isBullet ? trimmed.slice(2) : trimmed;
                const boldMatch = text.match(/^\*\*(.+?)\*\*[:：]?\s*([\s\S]*)/);
                return (
                  <p key={i} className={isBullet ? "flex gap-2" : ""}>
                    {isBullet && <span style={{ color: "var(--accent)", marginTop: "2px" }}>▸</span>}
                    <span>
                      {boldMatch ? (
                        <>
                          <strong style={{ color: "var(--text-primary)" }}>{boldMatch[1]}</strong>
                          {boldMatch[2] ? ` : ${boldMatch[2]}` : ""}
                        </>
                      ) : text}
                    </span>
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
