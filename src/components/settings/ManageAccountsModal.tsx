import React, { useState } from 'react';
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { updateUserDocSafe } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { Account, AccountType } from '../../types/finance';
import { AccountFormModal } from './AccountFormModal';

interface ManageAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const ManageAccountsModal: React.FC<ManageAccountsModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const { user } = useAuth();
  const { data } = useFinance();

  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Confirmação / Bloqueio de exclusão
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [blockedCount, setBlockedCount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const accounts = data.accounts || [];

  const getAccountTypeLabel = (type: AccountType): string => {
    switch (type) {
      case 'DINHEIRO':
        return 'Dinheiro';
      case 'CARTAO_CREDITO':
        return 'Cartão de Crédito';
      case 'CONTA_CORRENTE':
      default:
        return 'Conta Corrente';
    }
  };

  const formatBalance = (val: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(val) || 0);
  };

  const handleToggleArchive = async (account: Account) => {
    if (!user) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const nextArchived = !account.archived;
      const updated = accounts.map((a) =>
        Number(a.id) === Number(account.id) ? { ...a, archived: nextArchived } : a
      );

      await updateUserDocSafe(user.uid, { accounts: updated });

      onSuccessToast(nextArchived ? 'Conta arquivada!' : 'Conta desarquivada!');
    } catch (err: any) {
      console.error('[ManageAccountsModal] Erro ao arquivar conta:', err);
      setErrorMessage('Não foi possível salvar. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteClick = (account: Account) => {
    setErrorMessage(null);
    const accId = Number(account.id);

    // Contar vínculos: transações (account_id ou to_account_id), regras recorrentes, planos de parcelas
    const txCount = (data.transactions || []).filter(
      (t) => Number(t.account_id) === accId || Number(t.to_account_id) === accId
    ).length;

    const recurrenceCount = (data.recurrence_rules || []).filter(
      (r) => Number(r.account_id) === accId
    ).length;

    const installmentCount = (data.installment_plans || []).filter(
      (p) => Number(p.account_id) === accId
    ).length;

    const totalLinks = txCount + recurrenceCount + installmentCount;

    setDeleteTarget(account);
    if (totalLinks > 0) {
      setBlockedCount(totalLinks);
    } else {
      setBlockedCount(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !deleteTarget) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const updated = accounts.filter((a) => Number(a.id) !== Number(deleteTarget.id));
      await updateUserDocSafe(user.uid, { accounts: updated });

      onSuccessToast('Conta excluída com sucesso!');
      setDeleteTarget(null);
      setBlockedCount(null);
    } catch (err: any) {
      console.error('[ManageAccountsModal] Erro ao excluir conta:', err);
      setErrorMessage('Não foi possível salvar. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArchiveInsteadOfDelete = async () => {
    if (!deleteTarget) return;
    await handleToggleArchive(deleteTarget);
    setDeleteTarget(null);
    setBlockedCount(null);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Topo */}
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
              Gerenciar Contas
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Botão Adicionar Nova Conta */}
          <button
            type="button"
            onClick={() => {
              setAccountToEdit(null);
              setIsFormOpen(true);
            }}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Nova Conta</span>
          </button>

          {errorMessage && (
            <p className="text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55]">
              {errorMessage}
            </p>
          )}

          {/* Lista com rolagem máxima 300px */}
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
            {accounts.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#6B7280] dark:text-[#A9B1B1]">
                Nenhuma conta cadastrada.
              </div>
            ) : (
              accounts.map((acc) => {
                const isArchived = !!acc.archived;
                return (
                  <div
                    key={acc.id}
                    className={`p-3 rounded-[10px] bg-black/[0.04] dark:bg-white/[0.05] border border-[#ECEFF1] dark:border-[#263233] flex items-center justify-between transition-colors ${
                      isArchived ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-[#111827] dark:text-[#F5F7F7] truncate">
                          {acc.name}
                        </span>
                        {isArchived && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[#6B7280] dark:text-[#A9B1B1]">
                            Arquivada
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-[#6B7280] dark:text-[#A9B1B1] truncate">
                        Tipo: {getAccountTypeLabel(acc.type)} | Saldo: {formatBalance(acc.initial_balance)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Arquivar / Desarquivar */}
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(acc)}
                        disabled={isProcessing}
                        className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        title={isArchived ? 'Desarquivar conta' : 'Arquivar conta'}
                      >
                        {isArchived ? (
                          <ArchiveRestore className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A]" />
                        ) : (
                          <Archive className="w-4 h-4" />
                        )}
                      </button>

                      {/* Editar */}
                      <button
                        type="button"
                        onClick={() => {
                          setAccountToEdit(acc);
                          setIsFormOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-[#22A45D] dark:text-[#39D47A] hover:bg-[#22A45D]/10 transition-colors cursor-pointer"
                        title="Editar conta"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {/* Excluir */}
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(acc)}
                        className="p-1.5 rounded-lg text-[#EF4444] dark:text-[#FF4D55] hover:bg-[#EF4444]/10 transition-colors cursor-pointer"
                        title="Excluir conta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé Concluído */}
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

      {/* Modal Formulário de Conta */}
      <AccountFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        accountToEdit={accountToEdit}
        onSuccess={onSuccessToast}
      />

      {/* Diálogo de Exclusão / Bloqueio com Lançamentos Órfãos */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            setDeleteTarget(null);
            setBlockedCount(null);
          }}
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
                {blockedCount != null ? 'Conta com lançamentos' : 'Excluir conta'}
              </h3>
            </div>

            {blockedCount != null ? (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                  Esta conta possui <strong className="text-[#111827] dark:text-[#F5F7F7]">{blockedCount}</strong> lançamentos. Para preservar seu histórico, arquive a conta em vez de excluir.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ECEFF1] dark:border-[#263233]">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(null);
                      setBlockedCount(null);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleArchiveInsteadOfDelete}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] hover:brightness-105 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Arquivar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                  Excluir a conta '{deleteTarget.name}'? Esta ação não pode ser desfeita.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ECEFF1] dark:border-[#263233]">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(null);
                      setBlockedCount(null);
                    }}
                    disabled={isProcessing}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#EF4444] dark:bg-[#FF4D55] text-white hover:brightness-105 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
