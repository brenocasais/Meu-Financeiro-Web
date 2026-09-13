import {
  Account,
  Transaction,
  BudgetAllocation,
  AllocationMovement,
  Goal,
  CategoryMonthCalculation,
  ReadyToAssignCalculation,
} from '../types/finance';

/**
 * Camada de Lógica Financeira Compartilhada - Meu Financeiro
 * 
 * Fórmulas 100% alinhadas com as regras de negócio do app nativo Android em produção.
 * Utiliza estritamente os campos reais do Firestore (/users/{userId}).
 */

/**
 * Gera um ID numérico inteiro compatível com o tipo Int (32-bit signed) do Kotlin no Android.
 * Evita colisões com os IDs sequenciais baixos (1, 2, 3...) já existentes.
 */
export function generateNumericId(): number {
  return Math.floor(Math.random() * 1_000_000_000) + 1_000_000;
}

/**
 * 1. Saldo de conta:
 * Saldo de conta = initial_balance + créditos (RECEITA, TRANSFERENCIA recebida) - débitos (DESPESA, TRANSFERENCIA enviada)
 */
export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[]
): number {
  const initialBalance = Number(account.initial_balance) || 0;

  const credits = transactions.reduce((acc, tx) => {
    // RECEITA creditada na conta
    if (tx.type === 'RECEITA' && tx.account_id === account.id) {
      return acc + (Number(tx.value) || 0);
    }
    // TRANSFERÊNCIA recebida (to_account_id)
    if (tx.type === 'TRANSFERENCIA' && tx.to_account_id === account.id) {
      return acc + (Number(tx.value) || 0);
    }
    return acc;
  }, 0);

  const debits = transactions.reduce((acc, tx) => {
    // DESPESA debitada da conta
    if (tx.type === 'DESPESA' && tx.account_id === account.id) {
      return acc + (Number(tx.value) || 0);
    }
    // TRANSFERÊNCIA enviada da conta (account_id)
    if (tx.type === 'TRANSFERENCIA' && tx.account_id === account.id) {
      return acc + (Number(tx.value) || 0);
    }
    return acc;
  }, 0);

  return initialBalance + credits - debits;
}

/**
 * Calcula o saldo total somado de todas as contas ativas (não arquivadas).
 */
export function calculateTotalAccountsBalance(
  accounts: Account[],
  transactions: Transaction[]
): number {
  return accounts.reduce((total, acc) => {
    if (acc.archived) return total;
    return total + calculateAccountBalance(acc, transactions);
  }, 0);
}

/**
 * Calcula o Alocado de uma BudgetAllocation específica através da soma de AllocationMovement:
 * Alocado = Σ(dest_budget_allocation_id === id) - Σ(source_budget_allocation_id === id)
 */
export function calculateBudgetAllocationAllocated(
  budgetAllocationId: number,
  allocationMovements: AllocationMovement[]
): number {
  return allocationMovements.reduce((sum, movement) => {
    let delta = 0;
    if (movement.dest_budget_allocation_id === budgetAllocationId) {
      delta += Number(movement.amount) || 0;
    }
    if (movement.source_budget_allocation_id === budgetAllocationId) {
      delta -= Number(movement.amount) || 0;
    }
    return sum + delta;
  }, 0);
}

/**
 * 2. Alocado de uma categoria (ou categoria + subcategoria) para um determinado mês:
 * O mês e a categoria vivem em BudgetAllocation.
 * Somam-se os movimentos onde dest_budget_allocation_id é o ID da BudgetAllocation
 * menos onde source_budget_allocation_id é essa mesma BudgetAllocation.
 */
export function calculateCategoryAllocated(
  categoryId: number,
  month: string, // YYYY-MM
  budgetAllocations: BudgetAllocation[],
  allocationMovements: AllocationMovement[],
  subcategoryId?: number | null
): number {
  // Filtra as alocações da categoria para o mês solicitado
  const matchingAllocations = budgetAllocations.filter((b) => {
    if (b.category_id !== categoryId || b.month !== month) return false;
    if (subcategoryId !== undefined && subcategoryId !== null) {
      return b.subcategory_id === subcategoryId;
    }
    return true;
  });

  return matchingAllocations.reduce((sum, b) => {
    return sum + calculateBudgetAllocationAllocated(b.id, allocationMovements);
  }, 0);
}

/**
 * 3. Gasto de uma categoria/mês:
 * Gasto de uma categoria/mês = soma de Transaction tipo DESPESA daquela categoria/subcategoria, no mês
 */
export function calculateCategorySpent(
  categoryId: number,
  month: string, // YYYY-MM
  transactions: Transaction[],
  subcategoryId?: number | null
): number {
  return transactions.reduce((sum, tx) => {
    if (tx.type !== 'DESPESA') return sum;

    // Normaliza data 'YYYY-MM-DD' para 'YYYY-MM'
    const txMonth = typeof tx.date === 'string' ? tx.date.substring(0, 7) : '';
    if (txMonth !== month) return sum;

    if (subcategoryId !== undefined && subcategoryId !== null) {
      if (tx.subcategory_id === subcategoryId) {
        return sum + (Number(tx.value) || 0);
      }
      return sum;
    }

    if (tx.category_id === categoryId) {
      return sum + (Number(tx.value) || 0);
    }

    return sum;
  }, 0);
}

/**
 * Calcula o Gasto correspondente a uma BudgetAllocation específica:
 * Considera o mês da alocação, a categoria e a subcategoria correspondente.
 */
export function calculateBudgetAllocationSpent(
  allocation: BudgetAllocation,
  transactions: Transaction[]
): number {
  return transactions.reduce((sum, tx) => {
    if (tx.type !== 'DESPESA') return sum;

    const txMonth = typeof tx.date === 'string' ? tx.date.substring(0, 7) : '';
    if (txMonth !== allocation.month) return sum;

    if (allocation.subcategory_id) {
      if (tx.subcategory_id === allocation.subcategory_id) {
        return sum + (Number(tx.value) || 0);
      }
      return sum;
    }

    // Alocação em nível de categoria (sem subcategoria específica)
    if (tx.category_id === allocation.category_id) {
      if (!tx.subcategory_id) {
        return sum + (Number(tx.value) || 0);
      }
    }

    return sum;
  }, 0);
}

/**
 * 4. Disponível:
 * Disponível = Alocado - Gasto
 */
export function calculateCategoryAvailable(
  allocated: number,
  spent: number
): number {
  return allocated - spent;
}

/**
 * 5. current_value de uma meta:
 * current_value de uma meta = soma de AllocationMovement onde dest_goal_id é a meta
 *                            - onde source_goal_id é a meta (nunca reseta)
 */
export function calculateGoalCurrentValue(
  goalId: number,
  allocationMovements: AllocationMovement[]
): number {
  return allocationMovements.reduce((sum, movement) => {
    let delta = 0;
    // Onde a meta é destino (+)
    if (movement.dest_goal_id === goalId) {
      delta += Number(movement.amount) || 0;
    }
    // Onde a meta é origem (-)
    if (movement.source_goal_id === goalId) {
      delta -= Number(movement.amount) || 0;
    }
    return sum + delta;
  }, 0);
}

/**
 * 6. Pronto para Atribuir:
 * Pronto para Atribuir = saldo total das contas 
 *                      - soma do Disponível de TODAS as alocações com month <= selectedMonth
 *                      - soma do current_value de todas as metas
 */
export function calculateReadyToAssign(
  selectedMonth: string, // formato 'YYYY-MM'
  accounts: Account[],
  budgetAllocations: BudgetAllocation[],
  transactions: Transaction[],
  allocationMovements: AllocationMovement[],
  goals: Goal[]
): ReadyToAssignCalculation {
  // 1. Saldo total de todas as contas ativas
  const totalAccountsBalance = calculateTotalAccountsBalance(accounts, transactions);

  // 2. Filtrar BudgetAllocation por month <= selectedMonth
  const relevantAllocations = budgetAllocations.filter((b) => b.month <= selectedMonth);

  // Soma do Disponível (Alocado - Gasto) de todas as alocações elegíveis
  let totalAvailableAccumulated = 0;
  for (const allocation of relevantAllocations) {
    const allocated = calculateBudgetAllocationAllocated(allocation.id, allocationMovements);
    const spent = calculateBudgetAllocationSpent(allocation, transactions);
    const available = calculateCategoryAvailable(allocated, spent);
    totalAvailableAccumulated += available;
  }

  // 3. Soma do current_value de todas as metas ativas
  const totalGoalsCurrentValue = goals.reduce((sum, goal) => {
    return sum + calculateGoalCurrentValue(goal.id, allocationMovements);
  }, 0);

  // 4. Pronto para Atribuir
  const readyToAssign = totalAccountsBalance - totalAvailableAccumulated - totalGoalsCurrentValue;

  return {
    month: selectedMonth,
    totalAccountsBalance,
    totalAvailableAccumulated,
    totalGoalsCurrentValue,
    readyToAssign,
  };
}

/**
 * Retorna os cálculos completos de uma categoria para um mês determinado,
 * incluindo o Planejado (planned_value em BudgetAllocation).
 */
export function getCategoryMonthCalculation(
  categoryId: number,
  month: string,
  budgetAllocations: BudgetAllocation[],
  allocationMovements: AllocationMovement[],
  transactions: Transaction[],
  subcategoryId?: number | null
): CategoryMonthCalculation {
  const matchingAllocations = budgetAllocations.filter((b) => {
    if (b.category_id !== categoryId || b.month !== month) return false;
    if (subcategoryId !== undefined && subcategoryId !== null) {
      return b.subcategory_id === subcategoryId;
    }
    return true;
  });

  const planned = matchingAllocations.reduce((sum, b) => sum + (Number(b.planned_value) || 0), 0);
  const allocated = calculateCategoryAllocated(categoryId, month, budgetAllocations, allocationMovements, subcategoryId);
  const spent = calculateCategorySpent(categoryId, month, transactions, subcategoryId);
  const available = calculateCategoryAvailable(allocated, spent);

  return {
    categoryId,
    subcategoryId,
    month,
    planned,
    allocated,
    spent,
    available,
  };
}

/**
 * Formatador monetário para Real Brasileiro (BRL)
 */
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Retorna classe de cor baseada no status financeiro:
 * - Verde se positivo
 * - Cinza neutro se zero
 * - Vermelho se negativo
 * Regra estrita: NUNCA usar azul/roxo para estado financeiro.
 */
export function getFinancialStatusColorClass(
  value: number,
  mode: 'light' | 'dark' = 'light'
): string {
  if (value > 0.001) {
    return mode === 'dark' ? 'text-[#39D47A]' : 'text-[#22A45D]';
  }
  if (value < -0.001) {
    return mode === 'dark' ? 'text-[#FF4D55]' : 'text-[#EF4444]';
  }
  return mode === 'dark' ? 'text-[#A9B1B1]' : 'text-[#6B7280]';
}
