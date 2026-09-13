import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { subscribeUserData } from '../firebase/firestore';
import {
  UserFirestoreData,
  Account,
  Category,
  Subcategory,
  Transaction,
  BudgetAllocation,
  AllocationMovement,
  Goal,
  InstallmentPlan,
  ReadyToAssignCalculation,
} from '../types/finance';
import {
  calculateReadyToAssign,
  calculateAccountBalance,
  calculateTotalAccountsBalance,
  calculateCategorySpent,
  calculateGoalCurrentValue,
} from '../lib/financeLogic';

export interface FinanceAlert {
  id: string;
  type: 'danger' | 'warning' | 'success';
  title: string;
  message: string;
  targetTab: 'planning' | 'goals';
  categoryId?: number;
  goalId?: number;
}

interface MonthSummary {
  income: number;
  expenses: number;
  goalsContribution: number;
  prevIncome: number;
  prevExpenses: number;
  prevGoalsContribution: number;
  incomeVariationPercent: number;
  expensesVariationPercent: number;
  goalsVariationPercent: number;
  monthDiff: number; // income - expenses
  plannedTotal: number;
  spentTotal: number;
  budgetUsedPercent: number;
  budgetRemaining: number;
}

interface FinanceContextType {
  data: UserFirestoreData;
  installmentPlans: InstallmentPlan[];
  loading: boolean;
  error: string | null;
  selectedMonth: string; // 'YYYY-MM'
  setSelectedMonth: (month: string) => void;
  // Valores calculados
  readyToAssignCalc: ReadyToAssignCalculation;
  monthSummary: MonthSummary;
  alerts: FinanceAlert[];
  // Preferências visuais da Dashboard
  hideValues: boolean;
  toggleHideValues: () => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

function getCurrentMonthString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getPreviousMonthString(monthStr: string): string {
  const [yearStr, mStr] = monthStr.split('-');
  let y = parseInt(yearStr, 10);
  let m = parseInt(mStr, 10) - 1;
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

function calculatePercentVariation(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [data, setData] = useState<UserFirestoreData>({
    accounts: [],
    categories: [],
    subcategories: [],
    transactions: [],
    budget_allocations: [],
    allocation_movements: [],
    goals: [],
    installment_plans: [],
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthString());
  const [hideValues, setHideValues] = useState<boolean>(() => {
    return localStorage.getItem('mf_hide_values') === 'true';
  });

  const toggleHideValues = () => {
    setHideValues((prev) => {
      const next = !prev;
      localStorage.setItem('mf_hide_values', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!user) {
      setData({
        accounts: [],
        categories: [],
        subcategories: [],
        transactions: [],
        budget_allocations: [],
        allocation_movements: [],
        goals: [],
        installment_plans: [],
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeUserData(
      user.uid,
      (userData) => {
        setData(userData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[FinanceContext] Erro ao sincronizar dados:', err);
        setError('Não foi possível carregar os dados financeiros.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Cálculo de Pronto para Atribuir
  const readyToAssignCalc = useMemo(() => {
    return calculateReadyToAssign(
      selectedMonth,
      data.accounts,
      data.budget_allocations,
      data.transactions,
      data.allocation_movements,
      data.goals
    );
  }, [selectedMonth, data]);

  // Cálculo de Resumo do Mês
  const monthSummary = useMemo<MonthSummary>(() => {
    const prevMonth = getPreviousMonthString(selectedMonth);

    // Receitas do mês
    const income = data.transactions.reduce((acc, tx) => {
      if (tx.type === 'RECEITA' && String(tx.date || '').startsWith(selectedMonth)) {
        return acc + (Number(tx.value) || 0);
      }
      return acc;
    }, 0);

    // Despesas do mês
    const expenses = data.transactions.reduce((acc, tx) => {
      if (tx.type === 'DESPESA' && String(tx.date || '').startsWith(selectedMonth)) {
        return acc + (Number(tx.value) || 0);
      }
      return acc;
    }, 0);

    // Metas: aportes líquidos em metas no mês (dest_goal_id - source_goal_id)
    // Usando moved_at para verificar o timestamp do mês se disponível, ou movimentos com dest_goal_id
    // No Android, a coluna Metas no resumo do mês reflete o aporte feito no mês
    const goalsContribution = data.allocation_movements.reduce((acc, mov) => {
      if (!mov.moved_at) return acc;
      const movDate = new Date(mov.moved_at);
      const movMonth = `${movDate.getFullYear()}-${String(movDate.getMonth() + 1).padStart(2, '0')}`;
      if (movMonth === selectedMonth) {
        if (mov.dest_goal_id) acc += Number(mov.amount) || 0;
        if (mov.source_goal_id) acc -= Number(mov.amount) || 0;
      }
      return acc;
    }, 0);

    // Mês anterior
    const prevIncome = data.transactions.reduce((acc, tx) => {
      if (tx.type === 'RECEITA' && String(tx.date || '').startsWith(prevMonth)) {
        return acc + (Number(tx.value) || 0);
      }
      return acc;
    }, 0);

    const prevExpenses = data.transactions.reduce((acc, tx) => {
      if (tx.type === 'DESPESA' && String(tx.date || '').startsWith(prevMonth)) {
        return acc + (Number(tx.value) || 0);
      }
      return acc;
    }, 0);

    const prevGoalsContribution = data.allocation_movements.reduce((acc, mov) => {
      if (!mov.moved_at) return acc;
      const movDate = new Date(mov.moved_at);
      const movMonth = `${movDate.getFullYear()}-${String(movDate.getMonth() + 1).padStart(2, '0')}`;
      if (movMonth === prevMonth) {
        if (mov.dest_goal_id) acc += Number(mov.amount) || 0;
        if (mov.source_goal_id) acc -= Number(mov.amount) || 0;
      }
      return acc;
    }, 0);

    const incomeVariationPercent = calculatePercentVariation(income, prevIncome);
    const expensesVariationPercent = calculatePercentVariation(expenses, prevExpenses);
    const goalsVariationPercent = calculatePercentVariation(goalsContribution, prevGoalsContribution);

    // Total Planejado do mês (soma de planned_value das BudgetAllocation no mês)
    const plannedTotal = data.budget_allocations
      .filter((b) => b.month === selectedMonth)
      .reduce((acc, b) => acc + (Number(b.planned_value) || 0), 0);

    const spentTotal = expenses;

    // Base mínima de 1 para evitar divisão por zero
    const safePlanned = Math.max(plannedTotal, 1);
    const budgetUsedPercent = Math.min(Math.round((spentTotal / safePlanned) * 100), 999);
    const budgetRemaining = Math.max(plannedTotal - spentTotal, 0);

    return {
      income,
      expenses,
      goalsContribution,
      prevIncome,
      prevExpenses,
      prevGoalsContribution,
      incomeVariationPercent,
      expensesVariationPercent,
      goalsVariationPercent,
      monthDiff: income - expenses,
      plannedTotal,
      spentTotal,
      budgetUsedPercent,
      budgetRemaining,
    };
  }, [selectedMonth, data]);

  // 5. Cálculo dos Alertas ("Atenção necessária")
  // - Por categoria: se Planejado > 0 E Gasto > Planejado → vermelho "Ultrapassou o limite em R$X"
  //   se Gasto >= 80% do Planejado (mas não passou) → amarelo "Restam R$X do limite"
  // - Por meta: se current_value >= target_value → sucesso "Meta de R$X atingida!"
  // - Máximo de 4 alertas
  const alerts = useMemo<FinanceAlert[]>(() => {
    const list: FinanceAlert[] = [];

    // Alertas por categoria no mês selecionado
    data.categories.forEach((cat) => {
      if (cat.archived) return;

      // Soma de planned_value das BudgetAllocation da categoria no mês
      const categoryPlanned = data.budget_allocations
        .filter((b) => b.category_id === cat.id && b.month === selectedMonth)
        .reduce((sum, b) => sum + (Number(b.planned_value) || 0), 0);

      if (categoryPlanned <= 0) return;

      const categorySpent = calculateCategorySpent(cat.id, selectedMonth, data.transactions);

      if (categorySpent > categoryPlanned) {
        const excess = categorySpent - categoryPlanned;
        list.push({
          id: `alert-cat-over-${cat.id}`,
          type: 'danger',
          title: cat.name,
          message: `Ultrapassou o limite em R$ ${excess.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          targetTab: 'planning',
          categoryId: cat.id,
        });
      } else if (categorySpent >= 0.8 * categoryPlanned) {
        const remaining = categoryPlanned - categorySpent;
        list.push({
          id: `alert-cat-warn-${cat.id}`,
          type: 'warning',
          title: cat.name,
          message: `Restam R$ ${remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} do limite`,
          targetTab: 'planning',
          categoryId: cat.id,
        });
      }
    });

    // Alertas por meta (current_value >= target_value)
    data.goals.forEach((goal) => {
      if (goal.archived || goal.is_paused) return;
      const curVal = calculateGoalCurrentValue(goal.id, data.allocation_movements);
      if (curVal >= goal.target_value && goal.target_value > 0) {
        list.push({
          id: `alert-goal-reached-${goal.id}`,
          type: 'success',
          title: goal.name,
          message: `Meta de R$ ${goal.target_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} atingida!`,
          targetTab: 'goals',
          goalId: goal.id,
        });
      }
    });

    // Limitar a no máximo 4 alertas exibidos
    return list.slice(0, 4);
  }, [selectedMonth, data]);

  return (
    <FinanceContext.Provider
      value={{
        data,
        installmentPlans: data.installment_plans,
        loading,
        error,
        selectedMonth,
        setSelectedMonth,
        readyToAssignCalc,
        monthSummary,
        alerts,
        hideValues,
        toggleHideValues,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export function useFinance(): FinanceContextType {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
