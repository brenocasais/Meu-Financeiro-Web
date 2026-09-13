/**
 * Modelos de dados REAIS compartilhados entre o app nativo Android em produção
 * e este app Web, sincronizados através do documento /users/{userId} no Firebase Firestore.
 */

export interface Account {
  id: string;
  name: string;
  type: "DINHEIRO" | "CONTA_CORRENTE" | "CARTAO_CREDITO";
  initial_balance: number;
  archived: boolean;
}

export interface Category {
  id: string;
  name: string;
  archived: boolean;
  icon: string | null;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  archived: boolean;
  icon: string | null;
}

export interface Transaction {
  id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  type: "RECEITA" | "DESPESA" | "TRANSFERENCIA";
  value: number;
  description: string;
  date: string; // YYYY-MM-DD
  installment_plan_id?: string | null;
  installment_number?: number | null;
  recurrence_rule_id?: string | null;
}

export interface InstallmentPlan {
  id: string;
  account_id: string;
  category_id: string | null;
  subcategory_id: string | null;
  description: string;
  total_value: number;
  installments_count: number;
  first_installment_month: string; // YYYY-MM
}

export interface BudgetAllocation {
  id: string;
  category_id: string;
  subcategory_id: string | null;
  month: string; // YYYY-MM - o mês vive AQUI, não no AllocationMovement
  planned_value: number;
}

export interface AllocationMovement {
  id: string;
  source_budget_allocation_id: string | null;
  source_goal_id: string | null;
  dest_budget_allocation_id: string | null;
  dest_goal_id: string | null;
  amount: number;
  note: string | null;
  moved_at: number;
}

export interface Goal {
  id: string;
  name: string;
  target_value: number;
  deadline: string;
  is_paused: boolean;
  archived: boolean;
}

/**
 * Estrutura do documento raiz no Firestore: /users/{userId}
 * Cada usuário possui um único documento com arrays para cada entidade.
 */
export interface UserFirestoreData {
  accounts: Account[];
  categories: Category[];
  subcategories: Subcategory[];
  transactions: Transaction[];
  budget_allocations: BudgetAllocation[];
  allocation_movements: AllocationMovement[];
  goals: Goal[];
  installment_plans: InstallmentPlan[];
}

export interface CategoryMonthCalculation {
  categoryId: string;
  subcategoryId?: string | null;
  month: string; // 'YYYY-MM'
  planned: number;
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
