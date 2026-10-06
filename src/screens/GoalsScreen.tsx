import React, { useState, useMemo, useEffect } from 'react';
import {
  Scale,
  Target,
  Plus,
  ArrowLeft,
  Pause,
  Play,
  Archive,
  ArchiveRestore,
  Pencil,
  Trash2,
  ChevronDown,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { StandardScreenHeader } from '../components/common/StandardScreenHeader';
import {
  calculateReadyToAssign,
  calculateGoalCurrentValue,
  formatCurrencyBRL,
  monthFromTimestamp,
  generateUniqueNumericId,
  collectAllExistingNumericIds,
} from '../lib/financeLogic';
import {
  saveGoals,
  saveAllocationMovementsOnly,
} from '../firebase/firestore';
import {
  Goal,
  Category,
  Subcategory,
  BudgetAllocation,
  AllocationMovement,
} from '../types/finance';
import {
  DistributeModal,
  EnvelopeOption,
  MetaOption,
  EntityType,
} from '../components/planning/DistributeModal';
import { GoalFormModal } from '../components/goals/GoalFormModal';
import { EditMovementModal } from '../components/goals/EditMovementModal';

type FilterChip = 'TODAS' | 'EM_ANDAMENTO' | 'CONCLUIDAS' | 'PAUSADAS';

export type GoalStatus = 'CONCLUIDA' | 'PAUSADA' | 'ATRASADA' | 'NO_PRAZO';

interface GoalStatusInfo {
  status: GoalStatus;
  label: string;
  colorHex: string;
  isRed: boolean;
}

const SHORT_MONTHS_PT = [
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

const FULL_MONTHS_PT = [
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
 * Converte inteiro ARGB com sinal (formato Android, ex.: -13840847) para CSS RGBA / HEX
 */
function argbToRgb(argb?: number): { r: number; g: number; b: number; a: number; hex: string } {
  if (argb == null || isNaN(argb)) {
    return { r: 34, g: 164, b: 93, a: 1, hex: '#22A45D' };
  }
  const u = argb >>> 0;
  const a = ((u >>> 24) & 0xff) / 255;
  const r = (u >>> 16) & 0xff;
  const g = (u >>> 8) & 0xff;
  const b = u & 0xff;
  const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  return { r, g, b, a, hex };
}

/**
 * Mapeia o emoji da meta com base em palavras-chave no nome em minúsculas
 */
function getGoalEmoji(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('viagem') || n.includes('viajar') || n.includes('ferias') || n.includes('férias')) return '✈️';
  if (n.includes('reserva') || n.includes('emergencia') || n.includes('emergência') || n.includes('seguranca') || n.includes('segurança')) return '🛡️';
  if (n.includes('notebook') || n.includes('computador') || n.includes('pc') || n.includes('tech') || n.includes('laptop')) return '💻';
  if (n.includes('curso') || n.includes('estudo') || n.includes('faculdade') || n.includes('escola')) return '🎓';
  if (n.includes('carro') || n.includes('moto') || n.includes('veiculo') || n.includes('veículo')) return '🚗';
  if (n.includes('casa') || n.includes('ap') || n.includes('imovel') || n.includes('imóvel') || n.includes('reforma')) return '🏠';
  if (n.includes('compras') || n.includes('shopping')) return '🛍️';
  return '🎯';
}

/**
 * Formata deadline em "Mmm aaaa" (ex: "Dez 2026")
 */
function formatDeadlineShort(deadline?: string | null): string | null {
  if (!deadline) return null;
  const parts = deadline.split('-');
  if (parts.length < 2) return null;
  const year = parts[0];
  const mIdx = parseInt(parts[1], 10) - 1;
  if (isNaN(mIdx) || mIdx < 0 || mIdx > 11) return null;
  return `${SHORT_MONTHS_PT[mIdx]} ${year}`;
}

/**
 * Formata deadline com mês por extenso (ex: "Dezembro 2026")
 */
function formatDeadlineFull(deadline?: string | null): string {
  if (!deadline) return 'Sem prazo';
  const parts = deadline.split('-');
  if (parts.length < 2) return 'Sem prazo';
  const year = parts[0];
  const mIdx = parseInt(parts[1], 10) - 1;
  if (isNaN(mIdx) || mIdx < 0 || mIdx > 11) return 'Sem prazo';
  return `${FULL_MONTHS_PT[mIdx]} ${year}`;
}

/**
 * Formata timestamp em "dd/MM/aaaa"
 */
function formatMovementDate(ms: number | string): string {
  const d = new Date(Number(ms));
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Status com prioridade exata:
 * 1. saldo >= alvo -> "Concluída" (verde)
 * 2. is_paused -> "Pausada" (cinza)
 * 3. mês do deadline < mês selecionado -> "Atrasada" (VERMELHO)
 * 4. senão -> "No prazo" (verde)
 * NUNCA azul.
 */
function getGoalStatus(
  goal: Goal,
  saldo: number,
  selectedMonth: string
): GoalStatusInfo {
  const alvo = Number(goal.target_value) || 0;

  if (saldo >= alvo && alvo > 0) {
    return {
      status: 'CONCLUIDA',
      label: 'Concluída',
      colorHex: '#22A45D',
      isRed: false,
    };
  }

  if (goal.is_paused) {
    return {
      status: 'PAUSADA',
      label: 'Pausada',
      colorHex: '#6B7280',
      isRed: false,
    };
  }

  const deadlineMonth = goal.deadline ? String(goal.deadline).slice(0, 7) : null;
  if (deadlineMonth && deadlineMonth < selectedMonth) {
    return {
      status: 'ATRASADA',
      label: 'Atrasada',
      colorHex: '#EF4444',
      isRed: true,
    };
  }

  return {
    status: 'NO_PRAZO',
    label: 'No prazo',
    colorHex: '#22A45D',
    isRed: false,
  };
}

/**
 * Resolve o nome de exibição de origem ou destino de um AllocationMovement
 */
function resolveEntityLabel(
  allocId: number | null | undefined,
  goalId: number | null | undefined,
  allocMap: Map<number, BudgetAllocation>,
  catMap: Map<number, Category>,
  subcatMap: Map<number, Subcategory>,
  goalMap: Map<number, Goal>
): string {
  if (goalId != null) {
    const g = goalMap.get(Number(goalId));
    return g ? g.name : 'Meta';
  }
  if (allocId == null) {
    return 'Pronto para Atribuir';
  }
  const alloc = allocMap.get(Number(allocId));
  if (!alloc) {
    return 'Envelope';
  }
  const cat = catMap.get(Number(alloc.category_id));
  const catName = cat ? cat.name : 'Envelope';
  if (alloc.subcategory_id != null) {
    const sub = subcatMap.get(Number(alloc.subcategory_id));
    const subName = sub ? sub.name : 'Subcategoria';
    return `${catName} > ${subName}`;
  }
  return catName;
}

export const GoalsScreen: React.FC = () => {
  const { user } = useAuth();
  const { data, loading, selectedMonth, hideValues } = useFinance();

  const [activeChip, setActiveChip] = useState<FilterChip>('TODAS');
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [celebratedGoalId, setCelebratedGoalId] = useState<number | null>(null);

  // Modais de Criação e Edição de Meta (Fase 6b)
  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isDeleteGoalModalOpen, setIsDeleteGoalModalOpen] = useState(false);

  // Modais de Edição e Exclusão de Movimentação (Fase 6b)
  const [movementToEdit, setMovementToEdit] = useState<AllocationMovement | null>(null);
  const [movementToDelete, setMovementToDelete] = useState<AllocationMovement | null>(null);

  // Estado do DistributeModal reaproveitado do Planejamento
  const [distributeModalState, setDistributeModalState] = useState<{
    isOpen: boolean;
    initialSource?: {
      type: EntityType;
      categoryId?: number | null;
      subcategoryId?: number | null;
      goalId?: number | null;
    };
    initialDest?: {
      type: EntityType;
      categoryId?: number | null;
      subcategoryId?: number | null;
      goalId?: number | null;
    };
  }>({ isOpen: false });

  const maskValue = (formattedText: string): string => {
    if (hideValues) return '••••••';
    return formattedText;
  };

  const showNotice = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // 1. Pronto para Atribuir no mês selecionado
  const readyToAssign = useMemo(() => {
    return calculateReadyToAssign(
      selectedMonth,
      data.accounts || [],
      data.budget_allocations || [],
      data.transactions || [],
      data.allocation_movements || [],
      data.goals || []
    );
  }, [
    selectedMonth,
    data.accounts,
    data.budget_allocations,
    data.transactions,
    data.allocation_movements,
    data.goals,
  ]);

  // 2. Mapas O(1) para lookups rápidos
  const allocMap = useMemo(() => {
    const map = new Map<number, BudgetAllocation>();
    (data.budget_allocations || []).forEach((b) => map.set(Number(b.id), b));
    return map;
  }, [data.budget_allocations]);

  const catMap = useMemo(() => {
    const map = new Map<number, Category>();
    (data.categories || []).forEach((c) => map.set(Number(c.id), c));
    return map;
  }, [data.categories]);

  const subcatMap = useMemo(() => {
    const map = new Map<number, Subcategory>();
    (data.subcategories || []).forEach((s) => map.set(Number(s.id), s));
    return map;
  }, [data.subcategories]);

  const goalMap = useMemo(() => {
    const map = new Map<number, Goal>();
    (data.goals || []).forEach((g) => map.set(Number(g.id), g));
    return map;
  }, [data.goals]);

  // 3. Mapa de saldos de cada meta (calculateGoalCurrentValue - nunca reseta)
  const goalBalancesMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const g of data.goals || []) {
      const saldo = calculateGoalCurrentValue(Number(g.id), data.allocation_movements || []);
      map.set(Number(g.id), saldo);
    }
    return map;
  }, [data.goals, data.allocation_movements]);

  // 4. Saldo total guardado em TODAS as metas
  const totalSavedAllGoals = useMemo(() => {
    let sum = 0;
    for (const val of goalBalancesMap.values()) {
      sum += val;
    }
    return sum;
  }, [goalBalancesMap]);

  // 5. Quantidade de metas ativas (!archived)
  const activeGoalsCount = useMemo(() => {
    return (data.goals || []).filter((g) => !g.archived).length;
  }, [data.goals]);

  // 6. Pílula de variação do mês X = soma(dest) - soma(source) no mês selecionado
  const netContributionMonth = useMemo(() => {
    let net = 0;
    for (const m of data.allocation_movements || []) {
      const moveMonth = monthFromTimestamp(Number(m.moved_at) || 0);
      if (moveMonth !== selectedMonth) continue;
      const amount = Number(m.amount) || 0;
      if (m.dest_goal_id != null) {
        net += amount;
      }
      if (m.source_goal_id != null) {
        net -= amount;
      }
    }
    return net;
  }, [data.allocation_movements, selectedMonth]);

  // 7. Opções de envelopes e metas para o DistributeModal
  const envelopeOptions = useMemo<EnvelopeOption[]>(() => {
    const result: EnvelopeOption[] = [];
    const subcatsByCat = new Map<number, Subcategory[]>();
    (data.subcategories || []).forEach((s) => {
      const list = subcatsByCat.get(s.category_id) || [];
      list.push(s);
      subcatsByCat.set(s.category_id, list);
    });

    for (const cat of data.categories || []) {
      const subs = subcatsByCat.get(cat.id) || [];
      if (subs.length > 0) {
        for (const sub of subs) {
          result.push({
            key: `${cat.id}:${sub.id}`,
            categoryId: cat.id,
            subcategoryId: sub.id,
            categoryName: cat.name,
            subcategoryName: sub.name,
            label: `${cat.name} > ${sub.name}`,
            isSubcategory: true,
            sobraAcumulada: 0,
            archived: Boolean(sub.archived),
          });
        }
      } else {
        result.push({
          key: `${cat.id}:null`,
          categoryId: cat.id,
          subcategoryId: null,
          categoryName: cat.name,
          subcategoryName: null,
          label: cat.name,
          isSubcategory: false,
          sobraAcumulada: 0,
          archived: Boolean(cat.archived),
        });
      }
    }
    return result;
  }, [data.categories, data.subcategories]);

  const metaOptions = useMemo<MetaOption[]>(() => {
    if (!data.goals || data.goals.length === 0) return [];
    return data.goals.map((g) => ({
      id: Number(g.id),
      name: g.name,
      saldo: goalBalancesMap.get(Number(g.id)) || 0,
    }));
  }, [data.goals, goalBalancesMap]);

  // 8. Filtragem das metas não arquivadas pelos 4 chips
  const filteredActiveGoals = useMemo(() => {
    const active = (data.goals || []).filter((g) => !g.archived);

    return active.filter((goal) => {
      const saldo = goalBalancesMap.get(Number(goal.id)) || 0;
      const alvo = Number(goal.target_value) || 0;
      const atingida = saldo >= alvo && alvo > 0;

      if (activeChip === 'TODAS') return true;
      if (activeChip === 'EM_ANDAMENTO') return !atingida && !goal.is_paused;
      if (activeChip === 'CONCLUIDAS') return atingida;
      if (activeChip === 'PAUSADAS') return goal.is_paused;
      return true;
    });
  }, [data.goals, goalBalancesMap, activeChip]);

  // 9. Metas arquivadas
  const archivedGoals = useMemo(() => {
    return (data.goals || []).filter((g) => g.archived);
  }, [data.goals]);

  // 10. Meta atualmente selecionada para visualização de Detalhe
  const selectedGoal = useMemo(() => {
    if (selectedGoalId == null) return null;
    return (data.goals || []).find((g) => Number(g.id) === Number(selectedGoalId)) || null;
  }, [data.goals, selectedGoalId]);

  // Disparar toast de celebração uma vez ao abrir detalhe de meta concluída
  useEffect(() => {
    if (selectedGoal) {
      const saldo = goalBalancesMap.get(Number(selectedGoal.id)) || 0;
      const alvo = Number(selectedGoal.target_value) || 0;
      const atingida = saldo >= alvo && alvo > 0;

      if (atingida && celebratedGoalId !== selectedGoal.id) {
        setCelebratedGoalId(selectedGoal.id);
        showNotice('Meta alcançada 🎉');
      }
    }
  }, [selectedGoal, goalBalancesMap, celebratedGoalId]);

  // Movimentações da meta selecionada
  const selectedGoalMovements = useMemo(() => {
    if (!selectedGoal) return [];
    const goalId = Number(selectedGoal.id);

    const list = (data.allocation_movements || []).filter(
      (m) => Number(m.source_goal_id) === goalId || Number(m.dest_goal_id) === goalId
    );

    // Mais recente ao mais antigo
    list.sort((a, b) => (Number(b.moved_at) || 0) - (Number(a.moved_at) || 0));

    return list;
  }, [selectedGoal, data.allocation_movements]);

  // =========================================================================
  // HANDLERS DE PERSISTÊNCIA ATÔMICA (Fase 6b)
  // =========================================================================

  // 1. Salvar Nova Meta
  const handleSaveNewGoal = async (goalData: {
    name: string;
    target_value: number;
    start_date: string;
    deadline: string;
    color: number;
  }) => {
    if (!user) return;
    const usedIds = collectAllExistingNumericIds(data);
    const newId = generateUniqueNumericId(usedIds);
    const newGoal: Goal = {
      id: newId,
      name: goalData.name,
      target_value: goalData.target_value,
      start_date: goalData.start_date,
      deadline: goalData.deadline,
      color: goalData.color,
      archived: false,
      is_paused: false,
    };
    const updatedGoals = [...(data.goals || []), newGoal];
    await saveGoals(user.uid, updatedGoals);
    showNotice(`Meta "${newGoal.name}" criada com sucesso! 🎯`);
  };

  // 2. Salvar Meta Editada
  const handleSaveEditedGoal = async (goalData: {
    name: string;
    target_value: number;
    start_date: string;
    deadline: string;
    color: number;
  }) => {
    if (!user || !editingGoal) return;
    const updatedGoals = (data.goals || []).map((g) =>
      Number(g.id) === Number(editingGoal.id)
        ? {
            ...g,
            name: goalData.name,
            target_value: goalData.target_value,
            start_date: goalData.start_date,
            deadline: goalData.deadline,
            color: goalData.color,
          }
        : g
    );
    await saveGoals(user.uid, updatedGoals);
    showNotice(`Meta "${goalData.name}" atualizada com sucesso!`);
  };

  // 3. Pausar / Reativar Meta
  const handleTogglePause = async () => {
    if (!user || !selectedGoal) return;
    const nextPaused = !selectedGoal.is_paused;
    const updatedGoals = (data.goals || []).map((g) =>
      Number(g.id) === Number(selectedGoal.id) ? { ...g, is_paused: nextPaused } : g
    );
    await saveGoals(user.uid, updatedGoals);
    showNotice(nextPaused ? 'Meta pausada' : 'Meta reativada');
  };

  // 4. Arquivar / Desarquivar Meta do Detalhe
  const handleToggleArchive = async () => {
    if (!user || !selectedGoal) return;
    const nextArchived = !selectedGoal.archived;
    const updatedGoals = (data.goals || []).map((g) =>
      Number(g.id) === Number(selectedGoal.id) ? { ...g, archived: nextArchived } : g
    );
    await saveGoals(user.uid, updatedGoals);
    showNotice(nextArchived ? 'Meta arquivada' : 'Meta desarquivada');
    if (nextArchived) {
      setSelectedGoalId(null);
    }
  };

  // 5. Desarquivar diretamente do card arquivado
  const handleUnarchiveGoal = async (goalId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const updatedGoals = (data.goals || []).map((g) =>
      Number(g.id) === Number(goalId) ? { ...g, archived: false } : g
    );
    await saveGoals(user.uid, updatedGoals);
    showNotice('Meta desarquivada');
  };

  // 6. Confirmar Exclusão de Meta
  const handleConfirmDeleteGoal = async () => {
    if (!user || !selectedGoal) return;
    const updatedGoals = (data.goals || []).filter(
      (g) => Number(g.id) !== Number(selectedGoal.id)
    );
    await saveGoals(user.uid, updatedGoals);
    setSelectedGoalId(null);
    setIsDeleteGoalModalOpen(false);
    showNotice('Meta excluída com sucesso.');
  };

  // 7. Salvar Movimentação Editada
  const handleSaveEditedMovement = async (
    movementId: number,
    amount: number,
    note: string | null
  ) => {
    if (!user) return;
    const updatedMovements = (data.allocation_movements || []).map((m) =>
      Number(m.id) === Number(movementId)
        ? {
            ...m,
            amount,
            note,
          }
        : m
    );
    await saveAllocationMovementsOnly(user.uid, updatedMovements);
    showNotice('Movimentação atualizada com sucesso.');
  };

  // 8. Confirmar Exclusão de Movimentação
  const handleConfirmDeleteMovement = async () => {
    if (!user || !movementToDelete) return;
    const updatedMovements = (data.allocation_movements || []).filter(
      (m) => Number(m.id) !== Number(movementToDelete.id)
    );
    await saveAllocationMovementsOnly(user.uid, updatedMovements);
    setMovementToDelete(null);
    showNotice('Movimentação excluída com sucesso.');
  };

  // =========================================================================
  // ESTADO: CARREGANDO (SKELETON)
  // =========================================================================
  if (loading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-150">
        <StandardScreenHeader title="Metas" />
        <div className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-[18px] h-44 animate-pulse" />
        <div className="grid grid-cols-4 gap-[6px] h-[38px] animate-pulse" />
        <div className="space-y-3">
          <div className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 h-32 animate-pulse" />
          <div className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 h-32 animate-pulse" />
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: DETALHE DA META (Item 4)
  // =========================================================================
  if (selectedGoal) {
    const goalId = Number(selectedGoal.id);
    const saldo = goalBalancesMap.get(goalId) || 0;
    const alvo = Number(selectedGoal.target_value) || 0;
    const atingida = saldo >= alvo && alvo > 0;
    const faltam = Math.max(0, alvo - saldo);
    const percent = alvo > 0 ? Math.trunc((saldo / alvo) * 100) : 0;
    const fillRatio = alvo > 0 ? Math.min(1, Math.max(0, saldo / alvo)) : 0;
    const statusInfo = getGoalStatus(selectedGoal, saldo, selectedMonth);
    const emoji = getGoalEmoji(selectedGoal.name);
    const colorInfo = argbToRgb(selectedGoal.color);
    const deadlineFull = formatDeadlineFull(selectedGoal.deadline);

    return (
      <div className="space-y-4 pb-12 animate-in fade-in duration-200">
        {/* Toast flutuante */}
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

        {/* Topo: Voltar + Título "Detalhe da Meta" (22px) + Barra de Ações */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedGoalId(null)}
              className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#111827] dark:text-[#F5F7F8] transition-colors cursor-pointer"
              title="Voltar à lista de metas"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-[22px] font-bold text-[#111827] dark:text-[#F5F7F8] tracking-tight truncate">
              Detalhe da Meta
            </h2>
          </div>

          {/* Barra de ícones: pausar/reativar, arquivar/desarquivar, editar, excluir */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleTogglePause}
              className="p-2 rounded-lg text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title={selectedGoal.is_paused ? 'Reativar meta' : 'Pausar meta'}
            >
              {selectedGoal.is_paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleToggleArchive}
              className="p-2 rounded-lg text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title={selectedGoal.archived ? 'Desarquivar meta' : 'Arquivar meta'}
            >
              {selectedGoal.archived ? (
                <ArchiveRestore className="w-4 h-4" />
              ) : (
                <Archive className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setEditingGoal(selectedGoal)}
              className="p-2 rounded-lg text-[#22A45D] dark:text-[#39D47A] hover:bg-[#22A45D]/10 dark:hover:bg-[#39D47A]/10 transition-colors cursor-pointer"
              title="Editar meta"
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsDeleteGoalModalOpen(true)}
              className="p-2 rounded-lg text-[#EF4444] dark:text-[#FF4D55] hover:bg-[#EF4444]/10 dark:hover:bg-[#FF4D55]/10 transition-colors cursor-pointer"
              title="Excluir meta"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card Principal de Detalhes da Meta */}
        <div className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-5 shadow-2xs space-y-5 transition-colors">
          {/* Identificação da Meta */}
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-2xs"
              style={{
                backgroundColor: `rgba(${colorInfo.r}, ${colorInfo.g}, ${colorInfo.b}, 0.15)`,
              }}
            >
              {emoji}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#111827] dark:text-[#F5F7F8] truncate leading-tight">
                  {selectedGoal.name}
                </h3>
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0"
                  style={{
                    backgroundColor: `${statusInfo.colorHex}26`,
                    color: statusInfo.colorHex,
                  }}
                >
                  {statusInfo.label}
                </span>
              </div>
              <div className="text-xs text-[#6B7280] dark:text-[#9FA9AB] mt-0.5 font-medium">
                Prazo: {deadlineFull}
              </div>
            </div>
          </div>

          {/* Progresso Total + Barra Grande */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[#6B7280] dark:text-[#9FA9AB]">Progresso Total</span>
              <span style={{ color: statusInfo.colorHex }}>{percent}%</span>
            </div>

            <div className="w-full h-3 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${fillRatio * 100}%`,
                  backgroundColor: statusInfo.colorHex,
                }}
              />
            </div>
          </div>

          {/* 3 Colunas: Saldo Atual | Meta Alvo | Prazo Limite */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]/70 text-center">
            <div className="space-y-0.5">
              <span className="block text-[11px] text-[#6B7280] dark:text-[#9FA9AB]">Saldo Atual</span>
              <span className="block text-sm font-bold text-[#111827] dark:text-[#F5F7F8] truncate">
                {maskValue(formatCurrencyBRL(saldo))}
              </span>
            </div>

            <div className="space-y-0.5 border-x border-[#E6E9EC] dark:border-[#283438]/70 px-1">
              <span className="block text-[11px] text-[#6B7280] dark:text-[#9FA9AB]">Meta Alvo</span>
              <span className="block text-sm font-bold text-[#111827] dark:text-[#F5F7F8] truncate">
                {maskValue(formatCurrencyBRL(alvo))}
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="block text-[11px] text-[#6B7280] dark:text-[#9FA9AB]">Prazo Limite</span>
              <span className="block text-sm font-bold text-[#111827] dark:text-[#F5F7F8] truncate">
                {deadlineFull}
              </span>
            </div>
          </div>

          {/* Mensagem motivacional: Parabéns ou Faltam R$ X */}
          <div
            className={`p-3 rounded-xl text-xs font-semibold text-center ${
              atingida
                ? 'bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A]'
                : 'bg-black/5 dark:bg-white/5 text-[#6B7280] dark:text-[#9FA9AB]'
            }`}
          >
            {atingida ? (
              <span className="flex items-center justify-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                Parabéns! Meta alcançada! 🎉
              </span>
            ) : (
              <span>Faltam {maskValue(formatCurrencyBRL(faltam))} para atingir seu objetivo.</span>
            )}
          </div>

          {/* Botões "Aportar" e "Retirar" (abrem o DistributeModal já existente) */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              id="btn-goal-detail-aportar"
              type="button"
              onClick={() => {
                setDistributeModalState({
                  isOpen: true,
                  initialSource: {
                    type: 'PRONTO',
                  },
                  initialDest: {
                    type: 'META',
                    goalId: selectedGoal.id,
                  },
                });
              }}
              className="h-11 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold flex items-center justify-center hover:opacity-95 active:scale-98 transition-all cursor-pointer shadow-xs"
            >
              Aportar
            </button>

            <button
              id="btn-goal-detail-retirar"
              type="button"
              onClick={() => {
                setDistributeModalState({
                  isOpen: true,
                  initialSource: {
                    type: 'META',
                    goalId: selectedGoal.id,
                  },
                  initialDest: {
                    type: 'PRONTO',
                  },
                });
              }}
              className="h-11 rounded-xl border border-[#E6E9EC] dark:border-[#283438] text-[#111827] dark:text-[#F5F7F8] bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold flex items-center justify-center active:scale-98 transition-all cursor-pointer"
            >
              Retirar
            </button>
          </div>
        </div>

        {/* Seção: Histórico de Aportes e Retiradas */}
        <div className="space-y-2.5">
          <h4 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F8]">
            Histórico de Aportes e Retiradas
          </h4>

          {selectedGoalMovements.length === 0 ? (
            <div className="py-10 text-center space-y-2 border border-dashed border-[#E6E9EC] dark:border-[#283438] rounded-2xl bg-[#FFFFFF] dark:bg-[#172022]">
              <Clock className="w-7 h-7 text-[#6B7280] dark:text-[#9FA9AB] mx-auto opacity-70" />
              <p className="text-xs font-medium text-[#6B7280] dark:text-[#9FA9AB]">
                Nenhum aporte ou retirada realizado ainda.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedGoalMovements.map((m) => {
                const isDest = Number(m.dest_goal_id) === goalId;
                const sign = isDest ? '+' : '-';
                const signColor = isDest
                  ? 'text-[#22A45D] dark:text-[#39D47A]'
                  : 'text-[#EF4444] dark:text-[#FF4D55]';

                const srcLabel = resolveEntityLabel(
                  m.source_budget_allocation_id,
                  m.source_goal_id,
                  allocMap,
                  catMap,
                  subcatMap,
                  goalMap
                );
                const dstLabel = resolveEntityLabel(
                  m.dest_budget_allocation_id,
                  m.dest_goal_id,
                  allocMap,
                  catMap,
                  subcatMap,
                  goalMap
                );
                const formattedDate = formatMovementDate(m.moved_at);
                const valFormatted = maskValue(formatCurrencyBRL(Number(m.amount) || 0));

                return (
                  <div
                    key={m.id}
                    className="rounded-[14px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-3 space-y-1.5 shadow-2xs transition-colors"
                  >
                    {/* Linha 1: Data e Valor com sinal */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-[#6B7280] dark:text-[#9FA9AB] font-medium">
                        {formattedDate}
                      </span>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${signColor}`}>
                          {sign} {valFormatted}
                        </span>

                        {/* Botões editar / excluir movimentação */}
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setMovementToEdit(m)}
                            className="p-1 rounded-md text-[#6B7280] dark:text-[#9FA9AB] hover:text-[#22A45D] dark:hover:text-[#39D47A] transition-colors cursor-pointer"
                            title="Editar movimentação"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setMovementToDelete(m)}
                            className="p-1 rounded-md text-[#6B7280] dark:text-[#9FA9AB] hover:text-[#EF4444] dark:hover:text-[#FF4D55] transition-colors cursor-pointer"
                            title="Excluir movimentação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Linha 2: "De: {origem} → Para: {destino}" */}
                    <div className="text-[11.5px] text-[#111827] dark:text-[#F5F7F8] font-medium truncate">
                      <span className="text-[#6B7280] dark:text-[#9FA9AB]">De:</span> {srcLabel}{' '}
                      <span className="text-[#6B7280] dark:text-[#9FA9AB]">→ Para:</span> {dstLabel}
                    </div>

                    {/* Nota (se houver) */}
                    {m.note && m.note.trim() && (
                      <div className="text-[10.5px] italic text-[#6B7280] dark:text-[#9FA9AB] bg-black/5 dark:bg-white/5 p-1 rounded-md">
                        Nota: {m.note.trim()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal de Distribuição reaproveitado */}
        {distributeModalState.isOpen && (
          <DistributeModal
            isOpen={distributeModalState.isOpen}
            onClose={() => setDistributeModalState({ isOpen: false })}
            month={selectedMonth}
            readyToAssign={readyToAssign}
            envelopeOptions={envelopeOptions}
            metaOptions={metaOptions}
            initialSource={distributeModalState.initialSource}
            initialDest={distributeModalState.initialDest}
            onSuccess={showNotice}
          />
        )}

        {/* Modal de Edição de Meta */}
        {editingGoal && (
          <GoalFormModal
            isOpen={Boolean(editingGoal)}
            onClose={() => setEditingGoal(null)}
            goalToEdit={editingGoal}
            currentSelectedMonth={selectedMonth}
            onSave={handleSaveEditedGoal}
          />
        )}

        {/* Diálogo de Confirmação: Excluir Meta (Item 4) */}
        {isDeleteGoalModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-5 shadow-2xl space-y-4 text-[#111827] dark:text-[#F5F7F8]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 text-[#EF4444] dark:text-[#FF4D55]">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold">Excluir Meta</h3>
              </div>

              <p className="text-xs text-[#6B7280] dark:text-[#9FA9AB] leading-relaxed">
                Excluir esta meta? O valor guardado ({maskValue(formatCurrencyBRL(saldo))}) volta para Pronto para Atribuir. Os registros de aportes e retiradas continuam no histórico geral.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
                <button
                  type="button"
                  onClick={() => setIsDeleteGoalModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteGoal}
                  className="px-4 py-2 rounded-xl bg-[#EF4444] dark:bg-[#FF4D55] text-white text-xs font-bold hover:opacity-90 cursor-pointer shadow-xs"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edição de Movimentação (Item 5) */}
        {movementToEdit && (
          <EditMovementModal
            isOpen={Boolean(movementToEdit)}
            onClose={() => setMovementToEdit(null)}
            movement={movementToEdit}
            onSave={handleSaveEditedMovement}
          />
        )}

        {/* Diálogo de Confirmação: Excluir Movimentação (Item 6) */}
        {movementToDelete && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-5 shadow-2xl space-y-4 text-[#111827] dark:text-[#F5F7F8]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 text-[#EF4444] dark:text-[#FF4D55]">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold">Excluir Movimentação ⚠️</h3>
              </div>

              <p className="text-xs text-[#6B7280] dark:text-[#9FA9AB] leading-relaxed">
                Tem certeza que deseja excluir esta movimentação? O saldo da meta e o valor disponível serão recalculados.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
                <button
                  type="button"
                  onClick={() => setMovementToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteMovement}
                  className="px-4 py-2 rounded-xl bg-[#EF4444] dark:bg-[#FF4D55] text-white text-xs font-bold hover:opacity-90 cursor-pointer shadow-xs"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW PRINCIPAL: LISTA DE METAS (Itens 1, 2, 3, 5)
  // =========================================================================
  const hasAnyGoals = (data.goals || []).length > 0;

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Toast flutuante discreto */}
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
      <StandardScreenHeader title="Metas" />

      {/* ========================================================================= */}
      {/* 1. CARD DE RESUMO (raio 20px, padding 18px)                                */}
      {/* ========================================================================= */}
      <div
        id="card-goals-summary"
        className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-[18px] shadow-2xs relative overflow-hidden transition-colors space-y-4"
      >
        {/* Círculo decorativo de 56px com ícone de alvo no canto superior direito */}
        <div
          className="absolute -top-1 -right-1 w-14 h-14 rounded-full bg-[#22A45D]/10 dark:bg-[#39D47A]/10 flex items-center justify-center text-2xl select-none pointer-events-none"
          aria-hidden="true"
        >
          🎯
        </div>

        {/* Linha 1: "Disponível para metas" + Valor Pronto para Atribuir */}
        <div className="space-y-1">
          <span className="block text-[13px] font-medium text-[#6B7280] dark:text-[#9FA9AB] leading-tight">
            Disponível para metas
          </span>
          <div
            id="value-goals-ready-to-assign"
            className={`text-[28px] font-bold tracking-tight leading-none ${
              readyToAssign >= 0
                ? 'text-[#22A45D] dark:text-[#39D47A]'
                : 'text-[#EF4444] dark:text-[#FF4D55]'
            }`}
          >
            {maskValue(formatCurrencyBRL(readyToAssign))}
          </div>

          {/* Pílula calculada com dados reais (X = dest - source no mês) */}
          <div className="pt-1">
            {netContributionMonth > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A]">
                ↑ + {maskValue(formatCurrencyBRL(netContributionMonth))} este mês
              </span>
            )}
            {netContributionMonth < 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EF4444]/15 dark:bg-[#FF4D55]/15 text-[#EF4444] dark:text-[#FF4D55]">
                ↓ - {maskValue(formatCurrencyBRL(Math.abs(netContributionMonth)))} este mês
              </span>
            )}
            {netContributionMonth === 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-black/5 dark:bg-white/5 text-[#6B7280] dark:text-[#9FA9AB]">
                Nenhum aporte neste mês
              </span>
            )}
          </div>
        </div>

        {/* Linha inferior: Balança + metas ativas + guardados à esquerda; Botão "+ Nova meta" à direita */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4" />
            </div>

            <div className="min-w-0 text-left">
              <div className="text-xs text-[#6B7280] dark:text-[#9FA9AB] truncate">
                {activeGoalsCount} {activeGoalsCount === 1 ? 'meta ativa' : 'metas ativas'}
              </div>
              <div className="text-xs font-bold text-[#111827] dark:text-[#F5F7F8] truncate">
                {maskValue(formatCurrencyBRL(totalSavedAllGoals))} guardados
              </div>
            </div>
          </div>

          <button
            id="btn-new-goal"
            type="button"
            onClick={() => setIsNewGoalModalOpen(true)}
            className="h-[42px] px-4 rounded-[12px] bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-[13.5px] font-bold flex items-center gap-1.5 hover:opacity-95 active:scale-98 transition-all shrink-0 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nova meta</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ESTADO VAZIO ABSOLUTO (Sem nenhuma meta cadastrada)                        */}
      {/* ========================================================================= */}
      {!hasAnyGoals ? (
        <div
          id="goals-empty-state"
          className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-8 text-center space-y-3.5 shadow-2xs"
        >
          <div className="w-16 h-16 rounded-3xl bg-[#22A45D]/15 dark:bg-[#39D47A]/15 flex items-center justify-center text-3xl mx-auto shadow-2xs">
            🎯
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#111827] dark:text-[#F5F7F8]">
              Você ainda não criou nenhuma meta.
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#9FA9AB] max-w-sm mx-auto leading-relaxed">
              Crie uma meta para acompanhar seus objetivos financeiros.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsNewGoalModalOpen(true)}
            className="h-10 px-5 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-95 active:scale-98 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar primeira meta</span>
          </button>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 2. CHIPS (4, largura igual, altura 38px, raio 19px, gap 6px, 11.5px)      */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-4 gap-[6px]">
            {(
              [
                { key: 'TODAS', label: 'Todas' },
                { key: 'EM_ANDAMENTO', label: 'Em andamento' },
                { key: 'CONCLUIDAS', label: 'Concluídas' },
                { key: 'PAUSADAS', label: 'Pausadas' },
              ] as const
            ).map((chip) => {
              const isActive = activeChip === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setActiveChip(chip.key)}
                  className={`h-[38px] rounded-[19px] text-[11.5px] font-semibold flex items-center justify-center transition-all cursor-pointer truncate px-1 ${
                    isActive
                      ? 'bg-[#22A45D]/15 dark:bg-[#39D47A]/15 border border-[#22A45D] dark:border-[#39D47A] text-[#22A45D] dark:text-[#39D47A] shadow-2xs'
                      : 'bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#6B7280] dark:text-[#9FA9AB] hover:text-[#111827] dark:hover:text-[#F5F7F8]'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* ========================================================================= */}
          {/* 3. LISTA DE CARDS DE META (raio 18px, padding 16px, espaço 12px)          */}
          {/* ========================================================================= */}
          {filteredActiveGoals.length === 0 ? (
            <div className="py-12 text-center space-y-2 border border-dashed border-[#E6E9EC] dark:border-[#283438] rounded-2xl bg-[#FFFFFF] dark:bg-[#172022]">
              <Target className="w-8 h-8 text-[#6B7280] dark:text-[#9FA9AB] mx-auto opacity-70" />
              <p className="text-xs font-medium text-[#6B7280] dark:text-[#9FA9AB]">
                Nenhuma meta neste filtro.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredActiveGoals.map((goal) => {
                const goalId = Number(goal.id);
                const saldo = goalBalancesMap.get(goalId) || 0;
                const alvo = Number(goal.target_value) || 0;
                const percent = alvo > 0 ? Math.trunc((saldo / alvo) * 100) : 0;
                const fillRatio = alvo > 0 ? Math.min(1, Math.max(0, saldo / alvo)) : 0;
                const statusInfo = getGoalStatus(goal, saldo, selectedMonth);
                const emoji = getGoalEmoji(goal.name);
                const colorInfo = argbToRgb(goal.color);
                const deadlineShort = formatDeadlineShort(goal.deadline);

                return (
                  <div
                    key={goal.id}
                    id={`goal-card-${goal.id}`}
                    onClick={() => setSelectedGoalId(goal.id)}
                    className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 shadow-2xs space-y-3 transition-all hover:border-[#22A45D]/40 dark:hover:border-[#39D47A]/40 cursor-pointer active:scale-99"
                  >
                    {/* Linha 1: Ícone + Nome/Prazo + Chip de status */}
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-2xs"
                          style={{
                            backgroundColor: `rgba(${colorInfo.r}, ${colorInfo.g}, ${colorInfo.b}, 0.15)`,
                          }}
                        >
                          {emoji}
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-[16px] font-semibold text-[#111827] dark:text-[#F5F7F8] truncate leading-tight">
                            {goal.name}
                          </h4>
                          {deadlineShort && (
                            <span className="block text-[12.5px] text-[#6B7280] dark:text-[#9FA9AB] leading-tight mt-0.5">
                              {deadlineShort}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Chip de status (11.5px, nunca azul, fundo 15%) */}
                      <span
                        className="px-2.5 py-1 rounded-full text-[11.5px] font-bold shrink-0"
                        style={{
                          backgroundColor: `${statusInfo.colorHex}26`,
                          color: statusInfo.colorHex,
                        }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Linha 2: "R$ saldo / R$ alvo" à esquerda; percentual à direita */}
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0 flex items-baseline gap-1 truncate">
                        <span className="text-[17px] font-bold text-[#111827] dark:text-[#F5F7F8]">
                          {maskValue(formatCurrencyBRL(saldo))}
                        </span>
                        <span className="text-[13px] text-[#6B7280] dark:text-[#9FA9AB]">
                          / {maskValue(formatCurrencyBRL(alvo))}
                        </span>
                      </div>

                      <span
                        className="text-[13.5px] font-bold shrink-0"
                        style={{ color: statusInfo.colorHex }}
                      >
                        {percent}%
                      </span>
                    </div>

                    {/* Linha 3: Barra de 8px, raio total, preenchimento clamp(0,1), trilha neutra */}
                    <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${fillRatio * 100}%`,
                          backgroundColor: statusInfo.colorHex,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================================= */}
          {/* SEÇÃO "ARQUIVADAS ({n})" (Recolhível no fim da lista)                      */}
          {/* ========================================================================= */}
          {archivedGoals.length > 0 && (
            <div className="pt-2 space-y-2.5">
              <button
                type="button"
                onClick={() => setIsArchivedExpanded((prev) => !prev)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-xs font-bold text-[#6B7280] dark:text-[#9FA9AB] hover:text-[#111827] dark:hover:text-[#F5F7F8] transition-colors cursor-pointer"
              >
                <span>Arquivadas ({archivedGoals.length})</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isArchivedExpanded ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </button>

              {isArchivedExpanded && (
                <div className="space-y-3 opacity-75 dark:opacity-70">
                  {archivedGoals.map((goal) => {
                    const goalId = Number(goal.id);
                    const saldo = goalBalancesMap.get(goalId) || 0;
                    const alvo = Number(goal.target_value) || 0;
                    const percent = alvo > 0 ? Math.trunc((saldo / alvo) * 100) : 0;
                    const fillRatio = alvo > 0 ? Math.min(1, Math.max(0, saldo / alvo)) : 0;
                    const statusInfo = getGoalStatus(goal, saldo, selectedMonth);
                    const emoji = getGoalEmoji(goal.name);
                    const colorInfo = argbToRgb(goal.color);
                    const deadlineShort = formatDeadlineShort(goal.deadline);

                    return (
                      <div
                        key={goal.id}
                        id={`archived-goal-card-${goal.id}`}
                        onClick={() => setSelectedGoalId(goal.id)}
                        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-4 shadow-2xs space-y-3 transition-all cursor-pointer hover:border-[#22A45D]/40"
                      >
                        {/* Linha 1 */}
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-2xs"
                              style={{
                                backgroundColor: `rgba(${colorInfo.r}, ${colorInfo.g}, ${colorInfo.b}, 0.15)`,
                              }}
                            >
                              {emoji}
                            </div>

                            <div className="min-w-0">
                              <h4 className="text-[16px] font-semibold text-[#111827] dark:text-[#F5F7F8] truncate leading-tight">
                                {goal.name} (Arquivada)
                              </h4>
                              {deadlineShort && (
                                <span className="block text-[12.5px] text-[#6B7280] dark:text-[#9FA9AB] leading-tight mt-0.5">
                                  {deadlineShort}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleUnarchiveGoal(goal.id, e)}
                              className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#E6E9EC] dark:border-[#283438] bg-white/60 dark:bg-black/40 hover:bg-black/5 dark:hover:bg-white/10 text-[#111827] dark:text-[#F5F7F8] transition-colors cursor-pointer"
                              title="Desarquivar meta"
                            >
                              Desarquivar
                            </button>

                            <span
                              className="px-2.5 py-1 rounded-full text-[11.5px] font-bold shrink-0"
                              style={{
                                backgroundColor: `${statusInfo.colorHex}26`,
                                color: statusInfo.colorHex,
                              }}
                            >
                              {statusInfo.label}
                            </span>
                          </div>
                        </div>

                        {/* Linha 2 */}
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="min-w-0 flex items-baseline gap-1 truncate">
                            <span className="text-[17px] font-bold text-[#111827] dark:text-[#F5F7F8]">
                              {maskValue(formatCurrencyBRL(saldo))}
                            </span>
                            <span className="text-[13px] text-[#6B7280] dark:text-[#9FA9AB]">
                              / {maskValue(formatCurrencyBRL(alvo))}
                            </span>
                          </div>

                          <span
                            className="text-[13.5px] font-bold shrink-0"
                            style={{ color: statusInfo.colorHex }}
                          >
                            {percent}%
                          </span>
                        </div>

                        {/* Linha 3 */}
                        <div className="w-full h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${fillRatio * 100}%`,
                              backgroundColor: statusInfo.colorHex,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal de Nova Meta (Item 1) */}
      {isNewGoalModalOpen && (
        <GoalFormModal
          isOpen={isNewGoalModalOpen}
          onClose={() => setIsNewGoalModalOpen(false)}
          currentSelectedMonth={selectedMonth}
          onSave={handleSaveNewGoal}
        />
      )}

      {/* Modal de Distribuição reaproveitado */}
      {distributeModalState.isOpen && (
        <DistributeModal
          isOpen={distributeModalState.isOpen}
          onClose={() => setDistributeModalState({ isOpen: false })}
          month={selectedMonth}
          readyToAssign={readyToAssign}
          envelopeOptions={envelopeOptions}
          metaOptions={metaOptions}
          initialSource={distributeModalState.initialSource}
          initialDest={distributeModalState.initialDest}
          onSuccess={showNotice}
        />
      )}
    </div>
  );
};
