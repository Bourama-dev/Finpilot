export type Activity = "alternance" | "cle_avenir" | "hakily" | "personnel" | "freelance";
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

export type { ProfileRow, TransactionRow, CategoryRow, DocumentRow, BudgetRow, GoalRow, ReceivableRow };

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
        Insert: Omit<TransactionRow, "id" | "created_at" | "updated_at" | "description" | "document_id" | "is_recurring" | "recurring_frequency" | "tags" | "notes"> & {
          description?: string | null;
          document_id?: string | null;
          is_recurring?: boolean;
          recurring_frequency?: "daily" | "weekly" | "monthly" | "yearly" | null;
          tags?: string[] | null;
          notes?: string | null;
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
