/**
 * Modelos de dados REAIS compartilhados entre o app nativo Android em produção
 * e este app Web, sincronizados através do documento /users/{userId} no Firebase Firestore.
 * 
 * NOTA CRÍTICA: No Android / Firestore, todos os IDs e chaves estrangeiras (*_id)
 * são representados estritamente como NÚMEROS INTEIROS (Int de 32 bits no Kotlin).
 */

export interface Account {
  id: number;
  name: string;
  type: "DINHEIRO" | "CONTA_CORRENTE" | "CARTAO_CREDITO";
  initial_balance: number;
  archived: boolean;
}

export interface Category {
  id: number;
  name: string;
  archived: boolean;
  icon: string | null;
}

export interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  archived: boolean;
  icon: string | null;
}

export interface Transaction {
  id: number;
  account_id: number;
  to_account_id: number | null;
  category_id: number | null;
  subcategory_id: number | null;
  type: "RECEITA" | "DESPESA" | "TRANSFERENCIA";
  value: number;
  description: string;
  date: string; // YYYY-MM-DD
  installment_plan_id?: number | null;
  installment_number?: number | null;
  recurrence_rule_id?: number | null;
}

export interface InstallmentPlan {
  id: number;
  account_id: number;
  category_id: number | null;
  subcategory_id: number | null;
  description: string;
  total_value: number;
  installments_count: number;
  first_installment_month: string; // YYYY-MM
}

export interface BudgetAllocation {
  id: number;
  category_id: number;
  subcategory_id: number | null;
  month: string; // YYYY-MM - o mês vive AQUI, não no AllocationMovement
  planned_value: number;
}

export interface AllocationMovement {
  id: number;
  source_budget_allocation_id: number | null;
  source_goal_id: number | null;
  dest_budget_allocation_id: number | null;
  dest_goal_id: number | null;
  amount: number;
  note: string | null;
  moved_at: number;
}

export interface Goal {
  id: number;
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
  categoryId: number;
  subcategoryId?: number | null;
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
