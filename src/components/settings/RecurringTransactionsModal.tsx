import React, { useState } from 'react';
import { X, Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { updateDoc } from 'firebase/firestore';
import { getUserDocRef, sanitizeForFirestore } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { RecurrenceRule } from '../../types/finance';
import { EditRecurringRuleModal } from './EditRecurringRuleModal';

interface RecurringTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const RecurringTransactionsModal: React.FC<RecurringTransactionsModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const { user } = useAuth();
  const { data } = useFinance();

  const [ruleToEdit, setRuleToEdit] = useState<RecurrenceRule | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Confirmação de desativação
  const [deactivateTarget, setDeactivateTarget] = useState<RecurrenceRule | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = data.categories || [];
  const catMap = new Map<number, string>();
  categories.forEach((c) => catMap.set(Number(c.id), c.name));

  // Apenas regras ativas (active === true)
  const activeRules = (data.recurrence_rules || []).filter((r) => r.active !== false);

  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(val) || 0);
  };

  const handleConfirmDeactivate = async () => {
    if (!user || !deactivateTarget) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const allRules = data.recurrence_rules || [];
      const updated = allRules.map((r) =>
        Number(r.id) === Number(deactivateTarget.id) ? { ...r, active: false } : r
      );

      const docRef = getUserDocRef(user.uid);
      await updateDoc(docRef, {
        recurrence_rules: sanitizeForFirestore(updated),
      });

      onSuccessToast('Recorrência desativada!');
      setDeactivateTarget(null);
    } catch (err: any) {
      console.error('[RecurringTransactionsModal] Erro ao desativar recorrência:', err);
      setErrorMessage('Não foi possível salvar. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Topo */}
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
              Transações Recorrentes
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-[12px] text-[#6B7280] dark:text-[#A9B1B1] -mt-1">
            Lançamentos automáticos configurados para se repetirem periodicamente.
          </p>

          {errorMessage && (
            <p className="text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55]">
              {errorMessage}
            </p>
          )}

          {/* Lista com rolagem máx. 320px */}
          <div className="max-h-[320px] overflow-y-auto space-y-2.5 pr-1">
            {activeRules.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6B7280] dark:text-[#A9B1B1]">
                Nenhuma transação recorrente ativa.
              </div>
            ) : (
              activeRules.map((rule) => {
                const isIncome = rule.type === 'RECEITA';
                const catName = rule.category_id != null ? catMap.get(Number(rule.category_id)) : null;
                const categoryDisplay = catName || 'Sem categoria';
                const freqLabel = rule.frequency === 'ANUAL' ? 'ANUAL' : 'MENSAL';
                const endLabel = rule.end_month ? rule.end_month : 'Indefinido';

                return (
                  <div
                    key={rule.id}
                    className="p-3 rounded-[12px] bg-black/[0.04] dark:bg-white/[0.05] border border-[#ECEFF1] dark:border-[#263233] flex items-center justify-between transition-colors"
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="text-[14px] font-bold text-[#111827] dark:text-[#F5F7F7] truncate">
                        {rule.description || 'Transação Recorrente'}
                      </div>

                      <div className="text-[12px] text-[#6B7280] dark:text-[#A9B1B1] truncate">
                        Categoria: {categoryDisplay} • Frequência: {freqLabel}
                      </div>

                      <div
                        className={`text-[11px] font-semibold truncate ${
                          isIncome
                            ? 'text-[#22A45D] dark:text-[#39D47A]'
                            : 'text-[#EF4444] dark:text-[#FF4D55]'
                        }`}
                      >
                        {formatCurrency(rule.value)} | Início: {rule.start_date || '-'} | Fim: {endLabel}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setRuleToEdit(rule);
                          setIsEditModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-[#22A45D] dark:text-[#39D47A] hover:bg-[#22A45D]/10 transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeactivateTarget(rule)}
                        className="p-1.5 rounded-lg text-[#EF4444] dark:text-[#FF4D55] hover:bg-[#EF4444]/10 transition-colors cursor-pointer"
                        title="Desativar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé */}
          <div className="pt-2 border-t border-[#ECEFF1] dark:border-[#263233] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-black/5 dark:bg-white/10 text-[#111827] dark:text-[#F5F7F7] hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
            >
              Concluído
            </button>
          </div>
        </div>
      </div>

      {/* Modal Editar Regra Recorrente */}
      <EditRecurringRuleModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setRuleToEdit(null);
        }}
        ruleToEdit={ruleToEdit}
        onSuccess={onSuccessToast}
      />

      {/* Confirmação de desativação */}
      {deactivateTarget && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setDeactivateTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#EF4444]/15 dark:bg-[#FF4D55]/20 text-[#EF4444] dark:text-[#FF4D55] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F7]">
                Desativar recorrência
              </h3>
            </div>

            <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
              Desativar esta recorrência? Os lançamentos já criados continuam na tela Transações.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ECEFF1] dark:border-[#263233]">
              <button
                type="button"
                onClick={() => setDeactivateTarget(null)}
                disabled={isProcessing}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#EF4444] dark:bg-[#FF4D55] text-white hover:brightness-105 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Desativar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
