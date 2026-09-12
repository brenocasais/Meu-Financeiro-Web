import {
  Account,
  Transaction,
  AllocationMovement,
  Goal,
  Category,
  CategoryMonthCalculation,
  ReadyToAssignCalculation,
} from '../types/finance';

/**
 * Camada de Lógica Financeira Compartilhada - Meu Financeiro
 * 
 * Fórmulas validadas e idênticas às regras de negócio em produção do app nativo Android.
 * Nenhuma fórmula foi alterada ou reinventada.
 */

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
    // RECEITA associada à conta
    if (tx.type === 'RECEITA' && tx.account_id === account.id) {
      return acc + (Number(tx.amount) || 0);
    }
    // TRANSFERÊNCIA recebida pela conta
    if (tx.type === 'TRANSFERENCIA' && tx.destination_account_id === account.id) {
      return acc + (Number(tx.amount) || 0);
    }
    return acc;
  }, 0);

  const debits = transactions.reduce((acc, tx) => {
    // DESPESA originada da conta
    if (tx.type === 'DESPESA' && tx.account_id === account.id) {
      return acc + (Number(tx.amount) || 0);
    }
    // TRANSFERÊNCIA enviada pela conta
    if (tx.type === 'TRANSFERENCIA' && tx.account_id === account.id) {
      return acc + (Number(tx.amount) || 0);
    }
    return acc;
  }, 0);

  return initialBalance + credits - debits;
}

/**
 * Calcula o saldo total somado de todas as contas cadastradas.
 */
export function calculateTotalAccountsBalance(
  accounts: Account[],
  transactions: Transaction[]
): number {
  return accounts.reduce((total, acc) => {
    if (acc.is_archived) return total;
    return total + calculateAccountBalance(acc, transactions);
  }, 0);
}

/**
 * 2. Alocado de uma categoria/mês:
 * Alocado de uma categoria/mês = soma de AllocationMovement onde é destino - onde é origem
 */
export function calculateCategoryAllocated(
  categoryId: string,
  month: string, // formato 'YYYY-MM'
  allocationMovements: AllocationMovement[]
): number {
  return allocationMovements.reduce((sum, movement) => {
    // Verifica se o movimento pertence ao mês especificado
    if (movement.month && movement.month !== month) {
      return sum;
    }

    let delta = 0;
    // Onde a categoria é o destino do movimento (+)
    if (movement.destination_id === categoryId) {
      delta += Number(movement.amount) || 0;
    }
    // Onde a categoria é a origem do movimento (-)
    if (movement.origin_id === categoryId) {
      delta -= Number(movement.amount) || 0;
    }

    return sum + delta;
  }, 0);
}

/**
 * 3. Gasto de uma categoria/mês:
 * Gasto de uma categoria/mês = soma de Transaction tipo DESPESA daquela categoria/subcategoria, no mês
 */
export function calculateCategorySpent(
  categoryId: string,
  month: string, // formato 'YYYY-MM'
  transactions: Transaction[],
  subcategoryId?: string | null
): number {
  return transactions.reduce((sum, tx) => {
    if (tx.type !== 'DESPESA') return sum;

    // Normaliza a data da transação para comparar com 'YYYY-MM'
    const txMonth = typeof tx.date === 'string' ? tx.date.substring(0, 7) : '';
    if (txMonth !== month) return sum;

    if (subcategoryId) {
      // Filtrando especificamente por subcategoria
      if (tx.subcategory_id === subcategoryId) {
        return sum + (Number(tx.amount) || 0);
      }
      return sum;
    }

    // Filtrando por categoria principal
    if (tx.category_id === categoryId) {
      return sum + (Number(tx.amount) || 0);
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
 * Retorna os cálculos completos de uma categoria para um mês determinado.
 */
export function getCategoryMonthCalculation(
  categoryId: string,
  month: string,
  allocationMovements: AllocationMovement[],
  transactions: Transaction[]
): CategoryMonthCalculation {
  const allocated = calculateCategoryAllocated(categoryId, month, allocationMovements);
  const spent = calculateCategorySpent(categoryId, month, transactions);
  const available = calculateCategoryAvailable(allocated, spent);

  return {
    categoryId,
    month,
    allocated,
    spent,
    available,
  };
}

/**
 * 6. current_value de uma meta:
 * current_value de uma meta = soma de AllocationMovement onde é destino - onde é origem (nunca reseta)
 */
export function calculateGoalCurrentValue(
  goalId: string,
  allocationMovements: AllocationMovement[]
): number {
  return allocationMovements.reduce((sum, movement) => {
    let delta = 0;
    // Onde a meta é destino (+)
    if (movement.destination_id === goalId) {
      delta += Number(movement.amount) || 0;
    }
    // Onde a meta é origem (-)
    if (movement.origin_id === goalId) {
      delta -= Number(movement.amount) || 0;
    }
    return sum + delta;
  }, 0);
}

/**
 * 5. Pronto para Atribuir:
 * Pronto para Atribuir = saldo total das contas 
 *                      - soma do Disponível de TODAS as alocações com mês <= mês selecionado (acumulado entre meses, nunca reseta sozinho quando o mês vira) 
 *                      - soma do current_value de todas as metas
 */
export function calculateReadyToAssign(
  selectedMonth: string, // formato 'YYYY-MM'
  accounts: Account[],
  categories: Category[],
  transactions: Transaction[],
  allocationMovements: AllocationMovement[],
  goals: Goal[]
): ReadyToAssignCalculation {
  // 1. Saldo total de todas as contas
  const totalAccountsBalance = calculateTotalAccountsBalance(accounts, transactions);

  // 2. Extrai todos os meses presentes nos movimentos e transações com mês <= selectedMonth
  const monthsSet = new Set<string>();
  monthsSet.add(selectedMonth);

  allocationMovements.forEach((mov) => {
    if (mov.month && mov.month <= selectedMonth) {
      monthsSet.add(mov.month);
    }
  });

  transactions.forEach((tx) => {
    if (tx.date) {
      const m = tx.date.substring(0, 7);
      if (m && m <= selectedMonth) {
        monthsSet.add(m);
      }
    }
  });

  const validMonths = Array.from(monthsSet).sort();

  // Soma do Disponível de TODAS as alocações de categorias para cada mês <= selectedMonth
  let totalAvailableAccumulated = 0;
  for (const m of validMonths) {
    for (const cat of categories) {
      const allocated = calculateCategoryAllocated(cat.id, m, allocationMovements);
      const spent = calculateCategorySpent(cat.id, m, transactions);
      const available = calculateCategoryAvailable(allocated, spent);
      totalAvailableAccumulated += available;
    }
  }

  // 3. Soma do current_value de todas as metas (nunca reseta)
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
 * Formatador monetário para Real Brasileiro (BRL)
 */
export function formatCurrencyBRL(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Retorna classe de cor baseada no status financeiro:
 * - Verde se positivo
 * - Cinza neutro se zero
 * - Vermelho se negativo
 * Regra estrita do design system: NUNCA usar azul/roxo para estado financeiro.
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
