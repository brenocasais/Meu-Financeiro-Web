import React, { useState } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { updateDoc } from 'firebase/firestore';
import { getUserDocRef } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';

interface ClearAllDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const ClearAllDataModal: React.FC<ClearAllDataModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const { user } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfirmed = confirmText.trim().toUpperCase() === 'LIMPAR';

  const handleClear = async () => {
    if (!isConfirmed || !user) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const docRef = getUserDocRef(user.uid);
      // Numa única updateDoc, grava os 9 arrays como []
      await updateDoc(docRef, {
        accounts: [],
        categories: [],
        subcategories: [],
        transactions: [],
        budget_allocations: [],
        allocation_movements: [],
        goals: [],
        installment_plans: [],
        recurrence_rules: [],
      });

      onSuccessToast('Dados apagados com sucesso.');
      onClose();
    } catch (err: any) {
      console.error('[ClearAllDataModal] Erro ao limpar dados:', err);
      setErrorMessage('Não foi possível salvar. Tente novamente.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#EF4444]/30 dark:border-[#FF4D55]/30 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#EF4444]/15 dark:bg-[#FF4D55]/20 text-[#EF4444] dark:text-[#FF4D55] flex items-center justify-center shrink-0">
            <Trash2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-[#EF4444] dark:text-[#FF4D55]">
              Limpar Todos os Dados
            </h2>
            <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Ação destrutiva e irreversível
            </span>
          </div>
        </div>

        <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
          Atenção: esta ação é irreversível. Todas as suas contas, transações, categorias, subcategorias, metas e planejamentos serão apagados da sua conta, inclusive no aplicativo do celular.
        </p>

        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
            Para confirmar, digite 'LIMPAR' no campo abaixo:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="LIMPAR"
            className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono tracking-wider bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#EF4444] transition-colors"
          />
        </div>

        {errorMessage && (
          <p className="text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55]">
            {errorMessage}
          </p>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#ECEFF1] dark:border-[#263233]">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!isConfirmed || isDeleting}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              !isConfirmed || isDeleting
                ? 'opacity-40 cursor-not-allowed bg-black/10 dark:bg-white/10 text-[#6B7280]'
                : 'bg-[#EF4444] dark:bg-[#FF4D55] text-white hover:brightness-105 active:scale-98'
            }`}
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Apagar Tudo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
