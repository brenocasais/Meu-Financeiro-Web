/**
 * Types representing the data models shared between the Android native app
 * and the Web app in Firebase Firestore for "Meu Financeiro".
 */

export type TransactionType = 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA';

export interface Account {
  id: string;
  name: string;
  initial_balance: number;
  type?: 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CASH' | 'CREDIT_CARD' | string;
  color?: string;
  created_at?: string | number | null;
  updated_at?: string | number | null;
  is_archived?: boolean;
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  date: string; // ISO string 'YYYY-MM-DD' or timestamp
  account_id: string;
  destination_account_id?: string | null; // Used when type is 'TRANSFERENCIA'
  category_id?: string | null;
  subcategory_id?: string | null;
  description?: string;
  notes?: string;
  created_at?: string | number | null;
}

export type MovementEntityType = 'READY_TO_ASSIGN' | 'CATEGORY' | 'GOAL' | string;

export interface AllocationMovement {
  id: string;
  amount: number;
  origin_id: string; // e.g. 'READY_TO_ASSIGN', categoryId, goalId
  destination_id: string; // e.g. 'READY_TO_ASSIGN', categoryId, goalId
  origin_type?: MovementEntityType;
  destination_type?: MovementEntityType;
  month?: string; // Format 'YYYY-MM'
  created_at?: string | number | null;
  note?: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  icon?: string;
  order?: number;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  order?: number;
  subcategories?: Subcategory[];
}

export interface Goal {
  id: string;
  name: string;
  target_amount: number;
  target_date?: string | null; // 'YYYY-MM' or 'YYYY-MM-DD'
  created_at?: string | number | null;
  icon?: string;
  color?: string;
}

export interface CategoryMonthCalculation {
  categoryId: string;
  month: string; // 'YYYY-MM'
  allocated: number;
  spent: number;
  available: number;
}

export interface ReadyToAssignCalculation {
  month: string; // 'YYYY-MM'
  totalAccountsBalance: number;
  totalAvailableAccumulated: number;
  totalGoalsCurrentValue: number;
  readyToAssign: number;
}
