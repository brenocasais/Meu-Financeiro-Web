import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { updateUserDocSafe } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { Account, AccountType } from '../../types/finance';
import { generateUniqueNumericId, collectAllExistingNumericIds } from '../../lib/financeLogic';
import { parseBRLInput } from '../../lib/parseBRLInput';

interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountToEdit?: Account | null;
  onSuccess: (msg: string) => void;
}

export const AccountFormModal: React.FC<AccountFormModalProps> = ({
  isOpen,
  onClose,
  accountToEdit,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { data } = useFinance();

  const [name, setName] = useState('');
  const [balanceStr, setBalanceStr] = useState('0,00');
  const [type, setType] = useState<AccountType>('CONTA_CORRENTE');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEditing = !!accountToEdit;

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (accountToEdit) {
        setName(accountToEdit.name);
        const bal = Number(accountToEdit.initial_balance) || 0;
        setBalanceStr(bal.toFixed(2).replace('.', ','));
        setType(accountToEdit.type || 'CONTA_CORRENTE');
      } else {
        setName('');
        setBalanceStr('0,00');
        setType('CONTA_CORRENTE');
      }
    }
  }, [isOpen, accountToEdit]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim() || !user) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const initial_balance = parseBRLInput(balanceStr);
      const currentAccounts = data.accounts || [];

      let updatedAccounts: Account[];

      if (isEditing && accountToEdit) {
        updatedAccounts = currentAccounts.map((acc) =>
          Number(acc.id) === Number(accountToEdit.id)
            ? { ...acc, name: name.trim(), type, initial_balance }
            : acc
        );
      } else {
        const usedIds = collectAllExistingNumericIds(data);
        const newId = generateUniqueNumericId(usedIds);
        const newAccount: Account = {
          id: newId,
          name: name.trim(),
          type,
          initial_balance,
          archived: false,
        };
        updatedAccounts = [...currentAccounts, newAccount];
      }

      await updateUserDocSafe(user.uid, {
        accounts: updatedAccounts,
      });

      onSuccess(isEditing ? 'Conta atualizada!' : 'Conta criada com sucesso!');
      onClose();
    } catch (err: any) {
      console.error('[AccountFormModal] Erro ao salvar conta:', err);
      setErrorMessage('Não foi possível salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-6 shadow-xl space-y-5 animate-in zoom-in-95 duration-150 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
            {isEditing ? 'Editar Conta' : 'Nova Conta'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Nome da Conta
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Nubank, Carteira, Itaú"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#22A45D] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Saldo Inicial (R$)
            </label>
            <input
              type="text"
              value={balanceStr}
              onChange={(e) => setBalanceStr(e.target.value)}
              placeholder="0,00"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#22A45D] transition-colors"
            />
            <p className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
              Aceita valores negativos (ex: fatura de cartão de crédito inicial).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Tipo de Conta
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { typeKey: 'CONTA_CORRENTE', label: 'Conta Corrente' },
                  { typeKey: 'DINHEIRO', label: 'Dinheiro' },
                  { typeKey: 'CARTAO_CREDITO', label: 'Cartão de Crédito' },
                ] as const
              ).map((opt) => {
                const isSelected = type === opt.typeKey;
                return (
                  <button
                    key={opt.typeKey}
                    type="button"
                    onClick={() => setType(opt.typeKey)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'border-[#22A45D] dark:border-[#39D47A] bg-[#22A45D]/10 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] font-bold'
                        : 'border-[#ECEFF1] dark:border-[#263233] bg-[#FAFAFB] dark:bg-[#0D1315] text-[#6B7280] dark:text-[#A9B1B1] hover:border-[#6B7280]/40'
                    }`}
                  >
                    <span className="text-xs leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

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
            disabled={!name.trim() || isSaving}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              !name.trim() || isSaving
                ? 'opacity-50 cursor-not-allowed bg-black/10 dark:bg-white/10 text-[#6B7280]'
                : 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] hover:brightness-105 active:scale-98'
            }`}
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Salvar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
