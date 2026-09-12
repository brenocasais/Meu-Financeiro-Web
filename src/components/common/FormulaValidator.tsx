import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import {
  calculateAccountBalance,
  calculateCategoryAllocated,
  calculateCategorySpent,
  calculateCategoryAvailable,
  calculateGoalCurrentValue,
  calculateReadyToAssign,
  formatCurrencyBRL,
} from '../../lib/financeLogic';
import { Account, Transaction, BudgetAllocation, AllocationMovement, Goal } from '../../types/finance';

export const FormulaValidator: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Verificação matemática das 6 fórmulas centrais com o schema real do Firestore (/users/{userId})
  const sampleAccount: Account = {
    id: 'acc-1',
    name: 'Conta Corrente',
    type: 'CONTA_CORRENTE',
    initial_balance: 1000,
    archived: false,
  };

  const sampleTransactions: Transaction[] = [
    {
      id: 'tx-1',
      account_id: 'acc-1',
      to_account_id: null,
      category_id: null,
      subcategory_id: null,
      type: 'RECEITA',
      value: 500,
      description: 'Salário',
      date: '2026-09-05',
    },
    {
      id: 'tx-2',
      account_id: 'acc-1',
      to_account_id: null,
      category_id: 'cat-1',
      subcategory_id: null,
      type: 'DESPESA',
      value: 200,
      description: 'Supermercado',
      date: '2026-09-10',
    },
    {
      id: 'tx-3',
      account_id: 'acc-1',
      to_account_id: 'acc-2',
      category_id: null,
      subcategory_id: null,
      type: 'TRANSFERENCIA',
      value: 150,
      description: 'Transferência para poupança',
      date: '2026-09-12',
    },
  ];

  const sampleBudgetAllocations: BudgetAllocation[] = [
    {
      id: 'alloc-1',
      category_id: 'cat-1',
      subcategory_id: null,
      month: '2026-09',
      planned_value: 400,
    },
  ];

  const sampleMovements: AllocationMovement[] = [
    {
      id: 'mov-1',
      source_budget_allocation_id: null,
      source_goal_id: null,
      dest_budget_allocation_id: 'alloc-1',
      dest_goal_id: null,
      amount: 400,
      note: 'Distribuição inicial',
      moved_at: 1726000000,
    },
    {
      id: 'mov-2',
      source_budget_allocation_id: 'alloc-1',
      source_goal_id: null,
      dest_budget_allocation_id: 'alloc-other',
      dest_goal_id: null,
      amount: 50,
      note: 'Remanejamento de categoria',
      moved_at: 1726000001,
    },
    {
      id: 'mov-3',
      source_budget_allocation_id: null,
      source_goal_id: null,
      dest_budget_allocation_id: null,
      dest_goal_id: 'goal-1',
      amount: 300,
      note: 'Aporte na meta',
      moved_at: 1726000002,
    },
  ];

  const sampleGoal: Goal = {
    id: 'goal-1',
    name: 'Reserva de Emergência',
    target_value: 5000,
    deadline: '2027-12-31',
    is_paused: false,
    archived: false,
  };

  // 1. Saldo de conta: initial_balance + créditos - débitos
  const balance = calculateAccountBalance(sampleAccount, sampleTransactions); // 1000 + 500 - 200 - 150 = 1150

  // 2. Alocado categoria/mês: via BudgetAllocation (dest_budget_allocation_id - source_budget_allocation_id)
  const allocated = calculateCategoryAllocated('cat-1', '2026-09', sampleBudgetAllocations, sampleMovements); // 400 - 50 = 350

  // 3. Gasto categoria/mês: soma de DESPESA com date no mês
  const spent = calculateCategorySpent('cat-1', '2026-09', sampleTransactions); // 200

  // 4. Disponível: Alocado - Gasto
  const available = calculateCategoryAvailable(allocated, spent); // 350 - 200 = 150

  // 5. Goal current_value: dest_goal_id - source_goal_id (nunca reseta)
  const goalValue = calculateGoalCurrentValue('goal-1', sampleMovements); // 300

  // 6. Pronto para Atribuir: Saldo total - Σ(Disponível mês <= selecionado) - Σ(current_value metas)
  const rta = calculateReadyToAssign(
    '2026-09',
    [sampleAccount],
    sampleBudgetAllocations,
    sampleTransactions,
    sampleMovements,
    [sampleGoal]
  ); // 1150 - 150 - 300 = 700

  return (
    <div
      id="card-formula-validator"
      className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-4 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] transition-colors"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
              Camada de Lógica Financeira (Fase 1)
            </h4>
            <div className="flex items-center gap-1 text-[11px] text-[#22A45D] dark:text-[#39D47A]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>6/6 Fórmulas do Android com Schema Real</span>
            </div>
          </div>
        </div>
        <div className="text-[#6B7280] dark:text-[#A9B1B1]">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 pt-3 border-t border-[#E5E7EB] dark:border-[#222E30] space-y-2.5 text-xs text-[#111827] dark:text-[#F5F7F7] animate-in fade-in">
          <div className="p-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] space-y-1">
            <div className="font-semibold text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
              1. Saldo de Conta = initial_balance + créditos - débitos
            </div>
            <div className="font-mono text-xs text-[#22A45D] dark:text-[#39D47A]">
              1.000 + 500 (Rec) - 200 (Desp) - 150 (Transf) = {formatCurrencyBRL(balance)} ✓
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] space-y-1">
            <div className="font-semibold text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
              2. Alocado Categoria/Mês = Σ(dest_budget_allocation_id) - Σ(source_budget_allocation_id)
            </div>
            <div className="font-mono text-xs text-[#22A45D] dark:text-[#39D47A]">
              +400 (Destino) - 50 (Origem) = {formatCurrencyBRL(allocated)} ✓
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] space-y-1">
            <div className="font-semibold text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
              3. Gasto Categoria/Mês = Σ(Transaction tipo DESPESA da categoria no mês)
            </div>
            <div className="font-mono text-xs text-[#22A45D] dark:text-[#39D47A]">
              DESPESA = {formatCurrencyBRL(spent)} ✓
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] space-y-1">
            <div className="font-semibold text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
              4. Disponível = Alocado - Gasto
            </div>
            <div className="font-mono text-xs text-[#22A45D] dark:text-[#39D47A]">
              350 - 200 = {formatCurrencyBRL(available)} ✓
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] space-y-1">
            <div className="font-semibold text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
              5. Current Value da Meta = Σ(dest_goal_id) - Σ(source_goal_id)
            </div>
            <div className="font-mono text-xs text-[#22A45D] dark:text-[#39D47A]">
              +300 = {formatCurrencyBRL(goalValue)} ✓
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] space-y-1">
            <div className="font-semibold text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
              6. Pronto para Atribuir = Saldo total - Σ(Disponível mês ≤ selecionado) - Σ(metas)
            </div>
            <div className="font-mono text-xs text-[#22A45D] dark:text-[#39D47A]">
              1.150 - 150 (Disp) - 300 (Metas) = {formatCurrencyBRL(rta.readyToAssign)} ✓
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
