import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { allocateBudgetLogic, formatCurrencyBRL } from '../../lib/financeLogic';
import { saveBudgetAllocationsAndMovements } from '../../firebase/firestore';

interface AllocateModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId?: number | null;
  subcategoryId?: number | null;
  goalId?: number | null;
  titlePath: string; // Ex: "Alimentação > Supermercado" ou "Reserva de Emergência"
  month: string; // "YYYY-MM"
  readyToAssign: number;
  planejadoDoMes: number;
  alocadoDoMesSemSobra: number;
  onSuccess: (message: string) => void;
}

export const AllocateModal: React.FC<AllocateModalProps> = ({
  isOpen,
  onClose,
  categoryId,
  subcategoryId,
  goalId,
  titlePath,
  month,
  readyToAssign,
  planejadoDoMes,
  alocadoDoMesSemSobra,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { data } = useFinance();

  const [allocatedValueStr, setAllocatedValueStr] = useState<string>('');
  const [isRepeat, setIsRepeat] = useState<boolean>(false);
  const [interval, setInterval] = useState<number>(1);
  const [unit, setUnit] = useState<'MESES' | 'ANOS'>('MESES');
  const [endMode, setEndMode] = useState<'NUNCA' | 'ATE'>('NUNCA');
  const [endMonth, setEndMonth] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isGoal = Boolean(goalId != null);

  useEffect(() => {
    if (isOpen) {
      setAllocatedValueStr(
        alocadoDoMesSemSobra > 0
          ? alocadoDoMesSemSobra.toFixed(2).replace('.', ',')
          : ''
      );
      setIsRepeat(false);
      setInterval(1);
      setUnit('MESES');
      setEndMode('NUNCA');
      setEndMonth('');
      setError(null);
    }
  }, [isOpen, alocadoDoMesSemSobra]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!user) return;
    setError(null);

    const cleanStr = allocatedValueStr.replace(/\./g, '').replace(',', '.').trim();
    const newTotal = cleanStr === '' ? 0 : parseFloat(cleanStr);
    if (isNaN(newTotal) || newTotal < 0) {
      setError('Informe um valor alocado válido maior ou igual a zero.');
      return;
    }

    const diff = newTotal - alocadoDoMesSemSobra;
    if (Math.abs(diff) < 0.0001 && (!isRepeat || isGoal)) {
      // Sem alteração
      onClose();
      return;
    }

    if (isRepeat && !isGoal && endMode === 'ATE') {
      if (!endMonth) {
        setError('Informe o mês final para a repetição.');
        return;
      }
      if (endMonth < month) {
        setError('O mês final não pode ser anterior ao mês atual.');
        return;
      }
    }

    try {
      setSaving(true);
      const usedIds = new Set<number>();
      (data.budget_allocations || []).forEach((b) => usedIds.add(Number(b.id)));
      (data.allocation_movements || []).forEach((m) => usedIds.add(Number(m.id)));

      const { updatedAllocations, updatedMovements } = allocateBudgetLogic(
        {
          categoryId: categoryId != null ? Number(categoryId) : null,
          subcategoryId: subcategoryId != null ? Number(subcategoryId) : null,
          goalId: goalId != null ? Number(goalId) : null,
          month,
          newAllocatedTotal: newTotal,
          currentAllocatedInMonth: alocadoDoMesSemSobra,
          repeat: isRepeat && !isGoal
            ? {
                interval: Math.max(1, interval),
                unit,
                endMode,
                endMonth: endMode === 'ATE' ? endMonth : undefined,
              }
            : undefined,
        },
        data.budget_allocations || [],
        data.allocation_movements || [],
        usedIds
      );

      await saveBudgetAllocationsAndMovements(user.uid, updatedAllocations, updatedMovements);
      onSuccess(`Alocação de ${titlePath} atualizada para ${formatCurrencyBRL(newTotal)}!`);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar alocação:', err);
      setError(err?.message || 'Erro ao salvar alocação no Firestore.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-5 shadow-2xl space-y-4 text-[#111827] dark:text-[#F5F7F8] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[#E6E9EC] dark:border-[#283438] pb-3">
          <div>
            <h3 className="text-base font-bold tracking-tight">Alocar Dinheiro</h3>
            <p className="text-xs text-[#6B7280] dark:text-[#9FA9AB] truncate max-w-[280px]">
              {titlePath}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 3 Linhas informativas */}
        <div className="p-3.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#6B7280] dark:text-[#9FA9AB]">Saldo disponível para alocar:</span>
            <span
              className={`font-bold ${
                readyToAssign >= 0
                  ? 'text-[#22A45D] dark:text-[#39D47A]'
                  : 'text-[#EF4444] dark:text-[#FF4D55]'
              }`}
            >
              {formatCurrencyBRL(readyToAssign)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#6B7280] dark:text-[#9FA9AB]">Valor Planejado para este mês:</span>
            <span className="font-semibold text-[#111827] dark:text-[#F5F7F8]">
              {formatCurrencyBRL(planejadoDoMes)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#6B7280] dark:text-[#9FA9AB]">Valor atualmente alocado:</span>
            <span className="font-semibold text-[#111827] dark:text-[#F5F7F8]">
              {formatCurrencyBRL(alocadoDoMesSemSobra)}
            </span>
          </div>
        </div>

        {/* Campo Novo Valor Alocado Total */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
            Novo Valor Alocado Total (R$)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B7280] dark:text-[#9FA9AB]">
              R$
            </span>
            <input
              id="input-new-allocated-value"
              type="text"
              inputMode="decimal"
              value={allocatedValueStr}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9,]/g, '');
                setAllocatedValueStr(val);
              }}
              placeholder="0,00"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-base font-bold text-[#111827] dark:text-[#F5F7F8] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors"
              autoFocus
            />
          </div>
        </div>

        {/* Bloco Repetir planejamento? (apenas para Envelopes) */}
        {!isGoal && (
          <div className="p-3.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold block">Repetir planejamento?</span>
                <span className="text-[11px] text-[#6B7280] dark:text-[#9FA9AB] block">
                  Aplicar esta alocação nos meses seguintes
                </span>
              </div>
              <button
                id="toggle-repeat-allocate"
                type="button"
                role="switch"
                aria-checked={isRepeat}
                onClick={() => setIsRepeat(!isRepeat)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  isRepeat ? 'bg-[#22A45D] dark:bg-[#39D47A]' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isRepeat ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {isRepeat && (
              <div className="pt-2 border-t border-[#E6E9EC] dark:border-[#283438] space-y-3">
                {/* Repetir a cada [n] meses/anos */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#9FA9AB] block">
                    Repetir a cada
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={interval}
                      onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-20 px-3 py-1.5 rounded-lg bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-xs font-bold text-center"
                    />
                    <div className="grid grid-cols-2 gap-1 flex-1">
                      <button
                        type="button"
                        onClick={() => setUnit('MESES')}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                          unit === 'MESES'
                            ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214]'
                            : 'bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#6B7280] dark:text-[#9FA9AB]'
                        }`}
                      >
                        Meses
                      </button>
                      <button
                        type="button"
                        onClick={() => setUnit('ANOS')}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                          unit === 'ANOS'
                            ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214]'
                            : 'bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#6B7280] dark:text-[#9FA9AB]'
                        }`}
                      >
                        Anos
                      </button>
                    </div>
                  </div>
                </div>

                {/* Término */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#9FA9AB] block">
                    Término
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEndMode('NUNCA')}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        endMode === 'NUNCA'
                          ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214]'
                          : 'bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#6B7280] dark:text-[#9FA9AB]'
                      }`}
                    >
                      Nunca (até 2 anos)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndMode('ATE')}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        endMode === 'ATE'
                          ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214]'
                          : 'bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#6B7280] dark:text-[#9FA9AB]'
                      }`}
                    >
                      Até um mês
                    </button>
                  </div>

                  {endMode === 'ATE' && (
                    <div className="pt-1.5">
                      <input
                        type="month"
                        value={endMonth}
                        onChange={(e) => setEndMonth(e.target.value)}
                        min={month}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rodapé */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            id="btn-confirm-allocate"
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold hover:opacity-90 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Alocando...</span>
              </>
            ) : (
              <span>Confirmar Alocação</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
