"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  fmt, inputStyle, addMonths, monthLabel, computeMonths, computeMonthly,
  type BudgetData,
} from "./lib";

export default function MonthlyTab({ data, reload }: { data: BudgetData; reload: () => Promise<unknown> }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [newRevenueLabel, setNewRevenueLabel] = useState("");
  const [newChargeLabel, setNewChargeLabel] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const months = useMemo(() => computeMonths(data), [data]);
  const monthly = useMemo(() => computeMonthly(data, months), [data, months]);

  const revenueLines = data.lines.filter(l => l.section === "revenue");
  const chargeLines = data.lines.filter(l => l.section === "fixed_charge");

  function valueFor(lineId: string, month: string) {
    return data.values.find(v => v.line_id === lineId && v.month === month)?.amount ?? 0;
  }

  async function saveValue(lineId: string, month: string, amount: number) {
    if (!userId) return;
    await supabase.from("budget_line_values")
      .upsert({ user_id: userId, line_id: lineId, month, amount }, { onConflict: "line_id,month" });
    await reload();
  }

  async function addLine(section: "revenue" | "fixed_charge", label: string) {
    if (!userId || !label.trim()) return;
    const position = (section === "revenue" ? revenueLines : chargeLines).length;
    await supabase.from("budget_lines").insert({ user_id: userId, section, label: label.trim(), position });
    section === "revenue" ? setNewRevenueLabel("") : setNewChargeLabel("");
    await reload();
  }

  async function deleteLine(id: string) {
    if (!confirm("Supprimer cette ligne et toutes ses valeurs mensuelles ?")) return;
    await supabase.from("budget_lines").delete().eq("id", id);
    await reload();
  }

  async function addMonth() {
    if (!userId) return;
    const last = months[months.length - 1];
    const next = addMonths(last, 1);
    await supabase.from("budget_monthly_settings")
      .upsert({ user_id: userId, month: next, safety_margin_target: 350 }, { onConflict: "user_id,month" });
    await reload();
  }

  async function saveSafetyMargin(month: string, amount: number) {
    if (!userId) return;
    await supabase.from("budget_monthly_settings")
      .upsert({ user_id: userId, month, safety_margin_target: amount }, { onConflict: "user_id,month" });
    await reload();
  }

  const cellW = "min-w-[110px]";
  const th = "px-3 py-2.5 text-left text-xs font-semibold sticky top-0";
  const thM = `px-3 py-2.5 text-right text-xs font-semibold sticky top-0 ${cellW}`;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={addMonth} className="px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}>
          + Ajouter le mois suivant
        </button>
      </div>

      <div className="rounded-xl overflow-x-auto" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: "var(--bg-tertiary)" }}>
              <th className={th} style={{ color: "var(--text-muted)" }}></th>
              {months.map(m => (
                <th key={m} className={thM} style={{ color: "var(--text-muted)" }}>{monthLabel(m)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SectionHeader label="REVENUS" cols={months.length} />
            {revenueLines.map(line => (
              <LineRow key={line.id} label={line.label} months={months}
                getValue={m => valueFor(line.id, m)}
                onSave={(m, v) => saveValue(line.id, m, v)}
                onDelete={() => deleteLine(line.id)} />
            ))}
            <AddRow label={newRevenueLabel} setLabel={setNewRevenueLabel} onAdd={() => addLine("revenue", newRevenueLabel)} colSpan={months.length + 1} placeholder="Nouvelle ligne de revenu…" />
            <TotalRow label="TOTAL REVENUS" months={monthly} pick={m => m.totalRevenue} />

            <SectionHeader label="CHARGES FIXES" cols={months.length} />
            {chargeLines.map(line => (
              <LineRow key={line.id} label={line.label} months={months}
                getValue={m => valueFor(line.id, m)}
                onSave={(m, v) => saveValue(line.id, m, v)}
                onDelete={() => deleteLine(line.id)} />
            ))}
            <AddRow label={newChargeLabel} setLabel={setNewChargeLabel} onAdd={() => addLine("fixed_charge", newChargeLabel)} colSpan={months.length + 1} placeholder="Nouvelle charge fixe…" />
            <TotalRow label="TOTAL CHARGES FIXES" months={monthly} pick={m => m.totalCharges} negative />

            <SectionHeader label="DÉPENSE EXCEPTIONNELLE DU MOIS" cols={months.length} />
            <TotalRow label="Dépenses exceptionnelles (voir onglet dédié)" months={monthly} pick={m => m.exceptional} negative muted />

            <SectionHeader label="EXCÉDENT & AFFECTATION" cols={months.length} />
            <TotalRow label="Excédent brut (Revenus − Charges − Imprévu)" months={monthly} pick={m => m.grossSurplus} highlight />
            <tr>
              <td className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)" }}>Marge de sécurité visée</td>
              {months.map(m => {
                const s = monthly.find(x => x.month === m);
                return (
                  <td key={m} className={`px-3 py-1.5 text-right ${cellW}`}>
                    <input type="number" step="1" defaultValue={s?.safetyMargin ?? 350}
                      onBlur={e => saveSafetyMargin(m, parseFloat(e.target.value) || 0)}
                      className="w-full text-right px-2 py-1 rounded text-xs outline-none tabular-nums"
                      style={{ ...inputStyle, fontFamily: "var(--font-dm-mono, monospace)" }} />
                  </td>
                );
              })}
            </tr>
            <TotalRow label="Disponible pour remboursement anticipé" months={monthly} pick={m => m.availableForRepayment} />
            <TotalRow label="Remboursement anticipé réellement effectué" months={monthly} pick={m => m.actualRepayment} muted />
            <TotalRow label="Écart vs disponible" months={monthly} pick={m => m.gap} highlight />
            <TotalRow label="CUMUL remboursé" months={monthly} pick={m => m.cumulativeRepaid} highlight />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionHeader({ label, cols }: { label: string; cols: number }) {
  return (
    <tr>
      <td colSpan={cols + 1} className="px-3 py-2 text-[11px] font-bold tracking-wide" style={{ color: "var(--accent)", backgroundColor: "var(--bg-tertiary)" }}>
        {label}
      </td>
    </tr>
  );
}

function LineRow({ label, months, getValue, onSave, onDelete }: {
  label: string; months: string[]; getValue: (m: string) => number;
  onSave: (m: string, v: number) => void; onDelete: () => void;
}) {
  return (
    <tr className="group" style={{ borderBottom: "1px solid var(--border)" }}>
      <td className="px-3 py-1.5 text-xs whitespace-nowrap" style={{ color: "var(--text-primary)" }}>
        <div className="flex items-center gap-1.5">
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-[10px] transition-opacity" style={{ color: "var(--danger)" }}>🗑</button>
          {label}
        </div>
      </td>
      {months.map(m => (
        <td key={m} className="px-3 py-1.5 text-right min-w-[110px]">
          <input type="number" step="0.01" defaultValue={getValue(m) || ""} placeholder="0"
            onBlur={e => onSave(m, parseFloat(e.target.value) || 0)}
            className="w-full text-right px-2 py-1 rounded text-xs outline-none tabular-nums"
            style={{ ...inputStyle, fontFamily: "var(--font-dm-mono, monospace)" }} />
        </td>
      ))}
    </tr>
  );
}

function AddRow({ label, setLabel, onAdd, colSpan, placeholder }: {
  label: string; setLabel: (v: string) => void; onAdd: () => void; colSpan: number; placeholder: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-2">
        <div className="flex items-center gap-2">
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder={placeholder}
            onKeyDown={e => e.key === "Enter" && onAdd()}
            className="flex-1 max-w-xs px-2 py-1.5 rounded text-xs outline-none" style={inputStyle} />
          <button onClick={onAdd} className="px-2.5 py-1.5 rounded text-xs font-medium" style={{ backgroundColor: "var(--accent-light)", color: "var(--accent)" }}>+ Ajouter</button>
        </div>
      </td>
    </tr>
  );
}

function TotalRow({ label, months, pick, negative, highlight, muted }: {
  label: string;
  months: { month: string }[];
  pick: (m: { month: string } & Record<string, number>) => number;
  negative?: boolean;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <tr style={{ backgroundColor: highlight ? "var(--bg-tertiary)" : undefined }}>
      <td className="px-3 py-2 text-xs font-semibold" style={{ color: muted ? "var(--text-muted)" : "var(--text-primary)" }}>{label}</td>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(months as any[]).map(m => {
        const v = pick(m);
        const isNeg = v < 0;
        return (
          <td key={m.month} className="px-3 py-2 text-right text-xs font-bold tabular-nums min-w-[110px]"
            style={{ color: isNeg ? "var(--danger)" : negative ? "var(--text-secondary)" : muted ? "var(--text-muted)" : "var(--text-primary)", fontFamily: "var(--font-dm-mono, monospace)" }}>
            {fmt(v)}
          </td>
        );
      })}
    </tr>
  );
}
