import React, { useState, useEffect } from 'react';
import { X, Loader2, ArrowRightLeft } from 'lucide-react';
import { AllocationMovement } from '../../types/finance';

interface EditMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: AllocationMovement | null;
  onSave: (movementId: number, amount: number, note: string | null) => Promise<void>;
}

export const EditMovementModal: React.FC<EditMovementModalProps> = ({
  isOpen,
  onClose,
  movement,
  onSave,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && movement) {
      setErrorMsg(null);
      setAmountStr(String(movement.amount || ''));
      setNote(movement.note || '');
    }
  }, [isOpen, movement]);

  if (!isOpen || !movement) return null;

  const numericAmount = parseFloat(amountStr.replace(',', '.')) || 0;
  const isFormValid = numericAmount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || saving) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      await onSave(movement.id, numericAmount, note.trim() || null);
      onClose();
    } catch (err: any) {
      console.error('Erro ao atualizar movimentação:', err);
      setErrorMsg(err?.message || 'Erro ao atualizar movimentação. Tente novamente.');
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
        className="w-full max-w-sm rounded-2xl bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-5 shadow-2xl space-y-4 text-[#111827] dark:text-[#F5F7F8]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[#E6E9EC] dark:border-[#283438] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold tracking-tight">
              Editar Movimentação 📝
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Erro */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-[#EF4444]/15 text-[#EF4444] dark:text-[#FF4D55] text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campo: Valor (R$) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
              Valor (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6B7280] dark:text-[#9FA9AB]">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0,00"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-xs font-bold focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A]"
                autoFocus
                required
              />
            </div>
          </div>

          {/* Campo: Nota / Observação */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
              Nota / Observação
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Aporte extra do mês, resgate para viagem"
              className="w-full px-3.5 py-2 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-xs font-medium focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] resize-none"
            />
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!isFormValid || saving}
              className="px-5 py-2.5 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
