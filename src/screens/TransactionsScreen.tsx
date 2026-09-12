import React, { useState, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Repeat,
  X,
  Plus,
  Filter,
  Check,
  Calendar,
  Wallet,
  Tag,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrencyBRL } from '../lib/financeLogic';
import { Transaction } from '../types/finance';

const MONTH_NAMES_PT = [
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

type TypeFilter = 'TODAS' | 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA';
type RecurrenceFilter = 'TODAS' | 'RECORRENTES' | 'AVULSAS';
type InstallmentFilter = 'TODAS' | 'PARCELADAS' | 'A_VISTA';

interface AdvancedFilters {
  accountId: string; // '' = todas
  categoryId: string; // '' = todas
  subcategoryId: string; // '' = todas
  recurrence: RecurrenceFilter;
  installment: InstallmentFilter;
  minValue: string;
  maxValue: string;
}

const DEFAULT_FILTERS: AdvancedFilters = {
  accountId: '',
  categoryId: '',
  subcategoryId: '',
  recurrence: 'TODAS',
  installment: 'TODAS',
  minValue: '',
  maxValue: '',
};

function formatGroupDateLabel(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;

  const txDate = new Date(y, m - 1, d);
  const today = new Date();
  const txMid = new Date(y, m - 1, d).setHours(0, 0, 0, 0);
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).setHours(0, 0, 0, 0);

  const diffTime = todayMid - txMid;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Hoje';
  }
  if (diffDays === 1) {
    return 'Ontem';
  }
  if (diffDays > 1 && diffDays < 7) {
    const weekdayNames = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ];
    return weekdayNames[txDate.getDay()];
  }

  const monthNamesLower = [
    'janeiro',
    'fevereiro',
    'março',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
  ];
  return `${d} de ${monthNamesLower[m - 1]} de ${y}`;
}

function getPreviousMonthString(monthStr: string): string {
  const [yStr, mStr] = monthStr.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) - 1;
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export const TransactionsScreen: React.FC = () => {
  const { data, selectedMonth, setSelectedMonth, hideValues } = useFinance();

  // Estados locais
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('TODAS');
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);

  // Filtros avançados
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);
  const [tempFilters, setTempFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);

  // Verifica se há filtros avançados ativos
  const hasActiveAdvancedFilters = useMemo(() => {
    return (
      advancedFilters.accountId !== '' ||
      advancedFilters.categoryId !== '' ||
      advancedFilters.subcategoryId !== '' ||
      advancedFilters.recurrence !== 'TODAS' ||
      advancedFilters.installment !== 'TODAS' ||
      advancedFilters.minValue !== '' ||
      advancedFilters.maxValue !== ''
    );
  }, [advancedFilters]);

  // Formatação do mês selecionado por extenso
  const formattedMonth = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const mIndex = parseInt(monthStr, 10) - 1;
    const name = MONTH_NAMES_PT[mIndex] || monthStr;
    return `${name} ${yearStr}`;
  }, [selectedMonth]);

  // Mapeamentos rápidos para O(1)
  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    data.accounts.forEach((acc) => map.set(String(acc.id), acc.name));
    return map;
  }, [data.accounts]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    data.categories.forEach((cat) => map.set(String(cat.id), cat.name));
    return map;
  }, [data.categories]);

  const subcategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    data.subcategories.forEach((sub) => map.set(String(sub.id), sub.name));
    return map;
  }, [data.subcategories]);

  // Subcategorias filtradas pela categoria selecionada no modal de filtros
  const availableSubcategories = useMemo(() => {
    if (!tempFilters.categoryId) return [];
    return data.subcategories.filter((sub) => String(sub.category_id) === tempFilters.categoryId);
  }, [data.subcategories, tempFilters.categoryId]);

  // Helper para mascarar valores
  const maskValue = (formattedText: string): string => {
    if (hideValues) return '••••••';
    return formattedText;
  };

  // 1. Filtragem das transações do mês e buscas/filtros
  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return data.transactions.filter((tx) => {
      const txDateStr = String(tx.date || '');

      // Filtro de mês selecionado
      if (!txDateStr.startsWith(selectedMonth)) return false;

      // Filtro de tipo (Todas / Receitas / Despesas / Transferências)
      if (typeFilter !== 'TODAS' && tx.type !== typeFilter) {
        return false;
      }

      // Busca por texto (descrição, nome de categoria ou subcategoria)
      if (query) {
        const descMatch = (tx.description || '').toLowerCase().includes(query);
        const catName = tx.category_id ? (categoryMap.get(String(tx.category_id)) || '').toLowerCase() : '';
        const catMatch = catName.includes(query);
        const subName = tx.subcategory_id ? (subcategoryMap.get(String(tx.subcategory_id)) || '').toLowerCase() : '';
        const subMatch = subName.includes(query);

        if (!descMatch && !catMatch && !subMatch) return false;
      }

      // Filtros avançados
      if (advancedFilters.accountId) {
        const matchesAccount =
          String(tx.account_id) === advancedFilters.accountId ||
          String(tx.to_account_id) === advancedFilters.accountId;
        if (!matchesAccount) return false;
      }

      if (advancedFilters.categoryId && String(tx.category_id) !== advancedFilters.categoryId) {
        return false;
      }

      if (advancedFilters.subcategoryId && String(tx.subcategory_id) !== advancedFilters.subcategoryId) {
        return false;
      }

      if (advancedFilters.recurrence === 'RECORRENTES' && !tx.recurrence_rule_id) {
        return false;
      }
      if (advancedFilters.recurrence === 'AVULSAS' && tx.recurrence_rule_id) {
        return false;
      }

      if (advancedFilters.installment === 'PARCELADAS' && !tx.installment_plan_id) {
        return false;
      }
      if (advancedFilters.installment === 'A_VISTA' && tx.installment_plan_id) {
        return false;
      }

      if (advancedFilters.minValue !== '') {
        const min = parseFloat(advancedFilters.minValue);
        if (!isNaN(min) && (Number(tx.value) || 0) < min) return false;
      }

      if (advancedFilters.maxValue !== '') {
        const max = parseFloat(advancedFilters.maxValue);
        if (!isNaN(max) && (Number(tx.value) || 0) > max) return false;
      }

      return true;
    });
  }, [
    data.transactions,
    selectedMonth,
    typeFilter,
    searchQuery,
    advancedFilters,
    categoryMap,
    subcategoryMap,
  ]);

  // 2. Cálculos do Card de Resumo (Receitas, Despesas, Saldo)
  const summaryCalculations = useMemo(() => {
    // Totais do mês atual a partir das transações filtradas do período
    const income = filteredTransactions.reduce((sum, tx) => {
      return tx.type === 'RECEITA' ? sum + (Number(tx.value) || 0) : sum;
    }, 0);

    const expenses = filteredTransactions.reduce((sum, tx) => {
      return tx.type === 'DESPESA' ? sum + (Number(tx.value) || 0) : sum;
    }, 0);

    const balance = income - expenses;

    // Variação vs Mês anterior (usando a fórmula exata: ((atual - anterior) / anterior) * 100, ou 100% se mês anterior for zero)
    const prevMonth = getPreviousMonthString(selectedMonth);

    const prevIncome = data.transactions.reduce((sum, tx) => {
      if (tx.type === 'RECEITA' && String(tx.date || '').startsWith(prevMonth)) {
        return sum + (Number(tx.value) || 0);
      }
      return sum;
    }, 0);

    const prevExpenses = data.transactions.reduce((sum, tx) => {
      if (tx.type === 'DESPESA' && String(tx.date || '').startsWith(prevMonth)) {
        return sum + (Number(tx.value) || 0);
      }
      return sum;
    }, 0);

    const calcVariation = (curr: number, prev: number) => {
      if (prev === 0) {
        return curr > 0 ? 100 : 0;
      }
      return ((curr - prev) / Math.abs(prev)) * 100;
    };

    const incomeVar = calcVariation(income, prevIncome);
    const expensesVar = calcVariation(expenses, prevExpenses);

    return {
      income,
      expenses,
      balance,
      incomeVar,
      expensesVar,
    };
  }, [filteredTransactions, data.transactions, selectedMonth]);

  // 3. Agrupamento das transações por data (ordenadas decrescente)
  const groupedTransactions = useMemo(() => {
    // Ordenar transações decrescente pela data (e desempate por id)
    const sorted = [...filteredTransactions].sort((a, b) => {
      const dateA = String(a.date || '');
      const dateB = String(b.date || '');
      if (dateB !== dateA) {
        return dateB.localeCompare(dateA);
      }
      const idA = String(a.id ?? '');
      const idB = String(b.id ?? '');
      return idB.localeCompare(idA);
    });

    const groups: { date: string; label: string; transactions: Transaction[] }[] = [];
    let currentGroup: { date: string; label: string; transactions: Transaction[] } | null = null;

    sorted.forEach((tx) => {
      const txDateStr = String(tx.date || '');
      if (!currentGroup || currentGroup.date !== txDateStr) {
        currentGroup = {
          date: txDateStr,
          label: formatGroupDateLabel(txDateStr),
          transactions: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.transactions.push(tx);
    });

    return groups;
  }, [filteredTransactions]);

  // Abertura do modal de filtros avançados
  const handleOpenFilterModal = () => {
    setTempFilters({ ...advancedFilters });
    setIsFilterModalOpen(true);
  };

  const handleApplyFilters = () => {
    setAdvancedFilters({ ...tempFilters });
    setIsFilterModalOpen(false);
  };

  const handleClearFilters = () => {
    setTempFilters(DEFAULT_FILTERS);
    setAdvancedFilters(DEFAULT_FILTERS);
    setIsFilterModalOpen(false);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* 1. CABEÇALHO */}
      {/* ========================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pt-1">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#111827] dark:text-[#F5F7F7]">
              Transações
            </h2>

            {/* Seletor de mês interativo */}
            <div className="relative mt-0.5">
              <button
                id="btn-transactions-month-select"
                type="button"
                onClick={() => setIsMonthPickerOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] cursor-pointer transition-colors"
              >
                <span>{formattedMonth}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {isMonthPickerOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMonthPickerOpen(false)}
                  />
                  <div className="absolute left-0 top-full mt-2 z-50 w-52 rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] shadow-lg p-2 max-h-64 overflow-y-auto">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1] px-2 py-1">
                      Selecionar Mês
                    </div>
                    {(() => {
                      const currentYear = new Date().getFullYear();
                      const years = [currentYear - 1, currentYear, currentYear + 1];
                      const items: { label: string; value: string }[] = [];

                      years.forEach((yr) => {
                        MONTH_NAMES_PT.forEach((mName, idx) => {
                          const mVal = String(idx + 1).padStart(2, '0');
                          items.push({
                            label: `${mName} ${yr}`,
                            value: `${yr}-${mVal}`,
                          });
                        });
                      });

                      return items.map((item) => {
                        const isSelected = item.value === selectedMonth;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                              setSelectedMonth(item.value);
                              setIsMonthPickerOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] font-bold'
                                : 'text-[#111827] dark:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Botão Nova Transação (placeholder para Fase 4b) */}
          <button
            id="btn-new-transaction"
            type="button"
            onClick={() => setIsNewTxModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-semibold shadow-xs hover:opacity-95 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova</span>
          </button>
        </div>

        {/* Linha de Busca + Ícone de Filtros Avançados */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] dark:text-[#A9B1B1]">
              <Search className="w-4 h-4" />
            </div>
            <input
              id="input-search-transaction"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar transação..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-[#FFFFFF] dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] text-[#111827] dark:text-[#F5F7F7] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:outline-none focus:ring-1 focus:ring-[#22A45D] dark:focus:ring-[#39D47A] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Ícone de filtros avançados com pontinho verde se ativo */}
          <button
            id="btn-advanced-filters"
            type="button"
            onClick={handleOpenFilterModal}
            className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
              hasActiveAdvancedFilters
                ? 'border-[#22A45D] dark:border-[#39D47A] bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A]'
                : 'border-[#E5E7EB] dark:border-[#222E30] bg-[#FFFFFF] dark:bg-[#172021] text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7]'
            }`}
            title="Filtros avançados"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {hasActiveAdvancedFilters && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#22A45D] dark:bg-[#39D47A]" />
            )}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. CARD DE RESUMO (Receitas, Despesas, Saldo) */}
      {/* ========================================================= */}
      <div
        id="card-transactions-summary"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] p-4 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] transition-colors"
      >
        <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] dark:divide-[#222E30]">
          {/* Coluna 1: Receitas */}
          <div className="px-2 first:pl-0">
            <span className="text-[11px] font-medium text-[#6B7280] dark:text-[#A9B1B1]">
              Receitas
            </span>
            <div className="text-xs sm:text-sm font-bold text-[#111827] dark:text-[#F5F7F7] mt-0.5 truncate">
              {maskValue(formatCurrencyBRL(summaryCalculations.income))}
            </div>
            <div className="flex items-center gap-0.5 text-[10px] text-[#22A45D] dark:text-[#39D47A] mt-0.5 truncate">
              {summaryCalculations.incomeVar >= 0 ? (
                <ArrowUp className="w-3 h-3 shrink-0" />
              ) : (
                <ArrowDown className="w-3 h-3 shrink-0 text-[#EF4444] dark:text-[#FF4D55]" />
              )}
              <span className={summaryCalculations.incomeVar < 0 ? 'text-[#EF4444] dark:text-[#FF4D55]' : ''}>
                {Math.abs(summaryCalculations.incomeVar).toFixed(0)}% vs mês ant.
              </span>
            </div>
          </div>

          {/* Coluna 2: Despesas */}
          <div className="px-2">
            <span className="text-[11px] font-medium text-[#6B7280] dark:text-[#A9B1B1]">
              Despesas
            </span>
            <div className="text-xs sm:text-sm font-bold text-[#111827] dark:text-[#F5F7F7] mt-0.5 truncate">
              {maskValue(formatCurrencyBRL(summaryCalculations.expenses))}
            </div>
            <div className="flex items-center gap-0.5 text-[10px] text-[#EF4444] dark:text-[#FF4D55] mt-0.5 truncate">
              {summaryCalculations.expensesVar >= 0 ? (
                <ArrowUp className="w-3 h-3 shrink-0" />
              ) : (
                <ArrowDown className="w-3 h-3 shrink-0" />
              )}
              <span>
                {Math.abs(summaryCalculations.expensesVar).toFixed(0)}% vs mês ant.
              </span>
            </div>
          </div>

          {/* Coluna 3: Saldo */}
          <div className="px-2 last:pr-0">
            <span className="text-[11px] font-medium text-[#6B7280] dark:text-[#A9B1B1]">
              Saldo
            </span>
            <div
              className={`text-xs sm:text-sm font-bold mt-0.5 truncate ${
                summaryCalculations.balance >= 0
                  ? 'text-[#22A45D] dark:text-[#39D47A]'
                  : 'text-[#EF4444] dark:text-[#FF4D55]'
              }`}
            >
              {maskValue(formatCurrencyBRL(summaryCalculations.balance))}
            </div>
            <div className="text-[10px] text-[#6B7280] dark:text-[#A9B1B1] mt-0.5 truncate">
              Receitas - Despesas
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. CHIPS DE FILTRO POR TIPO */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(
          [
            { id: 'TODAS', label: 'Todas' },
            { id: 'RECEITA', label: 'Receitas' },
            { id: 'DESPESA', label: 'Despesas' },
            { id: 'TRANSFERENCIA', label: 'Transferências' },
          ] as const
        ).map((item) => {
          const isActive = typeFilter === item.id;
          return (
            <button
              key={item.id}
              id={`chip-filter-${item.id.toLowerCase()}`}
              type="button"
              onClick={() => setTypeFilter(item.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#22A45D] text-white border-[#22A45D] dark:bg-[#39D47A] dark:text-[#0D1214] dark:border-[#39D47A] shadow-xs'
                  : 'bg-[#FFFFFF] dark:bg-[#172021] border-[#E5E7EB] dark:border-[#222E30] text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7]'
              }`}
            >
              {item.label}
            </button>
          );
        })}

        {hasActiveAdvancedFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-[#EF4444]/10 text-[#EF4444] dark:text-[#FF4D55] whitespace-nowrap cursor-pointer hover:bg-[#EF4444]/20 transition-colors"
          >
            <X className="w-3 h-3" />
            <span>Limpar filtros</span>
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4 & 5. LISTA DE TRANSAÇÕES AGRUPADAS POR DATA */}
      {/* ========================================================= */}
      {groupedTransactions.length === 0 ? (
        <div
          id="empty-transactions"
          className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] p-8 text-center border border-[#E5E7EB] dark:border-[#222E30] space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center mx-auto">
            <Filter className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F7]">
              Nenhuma transação encontrada
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] max-w-xs mx-auto">
              Não há transações no mês de {formattedMonth} com os filtros aplicados.
            </p>
          </div>
          {(searchQuery || hasActiveAdvancedFilters || typeFilter !== 'TODAS') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('TODAS');
                handleClearFilters();
              }}
              className="px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] dark:border-[#222E30] text-xs font-semibold text-[#111827] dark:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              Resetar busca e filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTransactions.map((group) => (
            <div key={group.date} className="space-y-1.5">
              {/* Rótulo de Data do Grupo */}
              <div className="text-[11px] font-bold text-[#6B7280] dark:text-[#A9B1B1] px-1 uppercase tracking-wider">
                {group.label}
              </div>

              {/* Card com as transações da data */}
              <div className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] shadow-xs divide-y divide-[#E5E7EB] dark:divide-[#222E30] overflow-hidden">
                {group.transactions.map((tx) => {
                  const isIncome = tx.type === 'RECEITA';
                  const isExpense = tx.type === 'DESPESA';
                  const isTransfer = tx.type === 'TRANSFERENCIA';

                  // Ícone e cores do círculo (36px):
                  // Verde + seta cima (RECEITA)
                  // Vermelho + seta baixo (DESPESA)
                  // Azul + troca (TRANSFERENCIA)
                  let icon = <ArrowUp className="w-4 h-4 text-white" />;
                  let bgCircle = 'bg-[#22A45D] dark:bg-[#39D47A]';

                  if (isExpense) {
                    icon = <ArrowDown className="w-4 h-4 text-white" />;
                    bgCircle = 'bg-[#EF4444] dark:bg-[#FF4D55]';
                  } else if (isTransfer) {
                    icon = <ArrowLeftRight className="w-4 h-4 text-white" />;
                    bgCircle = 'bg-[#3B82F6]';
                  }

                  // Linha secundária:
                  // se transferência: "{conta origem} → {conta destino}"
                  // senão: "{categoria} • {conta}" (categoria omitida se não tiver)
                  const originAccountName = accountMap.get(String(tx.account_id)) || 'Conta';
                  const destAccountName = tx.to_account_id ? accountMap.get(String(tx.to_account_id)) || 'Conta' : '';
                  const categoryName = tx.category_id ? categoryMap.get(String(tx.category_id)) : null;

                  let secondaryLine = '';
                  if (isTransfer) {
                    secondaryLine = `${originAccountName} → ${destAccountName}`;
                  } else {
                    secondaryLine = categoryName
                      ? `${categoryName} • ${originAccountName}`
                      : originAccountName;
                  }

                  return (
                    <div
                      key={String(tx.id)}
                      className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors"
                    >
                      {/* Lado esquerdo: Círculo de 36px + Textos */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full ${bgCircle} flex items-center justify-center shrink-0 shadow-2xs`}
                        >
                          {icon}
                        </div>

                        <div className="min-w-0">
                          {/* Linha 1: Descrição em negrito (uma linha com truncate) */}
                          <div className="text-xs sm:text-sm font-bold text-[#111827] dark:text-[#F5F7F7] truncate">
                            {tx.description || (isIncome ? 'Receita' : isExpense ? 'Despesa' : 'Transferência')}
                          </div>

                          {/* Linha 2: Secundária + Badges de Parcela e Recorrência */}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1] truncate">
                              {secondaryLine}
                            </span>

                            {/* Badge de Parcela: "{número}/{total}" */}
                            {tx.installment_plan_id && tx.installment_number && (
                              <span className="px-1.5 py-0.2 rounded-md bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] text-[10px] font-bold shrink-0">
                                {tx.installment_number}/{tx.installment_total || '?'}
                              </span>
                            )}

                            {/* Ícone de repetição se tiver recurrence_rule_id */}
                            {tx.recurrence_rule_id && (
                              <Repeat
                                className="w-3 h-3 text-[#6B7280] dark:text-[#A9B1B1] shrink-0"
                                title="Recorrente"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Lado direito: Valor formatado com sinal e cor */}
                      <div className="text-right shrink-0">
                        <div
                          className={`text-xs sm:text-sm font-bold ${
                            isIncome
                              ? 'text-[#22A45D] dark:text-[#39D47A]'
                              : isExpense
                              ? 'text-[#EF4444] dark:text-[#FF4D55]'
                              : 'text-[#111827] dark:text-[#F5F7F7]'
                          }`}
                        >
                          {isIncome && '+ '}
                          {isExpense && '- '}
                          {maskValue(formatCurrencyBRL(Number(tx.value) || 0))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MODAL DE FILTROS AVANÇADOS (Bottom sheet / Modal) */}
      {/* ========================================================= */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-t-[24px] sm:rounded-[24px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] p-5 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB] dark:border-[#222E30]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A]" />
                <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F7]">
                  Filtros Avançados
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Conta */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
                Conta
              </label>
              <select
                value={tempFilters.accountId}
                onChange={(e) =>
                  setTempFilters({ ...tempFilters, accountId: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:ring-1 focus:ring-[#22A45D]"
              >
                <option value="">Todas as Contas</option>
                {data.accounts
                  .filter((acc) => !acc.archived)
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* 2. Categoria */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
                Categoria
              </label>
              <select
                value={tempFilters.categoryId}
                onChange={(e) =>
                  setTempFilters({
                    ...tempFilters,
                    categoryId: e.target.value,
                    subcategoryId: '', // reseta subcategoria
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:ring-1 focus:ring-[#22A45D]"
              >
                <option value="">Todas as Categorias</option>
                {data.categories
                  .filter((cat) => !cat.archived)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* 3. Subcategoria (dependente) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
                Subcategoria
              </label>
              <select
                disabled={!tempFilters.categoryId}
                value={tempFilters.subcategoryId}
                onChange={(e) =>
                  setTempFilters({ ...tempFilters, subcategoryId: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:ring-1 focus:ring-[#22A45D] disabled:opacity-50"
              >
                <option value="">
                  {tempFilters.categoryId
                    ? 'Todas as Subcategorias'
                    : 'Selecione uma categoria primeiro'}
                </option>
                {availableSubcategories
                  .filter((sub) => !sub.archived)
                  .map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* 4. Recorrência */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
                Recorrência
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'TODAS', label: 'Todas' },
                  { id: 'RECORRENTES', label: 'Recorrentes' },
                  { id: 'AVULSAS', label: 'Avulsas' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setTempFilters({
                        ...tempFilters,
                        recurrence: item.id as RecurrenceFilter,
                      })
                    }
                    className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                      tempFilters.recurrence === item.id
                        ? 'bg-[#22A45D]/10 dark:bg-[#39D47A]/10 border-[#22A45D] dark:border-[#39D47A] text-[#22A45D] dark:text-[#39D47A] font-bold'
                        : 'border-[#E5E7EB] dark:border-[#222E30] text-[#6B7280] dark:text-[#A9B1B1]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Parcelamento */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
                Parcelamento
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'TODAS', label: 'Todas' },
                  { id: 'PARCELADAS', label: 'Parceladas' },
                  { id: 'A_VISTA', label: 'À vista' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setTempFilters({
                        ...tempFilters,
                        installment: item.id as InstallmentFilter,
                      })
                    }
                    className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                      tempFilters.installment === item.id
                        ? 'bg-[#22A45D]/10 dark:bg-[#39D47A]/10 border-[#22A45D] dark:border-[#39D47A] text-[#22A45D] dark:text-[#39D47A] font-bold'
                        : 'border-[#E5E7EB] dark:border-[#222E30] text-[#6B7280] dark:text-[#A9B1B1]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Faixa de Valor */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
                Faixa de valor (R$)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Mínimo"
                  value={tempFilters.minValue}
                  onChange={(e) =>
                    setTempFilters({ ...tempFilters, minValue: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:ring-1 focus:ring-[#22A45D]"
                />
                <input
                  type="number"
                  placeholder="Máximo"
                  value={tempFilters.maxValue}
                  onChange={(e) =>
                    setTempFilters({ ...tempFilters, maxValue: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:ring-1 focus:ring-[#22A45D]"
                />
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex-1 py-2 rounded-xl border border-[#E5E7EB] dark:border-[#222E30] text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] cursor-pointer"
              >
                Limpar filtros
              </button>
              <button
                type="button"
                onClick={handleApplyFilters}
                className="flex-1 py-2 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. MODAL PLACEHOLDER DA FASE 4B (Nova Transação) */}
      {/* ========================================================= */}
      {isNewTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-[22px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] p-6 shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F7]">
                Nova Transação (Fase 4b)
              </h4>
              <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                O formulário completo para criar, editar e excluir transações (com seleção de contas, categorias, parcelamento e repetição) será ativado na Fase 4b.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsNewTxModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-semibold shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
