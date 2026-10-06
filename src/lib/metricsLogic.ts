import {
  Transaction,
  Category,
  Subcategory,
  Account,
  Goal,
  BudgetAllocation,
  AllocationMovement,
} from '../types/finance';
import { monthFromTimestamp } from './financeLogic';

export type PeriodType = 'MES' | 'TRIMESTRE' | 'ANO' | 'PERSONALIZADO';

export interface DateRange {
  startMonth: string; // "YYYY-MM"
  endMonth: string; // "YYYY-MM"
}

export interface PeriodSummary {
  receitas: number;
  despesas: number;
  saldoLiquido: number;
  economiaPercent: number | null; // null se receitas == 0
  receitasVarPercent: number | null; // null se prevReceitas == 0
  despesasVarPercent: number | null; // null se prevDespesas == 0
}

export interface CategoryExpenseItem {
  categoryId: number;
  name: string;
  color: string;
  total: number;
  average: number;
  percent: number;
}

export interface CategoryComparisonItem {
  categoryId: number;
  name: string;
  shortName: string;
  currentValue: number;
  previousValue: number;
}

export interface MonthlyBarItem {
  month: string;
  label: string;
  receita: number;
  despesa: number;
}

export interface WeeklyExpenseItem {
  year: number;
  weekNumber: number;
  label: string;
  amount: number;
}

export interface TopExpenseItem {
  id: number;
  description: string;
  date: string;
  formattedDate: string;
  value: number;
  categoryHierarchy: string;
}

export interface NetWorthMonthItem {
  month: string;
  label: string;
  netWorth: number;
}

export interface NetWorthEvolutionResult {
  series: NetWorthMonthItem[];
  currentValue: number;
  startValue: number;
  variationValue: number;
  variationPercent: number | null;
}

export interface PlannedVsAllocatedMonthItem {
  month: string;
  label: string;
  planejado: number;
  alocado: number;
}

export interface GoalTimelineSeriesItem {
  goalId: number;
  goalName: string;
  colorHex: string;
  targetValue: number;
  currentBalance: number;
  progressPercent: number;
  dataPoints: { month: string; label: string; saldo: number }[];
}

// Paleta de 8 cores decorativas para as fatias de gastos por categoria
export const CATEGORY_PALETTE = [
  '#2196F3',
  '#E91E63',
  '#4CAF50',
  '#FF9800',
  '#9C27B0',
  '#00BCD4',
  '#FFEB3B',
  '#795548',
];

const MONTH_NAMES_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const MONTH_NAMES_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/**
 * Desloca um mês "YYYY-MM" por N meses (+ ou -)
 */
export function shiftMonth(monthStr: string, delta: number): string {
  if (!monthStr || !monthStr.includes('-')) {
    const now = new Date();
    monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const [yStr, mStr] = monthStr.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) - 1 + delta;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * Retorna array inclusivo de meses entre start e end
 */
export function getMonthsInRange(start: string, end: string): string[] {
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  const list: string[] = [];
  let curr = start;
  while (curr <= end) {
    list.push(curr);
    curr = shiftMonth(curr, 1);
  }
  return list;
}

/**
 * Retorna o período selecionado de acordo com o chip
 */
export function getCurrentPeriod(
  type: PeriodType,
  selectedMonth: string,
  customStart?: string,
  customEnd?: string
): DateRange {
  if (type === 'MES') {
    return { startMonth: selectedMonth, endMonth: selectedMonth };
  }
  if (type === 'TRIMESTRE') {
    return { startMonth: shiftMonth(selectedMonth, -2), endMonth: selectedMonth };
  }
  if (type === 'ANO') {
    return { startMonth: shiftMonth(selectedMonth, -11), endMonth: selectedMonth };
  }
  // Personalizado
  const s = customStart || shiftMonth(selectedMonth, -3);
  const e = customEnd || selectedMonth;
  if (s > e) {
    return { startMonth: e, endMonth: s };
  }
  return { startMonth: s, endMonth: e };
}

/**
 * Retorna o período anterior equivalente para comparações
 */
export function getPreviousPeriod(
  type: PeriodType,
  selectedMonth: string,
  customStart?: string,
  customEnd?: string
): DateRange {
  if (type === 'MES') {
    const prev = shiftMonth(selectedMonth, -1);
    return { startMonth: prev, endMonth: prev };
  }
  if (type === 'TRIMESTRE') {
    const fim = shiftMonth(selectedMonth, -3);
    const inicio = shiftMonth(fim, -2);
    return { startMonth: inicio, endMonth: fim };
  }
  if (type === 'ANO') {
    const fim = shiftMonth(selectedMonth, -12);
    const inicio = shiftMonth(fim, -11);
    return { startMonth: inicio, endMonth: fim };
  }
  // Personalizado: com n = meses do período, fim = inicio - 1 e inicio = fim - (n - 1)
  const current = getCurrentPeriod('PERSONALIZADO', selectedMonth, customStart, customEnd);
  const n = getMonthsInRange(current.startMonth, current.endMonth).length;
  const fim = shiftMonth(current.startMonth, -1);
  const inicio = shiftMonth(fim, -(n - 1));
  return { startMonth: inicio, endMonth: fim };
}

/**
 * Formata o texto do cabeçalho de período:
 * no modo Mês: "Agosto 2026"
 * nos demais: "Agosto/2026 - Outubro/2026"
 */
export function formatPeriodHeader(
  type: PeriodType,
  startMonth: string,
  endMonth: string
): string {
  const formatSingle = (m: string) => {
    const [y, mStr] = m.split('-');
    const idx = parseInt(mStr, 10) - 1;
    return `${MONTH_NAMES_FULL[idx] || mStr} ${y}`;
  };

  const formatWithSlash = (m: string) => {
    const [y, mStr] = m.split('-');
    const idx = parseInt(mStr, 10) - 1;
    return `${MONTH_NAMES_FULL[idx] || mStr}/${y}`;
  };

  if (type === 'MES' || startMonth === endMonth) {
    return formatSingle(endMonth);
  }

  return `${formatWithSlash(startMonth)} - ${formatWithSlash(endMonth)}`;
}

/**
 * Formata rótulo curto de mês: "Mmm/aa" (ex: "Out/26")
 */
export function formatShortMonthYear(mStr: string): string {
  const [y, m] = mStr.split('-');
  const idx = parseInt(m, 10) - 1;
  const monthLabel = MONTH_NAMES_SHORT[idx] || m;
  const shortYear = y.slice(2);
  return `${monthLabel}/${shortYear}`;
}

/**
 * Filtra transações cuja date.slice(0, 7) está dentro do intervalo inclusive
 */
export function filterTransactionsByRange(
  transactions: Transaction[],
  range: DateRange
): Transaction[] {
  return transactions.filter((t) => {
    if (!t.date || typeof t.date !== 'string' || t.date.length < 7) return false;
    const m = t.date.slice(0, 7);
    return m >= range.startMonth && m <= range.endMonth;
  });
}

/**
 * 2. "Resumo do Período":
 * Quatro indicadores: Receitas, Despesas, Saldo Líquido, Economia %
 * com comparações percentuais vs período anterior.
 */
export function calculatePeriodSummary(
  transactions: Transaction[],
  currentRange: DateRange,
  previousRange: DateRange
): PeriodSummary {
  const currentTxs = filterTransactionsByRange(transactions, currentRange);
  const prevTxs = filterTransactionsByRange(transactions, previousRange);

  let receitas = 0;
  let despesas = 0;
  currentTxs.forEach((t) => {
    const val = Number(t.value) || 0;
    if (t.type === 'RECEITA') receitas += val;
    if (t.type === 'DESPESA') despesas += val;
  });

  let prevReceitas = 0;
  let prevDespesas = 0;
  prevTxs.forEach((t) => {
    const val = Number(t.value) || 0;
    if (t.type === 'RECEITA') prevReceitas += val;
    if (t.type === 'DESPESA') prevDespesas += val;
  });

  const saldoLiquido = receitas - despesas;
  const economiaPercent = receitas > 0 ? (saldoLiquido / receitas) * 100 : null;

  const receitasVarPercent =
    prevReceitas > 0 ? Math.trunc(((receitas - prevReceitas) / prevReceitas) * 100) : null;
  const despesasVarPercent =
    prevDespesas > 0 ? Math.trunc(((despesas - prevDespesas) / prevDespesas) * 100) : null;

  return {
    receitas,
    despesas,
    saldoLiquido,
    economiaPercent,
    receitasVarPercent,
    despesasVarPercent,
  };
}

/**
 * 3 & 4. "Gastos por Categoria" e "Média Mensal por Categoria":
 * Total por categoria das DESPESAS com category_id != null, total > 0, ordenado decrescente.
 */
export function calculateCategoryExpenses(
  transactions: Transaction[],
  categories: Category[],
  currentRange: DateRange,
  numMonths: number
): {
  items: CategoryExpenseItem[];
  totalPeriod: number;
  totalAverage: number;
} {
  const currentTxs = filterTransactionsByRange(transactions, currentRange);
  const catMap = new Map<number, string>();
  categories.forEach((c) => catMap.set(Number(c.id), c.name));

  const totalByCat = new Map<number, number>();
  let totalPeriod = 0;

  currentTxs.forEach((t) => {
    if (t.type !== 'DESPESA' || t.category_id == null) return;
    const catId = Number(t.category_id);
    const val = Number(t.value) || 0;
    totalByCat.set(catId, (totalByCat.get(catId) || 0) + val);
    totalPeriod += val;
  });

  const safeMonths = Math.max(1, numMonths);
  const sortedEntries = Array.from(totalByCat.entries())
    .filter(([_, val]) => val > 0)
    .sort((a, b) => b[1] - a[1]);

  const items: CategoryExpenseItem[] = sortedEntries.map(([catId, total], index) => {
    const name = catMap.get(catId) || `Categoria ${catId}`;
    const color = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
    const average = total / safeMonths;
    const percent = totalPeriod > 0 ? (total / totalPeriod) * 100 : 0;
    return {
      categoryId: catId,
      name,
      color,
      total,
      average,
      percent,
    };
  });

  const totalAverage = totalPeriod / safeMonths;

  return { items, totalPeriod, totalAverage };
}

/**
 * 5. "Comparativo entre Períodos por Categoria":
 * Barras agrupadas das 5 maiores categorias do período ATUAL.
 * Cada uma com valor atual e do período anterior.
 */
export function calculateCategoryComparison(
  transactions: Transaction[],
  categories: Category[],
  currentRange: DateRange,
  previousRange: DateRange
): CategoryComparisonItem[] {
  const currentExp = calculateCategoryExpenses(transactions, categories, currentRange, 1);
  const top5 = currentExp.items.slice(0, 5);
  if (top5.length === 0) return [];

  const prevTxs = filterTransactionsByRange(transactions, previousRange);
  const prevByCat = new Map<number, number>();

  prevTxs.forEach((t) => {
    if (t.type !== 'DESPESA' || t.category_id == null) return;
    const catId = Number(t.category_id);
    const val = Number(t.value) || 0;
    prevByCat.set(catId, (prevByCat.get(catId) || 0) + val);
  });

  return top5.map((item) => {
    const prevVal = prevByCat.get(item.categoryId) || 0;
    const shortName =
      item.name.length > 8 ? `${item.name.slice(0, 7)}…` : item.name;
    return {
      categoryId: item.categoryId,
      name: item.name,
      shortName,
      currentValue: item.total,
      previousValue: prevVal,
    };
  });
}

/**
 * 6. "Entradas vs Saídas Mensais (12 meses)":
 * Os 12 meses terminando em M.
 */
export function calculate12MonthsIncomeVsExpense(
  transactions: Transaction[],
  endMonth: string
): MonthlyBarItem[] {
  const startMonth = shiftMonth(endMonth, -11);
  const months = getMonthsInRange(startMonth, endMonth);

  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  transactions.forEach((t) => {
    if (!t.date || t.date.length < 7) return;
    const m = t.date.slice(0, 7);
    if (m >= startMonth && m <= endMonth) {
      const val = Number(t.value) || 0;
      if (t.type === 'RECEITA') {
        incomeMap.set(m, (incomeMap.get(m) || 0) + val);
      } else if (t.type === 'DESPESA') {
        expenseMap.set(m, (expenseMap.get(m) || 0) + val);
      }
    }
  });

  return months.map((m) => ({
    month: m,
    label: formatShortMonthYear(m),
    receita: incomeMap.get(m) || 0,
    despesa: expenseMap.get(m) || 0,
  }));
}

/**
 * Calcula a semana do ano começando no domingo, com a semana 1 contendo 1º de janeiro.
 */
export function getSundayWeekOfYear(dateStr: string): { year: number; weekNumber: number } {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const targetDate = new Date(y, m, d);

  const jan1 = new Date(y, 0, 1);
  const jan1DayOfWeek = jan1.getDay(); // 0 = Dom, 1 = Seg...

  const startOfFirstWeek = new Date(y, 0, 1 - jan1DayOfWeek);
  const diffTime = targetDate.getTime() - startOfFirstWeek.getTime();
  const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));

  const weekNumber = Math.floor(diffDays / 7) + 1;
  return { year: y, weekNumber };
}

/**
 * 7. "Análise Semanal (Gasto Total)":
 * Despesas do período agrupadas por semana domingo-a-sábado.
 */
export function calculateWeeklyExpenses(
  transactions: Transaction[],
  currentRange: DateRange
): WeeklyExpenseItem[] {
  const currentTxs = filterTransactionsByRange(transactions, currentRange);
  const expenseTxs = currentTxs.filter((t) => t.type === 'DESPESA');

  const startYear = parseInt(currentRange.startMonth.slice(0, 4), 10);
  const endYear = parseInt(currentRange.endMonth.slice(0, 4), 10);
  const coversMultipleYears = startYear !== endYear;

  const weeklyMap = new Map<string, { year: number; weekNumber: number; amount: number }>();

  expenseTxs.forEach((t) => {
    if (!t.date) return;
    const { year, weekNumber } = getSundayWeekOfYear(t.date);
    const key = `${year}-${String(weekNumber).padStart(2, '0')}`;
    const prev = weeklyMap.get(key) || { year, weekNumber, amount: 0 };
    prev.amount += Number(t.value) || 0;
    weeklyMap.set(key, prev);
  });

  const sortedKeys = Array.from(weeklyMap.keys()).sort();

  return sortedKeys.map((key) => {
    const entry = weeklyMap.get(key)!;
    const label = coversMultipleYears
      ? `Semana ${entry.weekNumber}/${String(entry.year).slice(2)}`
      : `Semana ${entry.weekNumber}`;
    return {
      year: entry.year,
      weekNumber: entry.weekNumber,
      label,
      amount: entry.amount,
    };
  });
}

/**
 * 8. "Maiores Despesas do Período":
 * As 5 maiores DESPESAS do período por valor.
 */
export function calculateTopExpenses(
  transactions: Transaction[],
  categories: Category[],
  subcategories: Subcategory[],
  currentRange: DateRange,
  limit: number = 5
): TopExpenseItem[] {
  const currentTxs = filterTransactionsByRange(transactions, currentRange);
  const expenses = currentTxs.filter((t) => t.type === 'DESPESA');

  expenses.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));

  const catMap = new Map<number, string>();
  categories.forEach((c) => catMap.set(Number(c.id), c.name));

  const subMap = new Map<number, string>();
  subcategories.forEach((s) => subMap.set(Number(s.id), s.name));

  return expenses.slice(0, limit).map((t) => {
    const catName = t.category_id != null ? catMap.get(Number(t.category_id)) : null;
    const subName = t.subcategory_id != null ? subMap.get(Number(t.subcategory_id)) : null;

    let categoryHierarchy = 'Sem Categoria';
    if (catName) {
      categoryHierarchy = subName ? `${catName} › ${subName}` : catName;
    }

    let formattedDate = t.date || '';
    if (t.date && t.date.length >= 10) {
      const [y, m, d] = t.date.split('-');
      formattedDate = `${d}/${m}/${y}`;
    }

    return {
      id: Number(t.id),
      description: t.description || 'Despesa',
      date: t.date || '',
      formattedDate,
      value: Number(t.value) || 0,
      categoryHierarchy,
    };
  });
}

/**
 * 9. "Evolução do Patrimônio Líquido":
 * Saldo cumulativo de todas as contas para os 6 meses terminando em M.
 * Valor(m) = initial_balance de TODAS as contas + receitas(<= m) - despesas(<= m).
 */
export function calculateNetWorthEvolution(
  accounts: Account[],
  transactions: Transaction[],
  endMonth: string,
  numMonths: number = 6
): NetWorthEvolutionResult {
  const startMonth = shiftMonth(endMonth, -(numMonths - 1));
  const months = getMonthsInRange(startMonth, endMonth);

  const initialBalanceSum = accounts.reduce(
    (sum, a) => sum + (Number(a.initial_balance) || 0),
    0
  );

  const series: NetWorthMonthItem[] = months.map((m) => {
    let incomeSum = 0;
    let expenseSum = 0;

    transactions.forEach((t) => {
      if (!t.date || t.date.length < 7) return;
      const txMonth = t.date.slice(0, 7);
      if (txMonth <= m) {
        const val = Number(t.value) || 0;
        if (t.type === 'RECEITA') incomeSum += val;
        if (t.type === 'DESPESA') expenseSum += val;
      }
    });

    const netWorth = initialBalanceSum + incomeSum - expenseSum;
    return {
      month: m,
      label: formatShortMonthYear(m),
      netWorth,
    };
  });

  const startValue = series.length > 0 ? series[0].netWorth : 0;
  const currentValue = series.length > 0 ? series[series.length - 1].netWorth : 0;
  const variationValue = currentValue - startValue;
  const variationPercent =
    startValue !== 0 ? Math.trunc((variationValue / Math.abs(startValue)) * 100) : null;

  return {
    series,
    currentValue,
    startValue,
    variationValue,
    variationPercent,
  };
}

/**
 * 10. "Planejado vs Alocado Mensal por Categoria":
 * 6 meses terminando em M.
 * Planejado = soma de planned_value das BudgetAllocation da categoria no mês m.
 * Alocado = soma dos AllocationMovement (+amount quando dest da categoria em m, -amount quando source em m).
 */
export function calculatePlannedVsAllocated(
  categoryId: number,
  budgetAllocations: BudgetAllocation[],
  allocationMovements: AllocationMovement[],
  endMonth: string,
  numMonths: number = 6
): {
  series: PlannedVsAllocatedMonthItem[];
  hasData: boolean;
} {
  const startMonth = shiftMonth(endMonth, -(numMonths - 1));
  const months = getMonthsInRange(startMonth, endMonth);

  // Mapa de BudgetAllocations por ID para lookup rápido
  const allocById = new Map<number, BudgetAllocation>();
  budgetAllocations.forEach((b) => allocById.set(Number(b.id), b));

  let totalPlanejadoGeral = 0;
  let totalAlocadoGeral = 0;

  const series: PlannedVsAllocatedMonthItem[] = months.map((m) => {
    // 1. Planejado no mês m para esta categoria (todas as subcategorias)
    let planejado = 0;
    budgetAllocations.forEach((b) => {
      if (Number(b.category_id) === Number(categoryId) && b.month === m) {
        planejado += Number(b.planned_value) || 0;
      }
    });

    // 2. Alocado no mês m para esta categoria
    let alocado = 0;
    allocationMovements.forEach((mov) => {
      const amount = Number(mov.amount) || 0;
      if (mov.dest_budget_allocation_id != null) {
        const dstAlloc = allocById.get(Number(mov.dest_budget_allocation_id));
        if (dstAlloc && Number(dstAlloc.category_id) === Number(categoryId) && dstAlloc.month === m) {
          alocado += amount;
        }
      }
      if (mov.source_budget_allocation_id != null) {
        const srcAlloc = allocById.get(Number(mov.source_budget_allocation_id));
        if (srcAlloc && Number(srcAlloc.category_id) === Number(categoryId) && srcAlloc.month === m) {
          alocado -= amount;
        }
      }
    });

    totalPlanejadoGeral += planejado;
    totalAlocadoGeral += Math.abs(alocado);

    return {
      month: m,
      label: formatShortMonthYear(m),
      planejado,
      alocado,
    };
  });

  const hasData = totalPlanejadoGeral > 0 || totalAlocadoGeral > 0;

  return { series, hasData };
}

/**
 * Converte inteiro ARGB com sinal (formato Android, ex.: -13840847) para CSS HEX
 */
export function goalColorArgbToHex(argb?: number): string {
  if (argb == null || isNaN(argb)) return '#22A45D';
  const u = argb >>> 0;
  const r = (u >>> 16) & 0xff;
  const g = (u >>> 8) & 0xff;
  const b = u & 0xff;
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * 11. "Progresso das Metas na Linha do Tempo":
 * 6 meses terminando em M.
 * Saldo da meta em m = soma dos movimentos com dest_goal_id = meta menos source_goal_id = meta,
 * contando só os cujo mês de moved_at (local) seja <= m.
 */
export function calculateGoalsProgressTimeline(
  goals: Goal[],
  allocationMovements: AllocationMovement[],
  endMonth: string,
  numMonths: number = 6
): {
  seriesList: GoalTimelineSeriesItem[];
  monthsList: string[];
} {
  const startMonth = shiftMonth(endMonth, -(numMonths - 1));
  const months = getMonthsInRange(startMonth, endMonth);

  const seriesList: GoalTimelineSeriesItem[] = goals.map((goal) => {
    const goalId = Number(goal.id);
    const colorHex = goalColorArgbToHex(goal.color);
    const targetValue = Number(goal.target_value) || 0;

    const dataPoints = months.map((m) => {
      let saldo = 0;
      allocationMovements.forEach((mov) => {
        const moveMonth = monthFromTimestamp(Number(mov.moved_at) || 0);
        if (moveMonth <= m) {
          const amt = Number(mov.amount) || 0;
          if (Number(mov.dest_goal_id) === goalId) saldo += amt;
          if (Number(mov.source_goal_id) === goalId) saldo -= amt;
        }
      });
      return {
        month: m,
        label: formatShortMonthYear(m),
        saldo,
      };
    });

    const currentBalance = dataPoints[dataPoints.length - 1]?.saldo || 0;
    const progressPercent =
      targetValue > 0 ? Math.trunc((currentBalance / targetValue) * 100) : 0;

    return {
      goalId,
      goalName: goal.name,
      colorHex,
      targetValue,
      currentBalance,
      progressPercent,
      dataPoints,
    };
  });

  return { seriesList, monthsList: months };
}
