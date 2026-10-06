import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  X,
  Target,
  Wallet,
  ShoppingBag,
  ArrowRightLeft,
  ChevronDown,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { StandardScreenHeader } from '../components/common/StandardScreenHeader';
import { formatCurrencyBRL } from '../lib/financeLogic';
import {
  PeriodType,
  getCurrentPeriod,
  getPreviousPeriod,
  getMonthsInRange,
  formatPeriodHeader,
  shiftMonth,
  calculatePeriodSummary,
  calculateCategoryExpenses,
  calculateCategoryComparison,
  calculate12MonthsIncomeVsExpense,
  calculateWeeklyExpenses,
  calculateTopExpenses,
  calculateNetWorthEvolution,
  calculatePlannedVsAllocated,
  calculateGoalsProgressTimeline,
  CATEGORY_PALETTE,
} from '../lib/metricsLogic';

export const MetricsScreen: React.FC = () => {
  const { data, loading, selectedMonth, hideValues } = useFinance();

  // 1. Estado de Período (Chip)
  const [periodType, setPeriodType] = useState<PeriodType>('MES');

  // Período personalizado: padrão início = mês atual - 3, fim = mês atual
  const now = new Date();
  const currentActualMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [customStart, setCustomStart] = useState<string>(shiftMonth(currentActualMonth, -3));
  const [customEnd, setCustomEnd] = useState<string>(currentActualMonth);

  // Filtro de categoria selecionada (compartilhado entre Seção 3 e Seção 10)
  const [filteredCategoryId, setFilteredCategoryId] = useState<number | null>(null);

  const maskValue = (val: string): string => {
    if (hideValues) return '••••••';
    return val;
  };

  // 2. Intervalo atual e anterior calculados
  const currentRange = useMemo(() => {
    return getCurrentPeriod(periodType, selectedMonth, customStart, customEnd);
  }, [periodType, selectedMonth, customStart, customEnd]);

  const previousRange = useMemo(() => {
    return getPreviousPeriod(periodType, selectedMonth, customStart, customEnd);
  }, [periodType, selectedMonth, customStart, customEnd]);

  const numMonths = useMemo(() => {
    return getMonthsInRange(currentRange.startMonth, currentRange.endMonth).length;
  }, [currentRange]);

  const periodHeaderText = useMemo(() => {
    return formatPeriodHeader(periodType, currentRange.startMonth, currentRange.endMonth);
  }, [periodType, currentRange]);

  // =========================================================================
  // CÁLCULOS DAS SEÇÕES
  // =========================================================================

  // Seção 2: Resumo do Período
  const summary = useMemo(() => {
    return calculatePeriodSummary(data.transactions || [], currentRange, previousRange);
  }, [data.transactions, currentRange, previousRange]);

  // Seção 3 e 4: Gastos por Categoria & Média Mensal
  const categoryExpenses = useMemo(() => {
    return calculateCategoryExpenses(
      data.transactions || [],
      data.categories || [],
      currentRange,
      numMonths
    );
  }, [data.transactions, data.categories, currentRange, numMonths]);

  // Seção 5: Comparativo entre Períodos por Categoria
  const comparisonItems = useMemo(() => {
    return calculateCategoryComparison(
      data.transactions || [],
      data.categories || [],
      currentRange,
      previousRange
    );
  }, [data.transactions, data.categories, currentRange, previousRange]);

  // Seção 6: Entradas vs Saídas Mensais (12 meses terminando em M)
  const twelveMonthsData = useMemo(() => {
    return calculate12MonthsIncomeVsExpense(data.transactions || [], selectedMonth);
  }, [data.transactions, selectedMonth]);

  // Seção 7: Análise Semanal (Gasto Total)
  const weeklyExpenses = useMemo(() => {
    return calculateWeeklyExpenses(data.transactions || [], currentRange);
  }, [data.transactions, currentRange]);

  // Seção 8: Maiores Despesas do Período
  const topExpenses = useMemo(() => {
    return calculateTopExpenses(
      data.transactions || [],
      data.categories || [],
      data.subcategories || [],
      currentRange,
      5
    );
  }, [data.transactions, data.categories, data.subcategories, currentRange]);

  // Seção 9: Evolução do Patrimônio Líquido (6 meses)
  const netWorthEvolution = useMemo(() => {
    return calculateNetWorthEvolution(
      data.accounts || [],
      data.transactions || [],
      selectedMonth,
      6
    );
  }, [data.accounts, data.transactions, selectedMonth]);

  // Categoria ativa para Seção 10: filtro da seção 3 ou primeira categoria
  const activePlanCategoryId = useMemo(() => {
    if (filteredCategoryId != null) return filteredCategoryId;
    if (data.categories && data.categories.length > 0) {
      return Number(data.categories[0].id);
    }
    return null;
  }, [filteredCategoryId, data.categories]);

  // Seção 10: Planejado vs Alocado Mensal por Categoria (6 meses)
  const plannedVsAllocated = useMemo(() => {
    if (activePlanCategoryId == null) return { series: [], hasData: false };
    return calculatePlannedVsAllocated(
      activePlanCategoryId,
      data.budget_allocations || [],
      data.allocation_movements || [],
      selectedMonth,
      6
    );
  }, [activePlanCategoryId, data.budget_allocations, data.allocation_movements, selectedMonth]);

  // Seção 11: Progresso das Metas na Linha do Tempo (6 meses)
  const goalsTimeline = useMemo(() => {
    return calculateGoalsProgressTimeline(
      data.goals || [],
      data.allocation_movements || [],
      selectedMonth,
      6
    );
  }, [data.goals, data.allocation_movements, selectedMonth]);

  // =========================================================================
  // SKELETON LOADING
  // =========================================================================
  if (loading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-150">
        <StandardScreenHeader title="Métricas" />
        <div className="grid grid-cols-4 gap-1.5 h-[38px] animate-pulse" />
        <div className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-[14px] h-36 animate-pulse" />
        <div className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-200">
      {/* Cabeçalho padrão com seletor de mês compartilhado */}
      <StandardScreenHeader
        title="Métricas"
        subtitle={periodHeaderText}
      />

      {/* ========================================================================= */}
      {/* 1. SELETOR DE PERÍODO (Chips: Mês | Trimestre | Ano | Personalizado)       */}
      {/* ========================================================================= */}
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438]">
          {(
            [
              { key: 'MES', label: 'Mês' },
              { key: 'TRIMESTRE', label: 'Trimestre' },
              { key: 'ANO', label: 'Ano' },
              { key: 'PERSONALIZADO', label: 'Personalizado' },
            ] as const
          ).map((chip) => {
            const isActive = periodType === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setPeriodType(chip.key)}
                className={`py-2 px-1 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer truncate ${
                  isActive
                    ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] shadow-xs'
                    : 'text-[#6B7280] dark:text-[#9FA9AB] hover:text-[#111827] dark:hover:text-[#F5F7F8]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Seletores no modo Personalizado */}
        {periodType === 'PERSONALIZADO' && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] shadow-2xs animate-in fade-in duration-150">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
                Mês Inicial
              </label>
              <input
                type="month"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-xs font-medium focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
                Mês Final
              </label>
              <input
                type="month"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-xs font-medium focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A]"
              />
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. "RESUMO DO PERÍODO" (card, raio 18px, padding 14px)                    */}
      {/* ========================================================================= */}
      <div
        id="card-period-summary"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-[14px] shadow-2xs space-y-3 transition-colors"
      >
        <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F8]">
          Resumo do Período
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Indicador 1: Receitas */}
          <div className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] space-y-1">
            <span className="block text-[11px] font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              Receitas
            </span>
            <span className="block text-[15px] font-bold text-[#22A45D] dark:text-[#39D47A] truncate">
              {maskValue(formatCurrencyBRL(summary.receitas))}
            </span>
            <span className="block text-[10.5px] font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              {summary.receitasVarPercent != null
                ? `${summary.receitasVarPercent >= 0 ? '+' : ''}${summary.receitasVarPercent}% vs ant.`
                : '—'}
            </span>
          </div>

          {/* Indicador 2: Despesas */}
          <div className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] space-y-1">
            <span className="block text-[11px] font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              Despesas
            </span>
            <span className="block text-[15px] font-bold text-[#EF4444] dark:text-[#FF4D55] truncate">
              {maskValue(formatCurrencyBRL(summary.despesas))}
            </span>
            <span className="block text-[10.5px] font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              {summary.despesasVarPercent != null
                ? `${summary.despesasVarPercent >= 0 ? '+' : ''}${summary.despesasVarPercent}% vs ant.`
                : '—'}
            </span>
          </div>

          {/* Indicador 3: Saldo Líquido */}
          <div className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] space-y-1">
            <span className="block text-[11px] font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              Saldo Líquido
            </span>
            <span
              className={`block text-[15px] font-bold truncate ${
                summary.saldoLiquido >= 0
                  ? 'text-[#22A45D] dark:text-[#39D47A]'
                  : 'text-[#EF4444] dark:text-[#FF4D55]'
              }`}
            >
              {maskValue(formatCurrencyBRL(summary.saldoLiquido))}
            </span>
            <span className="block text-[10.5px] font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              {summary.saldoLiquido >= 0 ? 'Positivo' : 'Negativo'}
            </span>
          </div>

          {/* Indicador 4: Economia % */}
          <div className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] space-y-1">
            <span className="block text-[11px] font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              Economia %
            </span>
            <span
              className={`block text-[15px] font-bold truncate ${
                summary.economiaPercent != null && summary.economiaPercent >= 0
                  ? 'text-[#22A45D] dark:text-[#39D47A]'
                  : summary.economiaPercent != null
                  ? 'text-[#EF4444] dark:text-[#FF4D55]'
                  : 'text-[#6B7280] dark:text-[#9FA9AB]'
              }`}
            >
              {summary.economiaPercent != null
                ? `${summary.economiaPercent.toFixed(1).replace('.', ',')}%`
                : '—'}
            </span>
            <span className="block text-[10.5px] font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              {summary.economiaPercent != null && summary.economiaPercent >= 0 ? 'Economizado' : 'Déficit'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. "GASTOS POR CATEGORIA 🛍️"                                             */}
      {/* ========================================================================= */}
      <div
        id="card-category-expenses"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 shadow-2xs space-y-4 transition-colors"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F8]">
            Gastos por Categoria 🛍️
          </h3>

          {filteredCategoryId != null && (
            <button
              type="button"
              onClick={() => setFilteredCategoryId(null)}
              className="text-[11px] font-semibold text-[#22A45D] dark:text-[#39D47A] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar filtro</span>
            </button>
          )}
        </div>

        {categoryExpenses.items.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-[#E6E9EC] dark:border-[#283438] rounded-2xl">
            <ShoppingBag className="w-8 h-8 text-[#6B7280] dark:text-[#9FA9AB] mx-auto opacity-70" />
            <p className="text-xs font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              Nenhum gasto registrado neste período.
            </p>
          </div>
        ) : (
          <>
            {/* Gráfico de Rosca de 130px com centro "Total" */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
              <div className="relative w-[130px] h-[130px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      formatter={(val: any) => [maskValue(formatCurrencyBRL(Number(val) || 0)), 'Gasto']}
                    />
                    <Pie
                      data={categoryExpenses.items}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={60}
                      paddingAngle={2}
                    >
                      {categoryExpenses.items.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Texto Central */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                  <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#9FA9AB] leading-none">
                    Total
                  </span>
                  <span className="text-xs font-bold text-[#111827] dark:text-[#F5F7F8] truncate max-w-[80px] mt-0.5">
                    {maskValue(formatCurrencyBRL(categoryExpenses.totalPeriod))}
                  </span>
                </div>
              </div>

              {/* Legenda com as 5 primeiras + N */}
              <div className="space-y-1.5 min-w-0 text-xs">
                {categoryExpenses.items.slice(0, 5).map((item) => (
                  <div key={item.categoryId} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[#111827] dark:text-[#F5F7F8] font-medium truncate max-w-[150px]">
                      {item.name}
                    </span>
                    <span className="text-[#6B7280] dark:text-[#9FA9AB] text-[11px] shrink-0">
                      ({item.percent.toFixed(0)}%)
                    </span>
                  </div>
                ))}
                {categoryExpenses.items.length > 5 && (
                  <div className="text-[11px] text-[#6B7280] dark:text-[#9FA9AB] italic pl-4">
                    + {categoryExpenses.items.length - 5} categorias
                  </div>
                )}
              </div>
            </div>

            {/* Lista de TODAS as categorias com barras proporcionais */}
            <div className="space-y-2 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
              {categoryExpenses.items.map((item) => {
                const isSelected = filteredCategoryId === item.categoryId;
                const maxVal = categoryExpenses.items[0]?.total || 1;
                const barRatio = Math.max(0.01, item.total / maxVal);

                return (
                  <div
                    key={item.categoryId}
                    onClick={() =>
                      setFilteredCategoryId((prev) => (prev === item.categoryId ? null : item.categoryId))
                    }
                    className={`p-2 rounded-xl transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#22A45D]/10 dark:bg-[#39D47A]/10 border border-[#22A45D] dark:border-[#39D47A]'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-[#111827] dark:text-[#F5F7F8] truncate">
                          {item.name} {isSelected && '(Ativo 📌)'}
                        </span>
                      </div>
                      <span className="font-bold text-[#111827] dark:text-[#F5F7F8] shrink-0">
                        {maskValue(formatCurrencyBRL(item.total))}
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${barRatio * 100}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. "MÉDIA MENSAL POR CATEGORIA 📊"                                        */}
      {/* ========================================================================= */}
      <div
        id="card-monthly-average-category"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 shadow-2xs space-y-4 transition-colors"
      >
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F8]">
            Média Mensal por Categoria 📊
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#9FA9AB]">
            {numMonths === 1
              ? 'Média mensal (período de 1 mês)'
              : `Média mensal baseada em ${numMonths} meses selecionados`}
          </p>
        </div>

        {categoryExpenses.items.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-[#E6E9EC] dark:border-[#283438] rounded-2xl">
            <p className="text-xs font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              Nenhum gasto registrado neste período.
            </p>
          </div>
        ) : (
          <>
            {/* Rosca com centro "Média" */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
              <div className="relative w-[130px] h-[130px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      formatter={(val: any) => [maskValue(formatCurrencyBRL(Number(val) || 0)), 'Média Mensal']}
                    />
                    <Pie
                      data={categoryExpenses.items}
                      dataKey="average"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={60}
                      paddingAngle={2}
                    >
                      {categoryExpenses.items.map((entry, idx) => (
                        <Cell key={`cell-avg-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
                  <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#9FA9AB] leading-none">
                    Média
                  </span>
                  <span className="text-xs font-bold text-[#111827] dark:text-[#F5F7F8] truncate max-w-[80px] mt-0.5">
                    {maskValue(formatCurrencyBRL(categoryExpenses.totalAverage))}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 min-w-0 text-xs">
                {categoryExpenses.items.slice(0, 5).map((item) => (
                  <div key={item.categoryId} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[#111827] dark:text-[#F5F7F8] font-medium truncate max-w-[150px]">
                      {item.name}
                    </span>
                    <span className="text-[#6B7280] dark:text-[#9FA9AB] text-[11px] shrink-0">
                      ({maskValue(formatCurrencyBRL(item.average))}/mês)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lista com valores médios */}
            <div className="space-y-2 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
              {categoryExpenses.items.map((item) => {
                const maxAvg = categoryExpenses.items[0]?.average || 1;
                const barRatio = Math.max(0.01, item.average / maxAvg);

                return (
                  <div key={item.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium text-[#111827] dark:text-[#F5F7F8] truncate">
                          {item.name}
                        </span>
                      </div>
                      <span className="font-bold text-[#111827] dark:text-[#F5F7F8] shrink-0">
                        {maskValue(formatCurrencyBRL(item.average))} / mês
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${barRatio * 100}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. "COMPARATIVO ENTRE PERÍODOS POR CATEGORIA 🔄"                          */}
      {/* ========================================================================= */}
      <div
        id="card-period-comparison"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 shadow-2xs space-y-4 transition-colors"
      >
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F8]">
            Comparativo entre Períodos por Categoria 🔄
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#9FA9AB]">
            Comparação dos gastos do período selecionado contra o período anterior equivalente
          </p>
        </div>

        {comparisonItems.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-[#E6E9EC] dark:border-[#283438] rounded-2xl">
            <p className="text-xs font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              Sem dados comparativos suficientes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Legenda */}
            <div className="flex items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#22A45D] dark:bg-[#39D47A]" />
                <span className="text-[#111827] dark:text-[#F5F7F8] font-medium">Período Atual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#9CA3AF]" />
                <span className="text-[#6B7280] dark:text-[#9FA9AB] font-medium">Período Anterior</span>
              </div>
            </div>

            {/* Gráfico de Barras Agrupadas com 3 linhas de grade */}
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonItems} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: '#6B7280' }}
                    interval={0}
                  />
                  <YAxis
                    tickCount={4}
                    tick={{ fontSize: 10, fill: '#6B7280' }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      maskValue(formatCurrencyBRL(Number(val) || 0)),
                      name === 'currentValue' ? 'Atual' : 'Anterior',
                    ]}
                  />
                  <Bar dataKey="currentValue" fill="#22A45D" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previousValue" fill="#9CA3AF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. "ENTRADAS VS SAÍDAS MENSAIS (12 MESES) 📈"                             */}
      {/* ========================================================================= */}
      <div
        id="card-income-vs-expense-12m"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 shadow-2xs space-y-4 transition-colors"
      >
        <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F8]">
          Entradas vs Saídas Mensais (12 meses) 📈
        </h3>

        <div className="flex items-center justify-center gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#22A45D] dark:bg-[#39D47A]" />
            <span className="text-[#111827] dark:text-[#F5F7F8] font-medium">Receita</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#EF4444] dark:bg-[#FF4D55]" />
            <span className="text-[#111827] dark:text-[#F5F7F8] font-medium">Despesa</span>
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={twelveMonthsData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#6B7280' }}
                interval={1}
              />
              <YAxis
                tickCount={4}
                tick={{ fontSize: 10, fill: '#6B7280' }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip
                formatter={(val: any, name: any) => [
                  maskValue(formatCurrencyBRL(Number(val) || 0)),
                  name === 'receita' ? 'Receita' : 'Despesa',
                ]}
              />
              <Bar dataKey="receita" fill="#22A45D" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. "ANÁLISE SEMANAL (GASTO TOTAL) 🗓️"                                      */}
      {/* ========================================================================= */}
      <div
        id="card-weekly-analysis"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 shadow-2xs space-y-4 transition-colors"
      >
        <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F8]">
          Análise Semanal (Gasto Total) 🗓️
        </h3>

        {weeklyExpenses.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-[#E6E9EC] dark:border-[#283438] rounded-2xl">
            <p className="text-xs font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              Nenhum gasto registrado neste período.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyExpenses} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#6B7280' }}
                    interval={weeklyExpenses.length > 8 ? 1 : 0}
                  />
                  <YAxis
                    tickCount={4}
                    tick={{ fontSize: 10, fill: '#6B7280' }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <Tooltip
                    formatter={(val: any) => [maskValue(formatCurrencyBRL(Number(val) || 0)), 'Despesa']}
                  />
                  <Bar dataKey="amount" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Lista linha a linha: "Semana N" + valor */}
            <div className="space-y-1.5 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
              {weeklyExpenses.map((w, idx) => (
                <div
                  key={`${w.year}-${w.weekNumber}-${idx}`}
                  className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="font-medium text-[#111827] dark:text-[#F5F7F8]">
                    {w.label}
                  </span>
                  <span className="font-bold text-[#EF4444] dark:text-[#FF4D55]">
                    {maskValue(formatCurrencyBRL(w.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 8. "MAIORES DESPESAS DO PERÍODO 💸"                                       */}
      {/* ========================================================================= */}
      <div
        id="card-top-expenses"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 shadow-2xs space-y-3 transition-colors"
      >
        <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F8]">
          Maiores Despesas do Período 💸
        </h3>

        {topExpenses.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-[#E6E9EC] dark:border-[#283438] rounded-2xl">
            <p className="text-xs font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              Nenhuma despesa registrada no período.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {topExpenses.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[#E6E9EC] dark:border-[#283438] bg-[#FAFAFB] dark:bg-[#0D1315]"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#111827] dark:text-[#F5F7F8] truncate leading-tight">
                    {tx.description}
                  </div>
                  <div className="text-[11px] text-[#6B7280] dark:text-[#9FA9AB] truncate mt-0.5 leading-tight">
                    {tx.categoryHierarchy} • {tx.formattedDate}
                  </div>
                </div>

                <span className="text-xs font-bold text-[#EF4444] dark:text-[#FF4D55] shrink-0">
                  - {maskValue(formatCurrencyBRL(tx.value))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 9. "EVOLUÇÃO DO PATRIMÔNIO LÍQUIDO 🏦"                                    */}
      {/* ========================================================================= */}
      <div
        id="card-net-worth-evolution"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 shadow-2xs space-y-4 transition-colors"
      >
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F8]">
            Evolução do Patrimônio Líquido 🏦
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#9FA9AB]">
            Saldo cumulativo de todas as suas contas
          </p>
        </div>

        {/* Valor do último mês em destaque e variação */}
        <div className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] flex items-baseline justify-between">
          <div>
            <span className="block text-[11px] text-[#6B7280] dark:text-[#9FA9AB]">
              Saldo no Mês Atual ({selectedMonth})
            </span>
            <span className="text-lg font-bold text-[#111827] dark:text-[#F5F7F8]">
              {maskValue(formatCurrencyBRL(netWorthEvolution.currentValue))}
            </span>
          </div>

          <div className="text-right">
            <span
              className={`text-xs font-bold ${
                netWorthEvolution.variationValue >= 0
                  ? 'text-[#22A45D] dark:text-[#39D47A]'
                  : 'text-[#EF4444] dark:text-[#FF4D55]'
              }`}
            >
              {netWorthEvolution.variationValue >= 0 ? '+' : ''}
              {maskValue(formatCurrencyBRL(netWorthEvolution.variationValue))}
              {netWorthEvolution.variationPercent != null &&
                ` (${netWorthEvolution.variationPercent >= 0 ? '+' : ''}${netWorthEvolution.variationPercent}%)`}
            </span>
            <span className="block text-[10.5px] text-[#6B7280] dark:text-[#9FA9AB]">
              em 6 meses
            </span>
          </div>
        </div>

        {/* Gráfico de Linha */}
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={netWorthEvolution.series} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7280' }} />
              <YAxis
                tickCount={4}
                tick={{ fontSize: 10, fill: '#6B7280' }}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip
                formatter={(val: any) => [maskValue(formatCurrencyBRL(Number(val) || 0)), 'Patrimônio']}
              />
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke="#22A45D"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#22A45D' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 10. "PLANEJADO VS ALOCADO MENSAL POR CATEGORIA 📁"                        */}
      {/* ========================================================================= */}
      <div
        id="card-planned-vs-allocated"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 shadow-2xs space-y-4 transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F8]">
              Planejado vs Alocado Mensal por Categoria 📁
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#9FA9AB]">
              Acompanhe se as alocações planejadas estão subindo ou descendo
            </p>
          </div>

          {/* Seletor dropdown de Categoria */}
          {data.categories && data.categories.length > 0 && (
            <div className="shrink-0">
              <select
                value={activePlanCategoryId || ''}
                onChange={(e) => setFilteredCategoryId(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold text-[#111827] dark:text-[#F5F7F8] focus:outline-hidden focus:border-[#22A45D] cursor-pointer"
              >
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!plannedVsAllocated.hasData ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-[#E6E9EC] dark:border-[#283438] rounded-2xl">
            <p className="text-xs font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              Nenhum planejamento registrado nos envelopes ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Legenda */}
            <div className="flex items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#9CA3AF]" />
                <span className="text-[#6B7280] dark:text-[#9FA9AB] font-medium">Planejado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#22A45D] dark:bg-[#39D47A]" />
                <span className="text-[#111827] dark:text-[#F5F7F8] font-medium">Alocado</span>
              </div>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={plannedVsAllocated.series} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7280' }} />
                  <YAxis
                    tickCount={4}
                    tick={{ fontSize: 10, fill: '#6B7280' }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      maskValue(formatCurrencyBRL(Number(val) || 0)),
                      name === 'planejado' ? 'Planejado' : 'Alocado',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="planejado"
                    stroke="#9CA3AF"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#9CA3AF' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="alocado"
                    stroke="#22A45D"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#22A45D' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Lista por mês: "Plan: R$ X | Alocado: R$ Y" */}
            <div className="space-y-1.5 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
              {plannedVsAllocated.series.map((item) => (
                <div
                  key={item.month}
                  className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="font-semibold text-[#111827] dark:text-[#F5F7F8]">
                    {item.label}
                  </span>
                  <div className="space-x-3 text-right">
                    <span className="text-[#6B7280] dark:text-[#9FA9AB]">
                      Plan: {maskValue(formatCurrencyBRL(item.planejado))}
                    </span>
                    <span className="font-bold text-[#22A45D] dark:text-[#39D47A]">
                      Alocado: {maskValue(formatCurrencyBRL(item.alocado))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 11. "PROGRESSO DAS METAS NA LINHA DO TEMPO 🎯"                            */}
      {/* ========================================================================= */}
      <div
        id="card-goals-progress-timeline"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 shadow-2xs space-y-4 transition-colors"
      >
        <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F8]">
          Progresso das Metas na Linha do Tempo 🎯
        </h3>

        {goalsTimeline.seriesList.length === 0 ? (
          <div className="py-10 text-center space-y-2 border border-dashed border-[#E6E9EC] dark:border-[#283438] rounded-2xl">
            <Target className="w-8 h-8 text-[#6B7280] dark:text-[#9FA9AB] mx-auto opacity-70" />
            <p className="text-xs font-medium text-[#6B7280] dark:text-[#9FA9AB]">
              Nenhuma meta cadastrada ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Gráfico com uma linha por meta */}
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={goalsTimeline.monthsList.map((m, idx) => {
                    const point: any = {
                      label: goalsTimeline.seriesList[0]?.dataPoints[idx]?.label || m,
                    };
                    goalsTimeline.seriesList.forEach((s) => {
                      point[s.goalName] = s.dataPoints[idx]?.saldo || 0;
                    });
                    return point;
                  })}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6B7280' }} />
                  <YAxis
                    tickCount={4}
                    tick={{ fontSize: 10, fill: '#6B7280' }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      maskValue(formatCurrencyBRL(Number(val) || 0)),
                      name,
                    ]}
                  />
                  {goalsTimeline.seriesList.map((s) => (
                    <Line
                      key={s.goalId}
                      type="monotone"
                      dataKey={s.goalName}
                      stroke={s.colorHex}
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: s.colorHex }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Lista abaixo: nome e "R$ saldo (X%)" no último mês */}
            <div className="space-y-2 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
              {goalsTimeline.seriesList.map((s) => (
                <div
                  key={s.goalId}
                  className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: s.colorHex }}
                    />
                    <span className="font-semibold text-[#111827] dark:text-[#F5F7F8] truncate">
                      {s.goalName}
                    </span>
                  </div>

                  <span className="font-bold text-[#111827] dark:text-[#F5F7F8] shrink-0">
                    {maskValue(formatCurrencyBRL(s.currentBalance))} ({s.progressPercent}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
