import React, { useState, useMemo } from 'react';
import { X, ArrowRightLeft, Clock } from 'lucide-react';
import {
  BudgetAllocation,
  AllocationMovement,
  Category,
  Subcategory,
  Goal,
} from '../../types/finance';
import { formatCurrencyBRL, getPreviousMonthStr, monthFromTimestamp } from '../../lib/financeLogic';

interface RedistributionsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string; // "YYYY-MM"
  allocationMovements: AllocationMovement[];
  budgetAllocations: BudgetAllocation[];
  categories: Category[];
  subcategories: Subcategory[];
  goals: Goal[];
  hideValues: boolean;
}

type TabKey = 'CURRENT' | 'PREVIOUS' | 'ALL';

function formatMonthYearExtenso(monthStr: string): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [y, m] = monthStr.split('-');
  const monthNames = [
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
  const idx = parseInt(m, 10) - 1;
  const name = monthNames[idx] || m;
  return `${name}/${y}`;
}

function formatDateTime(ms: number | string): string {
  const d = new Date(Number(ms));
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export const RedistributionsReportModal: React.FC<RedistributionsReportModalProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  allocationMovements,
  budgetAllocations,
  categories,
  subcategories,
  goals,
  hideValues,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('CURRENT');

  const previousMonth = useMemo(() => getPreviousMonthStr(selectedMonth), [selectedMonth]);

  // Mapas rápidos por ID para lookup O(1)
  const allocMap = useMemo(() => {
    const map = new Map<number, BudgetAllocation>();
    budgetAllocations.forEach((b) => map.set(Number(b.id), b));
    return map;
  }, [budgetAllocations]);

  const catMap = useMemo(() => {
    const map = new Map<number, Category>();
    categories.forEach((c) => map.set(Number(c.id), c));
    return map;
  }, [categories]);

  const subcatMap = useMemo(() => {
    const map = new Map<number, Subcategory>();
    subcategories.forEach((s) => map.set(Number(s.id), s));
    return map;
  }, [subcategories]);

  const goalMap = useMemo(() => {
    const map = new Map<number, Goal>();
    goals.forEach((g) => map.set(Number(g.id), g));
    return map;
  }, [goals]);

  // Função para resolver nome legível de origem ou destino
  const resolveEntityName = (
    allocId: number | null | undefined,
    goalId: number | null | undefined
  ): string => {
    if (goalId != null) {
      const g = goalMap.get(Number(goalId));
      return g ? `Meta: ${g.name}` : 'Meta desconhecida';
    }

    if (allocId == null) {
      return 'Pronto para Atribuir';
    }

    const alloc = allocMap.get(Number(allocId));
    if (!alloc) {
      return 'Envelope desconhecido';
    }

    const cat = catMap.get(Number(alloc.category_id));
    const catName = cat ? cat.name : 'Categoria desconhecida';
    const monthFormatted = formatMonthYearExtenso(alloc.month);

    if (alloc.subcategory_id != null) {
      const sub = subcatMap.get(Number(alloc.subcategory_id));
      const subName = sub ? sub.name : 'Subcategoria';
      return `${catName} > ${subName} (${monthFormatted})`;
    }

    return `${catName} (${monthFormatted})`;
  };

  // Filtragem dos movimentos conforme a aba ativa
  const filteredMovements = useMemo(() => {
    let list = [...allocationMovements];

    if (activeTab === 'CURRENT' || activeTab === 'PREVIOUS') {
      const targetMonth = activeTab === 'CURRENT' ? selectedMonth : previousMonth;

      list = list.filter((m) => {
        // Movimento cuja BudgetAllocation de origem OU destino tem month igual ao mês da aba
        const srcAlloc = m.source_budget_allocation_id != null ? allocMap.get(Number(m.source_budget_allocation_id)) : null;
        const dstAlloc = m.dest_budget_allocation_id != null ? allocMap.get(Number(m.dest_budget_allocation_id)) : null;

        if (srcAlloc && srcAlloc.month === targetMonth) return true;
        if (dstAlloc && dstAlloc.month === targetMonth) return true;

        // OU movimento de meta (source_goal_id/dest_goal_id preenchido e sem alocação)
        // cujo mês de moved_at (local, "YYYY-MM") seja o mês da aba
        const isGoalOnly =
          (m.source_goal_id != null || m.dest_goal_id != null) &&
          m.source_budget_allocation_id == null &&
          m.dest_budget_allocation_id == null;

        if (isGoalOnly) {
          const moveMonth = monthFromTimestamp(Number(m.moved_at) || 0);
          if (moveMonth === targetMonth) return true;
        }

        return false;
      });
    }

    // Ordenar por moved_at, do mais recente para o mais antigo
    list.sort((a, b) => (Number(b.moved_at) || 0) - (Number(a.moved_at) || 0));

    return list;
  }, [activeTab, allocationMovements, selectedMonth, previousMonth, allocMap]);

  if (!isOpen) return null;

  const maskValue = (formattedText: string): string => {
    if (hideValues) return '••••••';
    return formattedText;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-5 shadow-2xl space-y-4 text-[#111827] dark:text-[#F5F7F8]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[#E6E9EC] dark:border-[#283438] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold tracking-tight">
              Relatório de Redistribuições
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Abas de largura igual: Este Mês | Mês Passado | Tudo */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438]">
          <button
            type="button"
            onClick={() => setActiveTab('CURRENT')}
            className={`py-2 px-1 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
              activeTab === 'CURRENT'
                ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] shadow-xs'
                : 'text-[#6B7280] dark:text-[#9FA9AB] hover:text-[#111827] dark:hover:text-[#F5F7F8]'
            }`}
          >
            Este Mês
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PREVIOUS')}
            className={`py-2 px-1 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
              activeTab === 'PREVIOUS'
                ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] shadow-xs'
                : 'text-[#6B7280] dark:text-[#9FA9AB] hover:text-[#111827] dark:hover:text-[#F5F7F8]'
            }`}
          >
            Mês Passado
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`py-2 px-1 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] shadow-xs'
                : 'text-[#6B7280] dark:text-[#9FA9AB] hover:text-[#111827] dark:hover:text-[#F5F7F8]'
            }`}
          >
            Tudo
          </button>
        </div>

        {/* Lista de movimentações (rolável, altura máx. ~450px) */}
        <div className="max-h-[450px] overflow-y-auto space-y-2.5 pr-0.5">
          {filteredMovements.length === 0 ? (
            <div className="py-12 text-center space-y-2 border border-dashed border-[#E6E9EC] dark:border-[#283438] rounded-2xl">
              <Clock className="w-8 h-8 text-[#6B7280] dark:text-[#9FA9AB] mx-auto opacity-70" />
              <p className="text-xs font-medium text-[#6B7280] dark:text-[#9FA9AB]">
                Nenhuma movimentação neste período.
              </p>
            </div>
          ) : (
            filteredMovements.map((m) => {
              const srcName = resolveEntityName(m.source_budget_allocation_id, m.source_goal_id);
              const dstName = resolveEntityName(m.dest_budget_allocation_id, m.dest_goal_id);
              const formattedDate = formatDateTime(m.moved_at);
              const amountFormatted = maskValue(formatCurrencyBRL(Number(m.amount) || 0));

              return (
                <div
                  key={m.id}
                  className="rounded-[10px] bg-[#FFFFFF] dark:bg-[#1A2326] border border-[#E6E9EC] dark:border-[#283438] p-3 space-y-2 shadow-2xs transition-colors"
                >
                  {/* Linha 1: data/hora à esquerda e valor em reais à direita */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[#6B7280] dark:text-[#9FA9AB] font-medium">
                      {formattedDate}
                    </span>
                    <span className="font-bold text-[#22A45D] dark:text-[#39D47A] text-[13px]">
                      {amountFormatted}
                    </span>
                  </div>

                  {/* Linha 2: "De: {origem}" e "Para: {destino}" */}
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-[#EF4444] dark:bg-[#FF4D55] shrink-0" />
                      <span className="text-[#6B7280] dark:text-[#9FA9AB] font-medium text-[11px]">
                        De:
                      </span>
                      <span className="font-semibold text-[#111827] dark:text-[#F5F7F8] truncate text-[11.5px]">
                        {srcName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-[#22A45D] dark:text-[#39D47A] bg-[#22A45D] dark:bg-[#39D47A] shrink-0" />
                      <span className="text-[#6B7280] dark:text-[#9FA9AB] font-medium text-[11px]">
                        Para:
                      </span>
                      <span className="font-semibold text-[#111827] dark:text-[#F5F7F8] truncate text-[11.5px]">
                        {dstName}
                      </span>
                    </div>
                  </div>

                  {/* Nota (se houver) */}
                  {m.note && m.note.trim() && (
                    <div className="p-1.5 rounded-md bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC]/50 dark:border-[#283438]/50 text-[11px] italic text-[#6B7280] dark:text-[#9FA9AB] truncate">
                      Nota: {m.note.trim()}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé com Botão Fechar */}
        <div className="pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-bold text-[#111827] dark:text-[#F5F7F8] transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
