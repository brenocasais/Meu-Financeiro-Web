import React, { useState, useEffect } from 'react';
import { X, Calendar, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { planBudgetLogic, formatCurrencyBRL } from '../../lib/financeLogic';
import { saveBudgetAllocations } from '../../firebase/firestore';

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: number;
  subcategoryId?: number | null;
  categoryName: string;
  subcategoryName?: string | null;
  month: string; // "YYYY-MM"
  currentPlannedValue: number;
  onSuccess: (message: string) => void;
}

export const PlanModal: React.FC<PlanModalProps> = ({
  isOpen,
  onClose,
  categoryId,
  subcategoryId,
  categoryName,
  subcategoryName,
  month,
  currentPlannedValue,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { data } = useFinance();

  const [plannedValueStr, setPlannedValueStr] = useState<string>('');
  const [isRepeat, setIsRepeat] = useState<boolean>(false);
  const [interval, setInterval] = useState<number>(1);
  const [unit, setUnit] = useState<'MESES' | 'ANOS'>('MESES');
  const [endMode, setEndMode] = useState<'NUNCA' | 'ATE'>('NUNCA');
  const [endMonth, setEndMonth] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPlannedValueStr(
        currentPlannedValue > 0
          ? currentPlannedValue.toFixed(2).replace('.', ',')
          : ''
      );
      setIsRepeat(false);
      setInterval(1);
      setUnit('MESES');
      setEndMode('NUNCA');
      setEndMonth('');
      setError(null);
    }
  }, [isOpen, currentPlannedValue]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!user) return;
    setError(null);

    const cleanStr = plannedValueStr.replace(/\./g, '').replace(',', '.').trim();
    const numericValue = parseFloat(cleanStr);
    if (isNaN(numericValue) || numericValue < 0) {
      setError('Informe um valor planejado válido maior ou igual a zero.');
      return;
    }

    if (isRepeat && endMode === 'ATE') {
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

      const { updatedAllocations } = planBudgetLogic(
        {
          categoryId,
          subcategoryId,
          month,
          newPlannedValue: numericValue,
          repeat: isRepeat
            ? {
                interval: Math.max(1, interval),
                unit,
                endMode,
                endMonth: endMode === 'ATE' ? endMonth : undefined,
              }
            : undefined,
        },
        data.budget_allocations || [],
        usedIds
      );

      await saveBudgetAllocations(user.uid, updatedAllocations);
      const targetLabel = subcategoryName ? `${categoryName} > ${subcategoryName}` : categoryName;
      onSuccess(`Planejamento de ${targetLabel} atualizado para ${formatCurrencyBRL(numericValue)}!`);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar planejamento:', err);
      setError(err?.message || 'Erro ao salvar planejamento no Firestore.');
    } finally {
      setSaving(false);
    }
  };

  const titlePath = subcategoryName ? `${categoryName} > ${subcategoryName}` : categoryName;

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
            <h3 className="text-base font-bold tracking-tight">Planejar Orçamento</h3>
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

        {/* Campo Novo Valor Planejado */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
            Novo Valor Planejado (R$)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B7280] dark:text-[#9FA9AB]">
              R$
            </span>
            <input
              id="input-new-planned-value"
              type="text"
              inputMode="decimal"
              value={plannedValueStr}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9,]/g, '');
                setPlannedValueStr(val);
              }}
              placeholder="0,00"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-base font-bold text-[#111827] dark:text-[#F5F7F8] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors"
              autoFocus
            />
          </div>
        </div>

        {/* Bloco Repetir Planejamento */}
        <div className="p-3.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold block">Repetir planejamento?</span>
              <span className="text-[11px] text-[#6B7280] dark:text-[#9FA9AB] block">
                Aplicar este valor planejado nos meses seguintes
              </span>
            </div>
            <button
              id="toggle-repeat-plan"
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

              {/* Término: Nunca vs Até */}
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

        {/* Rodapé com botões de ação */}
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
            id="btn-confirm-plan"
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold hover:opacity-90 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <span>Salvar Planejamento</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
