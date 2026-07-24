"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type {
  BudgetLineRow, BudgetLineValueRow, BudgetMonthlySettingRow,
  BudgetCreditRow, BudgetCreditRepaymentRow, BudgetExceptionalExpenseRow,
} from "@/types/database";
import {
  monthKey, DEFAULT_REVENUE_LABELS, DEFAULT_CHARGE_LABELS, DEFAULT_CREDITS, DEFAULT_SAFETY_MARGIN,
  type BudgetData,
} from "./lib";
import MonthlyTab from "./MonthlyTab";
import CreditsTab from "./CreditsTab";
import ExceptionalTab from "./ExceptionalTab";
import AnalysisTab from "./AnalysisTab";

const TABS = [
  { key: "monthly", label: "Suivi mensuel", icon: "📅" },
  { key: "credits", label: "Crédits renouvelables", icon: "💳" },
  { key: "exceptional", label: "Dépenses exceptionnelles", icon: "🧾" },
  { key: "analysis", label: "Analyse", icon: "📊" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function BudgetsPage() {
  const [tab, setTab] = useState<TabKey>("monthly");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BudgetData>({
    lines: [], values: [], settings: [], credits: [], repayments: [], exceptional: [],
  });

  const load = useCallback(async () => {
    const [lines, values, settings, credits, repayments, exceptional] = await Promise.all([
      supabase.from("budget_lines").select("*").order("section").order("position"),
      supabase.from("budget_line_values").select("*"),
      supabase.from("budget_monthly_settings").select("*"),
      supabase.from("budget_credits").select("*").order("position"),
      supabase.from("budget_credit_repayments").select("*"),
      supabase.from("budget_exceptional_expenses").select("*").order("expense_date"),
    ]);
    setData({
      lines: (lines.data as BudgetLineRow[]) ?? [],
      values: (values.data as BudgetLineValueRow[]) ?? [],
      settings: (settings.data as BudgetMonthlySettingRow[]) ?? [],
      credits: (credits.data as BudgetCreditRow[]) ?? [],
      repayments: (repayments.data as BudgetCreditRepaymentRow[]) ?? [],
      exceptional: (exceptional.data as BudgetExceptionalExpenseRow[]) ?? [],
    });
    return lines.data as BudgetLineRow[] | null;
  }, []);

  const seedIfEmpty = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const existingLines = await load();
    if (existingLines && existingLines.length > 0) { setLoading(false); return; }

    const rows = [
      ...DEFAULT_REVENUE_LABELS.map((label, i) => ({ user_id: user.id, section: "revenue" as const, label, position: i })),
      ...DEFAULT_CHARGE_LABELS.map((label, i) => ({ user_id: user.id, section: "fixed_charge" as const, label, position: i })),
    ];
    await supabase.from("budget_lines").insert(rows);

    const currentMonth = monthKey(new Date());
    await supabase.from("budget_monthly_settings").insert({
      user_id: user.id, month: currentMonth, safety_margin_target: DEFAULT_SAFETY_MARGIN,
    });
    await supabase.from("budget_credits").insert(
      DEFAULT_CREDITS.map((c, i) => ({
        user_id: user.id, name: c.name, taeg: c.taeg, starting_balance: c.starting_balance,
        start_month: currentMonth, position: i,
      }))
    );

    await load();
    setLoading(false);
  }, [load]);

  useEffect(() => { seedIfEmpty(); }, [seedIfEmpty]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Budget</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Suivi budget &amp; remboursement des crédits renouvelables
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap p-1 rounded-xl w-fit" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            style={{
              backgroundColor: tab === t.key ? "var(--accent)" : "transparent",
              color: tab === t.key ? "#fff" : "var(--text-secondary)",
            }}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <p className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Chargement…</p>
        </div>
      ) : (
        <>
          {tab === "monthly" && <MonthlyTab data={data} reload={load} />}
          {tab === "credits" && <CreditsTab data={data} reload={load} />}
          {tab === "exceptional" && <ExceptionalTab data={data} reload={load} />}
          {tab === "analysis" && <AnalysisTab data={data} />}
        </>
      )}
    </div>
  );
}
