import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  X,
  Target,
  AlertCircle,
  Folder,
  Layers,
  Sparkles,
  Zap,
  ArrowRightLeft,
  Plus,
  Calendar,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { useTheme } from '../context/ThemeContext';
import { StandardScreenHeader } from '../components/common/StandardScreenHeader';
import {
  calculateReadyToAssign,
  getCumulativeLeftoversMap,
  getPreviousMonthStr,
  buildMonthMaps,
  getMonthsInRange,
  formatCurrencyBRL,
  monthFromTimestamp,
  calculateGoalCurrentValue,
} from '../lib/financeLogic';
import { moveMoney, createCategory } from '../firebase/firestore';
import { Category, Subcategory, Goal } from '../types/finance';
import { PlanModal } from '../components/planning/PlanModal';
import { AllocateModal } from '../components/planning/AllocateModal';
import {
  DistributeModal,
  EnvelopeOption,
  MetaOption,
  EntityType,
} from '../components/planning/DistributeModal';
import { TransactionFormModal } from '../components/transactions/TransactionFormModal';

type FilterChip = 'TODAS' | 'ALERTAS' | 'EXCEDIDAS' | 'DISPONIVEIS';

interface CalculatedSubcategory {
  sub: Subcategory;
  planejado: number;
  alocado: number;
  gasto: number;
  disponivel: number;
  barColorHex: string;
  isRed: boolean;
  percent: number;
}

interface CalculatedCategory {
  cat: Category;
  hasSubcategories: boolean;
  visibleSubs: CalculatedSubcategory[];
  planejado: number;
  alocado: number;
  gasto: number;
  disponivel: number;
  barColorHex: string;
  isRed: boolean;
  percent: number;
}

interface CalculatedGoalSub {
  goal: Goal;
  planejado: number;
  alocado: number;
}

interface CalculatedGoalsCategory {
  isVirtualGoals: true;
  goals: CalculatedGoalSub[];
  planejado: number;
  alocado: number;
}

export const PlanningScreen: React.FC = () => {
  const { user } = useAuth();
  const { data, loading, selectedMonth, hideValues } = useFinance();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Estados locais da tela
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState<FilterChip>('TODAS');
  const [expandedCategories, setExpandedCategories] = useState<Set<number | string>>(new Set());
  const [activeActionPanel, setActiveActionPanel] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Estados dos diálogos (Fase 5b)
  const [planModalState, setPlanModalState] = useState<{
    isOpen: boolean;
    categoryId: number;
    subcategoryId?: number | null;
    categoryName: string;
    subcategoryName?: string | null;
    currentPlannedValue: number;
  } | null>(null);

  const [allocateModalState, setAllocateModalState] = useState<{
    isOpen: boolean;
    categoryId?: number | null;
    subcategoryId?: number | null;
    goalId?: number | null;
    titlePath: string;
    planejadoDoMes: number;
    alocadoDoMesSemSobra: number;
  } | null>(null);

  const [distributeModalState, setDistributeModalState] = useState<{
    isOpen: boolean;
    initialSource?: {
      type: EntityType;
      categoryId?: number | null;
      subcategoryId?: number | null;
      goalId?: number | null;
    };
  }>({ isOpen: false });

  const [txModalState, setTxModalState] = useState<{
    isOpen: boolean;
    categoryId?: number | null;
    subcategoryId?: number | null;
  }>({ isOpen: false });

  const [isNewCategoryOpen, setIsNewCategoryOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [savingNewCat, setSavingNewCat] = useState(false);

  // Helper para mascarar valores monetários respeitando a privacidade
  const maskValue = (formattedText: string): string => {
    if (hideValues) return '••••••';
    return formattedText;
  };

  // Exibir aviso temporário discreto
  const showNotice = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // 1. Mês anterior
  const prevMonth = useMemo(() => getPreviousMonthStr(selectedMonth), [selectedMonth]);

  // 2. Mapa de sobras acumuladas até o mês anterior M-1
  const sobrasPrevMap = useMemo(() => {
    return getCumulativeLeftoversMap(
      data.budget_allocations,
      data.allocation_movements,
      data.transactions,
      data.categories,
      data.subcategories,
      prevMonth
    );
  }, [data.budget_allocations, data.allocation_movements, data.transactions, data.categories, data.subcategories, prevMonth]);

  // 3. Soma de TODOS os valores de sobras do mês anterior
  const totalSobraPrevMonth = useMemo(() => {
    let sum = 0;
    for (const val of sobrasPrevMap.values()) {
      sum += val;
    }
    return sum;
  }, [sobrasPrevMap]);

  // 4. Mapas do mês M (alocações e gastos)
  const monthMaps = useMemo(() => {
    return buildMonthMaps(
      selectedMonth,
      data.budget_allocations,
      data.allocation_movements,
      data.transactions
    );
  }, [selectedMonth, data.budget_allocations, data.allocation_movements, data.transactions]);

  // 5. Pronto para Atribuir no mês M
  const readyToAssign = useMemo(() => {
    return calculateReadyToAssign(
      selectedMonth,
      data.accounts,
      data.budget_allocations,
      data.transactions,
      data.allocation_movements,
      data.goals
    ).readyToAssign;
  }, [selectedMonth, data.accounts, data.budget_allocations, data.transactions, data.allocation_movements, data.goals]);

  // Função pura para cor da barra
  const getBarColorInfo = (
    planejado: number,
    alocado: number,
    gasto: number
  ): { barColorHex: string; isRed: boolean } => {
    if (planejado === 0 && alocado === 0 && gasto === 0) {
      return { barColorHex: '#9FA9AB', isRed: false };
    }
    if (gasto > alocado || (alocado === 0 && gasto > 0)) {
      return { barColorHex: isDark ? '#FF4D55' : '#EF4444', isRed: true };
    }
    if (gasto > planejado && planejado > 0) {
      return { barColorHex: isDark ? '#FF9F1C' : '#F59E0B', isRed: false };
    }
    return { barColorHex: isDark ? '#39D47A' : '#22A45D', isRed: false };
  };

  // 6. Processamento das Categorias e Subcategorias reais
  const calculatedCategories = useMemo(() => {
    const list: CalculatedCategory[] = [];

    for (const cat of data.categories) {
      const subsOfCat = data.subcategories.filter((s) => s.category_id === cat.id);

      // Subcategorias visíveis: NÃO arquivada OU alocação em M OU gasto em M
      const visibleSubsRaw = subsOfCat.filter((sub) => {
        const subKey = `${sub.category_id}:${sub.id}`;
        const hasAlloc = monthMaps.allocationInfo.has(subKey);
        const hasSpent = (monthMaps.spentInfo.get(subKey) || 0) > 0;
        return !sub.archived || hasAlloc || hasSpent;
      });

      // Checa visibilidade da Categoria
      const catKey = `${cat.id}:null`;
      const catHasDirectAlloc = monthMaps.allocationInfo.has(catKey);
      const catHasAnySubAlloc = subsOfCat.some((s) => monthMaps.allocationInfo.has(`${s.category_id}:${s.id}`));
      const catHasSpent = (monthMaps.spentInfo.get(catKey) || 0) > 0;
      const isCatVisible = !cat.archived || catHasDirectAlloc || catHasAnySubAlloc || catHasSpent;

      if (!isCatVisible) continue;

      // Calcular valores das subcategorias visíveis
      const visibleSubsCalculated: CalculatedSubcategory[] = visibleSubsRaw.map((sub) => {
        const subKey = `${sub.category_id}:${sub.id}`;
        const allocInfo = monthMaps.allocationInfo.get(subKey) || { planned: 0, allocated: 0 };
        const planejado = allocInfo.planned;
        const sobraM1 = sobrasPrevMap.get(subKey) || 0;
        const alocado = allocInfo.allocated + sobraM1;
        const gasto = monthMaps.spentInfo.get(subKey) || 0;
        const disponivel = alocado - gasto;
        const { barColorHex, isRed } = getBarColorInfo(planejado, alocado, gasto);
        const percent = alocado > 0 ? Math.trunc((gasto / alocado) * 100) : 0;

        return {
          sub,
          planejado,
          alocado,
          gasto,
          disponivel,
          barColorHex,
          isRed,
          percent,
        };
      });

      let catPlanejado = 0;
      let catAlocado = 0;
      let catGasto = 0;

      if (visibleSubsCalculated.length === 0) {
        // Categoria SEM subcategorias visíveis: usa chave (cat, null)
        const allocInfo = monthMaps.allocationInfo.get(catKey) || { planned: 0, allocated: 0 };
        const sobraM1 = sobrasPrevMap.get(catKey) || 0;
        catPlanejado = allocInfo.planned;
        catAlocado = allocInfo.allocated + sobraM1;
        catGasto = monthMaps.spentInfo.get(catKey) || 0;
      } else {
        // Categoria COM subcategorias visíveis: soma das subcategorias
        catPlanejado = visibleSubsCalculated.reduce((acc, s) => acc + s.planejado, 0);
        catAlocado = visibleSubsCalculated.reduce((acc, s) => acc + s.alocado, 0);
        catGasto = visibleSubsCalculated.reduce((acc, s) => acc + s.gasto, 0);
      }

      const catDisponivel = catAlocado - catGasto;
      const { barColorHex, isRed } = getBarColorInfo(catPlanejado, catAlocado, catGasto);
      const percent = catAlocado > 0 ? Math.trunc((catGasto / catAlocado) * 100) : 0;

      list.push({
        cat,
        hasSubcategories: subsOfCat.length > 0,
        visibleSubs: visibleSubsCalculated,
        planejado: catPlanejado,
        alocado: catAlocado,
        gasto: catGasto,
        disponivel: catDisponivel,
        barColorHex,
        isRed,
        percent,
      });
    }

    return list;
  }, [data.categories, data.subcategories, monthMaps, sobrasPrevMap, isDark]);

  // 7. Categoria virtual "Metas 🎯" (se houver pelo menos uma meta)
  const calculatedGoalsCategory = useMemo<CalculatedGoalsCategory | null>(() => {
    if (!data.goals || data.goals.length === 0) return null;

    const goalSubs: CalculatedGoalSub[] = data.goals.map((goal) => {
      const startM = (goal as any).start_date ? String((goal as any).start_date).slice(0, 7) : selectedMonth;
      const endM = goal.deadline ? String(goal.deadline).slice(0, 7) : selectedMonth;
      const nMeses = Math.max(1, getMonthsInRange(startM, endM).length);
      const alvo = Number(goal.target_value) || 0;

      let planejado = 0;
      if (selectedMonth < startM) {
        planejado = alvo / nMeses;
      } else if (selectedMonth > endM) {
        planejado = 0;
      } else {
        planejado = alvo / nMeses;
      }

      const alocado = data.allocation_movements.reduce((sum, m) => {
        const moveMonth = monthFromTimestamp(Number(m.moved_at) || 0);
        if (moveMonth !== selectedMonth) return sum;
        let delta = 0;
        if (m.dest_goal_id === goal.id) delta += Number(m.amount) || 0;
        if (m.source_goal_id === goal.id) delta -= Number(m.amount) || 0;
        return sum + delta;
      }, 0);

      return {
        goal,
        planejado,
        alocado,
      };
    });

    const totalPlanejado = goalSubs.reduce((acc, g) => acc + g.planejado, 0);
    const totalAlocado = goalSubs.reduce((acc, g) => acc + g.alocado, 0);

    return {
      isVirtualGoals: true,
      goals: goalSubs,
      planejado: totalPlanejado,
      alocado: totalAlocado,
    };
  }, [data.goals, data.allocation_movements, selectedMonth]);

  // 8. Opções para o Diálogo de Distribuir / Mover
  const envelopeOptions = useMemo<EnvelopeOption[]>(() => {
    const result: EnvelopeOption[] = [];
    for (const item of calculatedCategories) {
      if (item.hasSubcategories && item.visibleSubs.length > 0) {
        for (const subItem of item.visibleSubs) {
          result.push({
            key: `${item.cat.id}:${subItem.sub.id}`,
            categoryId: item.cat.id,
            subcategoryId: subItem.sub.id,
            categoryName: item.cat.name,
            subcategoryName: subItem.sub.name,
            label: `${item.cat.name} > ${subItem.sub.name}`,
            isSubcategory: true,
            sobraAcumulada: subItem.disponivel,
            archived: Boolean(subItem.sub.archived),
          });
        }
      } else {
        result.push({
          key: `${item.cat.id}:null`,
          categoryId: item.cat.id,
          subcategoryId: null,
          categoryName: item.cat.name,
          subcategoryName: null,
          label: item.cat.name,
          isSubcategory: false,
          sobraAcumulada: item.disponivel,
          archived: Boolean(item.cat.archived),
        });
      }
    }
    return result;
  }, [calculatedCategories]);

  const metaOptions = useMemo<MetaOption[]>(() => {
    if (!data.goals || data.goals.length === 0) return [];
    return data.goals.map((g) => {
      const saldo = calculateGoalCurrentValue(Number(g.id), data.allocation_movements || []);
      return {
        id: Number(g.id),
        name: g.name,
        saldo,
      };
    });
  }, [data.goals, data.allocation_movements]);

  // 9. Filtragem por busca e chips
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return calculatedCategories.filter((item) => {
      if (activeChip === 'ALERTAS') {
        const isAlert =
          item.planejado !== item.alocado ||
          (item.alocado > 0 && item.gasto / item.alocado >= 0.8 && item.gasto <= item.alocado);
        if (!isAlert) return false;
      } else if (activeChip === 'EXCEDIDAS') {
        const isExceeded = item.gasto > item.alocado || (item.alocado === 0 && item.gasto > 0);
        if (!isExceeded) return false;
      } else if (activeChip === 'DISPONIVEIS') {
        const isAvailable = item.alocado - item.gasto > 0;
        if (!isAvailable) return false;
      }

      if (q) {
        const catNameMatches = item.cat.name.toLowerCase().includes(q);
        const anySubMatches = item.visibleSubs.some((s) => s.sub.name.toLowerCase().includes(q));
        if (!catNameMatches && !anySubMatches) return false;
      }

      return true;
    });
  }, [calculatedCategories, activeChip, searchQuery]);

  // Se a categoria virtual "Metas" deve aparecer de acordo com os filtros
  const showVirtualGoals = useMemo(() => {
    if (!calculatedGoalsCategory) return false;

    if (activeChip === 'ALERTAS') {
      const isAlert = calculatedGoalsCategory.planejado !== calculatedGoalsCategory.alocado;
      if (!isAlert) return false;
    } else if (activeChip === 'EXCEDIDAS') {
      return false;
    } else if (activeChip === 'DISPONIVEIS') {
      if (calculatedGoalsCategory.alocado <= 0) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const nameMatches = 'metas'.includes(q);
      const anyGoalMatches = calculatedGoalsCategory.goals.some((g) =>
        g.goal.name.toLowerCase().includes(q)
      );
      if (!nameMatches && !anyGoalMatches) return false;
    }

    return true;
  }, [calculatedGoalsCategory, activeChip, searchQuery]);

  // Alternar expandir/recolher categoria
  const toggleExpand = (id: number | string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Alternar painel de ações (só um painel aberto por vez)
  const toggleActionPanel = (panelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveActionPanel((prev) => (prev === panelId ? null : panelId));
  };

  // 10. Handler de Ajustar Rápido (⚡) - Fase 5b
  const handleQuickAdjust = async (params: {
    categoryId?: number | null;
    subcategoryId?: number | null;
    goalId?: number | null;
    name: string;
    planejado: number;
    alocado: number;
  }) => {
    if (!user) return;
    const diff = params.planejado - params.alocado;
    if (Math.abs(diff) < 0.0001) {
      showNotice(`${params.name} já está ajustado(a) com o valor planejado.`);
      return;
    }

    try {
      const isGoal = params.goalId != null;
      const note = 'Ajuste rápido (⚡) - Igualar ao Planejado';

      await moveMoney(
        user.uid,
        {
          sourceCat: !isGoal && diff < 0 ? Number(params.categoryId) : null,
          sourceSub: !isGoal && diff < 0 ? (params.subcategoryId != null ? Number(params.subcategoryId) : null) : null,
          destCat: !isGoal && diff > 0 ? Number(params.categoryId) : null,
          destSub: !isGoal && diff > 0 ? (params.subcategoryId != null ? Number(params.subcategoryId) : null) : null,
          sourceGoalId: isGoal && diff < 0 ? Number(params.goalId) : null,
          destGoalId: isGoal && diff > 0 ? Number(params.goalId) : null,
          month: selectedMonth,
          amount: Math.abs(diff),
          note,
        },
        data.budget_allocations || [],
        data.allocation_movements || [],
        data
      );

      if (diff > 0) {
        showNotice(`Alocados ${formatCurrencyBRL(diff)} de Pronto para Atribuir para ${params.name}`);
      } else {
        showNotice(`Retornados ${formatCurrencyBRL(Math.abs(diff))} de ${params.name} para Pronto para Atribuir`);
      }
    } catch (err: any) {
      console.error('Erro no ajuste rápido:', err);
      showNotice(err?.message || 'Erro ao realizar ajuste rápido.');
    }
  };

  // Handler para criar nova categoria
  const handleCreateCategory = async () => {
    if (!user || !newCatName.trim()) return;
    try {
      setSavingNewCat(true);
      await createCategory(user.uid, newCatName.trim(), data.categories || []);
      showNotice(`Categoria "${newCatName.trim()}" criada com sucesso!`);
      setNewCatName('');
      setIsNewCategoryOpen(false);
    } catch (err: any) {
      console.error('Erro ao criar categoria:', err);
      showNotice(err?.message || 'Erro ao criar categoria.');
    } finally {
      setSavingNewCat(false);
    }
  };

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <div className="space-y-3.5 pb-10 animate-in fade-in duration-200">
      {/* Toast flutuante de aviso discreto */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#111827] dark:bg-[#1E292B] text-white dark:text-[#F5F7F8] text-xs font-semibold shadow-xl border border-gray-700/30 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <Sparkles className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cabeçalho padrão com seletor de mês compartilhado */}
      <StandardScreenHeader title="Planejamento" />

      {/* ========================================================================= */}
      {/* 1. CARD "PRONTO PARA ATRIBUIR"                                            */}
      {/* ========================================================================= */}
      <div
        id="card-ready-to-assign"
        className="rounded-[14px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-[10px_12px] shadow-2xs space-y-3 transition-colors"
      >
        {/* Duas colunas com divisor vertical */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          {/* Coluna 1: Pronto para atribuir */}
          <div className="space-y-0.5">
            <span className="block text-[11px] font-medium text-[#6B7280] dark:text-[#9FA9AB] leading-tight">
              Pronto para atribuir
            </span>
            <div
              id="value-ready-to-assign"
              className={`text-[20px] font-bold tracking-tight leading-none ${
                readyToAssign >= 0
                  ? 'text-[#22A45D] dark:text-[#39D47A]'
                  : 'text-[#EF4444] dark:text-[#FF4D55]'
              }`}
            >
              {maskValue(formatCurrencyBRL(readyToAssign))}
            </div>
          </div>

          {/* Divisor vertical */}
          <div className="w-px h-10 bg-[#E6E9EC] dark:border-[#283438] bg-[#E6E9EC] dark:bg-[#283438]" />

          {/* Coluna 2: Sobra do mês anterior */}
          <div className="space-y-0.5 pl-1">
            <span className="block text-[11px] font-medium text-[#6B7280] dark:text-[#9FA9AB] leading-tight">
              Sobra do mês anterior
            </span>
            <div
              id="value-leftover-prev-month"
              className={`text-[20px] font-bold tracking-tight leading-none ${
                totalSobraPrevMonth >= 0
                  ? 'text-[#22A45D] dark:text-[#39D47A]'
                  : 'text-[#EF4444] dark:text-[#FF4D55]'
              }`}
            >
              {maskValue(formatCurrencyBRL(totalSobraPrevMonth))}
            </div>
          </div>
        </div>

        {/* 3 Botões lado a lado (altura 34px, raio 10px, texto 11px) */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#E6E9EC] dark:border-[#283438]/60">
          <button
            id="btn-distribute-ready"
            type="button"
            onClick={() =>
              setDistributeModalState({
                isOpen: true,
                initialSource: { type: 'PRONTO' },
              })
            }
            className="h-[34px] rounded-[10px] bg-[#22A45D]/20 dark:bg-[#39D47A]/20 text-[#22A45D] dark:text-[#39D47A] text-[11px] font-semibold flex items-center justify-center hover:opacity-90 active:scale-98 transition-all cursor-pointer"
          >
            Distribuir
          </button>

          <button
            id="btn-new-category"
            type="button"
            onClick={() => setIsNewCategoryOpen(true)}
            className="h-[34px] rounded-[10px] border border-[#E6E9EC] dark:border-[#283438] text-[#111827] dark:text-[#F5F7F8] bg-transparent text-[11px] font-semibold flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-98 transition-all cursor-pointer"
          >
            Nova Categoria
          </button>

          <button
            id="btn-planning-report"
            type="button"
            onClick={() => showNotice('Relatório detalhado disponível na próxima etapa')}
            className="h-[34px] rounded-[10px] border border-[#E6E9EC] dark:border-[#283438] text-[#111827] dark:text-[#F5F7F8] bg-transparent text-[11px] font-semibold flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-98 transition-all cursor-pointer"
          >
            Relatório
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. BUSCA E FILTROS                                                        */}
      {/* ========================================================================= */}
      <div className="space-y-2">
        {/* Campo de Busca */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6B7280] dark:text-[#9FA9AB]">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="input-search-planning"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar categoria ou subcategoria"
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#111827] dark:text-[#F5F7F8] placeholder-[#9CA3AF] dark:placeholder-[#6B7280] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#6B7280] dark:text-[#9FA9AB] hover:text-[#111827] dark:hover:text-[#F5F7F8] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 4 Chips distribuídos igualmente na largura */}
        <div className="grid grid-cols-4 gap-1.5">
          {(
            [
              { id: 'TODAS', label: 'Todas' },
              { id: 'ALERTAS', label: 'Alertas' },
              { id: 'EXCEDIDAS', label: 'Excedidas' },
              { id: 'DISPONIVEIS', label: 'Disponíveis' },
            ] as const
          ).map((chip) => {
            const isActive = activeChip === chip.id;
            return (
              <button
                key={chip.id}
                id={`chip-filter-${chip.id.toLowerCase()}`}
                type="button"
                onClick={() => setActiveChip(chip.id)}
                className={`py-1.5 px-1 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] shadow-2xs'
                    : 'bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#6B7280] dark:text-[#9FA9AB] hover:text-[#111827] dark:hover:text-[#F5F7F8]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. LISTA DE CATEGORIAS / ESTADO CARREGANDO / LISTA VAZIA                 */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="space-y-2 pt-1 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-[14px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800" />
                  <div className="w-24 h-4 rounded-md bg-gray-200 dark:bg-gray-800" />
                </div>
                <div className="w-20 h-4 rounded-md bg-gray-200 dark:bg-gray-800" />
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      ) : filteredCategories.length === 0 && !showVirtualGoals ? (
        <div
          id="planning-empty-state"
          className="rounded-[14px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-8 text-center space-y-2 mt-2"
        >
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800/60 text-[#6B7280] dark:text-[#9FA9AB] flex items-center justify-center mx-auto mb-2">
            <Folder className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-[#111827] dark:text-[#F5F7F8]">
            {data.categories.length === 0
              ? 'Nenhuma categoria cadastrada'
              : 'Nenhuma categoria encontrada'}
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#9FA9AB] max-w-xs mx-auto">
            {data.categories.length === 0
              ? 'Crie categorias para organizar o seu orçamento mensal por envelopes.'
              : 'Tente ajustar os termos da busca ou mudar o filtro selecionado.'}
          </p>
        </div>
      ) : (
        <div id="planning-categories-list" className="space-y-1.5">
          {filteredCategories.map((item) => {
            const isExpanded = isSearchActive || expandedCategories.has(item.cat.id);
            const rawQuery = searchQuery.trim().toLowerCase();
            const hasVisibleSubs = item.visibleSubs.length > 0;
            const catActionPanelKey = `cat-${item.cat.id}`;
            const isCatActionPanelOpen = !hasVisibleSubs && activeActionPanel === catActionPanelKey;

            // Filtragem de subcategorias com busca ativa
            const displayedSubs = rawQuery
              ? item.visibleSubs.filter(
                  (s) =>
                    s.sub.name.toLowerCase().includes(rawQuery) ||
                    item.cat.name.toLowerCase().includes(rawQuery)
                )
              : item.visibleSubs;

            return (
              <div
                key={item.cat.id}
                id={`card-planning-category-${item.cat.id}`}
                className="rounded-[14px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-2.5 transition-colors shadow-2xs"
              >
                {/* Linha 1: Ícone + Nome + Disponibilidade + Seta */}
                <div
                  onClick={(e) => {
                    if (hasVisibleSubs) {
                      toggleExpand(item.cat.id);
                    } else {
                      toggleActionPanel(catActionPanelKey, e);
                    }
                  }}
                  className="flex items-center justify-between gap-2.5 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 transition-colors ${
                        item.isRed
                          ? 'bg-[#EF4444]/15 dark:bg-[#FF4D55]/15 text-[#EF4444] dark:text-[#FF4D55]'
                          : 'bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A]'
                      }`}
                    >
                      {item.cat.icon || '📁'}
                    </div>

                    <span className="text-[15px] font-semibold text-[#111827] dark:text-[#F5F7F8] truncate">
                      {item.cat.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-semibold ${
                        item.disponivel >= 0
                          ? 'text-[#22A45D] dark:text-[#39D47A]'
                          : 'text-[#EF4444] dark:text-[#FF4D55]'
                      }`}
                    >
                      {item.disponivel >= 0
                        ? `${maskValue(formatCurrencyBRL(item.disponivel))} disponíveis`
                        : `${maskValue(formatCurrencyBRL(Math.abs(item.disponivel)))} acima`}
                    </span>

                    {hasVisibleSubs && (
                      <ChevronDown
                        className={`w-4 h-4 text-[#6B7280] dark:text-[#9FA9AB] transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : 'rotate-0'
                        }`}
                      />
                    )}
                  </div>
                </div>

                {/* Linha 2: Três colunas "Planejado | Alocado | Gasto" e percentual à direita */}
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div className="flex items-center gap-4 text-left">
                    <div>
                      <span className="block text-[10px] text-[#6B7280] dark:text-[#9FA9AB] font-normal leading-none">
                        Planejado
                      </span>
                      <span className="text-[12px] font-semibold text-[#111827] dark:text-[#F5F7F8] mt-0.5 block leading-tight">
                        {maskValue(formatCurrencyBRL(item.planejado))}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] text-[#6B7280] dark:text-[#9FA9AB] font-normal leading-none">
                        Alocado
                      </span>
                      <span className="text-[12px] font-semibold text-[#111827] dark:text-[#F5F7F8] mt-0.5 block leading-tight">
                        {maskValue(formatCurrencyBRL(item.alocado))}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] text-[#6B7280] dark:text-[#9FA9AB] font-normal leading-none">
                        Gasto
                      </span>
                      <span className="text-[12px] font-semibold text-[#111827] dark:text-[#F5F7F8] mt-0.5 block leading-tight">
                        {maskValue(formatCurrencyBRL(item.gasto))}
                      </span>
                    </div>
                  </div>

                  <span
                    className="text-[11.5px] font-bold tracking-tight shrink-0"
                    style={{ color: item.barColorHex }}
                  >
                    {item.percent}%
                  </span>
                </div>

                {/* Linha 3: Barra de 5px, raio 3px, largura total */}
                <div className="mt-1.5 w-full h-[5px] rounded-[3px] bg-[#EAEAEA] dark:bg-[#202B2E] overflow-hidden">
                  <div
                    className="h-full rounded-[3px] transition-all duration-300"
                    style={{
                      width: `${item.alocado > 0 ? Math.min(100, Math.max(0, (item.gasto / item.alocado) * 100)) : 0}%`,
                      backgroundColor: item.barColorHex,
                    }}
                  />
                </div>

                {/* ========================================================= */}
                {/* PAINEL DE AÇÕES PARA CATEGORIA SEM SUBCATEGORIAS (Fase 5b) */}
                {/* ========================================================= */}
                {isCatActionPanelOpen && (
                  <div className="mt-2.5 pt-2 border-t border-[#E6E9EC]/70 dark:border-[#283438]/70 animate-in fade-in duration-150">
                    <div className="grid grid-cols-5 gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          setPlanModalState({
                            isOpen: true,
                            categoryId: item.cat.id,
                            subcategoryId: null,
                            categoryName: item.cat.name,
                            subcategoryName: null,
                            currentPlannedValue: item.planejado,
                          })
                        }
                        className="py-1.5 px-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-center font-semibold cursor-pointer truncate"
                      >
                        Planejar
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const allocInM = monthMaps.allocationInfo.get(`${item.cat.id}:null`);
                          const alocadoDoMesSemSobra = allocInM ? allocInM.allocated : 0;
                          setAllocateModalState({
                            isOpen: true,
                            categoryId: item.cat.id,
                            subcategoryId: null,
                            goalId: null,
                            titlePath: item.cat.name,
                            planejadoDoMes: item.planejado,
                            alocadoDoMesSemSobra,
                          });
                        }}
                        className="py-1.5 px-1 rounded-lg bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] hover:opacity-90 text-center font-semibold cursor-pointer truncate"
                      >
                        Alocar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDistributeModalState({
                            isOpen: true,
                            initialSource: {
                              type: 'ENVELOPE',
                              categoryId: item.cat.id,
                              subcategoryId: null,
                            },
                          })
                        }
                        className="py-1.5 px-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-center font-semibold cursor-pointer truncate"
                      >
                        Mover
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setTxModalState({
                            isOpen: true,
                            categoryId: item.cat.id,
                            subcategoryId: null,
                          })
                        }
                        className="py-1.5 px-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-center font-semibold cursor-pointer truncate"
                      >
                        + Transação
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleQuickAdjust({
                            categoryId: item.cat.id,
                            subcategoryId: null,
                            name: item.cat.name,
                            planejado: item.planejado,
                            alocado: item.alocado,
                          })
                        }
                        className="py-1.5 px-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:opacity-90 text-center font-semibold cursor-pointer truncate"
                      >
                        Ajustar (⚡)
                      </button>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* SUBCATEGORIAS (quando expandida)                         */}
                {/* ========================================================= */}
                {isExpanded && hasVisibleSubs && (
                  <div className="mt-3 pt-2.5 border-t border-[#E6E9EC]/70 dark:border-[#283438]/70">
                    {displayedSubs.length === 0 ? (
                      <div className="py-2 text-center text-xs text-[#6B7280] dark:text-[#9FA9AB]">
                        Nenhuma subcategoria.
                      </div>
                    ) : (
                      <div className="relative pl-4 space-y-3">
                        <div className="absolute left-[7px] top-1 bottom-4 w-px border-l border-dashed border-[#E6E9EC] dark:border-[#283438]" />

                        {displayedSubs.map((subItem) => {
                          const subActionPanelKey = `sub-${subItem.sub.id}`;
                          const isSubActionPanelOpen = activeActionPanel === subActionPanelKey;

                          return (
                            <div
                              key={subItem.sub.id}
                              id={`subcat-item-${subItem.sub.id}`}
                              className="relative pl-4 space-y-1"
                            >
                              <div className="absolute left-[-9px] top-3.5 w-3 h-px border-b border-dashed border-[#E6E9EC] dark:border-[#283438]" />

                              {/* Tocar na subcategoria abre/fecha o painel de ações */}
                              <div
                                onClick={(e) => toggleActionPanel(subActionPanelKey, e)}
                                className="cursor-pointer select-none rounded-lg hover:bg-black/5 dark:hover:bg-white/5 p-1 -m-1 transition-colors"
                              >
                                {/* Sub Linha 1: Ícone + Nome + Disponível */}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className={`w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 ${
                                        subItem.isRed
                                          ? 'bg-[#EF4444]/15 dark:bg-[#FF4D55]/15 text-[#EF4444] dark:text-[#FF4D55]'
                                          : 'bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A]'
                                      }`}
                                    >
                                      {subItem.sub.icon || '📄'}
                                    </div>
                                    <span className="text-[13px] font-medium text-[#111827] dark:text-[#F5F7F8] truncate">
                                      {subItem.sub.name}
                                    </span>
                                  </div>

                                  <span
                                    className={`text-[11.5px] font-semibold shrink-0 ${
                                      subItem.disponivel >= 0
                                        ? 'text-[#22A45D] dark:text-[#39D47A]'
                                        : 'text-[#EF4444] dark:text-[#FF4D55]'
                                    }`}
                                  >
                                    {subItem.disponivel >= 0
                                      ? `${maskValue(formatCurrencyBRL(subItem.disponivel))} disponíveis`
                                      : `${maskValue(formatCurrencyBRL(Math.abs(subItem.disponivel)))} acima`}
                                  </span>
                                </div>

                                {/* Sub Linha 2: Planejado | Alocado | Gasto e percentual */}
                                <div className="flex items-end justify-between gap-2 pl-8">
                                  <div className="flex items-center gap-3.5 text-left">
                                    <div>
                                      <span className="block text-[9.5px] text-[#6B7280] dark:text-[#9FA9AB] leading-none">
                                        Planejado
                                      </span>
                                      <span className="text-[11px] font-semibold text-[#111827] dark:text-[#F5F7F8] mt-0.5 block leading-tight">
                                        {maskValue(formatCurrencyBRL(subItem.planejado))}
                                      </span>
                                    </div>

                                    <div>
                                      <span className="block text-[9.5px] text-[#6B7280] dark:text-[#9FA9AB] leading-none">
                                        Alocado
                                      </span>
                                      <span className="text-[11px] font-semibold text-[#111827] dark:text-[#F5F7F8] mt-0.5 block leading-tight">
                                        {maskValue(formatCurrencyBRL(subItem.alocado))}
                                      </span>
                                    </div>

                                    <div>
                                      <span className="block text-[9.5px] text-[#6B7280] dark:text-[#9FA9AB] leading-none">
                                        Gasto
                                      </span>
                                      <span className="text-[11px] font-semibold text-[#111827] dark:text-[#F5F7F8] mt-0.5 block leading-tight">
                                        {maskValue(formatCurrencyBRL(subItem.gasto))}
                                      </span>
                                    </div>
                                  </div>

                                  <span
                                    className="text-[10.5px] font-bold tracking-tight"
                                    style={{ color: subItem.barColorHex }}
                                  >
                                    {subItem.percent}%
                                  </span>
                                </div>

                                {/* Sub Linha 3: Barra de 5px */}
                                <div className="pl-8 pt-0.5">
                                  <div className="w-full h-[5px] rounded-[3px] bg-[#EAEAEA] dark:bg-[#202B2E] overflow-hidden">
                                    <div
                                      className="h-full rounded-[3px] transition-all duration-300"
                                      style={{
                                        width: `${subItem.alocado > 0 ? Math.min(100, Math.max(0, (subItem.gasto / subItem.alocado) * 100)) : 0}%`,
                                        backgroundColor: subItem.barColorHex,
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* ========================================================= */}
                              {/* PAINEL DE AÇÕES DA SUBCATEGORIA (5 BOTÕES) - Fase 5b       */}
                              {/* ========================================================= */}
                              {isSubActionPanelOpen && (
                                <div className="pl-8 pt-1.5 animate-in fade-in duration-150">
                                  <div className="grid grid-cols-5 gap-1 text-[11px] p-1.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438]">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPlanModalState({
                                          isOpen: true,
                                          categoryId: item.cat.id,
                                          subcategoryId: subItem.sub.id,
                                          categoryName: item.cat.name,
                                          subcategoryName: subItem.sub.name,
                                          currentPlannedValue: subItem.planejado,
                                        })
                                      }
                                      className="py-1.5 px-0.5 rounded-lg bg-white dark:bg-[#172022] hover:bg-black/5 dark:hover:bg-white/5 border border-[#E6E9EC] dark:border-[#283438] text-center font-semibold cursor-pointer truncate"
                                    >
                                      Planejar
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const allocInM = monthMaps.allocationInfo.get(
                                          `${item.cat.id}:${subItem.sub.id}`
                                        );
                                        const alocadoDoMesSemSobra = allocInM ? allocInM.allocated : 0;
                                        setAllocateModalState({
                                          isOpen: true,
                                          categoryId: item.cat.id,
                                          subcategoryId: subItem.sub.id,
                                          goalId: null,
                                          titlePath: `${item.cat.name} > ${subItem.sub.name}`,
                                          planejadoDoMes: subItem.planejado,
                                          alocadoDoMesSemSobra,
                                        });
                                      }}
                                      className="py-1.5 px-0.5 rounded-lg bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] hover:opacity-90 text-center font-semibold cursor-pointer truncate"
                                    >
                                      Alocar
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDistributeModalState({
                                          isOpen: true,
                                          initialSource: {
                                            type: 'ENVELOPE',
                                            categoryId: item.cat.id,
                                            subcategoryId: subItem.sub.id,
                                          },
                                        })
                                      }
                                      className="py-1.5 px-0.5 rounded-lg bg-white dark:bg-[#172022] hover:bg-black/5 dark:hover:bg-white/5 border border-[#E6E9EC] dark:border-[#283438] text-center font-semibold cursor-pointer truncate"
                                    >
                                      Mover
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setTxModalState({
                                          isOpen: true,
                                          categoryId: item.cat.id,
                                          subcategoryId: subItem.sub.id,
                                        })
                                      }
                                      className="py-1.5 px-0.5 rounded-lg bg-white dark:bg-[#172022] hover:bg-black/5 dark:hover:bg-white/5 border border-[#E6E9EC] dark:border-[#283438] text-center font-semibold cursor-pointer truncate"
                                    >
                                      + Transação
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleQuickAdjust({
                                          categoryId: item.cat.id,
                                          subcategoryId: subItem.sub.id,
                                          name: subItem.sub.name,
                                          planejado: subItem.planejado,
                                          alocado: subItem.alocado,
                                        })
                                      }
                                      className="py-1.5 px-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:opacity-90 text-center font-semibold cursor-pointer truncate"
                                    >
                                      Ajustar (⚡)
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* ========================================================================= */}
          {/* 5. LINHA ESPECIAL "METAS 🎯"                                              */}
          {/* ========================================================================= */}
          {showVirtualGoals && calculatedGoalsCategory && (
            <div
              id="card-planning-category-virtual-goals"
              className="rounded-[14px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-2.5 transition-colors shadow-2xs"
            >
              {/* Linha 1: Ícone 🎯 + Nome "Metas" + Acumulados + Seta */}
              <div
                onClick={() => toggleExpand('virtual_goals')}
                className="flex items-center justify-between gap-2.5 cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center text-sm shrink-0">
                    🎯
                  </div>

                  <span className="text-[15px] font-semibold text-[#111827] dark:text-[#F5F7F8] truncate">
                    Metas
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-[#22A45D] dark:text-[#39D47A]">
                    {maskValue(formatCurrencyBRL(calculatedGoalsCategory.alocado))} acumulados
                  </span>

                  <ChevronDown
                    className={`w-4 h-4 text-[#6B7280] dark:text-[#9FA9AB] transition-transform duration-200 ${
                      isSearchActive || expandedCategories.has('virtual_goals')
                        ? 'rotate-180'
                        : 'rotate-0'
                    }`}
                  />
                </div>
              </div>

              {/* Linha 2: Planejado | Alocado no mês (sem coluna Gasto, sem percentual e sem barra) */}
              <div className="mt-2 flex items-center gap-4 text-left">
                <div>
                  <span className="block text-[10px] text-[#6B7280] dark:text-[#9FA9AB] font-normal leading-none">
                    Planejado
                  </span>
                  <span className="text-[12px] font-semibold text-[#111827] dark:text-[#F5F7F8] mt-0.5 block leading-tight">
                    {maskValue(formatCurrencyBRL(calculatedGoalsCategory.planejado))}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-[#6B7280] dark:text-[#9FA9AB] font-normal leading-none">
                    Alocado no mês
                  </span>
                  <span className="text-[12px] font-semibold text-[#111827] dark:text-[#F5F7F8] mt-0.5 block leading-tight">
                    {maskValue(formatCurrencyBRL(calculatedGoalsCategory.alocado))}
                  </span>
                </div>
              </div>

              {/* Lista de Metas Individuais (quando expandida) */}
              {(isSearchActive || expandedCategories.has('virtual_goals')) && (
                <div className="mt-3 pt-2.5 border-t border-[#E6E9EC]/70 dark:border-[#283438]/70 relative pl-4 space-y-3">
                  <div className="absolute left-[7px] top-1 bottom-4 w-px border-l border-dashed border-[#E6E9EC] dark:border-[#283438]" />

                  {calculatedGoalsCategory.goals.map((g) => {
                    const goalActionPanelKey = `goal-${g.goal.id}`;
                    const isGoalActionPanelOpen = activeActionPanel === goalActionPanelKey;

                    return (
                      <div
                        key={g.goal.id}
                        id={`virtual-goal-item-${g.goal.id}`}
                        className="relative pl-4 space-y-1"
                      >
                        <div className="absolute left-[-9px] top-3.5 w-3 h-px border-b border-dashed border-[#E6E9EC] dark:border-[#283438]" />

                        {/* Tocar na meta abre/fecha o painel de ações */}
                        <div
                          onClick={(e) => toggleActionPanel(goalActionPanelKey, e)}
                          className="cursor-pointer select-none rounded-lg hover:bg-black/5 dark:hover:bg-white/5 p-1 -m-1 transition-colors"
                        >
                          {/* Meta Linha 1 */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-md bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center text-xs shrink-0">
                                🎯
                              </div>
                              <span className="text-[13px] font-medium text-[#111827] dark:text-[#F5F7F8] truncate">
                                {g.goal.name}
                              </span>
                            </div>

                            <span className="text-[11.5px] font-semibold text-[#22A45D] dark:text-[#39D47A] shrink-0">
                              {maskValue(formatCurrencyBRL(g.alocado))}
                            </span>
                          </div>

                          {/* Meta Linha 2: Planejado | Alocado */}
                          <div className="flex items-center gap-4 pl-8">
                            <div>
                              <span className="block text-[9.5px] text-[#6B7280] dark:text-[#9FA9AB] leading-none">
                                Planejado
                              </span>
                              <span className="text-[11px] font-semibold text-[#111827] dark:text-[#F5F7F8] mt-0.5 block leading-tight">
                                {maskValue(formatCurrencyBRL(g.planejado))}
                              </span>
                            </div>

                            <div>
                              <span className="block text-[9.5px] text-[#6B7280] dark:text-[#9FA9AB] leading-none">
                                Alocado no mês
                              </span>
                              <span className="text-[11px] font-semibold text-[#111827] dark:text-[#F5F7F8] mt-0.5 block leading-tight">
                                {maskValue(formatCurrencyBRL(g.alocado))}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ========================================================= */}
                        {/* PAINEL DE AÇÕES DA META (3 BOTÕES) - Fase 5b              */}
                        {/* ========================================================= */}
                        {isGoalActionPanelOpen && (
                          <div className="pl-8 pt-1.5 animate-in fade-in duration-150">
                            <div className="grid grid-cols-3 gap-1.5 text-[11px] p-1.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438]">
                              <button
                                type="button"
                                onClick={() =>
                                  setAllocateModalState({
                                    isOpen: true,
                                    categoryId: null,
                                    subcategoryId: null,
                                    goalId: g.goal.id,
                                    titlePath: g.goal.name,
                                    planejadoDoMes: g.planejado,
                                    alocadoDoMesSemSobra: g.alocado,
                                  })
                                }
                                className="py-1.5 px-1 rounded-lg bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] hover:opacity-90 text-center font-semibold cursor-pointer truncate"
                              >
                                Alocar (Aportar)
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setDistributeModalState({
                                    isOpen: true,
                                    initialSource: {
                                      type: 'META',
                                      goalId: g.goal.id,
                                    },
                                  })
                                }
                                className="py-1.5 px-1 rounded-lg bg-white dark:bg-[#172022] hover:bg-black/5 dark:hover:bg-white/5 border border-[#E6E9EC] dark:border-[#283438] text-center font-semibold cursor-pointer truncate"
                              >
                                Mover (Retirar)
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleQuickAdjust({
                                    goalId: g.goal.id,
                                    name: g.goal.name,
                                    planejado: g.planejado,
                                    alocado: g.alocado,
                                  })
                                }
                                className="py-1.5 px-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:opacity-90 text-center font-semibold cursor-pointer truncate"
                              >
                                Ajustar (⚡)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIÁLOGOS DE AÇÕES DO PLANEJAMENTO (Fase 5b)                               */}
      {/* ========================================================================= */}

      {/* 1. Modal Planejar */}
      {planModalState && (
        <PlanModal
          isOpen={planModalState.isOpen}
          onClose={() => setPlanModalState(null)}
          categoryId={planModalState.categoryId}
          subcategoryId={planModalState.subcategoryId}
          categoryName={planModalState.categoryName}
          subcategoryName={planModalState.subcategoryName}
          month={selectedMonth}
          currentPlannedValue={planModalState.currentPlannedValue}
          onSuccess={showNotice}
        />
      )}

      {/* 2. Modal Alocar */}
      {allocateModalState && (
        <AllocateModal
          isOpen={allocateModalState.isOpen}
          onClose={() => setAllocateModalState(null)}
          categoryId={allocateModalState.categoryId}
          subcategoryId={allocateModalState.subcategoryId}
          goalId={allocateModalState.goalId}
          titlePath={allocateModalState.titlePath}
          month={selectedMonth}
          readyToAssign={readyToAssign}
          planejadoDoMes={allocateModalState.planejadoDoMes}
          alocadoDoMesSemSobra={allocateModalState.alocadoDoMesSemSobra}
          onSuccess={showNotice}
        />
      )}

      {/* 3. Modal Distribuir / Mover */}
      {distributeModalState.isOpen && (
        <DistributeModal
          isOpen={distributeModalState.isOpen}
          onClose={() => setDistributeModalState({ isOpen: false })}
          month={selectedMonth}
          readyToAssign={readyToAssign}
          envelopeOptions={envelopeOptions}
          metaOptions={metaOptions}
          initialSource={distributeModalState.initialSource}
          onSuccess={showNotice}
        />
      )}

      {/* 4. Modal de Nova Transação com categoria/subcategoria pré-selecionada */}
      {txModalState.isOpen && (
        <TransactionFormModal
          isOpen={txModalState.isOpen}
          onClose={() => setTxModalState({ isOpen: false })}
          initialCategoryId={txModalState.categoryId}
          initialSubcategoryId={txModalState.subcategoryId}
        />
      )}

      {/* 5. Modal Simples de Criação de Categoria */}
      {isNewCategoryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-5 shadow-2xl space-y-4 text-[#111827] dark:text-[#F5F7F8]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E6E9EC] dark:border-[#283438] pb-3">
              <h3 className="text-base font-bold">Nova Categoria</h3>
              <button
                type="button"
                onClick={() => setIsNewCategoryOpen(false)}
                className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
                Nome da Categoria
              </label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Ex: Assinaturas e Serviços"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
              <button
                type="button"
                onClick={() => setIsNewCategoryOpen(false)}
                disabled={savingNewCat}
                className="px-4 py-2 rounded-xl border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={savingNewCat || !newCatName.trim()}
                className="px-4 py-2 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingNewCat ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Criando...</span>
                  </>
                ) : (
                  <span>Criar Categoria</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
