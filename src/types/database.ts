export type Activity = string;
export type TransactionType = "income" | "expense";
export type BudgetPeriod = "monthly" | "quarterly" | "yearly";

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  currency: string;
  theme: string;
  created_at: string;
  updated_at: string;
};

type TransactionRow = {
  id: string;
  user_id: string;
  activity: Activity;
  type: TransactionType;
  amount: number;
  currency: string;
  category: string;
  description: string | null;
  date: string;
  document_id: string | null;
  is_recurring: boolean;
  recurring_frequency: "daily" | "weekly" | "monthly" | "yearly" | null;
  tags: string[] | null;
  notes: string | null;
  excluded_from_totals: boolean;
  created_at: string;
  updated_at: string;
};

type CategoryRow = {
  id: string;
  user_id: string | null;
  activity: Activity | null;
  type: TransactionType;
  name: string;
  icon: string | null;
  color: string | null;
  budget_monthly: number | null;
  is_default: boolean;
  created_at: string;
};

type DocumentRow = {
  id: string;
  user_id: string;
  activity: Activity | null;
  name: string;
  type: string;
  size: number;
  storage_path: string;
  tags: string[] | null;
  created_at: string;
};

type BudgetRow = {
  id: string;
  user_id: string;
  activity: Activity;
  category: string;
  amount: number;
  period: BudgetPeriod;
  year: number;
  month: number | null;
  created_at: string;
};

type GoalRow = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  color: string | null;
  icon: string | null;
  description: string | null;
  is_completed: boolean;
  created_at: string;
};

type ReceivableRow = {
  id: string;
  user_id: string;
  activity: Activity;
  client: string;
  invoice_ref: string | null;
  amount: number;
  currency: string;
  status: "to_invoice" | "invoiced" | "paid";
  service_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type UserActivityRow = {
  id: string;
  user_id: string;
  key: string;
  label: string;
  color: string;
  emoji: string;
  position: number;
  created_at: string;
};

type PurchaseRow = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  activity: Activity;
  category: string;
  payment_mode: "comptant" | "3x" | "4x" | "credit";
  installment_fees_pct: number;
  credit_months: number | null;
  priority: "high" | "medium" | "low";
  status: "planned" | "in_progress" | "done" | "cancelled";
  target_date: string | null;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type BudgetLineSection = "revenue" | "fixed_charge";

type BudgetLineRow = {
  id: string;
  user_id: string;
  section: BudgetLineSection;
  label: string;
  position: number;
  created_at: string;
};

type BudgetLineValueRow = {
  id: string;
  user_id: string;
  line_id: string;
  month: string;
  amount: number;
  created_at: string;
};

type BudgetMonthlySettingRow = {
  id: string;
  user_id: string;
  month: string;
  safety_margin_target: number;
  created_at: string;
};

type BudgetCreditRow = {
  id: string;
  user_id: string;
  name: string;
  taeg: number | null;
  starting_balance: number;
  start_month: string;
  position: number;
  created_at: string;
};

type BudgetCreditRepaymentRow = {
  id: string;
  user_id: string;
  credit_id: string;
  month: string;
  amount: number;
  created_at: string;
};

type BudgetExceptionalExpenseRow = {
  id: string;
  user_id: string;
  expense_date: string;
  description: string;
  amount: number;
  notes: string | null;
  created_at: string;
};

export type {
  ProfileRow, TransactionRow, CategoryRow, DocumentRow, BudgetRow, GoalRow, ReceivableRow, PurchaseRow, UserActivityRow,
  BudgetLineSection, BudgetLineRow, BudgetLineValueRow, BudgetMonthlySettingRow, BudgetCreditRow, BudgetCreditRepaymentRow, BudgetExceptionalExpenseRow,
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "created_at" | "updated_at">;
        Update: Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: Omit<TransactionRow, "id" | "created_at" | "updated_at" | "description" | "document_id" | "is_recurring" | "recurring_frequency" | "tags" | "notes" | "excluded_from_totals"> & {
          description?: string | null;
          document_id?: string | null;
          is_recurring?: boolean;
          recurring_frequency?: "daily" | "weekly" | "monthly" | "yearly" | null;
          tags?: string[] | null;
          notes?: string | null;
          excluded_from_totals?: boolean;
        };
        Update: Partial<Omit<TransactionRow, "id" | "user_id" | "created_at" | "updated_at">>;
        Relationships: [
          { foreignKeyName: "transactions_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "fk_transaction_document"; columns: ["document_id"]; isOneToOne: false; referencedRelation: "documents"; referencedColumns: ["id"] }
        ];
      };
      categories: {
        Row: CategoryRow;
        Insert: Omit<CategoryRow, "id" | "created_at">;
        Update: Partial<Omit<CategoryRow, "id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "categories_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ];
      };
      documents: {
        Row: DocumentRow;
        Insert: Omit<DocumentRow, "id" | "created_at" | "tags"> & { tags?: string[] | null };
        Update: Partial<Omit<DocumentRow, "id" | "user_id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "documents_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ];
      };
      budgets: {
        Row: BudgetRow;
        Insert: Omit<BudgetRow, "id" | "created_at">;
        Update: Partial<Omit<BudgetRow, "id" | "user_id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "budgets_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ];
      };
      goals: {
        Row: GoalRow;
        Insert: Omit<GoalRow, "id" | "created_at">;
        Update: Partial<Omit<GoalRow, "id" | "user_id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "goals_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ];
      };
      receivables: {
        Row: ReceivableRow;
        Insert: Omit<ReceivableRow, "id" | "created_at" | "updated_at" | "invoice_ref" | "service_date" | "description"> & {
          invoice_ref?: string | null;
          service_date?: string | null;
          description?: string | null;
        };
        Update: Partial<Omit<ReceivableRow, "id" | "user_id" | "created_at" | "updated_at">>;
        Relationships: [
          { foreignKeyName: "receivables_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ];
      };
      purchases: {
        Row: PurchaseRow;
        Insert: Omit<PurchaseRow, "id" | "created_at" | "updated_at" | "credit_months" | "target_date" | "purchase_date" | "notes"> & {
          credit_months?: number | null;
          target_date?: string | null;
          purchase_date?: string | null;
          notes?: string | null;
        };
        Update: Partial<Omit<PurchaseRow, "id" | "user_id" | "created_at" | "updated_at">>;
        Relationships: [
          { foreignKeyName: "purchases_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ];
      };
      user_activities: {
        Row: UserActivityRow;
        Insert: Omit<UserActivityRow, "id" | "created_at">;
        Update: Partial<Omit<UserActivityRow, "id" | "user_id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "user_activities_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ];
      };
      budget_lines: {
        Row: BudgetLineRow;
        Insert: Omit<BudgetLineRow, "id" | "created_at">;
        Update: Partial<Omit<BudgetLineRow, "id" | "user_id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "budget_lines_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ];
      };
      budget_line_values: {
        Row: BudgetLineValueRow;
        Insert: Omit<BudgetLineValueRow, "id" | "created_at">;
        Update: Partial<Omit<BudgetLineValueRow, "id" | "user_id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "budget_line_values_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "budget_line_values_line_id_fkey"; columns: ["line_id"]; isOneToOne: false; referencedRelation: "budget_lines"; referencedColumns: ["id"] }
        ];
      };
      budget_monthly_settings: {
        Row: BudgetMonthlySettingRow;
        Insert: Omit<BudgetMonthlySettingRow, "id" | "created_at">;
        Update: Partial<Omit<BudgetMonthlySettingRow, "id" | "user_id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "budget_monthly_settings_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ];
      };
      budget_credits: {
        Row: BudgetCreditRow;
        Insert: Omit<BudgetCreditRow, "id" | "created_at">;
        Update: Partial<Omit<BudgetCreditRow, "id" | "user_id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "budget_credits_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ];
      };
      budget_credit_repayments: {
        Row: BudgetCreditRepaymentRow;
        Insert: Omit<BudgetCreditRepaymentRow, "id" | "created_at">;
        Update: Partial<Omit<BudgetCreditRepaymentRow, "id" | "user_id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "budget_credit_repayments_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "budget_credit_repayments_credit_id_fkey"; columns: ["credit_id"]; isOneToOne: false; referencedRelation: "budget_credits"; referencedColumns: ["id"] }
        ];
      };
      budget_exceptional_expenses: {
        Row: BudgetExceptionalExpenseRow;
        Insert: Omit<BudgetExceptionalExpenseRow, "id" | "created_at">;
        Update: Partial<Omit<BudgetExceptionalExpenseRow, "id" | "user_id" | "created_at">>;
        Relationships: [
          { foreignKeyName: "budget_exceptional_expenses_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      activity: Activity;
      transaction_type: TransactionType;
      budget_period: BudgetPeriod;
    };
  };
};
