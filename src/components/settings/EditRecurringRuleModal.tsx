import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { updateDoc } from 'firebase/firestore';
import { getUserDocRef, sanitizeForFirestore } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { RecurrenceRule } from '../../types/finance';

interface EditRecurringRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  ruleToEdit: RecurrenceRule | null;
  onSuccess: (msg: string) => void;
}

export const EditRecurringRuleModal: React.FC<EditRecurringRuleModalProps> = ({
  isOpen,
  onClose,
  ruleToEdit,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { data } = useFinance();

  const [description, setDescription] = useState('');
  const [valueStr, setValueStr] = useState('0,00');
  const [endMonth, setEndMonth] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && ruleToEdit) {
      setErrorMessage(null);
      setDescription(ruleToEdit.description || '');
      const val = Number(ruleToEdit.value) || 0;
      setValueStr(val.toFixed(2).replace('.', ','));
      setEndMonth(ruleToEdit.end_month || '');
    }
  }, [isOpen, ruleToEdit]);

  if (!isOpen || !ruleToEdit) return null;

  const parseValue = (str: string): number => {
    const clean = str.trim().replace(/\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const validateEndMonth = (val: string, startMonthStr: string): boolean => {
    if (!val.trim()) return true; // Vazio é válido (indefinido)
    const regex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!regex.test(val.trim())) return false;
    if (startMonthStr && startMonthStr.length >= 7) {
      const startM = startMonthStr.slice(0, 7);
      if (val.trim() < startM) return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!user || !ruleToEdit) return;

    const trimmedEndMonth = endMonth.trim();
    if (trimmedEndMonth && !validateEndMonth(trimmedEndMonth, ruleToEdit.start_date)) {
      setErrorMessage('Mês final inválido.');
      return;
    }

    const valNum = parseValue(valueStr);
    if (valNum <= 0) {
      setErrorMessage('O valor deve ser maior que zero.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const currentRules = data.recurrence_rules || [];
      const updatedRules = currentRules.map((r) =>
        Number(r.id) === Number(ruleToEdit.id)
          ? {
              ...r,
              description: description.trim(),
              value: valNum,
              end_month: trimmedEndMonth ? trimmedEndMonth : null,
            }
          : r
      );

      const docRef = getUserDocRef(user.uid);
      await updateDoc(docRef, {
        recurrence_rules: sanitizeForFirestore(updatedRules),
      });

      onSuccess('Regra recorrente atualizada!');
      onClose();
    } catch (err: any) {
      console.error('[EditRecurringRuleModal] Erro ao salvar regra:', err);
      setErrorMessage('Não foi possível salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
            Editar Regra Recorrente
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Descrição
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Aluguel, Assinatura Netflix"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#22A45D] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Valor (R$)
            </label>
            <input
              type="text"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              placeholder="0,00"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#22A45D] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Mês Final (AAAA-MM) ou Vazio
            </label>
            <input
              type="text"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              placeholder="Ex: 2026-12"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#22A45D] transition-colors"
            />
            <p className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
              Deixe vazio para recorrência indefinida.
            </p>
          </div>

          <p className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed italic bg-black/[0.03] dark:bg-white/[0.04] p-2.5 rounded-xl border border-[#ECEFF1] dark:border-[#263233]">
            Alterações valem para os próximos lançamentos. Lançamentos já criados não mudam — edite-os na tela Transações.
          </p>

          {errorMessage && (
            <p className="text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55]">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#ECEFF1] dark:border-[#263233]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] hover:brightness-105 active:scale-98 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Salvar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
