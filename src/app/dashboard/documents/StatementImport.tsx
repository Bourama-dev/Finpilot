"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { UserActivity } from "@/hooks/useActivities";
import { CATEGORY_SUGGESTIONS } from "./constants";

type StatementTx = {
  type: "income" | "expense";
  amount: string;
  category: string;
  description: string;
  date: string;
  include: boolean;
  duplicate: boolean;
};

type ImportSummary = {
  count: number;
  income: number;
  expense: number;
  byCategory: { category: string; amount: number }[];
  periodLabel: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const inputStyle = {
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

const PALETTE = ["#4F46E5", "#059669", "#D97706", "#DC2626", "#0EA5E9", "#EC4899", "#8B5CF6", "#14B8A6"];

export default function StatementImport({ activities }: { activities: UserActivity[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fileObjRef = useRef<File | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<StatementTx[] | null>(null);
  const [activity, setActivity] = useState("personnel");
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function analyzeStatement(file: File) {
    setAnalyzing(true);
    setError(null);
    setRows(null);
    setSummary(null);
    fileObjRef.current = file;

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/analyze-statement", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur analyse");
      const extracted = (json.data as Array<Record<string, unknown>>) ?? [];
      if (extracted.length === 0) throw new Error("Aucune opération détectée dans ce document.");

      const dates = extracted.map(t => String(t.date ?? "")).filter(Boolean).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];

      const { data: existing } = await supabase
        .from("transactions")
        .select("date, amount")
        .gte("date", minDate)
        .lte("date", maxDate);

      const existingSet = new Set((existing ?? []).map(t => `${t.date}|${Number(t.amount).toFixed(2)}`));

      const built: StatementTx[] = extracted.map(t => {
        const amount = String(t.amount ?? "");
        const date = String(t.date ?? new Date().toISOString().slice(0, 10));
        const isDup = existingSet.has(`${date}|${Number(amount).toFixed(2)}`);
        return {
          type: t.type === "income" ? "income" : "expense",
          amount,
          category: String(t.category ?? "Autre"),
          description: String(t.description ?? ""),
          date,
          include: !isDup,
          duplicate: isDup,
        };
      });

      setRows(built);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'analyse");
    } finally {
      setAnalyzing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function updateRow(i: number, patch: Partial<StatementTx>) {
    setRows(prev => prev ? prev.map((r, idx) => idx === i ? { ...r, ...patch } : r) : prev);
  }

  async function doImport() {
    if (!rows || !fileObjRef.current) return;
    const included = rows.filter(r => r.include && r.amount);
    if (included.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const file = fileObjRef.current;
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: storageError } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
      if (storageError) throw storageError;

      const { data: doc, error: docError } = await supabase.from("documents").insert({
        user_id: user.id,
        name: file.name,
        type: file.type,
        size: file.size,
        storage_path: path,
        activity,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).select().single();
      if (docError) throw docError;

      const { error: txError } = await supabase.from("transactions").insert(
        included.map(r => ({
          user_id: user.id,
          activity,
          type: r.type,
          amount: parseFloat(r.amount),
          currency: "EUR",
          category: r.category,
          description: r.description || null,
          date: r.date,
          is_recurring: false,
          recurring_frequency: null,
          document_id: doc.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        })) as any
      );
      if (txError) throw txError;

      const byCategory: Record<string, number> = {};
      let income = 0, expense = 0;
      included.forEach(r => {
        const amt = parseFloat(r.amount);
        if (r.type === "income") income += amt;
        else { expense += amt; byCategory[r.category] = (byCategory[r.category] ?? 0) + amt; }
      });
      const dates = included.map(r => r.date).sort();
      const periodLabel = dates.length > 0
        ? `${new Date(dates[0]).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} → ${new Date(dates[dates.length - 1]).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
        : "";

      setSummary({
        count: included.length,
        income, expense,
        byCategory: Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount })),
        periodLabel,
      });
      setRows(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  }

  const includedCount = rows?.filter(r => r.include).length ?? 0;
  const net = summary ? summary.income - summary.expense : 0;
  const topCategory = summary?.byCategory[0];
  const maxCatAmount = summary?.byCategory[0]?.amount ?? 1;

  return (
    <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--accent)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent)" }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: "var(--accent-light)" }}>🏦</div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Importer un relevé bancaire</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Claude extrait toutes les opérations — vérifiez avant d&apos;importer, puis obtenez une analyse</p>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={analyzing}
          className="ml-auto px-4 py-2 rounded-xl text-white text-sm font-medium shrink-0 disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)" }}>
          {analyzing ? "Analyse…" : "Choisir un relevé"}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) analyzeStatement(f); }} />
      </div>

      {analyzing && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
          <span className="animate-spin">⏳</span> Lecture du relevé en cours… (peut prendre jusqu&apos;à une minute)
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "var(--danger-light)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              {rows.length} opération{rows.length > 1 ? "s" : ""} détectée{rows.length > 1 ? "s" : ""} — {includedCount} sélectionnée{includedCount > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Activité :</span>
              <select value={activity} onChange={e => setActivity(e.target.value)}
                className="px-2 py-1 rounded-lg text-xs outline-none" style={inputStyle}>
                {activities.map(a => <option key={a.key} value={a.key}>{a.emoji} {a.label}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-lg overflow-auto max-h-96" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <th className="px-2 py-2"></th>
                  <th className="px-2 py-2 text-left" style={{ color: "var(--text-muted)" }}>Date</th>
                  <th className="px-2 py-2 text-left" style={{ color: "var(--text-muted)" }}>Description</th>
                  <th className="px-2 py-2 text-left" style={{ color: "var(--text-muted)" }}>Catégorie</th>
                  <th className="px-2 py-2 text-left" style={{ color: "var(--text-muted)" }}>Type</th>
                  <th className="px-2 py-2 text-right" style={{ color: "var(--text-muted)" }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)", opacity: r.include ? 1 : 0.45 }}>
                    <td className="px-2 py-1.5">
                      <input type="checkbox" checked={r.include} onChange={e => updateRow(i, { include: e.target.checked })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="date" value={r.date} onChange={e => updateRow(i, { date: e.target.value })}
                        className="w-full px-1.5 py-1 rounded text-xs outline-none" style={inputStyle} />
                    </td>
                    <td className="px-2 py-1.5 min-w-[140px]">
                      <input type="text" value={r.description} onChange={e => updateRow(i, { description: e.target.value })}
                        className="w-full px-1.5 py-1 rounded text-xs outline-none" style={inputStyle} />
                      {r.duplicate && (
                        <span className="block mt-0.5 text-[10px]" style={{ color: "var(--warning)" }}>⚠ déjà importé (même date/montant)</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 min-w-[110px]">
                      <input type="text" list="cat-statement" value={r.category} onChange={e => updateRow(i, { category: e.target.value })}
                        className="w-full px-1.5 py-1 rounded text-xs outline-none" style={inputStyle} />
                    </td>
                    <td className="px-2 py-1.5">
                      <select value={r.type} onChange={e => updateRow(i, { type: e.target.value as "income" | "expense" })}
                        className="px-1.5 py-1 rounded text-xs outline-none" style={inputStyle}>
                        <option value="expense">↓ Dépense</option>
                        <option value="income">↑ Revenu</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right min-w-[90px]">
                      <input type="number" step="0.01" value={r.amount} onChange={e => updateRow(i, { amount: e.target.value })}
                        className="w-full text-right px-1.5 py-1 rounded text-xs outline-none tabular-nums" style={inputStyle} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="cat-statement">{CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}</datalist>
          </div>

          <div className="flex gap-2">
            <button onClick={doImport} disabled={importing || includedCount === 0}
              className="flex-1 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)" }}>
              {importing ? "Import en cours…" : `✓ Importer ${includedCount} opération${includedCount > 1 ? "s" : ""}`}
            </button>
            <button onClick={() => { setRows(null); fileObjRef.current = null; }}
              className="px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {summary && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "var(--success-light)", color: "var(--success)" }}>
            ✓ {summary.count} opération{summary.count > 1 ? "s" : ""} importée{summary.count > 1 ? "s" : ""} ({summary.periodLabel})
            <button onClick={() => setSummary(null)} className="ml-auto text-xs underline opacity-70">Importer un autre relevé</button>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>📊 Analyse du relevé</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Revenus</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: "var(--success)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(summary.income)}</p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Dépenses</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(summary.expense)}</p>
              </div>
              <div className="rounded-lg p-3 text-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Solde net</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: net >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-dm-mono, monospace)" }}>{net >= 0 ? "+" : ""}{fmt(net)}</p>
              </div>
            </div>
          </div>

          {summary.byCategory.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Répartition des dépenses par catégorie</p>
              {summary.byCategory.map((c, i) => (
                <div key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--text-secondary)" }}>{c.category}</span>
                    <span className="font-semibold tabular-nums" style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>{fmt(c.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, (c.amount / maxCatAmount) * 100)}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>💡 Recommandations</p>
            <div className="space-y-2">
              {net < 0 && (
                <div className="rounded-lg p-3 text-sm flex gap-2" style={{ backgroundColor: "color-mix(in srgb, var(--danger) 7%, var(--bg-secondary))", border: "1px solid var(--danger)" }}>
                  <span>🔴</span>
                  <span style={{ color: "var(--text-secondary)" }}>Ce relevé est en déficit de {fmt(Math.abs(net))} — vos dépenses ont dépassé vos revenus sur cette période.</span>
                </div>
              )}
              {topCategory && (
                <div className="rounded-lg p-3 text-sm flex gap-2" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <span>✂️</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    <strong style={{ color: "var(--text-primary)" }}>{topCategory.category}</strong> est votre plus grosse dépense ({fmt(topCategory.amount)}). Une réduction de 20 % libérerait {fmt(topCategory.amount * 0.2)}.
                  </span>
                </div>
              )}
              {summary.income > 0 && (
                <div className="rounded-lg p-3 text-sm flex gap-2" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <span>💰</span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    Taux d&apos;épargne sur la période : <strong style={{ color: net >= 0 ? "var(--success)" : "var(--danger)" }}>{Math.round((net / summary.income) * 100)}%</strong>
                    {net / summary.income < 0.1 ? " — en dessous des 20% recommandés." : "."}
                  </span>
                </div>
              )}
            </div>
            <a href="/dashboard/recommendations" className="inline-block text-xs underline mt-1" style={{ color: "var(--accent)" }}>
              Voir l&apos;analyse complète et le score de santé financière →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
