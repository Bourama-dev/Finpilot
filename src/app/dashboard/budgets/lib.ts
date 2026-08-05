import type {
  BudgetLineRow, BudgetLineValueRow, BudgetMonthlySettingRow,
  BudgetCreditRow, BudgetCreditRepaymentRow, BudgetExceptionalExpenseRow,
} from "@/types/database";

export const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export const inputStyle = {
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
};

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export const DEFAULT_REVENUE_LABELS = [
  "Salaire (net)",
  "APL",
  "CAF Prime d'activité",
  "Aide Mobili-jeune",
  "Arbitrage",
  "Freelance (encaissé réel)",
  "Prime exceptionnelle",
];

export const DEFAULT_CHARGE_LABELS = [
  "Loyer",
  "Loyer Parents",
  "Crédit Auto",
  "Sofinco (mensualité min.)",
  "Oney (mensualité min.)",
  "Téléphone",
  "Assurance auto + habitation",
  "EDF + GRDF",
  "Courses",
  "Carburant",
  "Internet / Freebox",
  "Abonnements",
];

export const DEFAULT_CREDITS = [
  { name: "Sofinco", taeg: 23.5, starting_balance: 2990 },
  { name: "Oney", taeg: 23.3, starting_balance: 2394.84 },
];

export const DEFAULT_SAFETY_MARGIN = 350;

export type BudgetData = {
  lines: BudgetLineRow[];
  values: BudgetLineValueRow[];
  settings: BudgetMonthlySettingRow[];
  credits: BudgetCreditRow[];
  repayments: BudgetCreditRepaymentRow[];
  exceptional: BudgetExceptionalExpenseRow[];
};

export type MonthCompute = {
  month: string;
  totalRevenue: number;
  totalCharges: number;
  exceptional: number;
  grossSurplus: number;
  safetyMargin: number;
  availableForRepayment: number;
  actualRepayment: number;
  gap: number;
  cumulativeRepaid: number;
};

export function computeMonths(data: BudgetData): string[] {
  const set = new Set<string>();
  data.values.forEach(v => set.add(v.month));
  data.settings.forEach(s => set.add(s.month));
  data.repayments.forEach(r => set.add(r.month));
  set.add(monthKey(new Date()));
  return Array.from(set).sort();
}

export function computeMonthly(data: BudgetData, months: string[]): MonthCompute[] {
  const revenueLineIds = new Set(data.lines.filter(l => l.section === "revenue").map(l => l.id));
  const chargeLineIds = new Set(data.lines.filter(l => l.section === "fixed_charge").map(l => l.id));

  let cumulativeRepaid = 0;
  return months.map(month => {
    const totalRevenue = data.values
      .filter(v => v.month === month && revenueLineIds.has(v.line_id))
      .reduce((s, v) => s + v.amount, 0);
    const totalCharges = data.values
      .filter(v => v.month === month && chargeLineIds.has(v.line_id))
      .reduce((s, v) => s + v.amount, 0);
    const exceptional = data.exceptional
      .filter(e => e.expense_date.slice(0, 7) === month.slice(0, 7))
      .reduce((s, e) => s + e.amount, 0);
    const safetyMargin = data.settings.find(s => s.month === month)?.safety_margin_target ?? DEFAULT_SAFETY_MARGIN;
    const grossSurplus = totalRevenue - totalCharges - exceptional;
    const availableForRepayment = Math.max(0, grossSurplus - safetyMargin);
    const actualRepayment = data.repayments
      .filter(r => r.month === month)
      .reduce((s, r) => s + r.amount, 0);
    const gap = actualRepayment - availableForRepayment;
    cumulativeRepaid += actualRepayment;
    return {
      month, totalRevenue, totalCharges, exceptional, grossSurplus,
      safetyMargin, availableForRepayment, actualRepayment, gap,
      cumulativeRepaid,
    };
  });
}

export function creditRemaining(credit: BudgetCreditRow, repayments: BudgetCreditRepaymentRow[], upToMonth: string) {
  const repaid = repayments
    .filter(r => r.credit_id === credit.id && r.month <= upToMonth)
    .reduce((s, r) => s + r.amount, 0);
  return Math.max(0, credit.starting_balance - repaid);
}
