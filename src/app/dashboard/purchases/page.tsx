"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Activity } from "@/types/database";
import { useActivities } from "@/hooks/useActivities";
import { Tooltip, TRow, TDivider } from "@/components/ui/Tooltip";

const CATEGORIES = [
  "Électronique", "Informatique", "Mobilier", "Électroménager",
  "Vêtements", "Voyage", "Sport", "Santé", "Loisirs", "Formation", "Autre",
];

const PAYMENT_MODES = [
  { key: "comptant", label: "Comptant",  icon: "💵" },
  { key: "3x",       label: "3×",        icon: "3️⃣" },
  { key: "4x",       label: "4×",        icon: "4️⃣" },
  { key: "credit",   label: "Crédit",    icon: "💳" },
] as const;

type PaymentMode = "comptant" | "3x" | "4x" | "credit";
type Priority    = "high" | "medium" | "low";
type PurchaseStatus = "planned" | "in_progress" | "done" | "cancelled";

const PRIORITY_CFG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  high:   { label: "Urgent",       color: "var(--danger)",   bg: "color-mix(in srgb, var(--danger) 10%, transparent)",   dot: "🔴" },
  medium: { label: "Moyen terme",  color: "#f59e0b",         bg: "color-mix(in srgb, #f59e0b 12%, transparent)",         dot: "🟡" },
  low:    { label: "Envie",        color: "var(--success)",  bg: "color-mix(in srgb, var(--success) 10%, transparent)",  dot: "🟢" },
};

const STATUS_CFG: Record<PurchaseStatus, { label: string; color: string; bg: string }> = {
  planned:     { label: "Planifié",   color: "var(--accent)",     bg: "color-mix(in srgb, var(--accent) 10%, transparent)"  },
  in_progress: { label: "En cours",   color: "#f59e0b",            bg: "color-mix(in srgb, #f59e0b 12%, transparent)"        },
  done:        { label: "Terminé",    color: "var(--success)",     bg: "color-mix(in srgb, var(--success) 10%, transparent)" },
  cancelled:   { label: "Abandonné",  color: "var(--text-muted)",  bg: "var(--bg-tertiary)"                                  },
};

// Status transitions: current → next
const STATUS_NEXT: Partial<Record<PurchaseStatus, { to: PurchaseStatus; label: string }>> = {
  planned:     { to: "in_progress", label: "Démarrer" },
  in_progress: { to: "done",        label: "Terminer ✓" },
};

type Purchase = {
  id: string;
  name: string;
  amount: number;
  activity: Activity;
  category: string;
  payment_mode: PaymentMode;
  installment_fees_pct: number;
  credit_months: number | null;
  priority: Priority;
  status: PurchaseStatus;
  target_date: string | null;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
};

type FormState = {
  name: string;
  amount: string;
  activity: Activity;
  category: string;
  payment_mode: PaymentMode;
  installment_fees_pct: string;
  credit_months: string;
  priority: Priority;
  status: PurchaseStatus;
  target_date: string;
  purchase_date: string;
  notes: string;
};

const EMPTY: FormState = {
  name: "", amount: "", activity: "personnel", category: "Électronique",
  payment_mode: "comptant", installment_fees_pct: "0", credit_months: "12",
  priority: "medium", status: "planned",
  target_date: "", purchase_date: "", notes: "",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

function installmentCount(mode: PaymentMode, creditMonths: number | null): number {
  if (mode === "3x")    return 3;
  if (mode === "4x")    return 4;
  if (mode === "credit") return creditMonths ?? 12;
  return 1;
}

function calcInstallments(amount: number, mode: PaymentMode, feesPct: number, creditMonths: number | null) {
  const n = installmentCount(mode, creditMonths);
  const total   = amount * (1 + feesPct / 100);
  const monthly = total / n;
  const fees    = total - amount;
  return { n, total, monthly, fees };
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86_400_000);
}

function installmentDates(startDate: string | null, n: number): string[] {
  if (!startDate || n <= 1) return [];
  const base = new Date(startDate);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() + i, base.getDate());
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  });
}

const ALL_STATUSES: Array<PurchaseStatus | "all"> = ["all", "planned", "in_progress", "done", "cancelled"];

export default function PurchasesPage() {
  const { activities } = useActivities();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<PurchaseStatus | "all">("all");
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // modal
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editId,      setEditId]      = useState<string | null>(null);
  const [form,        setForm]        = useState<FormState>(EMPTY);
  const [expanded,    setExpanded]    = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("purchases")
      .select("id, name, amount, activity, category, payment_mode, installment_fees_pct, credit_months, priority, status, target_date, purchase_date, notes, created_at")
      .order("priority", { ascending: true })
      .order("target_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (data) setPurchases(data as Purchase[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY);
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(p: Purchase) {
    setSaveError(null);
    setEditId(p.id);
    setForm({
      name: p.name,
      amount: String(p.amount),
      activity: p.activity,
      category: p.category,
      payment_mode: p.payment_mode,
      installment_fees_pct: String(p.installment_fees_pct),
      credit_months: String(p.credit_months ?? 12),
      priority: p.priority,
      status: p.status,
      target_date: p.target_date ?? "",
      purchase_date: p.purchase_date ?? "",
      notes: p.notes ?? "",
    });
    setModalOpen(true);
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function save() {
    const amount = parseFloat(form.amount);
    if (!form.name.trim() || isNaN(amount) || amount <= 0) return;
    setSaving(true);
    setSaveError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const payload = {
      name: form.name.trim(),
      amount,
      activity: form.activity,
      category: form.category,
      payment_mode: form.payment_mode,
      installment_fees_pct: parseFloat(form.installment_fees_pct) || 0,
      credit_months: form.payment_mode === "credit" ? (parseInt(form.credit_months) || 12) : null,
      priority: form.priority,
      status: form.status,
      target_date:   form.target_date   || null,
      purchase_date: form.purchase_date || null,
      notes: form.notes.trim() || null,
    };

    const { error } = editId
      ? await supabase.from("purchases").update(payload).eq("id", editId)
      : await supabase.from("purchases").insert({ ...payload, user_id: user.id });

    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setModalOpen(false);
    load();
  }

  async function remove(id: string) {
    setDeleting(id);
    await supabase.from("purchases").delete().eq("id", id);
    setDeleting(null);
    setPurchases(p => p.filter(x => x.id !== id));
  }

  async function advanceStatus(p: Purchase) {
    const next = STATUS_NEXT[p.status];
    if (!next) return;
    const extra = next.to === "done" ? { purchase_date: new Date().toISOString().slice(0, 10) } : {};
    await supabase.from("purchases").update({ status: next.to, ...extra }).eq("id", p.id);
    load();
  }

  const visible = useMemo(() =>
    filter === "all" ? purchases : purchases.filter(p => p.status === filter),
    [purchases, filter]);

  const kpis = useMemo(() => {
    const active = purchases.filter(p => p.status !== "done" && p.status !== "cancelled");
    const totalPlanned = active.reduce((s, p) => {
      const { total } = calcInstallments(p.amount, p.payment_mode, p.installment_fees_pct, p.credit_months);
      return s + total;
    }, 0);
    const monthlyCommit = purchases
      .filter(p => p.status === "in_progress")
      .reduce((s, p) => {
        if (p.payment_mode === "comptant") return s;
        const { monthly } = calcInstallments(p.amount, p.payment_mode, p.installment_fees_pct, p.credit_months);
        return s + monthly;
      }, 0);
    const nextPurchase = [...active]
      .filter(p => p.target_date)
      .sort((a, b) => (a.target_date! < b.target_date! ? -1 : 1))[0];
    return { totalPlanned, monthlyCommit, nextPurchase, activeCount: active.length };
  }, [purchases]);

  // Computed installment details for the form preview
  const formAmount = parseFloat(form.amount) || 0;
  const formInst   = calcInstallments(
    formAmount, form.payment_mode,
    parseFloat(form.installment_fees_pct) || 0,
    form.payment_mode === "credit" ? parseInt(form.credit_months) || 12 : null,
  );
  const formDates  = installmentDates(form.purchase_date || form.target_date || null, formInst.n);

  const filterLabels: Record<PurchaseStatus | "all", string> = {
    all:         `Tous (${purchases.length})`,
    planned:     `Planifié (${purchases.filter(p => p.status === "planned").length})`,
    in_progress: `En cours (${purchases.filter(p => p.status === "in_progress").length})`,
    done:        `Terminé (${purchases.filter(p => p.status === "done").length})`,
    cancelled:   `Abandonné (${purchases.filter(p => p.status === "cancelled").length})`,
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Achats</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>Planifiez et suivez vos achats futurs</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium"
          style={{ backgroundColor: "var(--accent)" }}>
          + Ajouter un achat
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Total planifié</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>
            <Tooltip align="left" content={
              <div className="p-3 space-y-0.5">
                <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>🛒 Achats actifs</p>
                {purchases.filter(p => p.status !== "done" && p.status !== "cancelled").map(p => {
                  const { total } = calcInstallments(p.amount, p.payment_mode, p.installment_fees_pct, p.credit_months);
                  return <TRow key={p.id} label={p.name} value={fmt(total)} />;
                })}
                {kpis.activeCount > 1 && <><TDivider /><TRow label="= Total" value={fmt(kpis.totalPlanned)} color="var(--danger)" /></>}
              </div>
            }>{fmt(kpis.totalPlanned)}</Tooltip>
          </p>
        </div>
        <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Charge mensuelle</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: kpis.monthlyCommit > 0 ? "#f59e0b" : "var(--text-muted)", fontFamily: "var(--font-dm-mono, monospace)" }}>
            {kpis.monthlyCommit > 0 ? (
              <Tooltip align="left" content={
                <div className="p-3 space-y-0.5">
                  <p className="text-[10px] font-bold mb-2" style={{ color: "var(--text-primary)" }}>📅 Mensualités en cours</p>
                  {purchases.filter(p => p.status === "in_progress" && p.payment_mode !== "comptant").map(p => {
                    const { monthly } = calcInstallments(p.amount, p.payment_mode, p.installment_fees_pct, p.credit_months);
                    return <TRow key={p.id} label={p.name} value={fmt(monthly) + "/mois"} color="#f59e0b" />;
                  })}
                  <TDivider />
                  <TRow label="= Charge mensuelle" value={fmt(kpis.monthlyCommit)} color="#f59e0b" />
                </div>
              }>{fmt(kpis.monthlyCommit)}</Tooltip>
            ) : "—"}
          </p>
        </div>
        <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Achats actifs</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>{kpis.activeCount}</p>
        </div>
        <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Prochain achat</p>
          {kpis.nextPurchase ? (
            <>
              <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{kpis.nextPurchase.name}</p>
              {(() => {
                const d = daysUntil(kpis.nextPurchase.target_date);
                return d !== null && (
                  <p className="text-xs" style={{ color: d <= 7 ? "var(--danger)" : "var(--text-muted)" }}>
                    {d <= 0 ? "Aujourd'hui !" : `dans ${d}j`}
                  </p>
                );
              })()}
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>—</p>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {ALL_STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={filter === s
              ? { backgroundColor: "var(--accent)", color: "#fff" }
              : { backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            {filterLabels[s]}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center">
          <p className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Chargement…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl p-12 text-center space-y-3" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <div className="text-4xl">🛒</div>
          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {filter === "all" ? "Aucun achat planifié" : `Aucun achat "${filterLabels[filter].split(" (")[0].toLowerCase()}"`}
          </p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Commencez par ajouter un achat à planifier.</p>
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium mt-2"
            style={{ backgroundColor: "var(--accent)" }}>
            + Ajouter un achat
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(p => {
            const act  = activities.find(a => a.key === p.activity);
            const inst = calcInstallments(p.amount, p.payment_mode, p.installment_fees_pct, p.credit_months);
            const days = daysUntil(p.target_date);
            const prCfg  = PRIORITY_CFG[p.priority];
            const stCfg  = STATUS_CFG[p.status];
            const next   = STATUS_NEXT[p.status];
            const isOpen = expanded === p.id;
            const dates  = isOpen ? installmentDates(p.purchase_date || p.target_date || null, inst.n) : [];

            return (
              <div key={p.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Activity icon */}
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: `${act?.color ?? "#888"}1a` }}>
                    {act?.emoji ?? "🛒"}
                  </div>

                  {/* Name + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                      <span className="text-[10px] px-1.5 py-px rounded font-medium shrink-0"
                        style={{ backgroundColor: prCfg.bg, color: prCfg.color }}>
                        {prCfg.dot} {prCfg.label}
                      </span>
                      <span className="text-[10px] px-1.5 py-px rounded font-medium shrink-0"
                        style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                        {stCfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{p.category}</span>
                      {p.target_date && (
                        <span className="text-[11px]" style={{ color: days !== null && days <= 7 ? "var(--danger)" : "var(--text-muted)" }}>
                          · 🗓 {new Date(p.target_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          {days !== null && ` (${days <= 0 ? "aujourd'hui" : `dans ${days}j`})`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                      {fmt(p.amount)}
                    </p>
                    {p.payment_mode !== "comptant" && (
                      <p className="text-[10px] tabular-nums" style={{ color: "#f59e0b", fontFamily: "var(--font-dm-mono, monospace)" }}>
                        {inst.n}× {fmt(inst.monthly)}/mois
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {next && (
                      <button onClick={() => advanceStatus(p)}
                        className="text-[11px] px-2 py-1 rounded-lg font-medium transition-opacity hover:opacity-70"
                        style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        {next.label}
                      </button>
                    )}
                    <button onClick={() => setExpanded(isOpen ? null : p.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-opacity hover:opacity-70"
                      style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                      {isOpen ? "▲" : "▼"}
                    </button>
                    <button onClick={() => openEdit(p)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-opacity hover:opacity-70"
                      style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                      ✏️
                    </button>
                    <button onClick={() => remove(p.id)} disabled={deleting === p.id}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-opacity hover:opacity-70 disabled:opacity-40"
                      style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--danger)" }}>
                      🗑
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
                    {/* Payment breakdown */}
                    {p.payment_mode !== "comptant" && (
                      <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                          Échelonnement {p.payment_mode} {p.installment_fees_pct > 0 ? `(${p.installment_fees_pct}% frais)` : "sans frais"}
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Par mensualité</p>
                            <p className="text-sm font-bold tabular-nums" style={{ color: "#f59e0b", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(inst.monthly)}</p>
                          </div>
                          <div>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Coût total</p>
                            <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(inst.total)}</p>
                          </div>
                          <div>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Frais</p>
                            <p className="text-sm font-bold tabular-nums" style={{ color: inst.fees > 0 ? "var(--danger)" : "var(--success)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                              {inst.fees > 0 ? fmt(inst.fees) : "Gratuit"}
                            </p>
                          </div>
                        </div>
                        {dates.length > 0 && (
                          <div>
                            <p className="text-[10px] mb-1.5" style={{ color: "var(--text-muted)" }}>Échéances</p>
                            <div className="flex flex-wrap gap-1.5">
                              {dates.map((d, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                                  {i + 1}. {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {p.notes && (
                      <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>💬 {p.notes}</p>
                    )}

                    {/* Purchase date */}
                    {p.purchase_date && (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Acheté le {new Date(p.purchase_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 z-40" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-lg rounded-2xl pointer-events-auto overflow-y-auto max-h-[90vh]"
              style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
              <div className="sticky top-0 px-5 py-4 flex items-center justify-between" style={{ backgroundColor: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
                  {editId ? "Modifier l'achat" : "Nouvel achat"}
                </h2>
                <button onClick={() => setModalOpen(false)} className="text-lg leading-none hover:opacity-70" style={{ color: "var(--text-muted)" }}>✕</button>
              </div>

              <div className="p-5 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Nom de l'achat *</label>
                  <input value={form.name} onChange={e => set("name", e.target.value)}
                    placeholder="ex. MacBook Pro, Canapé…"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Montant (€) *</label>
                  <input value={form.amount} onChange={e => set("amount", e.target.value)}
                    type="number" min="0.01" step="0.01" placeholder="0,00"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>

                {/* Payment mode */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Mode de paiement</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {PAYMENT_MODES.map(m => (
                      <button key={m.key} type="button" onClick={() => set("payment_mode", m.key)}
                        className="py-2.5 rounded-xl text-sm font-medium text-center transition-all"
                        style={form.payment_mode === m.key
                          ? { backgroundColor: "var(--accent)", color: "#fff" }
                          : { backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        <div>{m.icon}</div>
                        <div className="text-[10px] mt-0.5">{m.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Installment options */}
                {form.payment_mode !== "comptant" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Frais (%)</label>
                        <input value={form.installment_fees_pct} onChange={e => set("installment_fees_pct", e.target.value)}
                          type="number" min="0" step="0.1" placeholder="0"
                          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                      </div>
                      {form.payment_mode === "credit" && (
                        <div>
                          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Durée (mois)</label>
                          <input value={form.credit_months} onChange={e => set("credit_months", e.target.value)}
                            type="number" min="2" step="1" placeholder="12"
                            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                        </div>
                      )}
                    </div>

                    {/* Installment preview */}
                    {formAmount > 0 && (
                      <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Récapitulatif</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{formInst.n}× mensualités</p>
                            <p className="text-sm font-bold tabular-nums" style={{ color: "#f59e0b", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(formInst.monthly)}</p>
                          </div>
                          <div>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Total</p>
                            <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(formInst.total)}</p>
                          </div>
                          <div>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Frais</p>
                            <p className="text-sm font-bold tabular-nums" style={{ color: formInst.fees > 0 ? "var(--danger)" : "var(--success)", fontFamily: "var(--font-dm-mono, monospace)" }}>
                              {formInst.fees > 0 ? fmt(formInst.fees) : "Gratuit"}
                            </p>
                          </div>
                        </div>
                        {formDates.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {formDates.map((d, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                                {i + 1}. {d}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Category + Activity */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Catégorie</label>
                    <select value={form.category} onChange={e => set("category", e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none appearance-none"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Activité</label>
                    <select value={form.activity} onChange={e => set("activity", e.target.value as Activity)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none appearance-none"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      {activities.map(a => <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Priorité</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["high", "medium", "low"] as Priority[]).map(pr => {
                      const cfg = PRIORITY_CFG[pr];
                      return (
                        <button key={pr} type="button" onClick={() => set("priority", pr)}
                          className="py-2 rounded-xl text-xs font-medium text-center transition-all"
                          style={form.priority === pr
                            ? { backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}` }
                            : { backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                          {cfg.dot} {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Statut</label>
                  <select value={form.status} onChange={e => set("status", e.target.value as PurchaseStatus)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none appearance-none"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                    {(Object.keys(STATUS_CFG) as PurchaseStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                    ))}
                  </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Date prévue</label>
                    <input type="date" value={form.target_date} onChange={e => set("target_date", e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Date d'achat réelle</label>
                    <input type="date" value={form.purchase_date} onChange={e => set("purchase_date", e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Notes</label>
                  <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                    rows={2} placeholder="Lien produit, justification, comparatif de prix…"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>

                {/* Footer */}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                    Annuler
                  </button>
                  <button type="button" onClick={save} disabled={saving || !form.name.trim() || !form.amount}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: "var(--accent)" }}>
                    {saving ? "Enregistrement…" : editId ? "Mettre à jour" : "Ajouter"}
                  </button>
                </div>
                {saveError && (
                  <p className="text-xs text-center mt-2" style={{ color: "var(--danger)" }}>
                    Erreur : {saveError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
