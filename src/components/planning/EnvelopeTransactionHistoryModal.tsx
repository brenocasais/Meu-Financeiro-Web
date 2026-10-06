import React, { useMemo } from 'react';
import {
  X,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  Receipt,
} from 'lucide-react';
import { Transaction, Account } from '../../types/finance';
import { formatCurrencyBRL } from '../../lib/financeLogic';

interface EnvelopeTransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: number;
  subcategoryId?: number | null;
  categoryName: string;
  subcategoryName?: string | null;
  selectedMonth: string; // "YYYY-MM"
  transactions: Transaction[];
  accounts: Account[];
  hideValues: boolean;
  onSelectTransaction: (txId: string | number, txDate?: string) => void;
}

function formatMonthYearTitle(monthStr: string): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [y, m] = monthStr.split('-');
  const monthNames = [
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
  const idx = parseInt(m, 10) - 1;
  const name = monthNames[idx] || m;
  return `${name} ${y}`;
}

function formatDayMonth(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const m = parts[1];
  const d = parts[2];
  return `${d}/${m}`;
}

export const EnvelopeTransactionHistoryModal: React.FC<EnvelopeTransactionHistoryModalProps> = ({
  isOpen,
  onClose,
  categoryId,
  subcategoryId,
  categoryName,
  subcategoryName,
  selectedMonth,
  transactions,
  accounts,
  hideValues,
  onSelectTransaction,
}) => {
  const accountMap = useMemo(() => {
    const map = new Map<number, string>();
    accounts.forEach((a) => map.set(Number(a.id), a.name));
    return map;
  }, [accounts]);

  // Filtrar transações do mês e do envelope específico
  const envelopeTransactions = useMemo(() => {
    const list = transactions.filter((t) => {
      if (!t.date || !t.date.startsWith(selectedMonth)) return false;
      // Não listar transações de meta aqui (as metas são acompanhadas em Metas)
      if ((t as any).destination_goal_id != null) return false;
      if (Number(t.category_id) !== Number(categoryId)) return false;
      if (subcategoryId != null) {
        if (Number(t.subcategory_id) !== Number(subcategoryId)) return false;
      } else {
        // Se categoria sem sub ou toque na categoria: subcategory_id nulo
        if (t.subcategory_id != null) return false;
      }
      return true;
    });

    // Ordem: data mais recente primeiro
    list.sort((a, b) => {
      const dateDiff = String(b.date).localeCompare(String(a.date));
      if (dateDiff !== 0) return dateDiff;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

    return list;
  }, [transactions, selectedMonth, categoryId, subcategoryId]);

  if (!isOpen) return null;

  const maskValue = (formattedText: string): string => {
    if (hideValues) return '••••••';
    return formattedText;
  };

  const titleHierarchy = subcategoryName
    ? `${categoryName} > ${subcategoryName}`
    : categoryName;

  const formattedMonthTitle = formatMonthYearTitle(selectedMonth);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-5 shadow-2xl space-y-4 text-[#111827] dark:text-[#F5F7F8]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho com título do envelope e subtítulo "Transações do mês {Mês aaaa}" */}
        <div className="flex items-start justify-between border-b border-[#E6E9EC] dark:border-[#283438] pb-3">
          <div className="space-y-0.5 min-w-0 pr-2">
            <h3 className="text-base font-bold tracking-tight leading-tight truncate">
              {titleHierarchy}
            </h3>
            <div className="text-xs text-[#6B7280] dark:text-[#9FA9AB] font-medium">
              Transações do mês {formattedMonthTitle}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Transações (rolável, altura máx. ~450px) */}
        <div className="max-h-[420px] overflow-y-auto space-y-1.5 pr-0.5">
          {envelopeTransactions.length === 0 ? (
            <div className="py-12 text-center space-y-2 border border-dashed border-[#E6E9EC] dark:border-[#283438] rounded-2xl">
              <Receipt className="w-8 h-8 text-[#6B7280] dark:text-[#9FA9AB] mx-auto opacity-70" />
              <p className="text-xs font-medium text-[#6B7280] dark:text-[#9FA9AB] px-4">
                Nenhuma transação neste envelope em {formattedMonthTitle}.
              </p>
            </div>
          ) : (
            envelopeTransactions.map((tx) => {
              const isIncome = tx.type === 'RECEITA';
              const isExpense = tx.type === 'DESPESA';
              const isTransfer = tx.type === 'TRANSFERENCIA';

              let icon = <ArrowUp className="w-4 h-4 text-white" />;
              let bgCircle = 'bg-[#22A45D] dark:bg-[#39D47A]';

              if (isExpense) {
                icon = <ArrowDown className="w-4 h-4 text-white" />;
                bgCircle = 'bg-[#EF4444] dark:bg-[#FF4D55]';
              } else if (isTransfer) {
                icon = <ArrowRightLeft className="w-4 h-4 text-white" />;
                bgCircle = 'bg-[#3B82F6]';
              }

              const originAccount = accountMap.get(Number(tx.account_id)) || 'Conta';
              const destAccount = tx.to_account_id != null ? accountMap.get(Number(tx.to_account_id)) || 'Conta' : '';
              const accountDisplay = isTransfer
                ? `${originAccount} → ${destAccount}`
                : originAccount;

              const valFormatted = maskValue(formatCurrencyBRL(Number(tx.value) || 0));
              const dateLabel = formatDayMonth(String(tx.date || ''));

              return (
                <div
                  key={tx.id}
                  onClick={() => {
                    onClose();
                    onSelectTransaction(tx.id, tx.date);
                  }}
                  className="p-2.5 rounded-xl border border-[#E6E9EC] dark:border-[#283438] bg-[#FAFAFB] dark:bg-[#1A2326] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-all flex items-center justify-between gap-3 active:scale-98"
                  title="Tocar para ver na aba Transações"
                >
                  {/* Esquerda: Círculo de 36px + Descrição + Linha secundária com nome da conta */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full ${bgCircle} flex items-center justify-center shrink-0 shadow-2xs`}
                    >
                      {icon}
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#111827] dark:text-[#F5F7F8] truncate leading-tight">
                        {tx.description || (isIncome ? 'Receita' : isExpense ? 'Despesa' : 'Transferência')}
                      </div>
                      <div className="text-[11px] text-[#6B7280] dark:text-[#9FA9AB] truncate mt-0.5 leading-tight">
                        {accountDisplay}
                      </div>
                    </div>
                  </div>

                  {/* Direita: Valor em reais (+ verde para receita, - padrão para despesa/transferência) + Data */}
                  <div className="text-right shrink-0 space-y-0.5">
                    <div
                      className={`text-xs font-bold leading-tight ${
                        isIncome
                          ? 'text-[#22A45D] dark:text-[#39D47A]'
                          : 'text-[#111827] dark:text-[#F5F7F8]'
                      }`}
                    >
                      {isIncome && '+ '}
                      {(isExpense || isTransfer) && '- '}
                      {valFormatted}
                    </div>
                    <div className="text-[10px] text-[#6B7280] dark:text-[#9FA9AB] leading-tight">
                      {dateLabel}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé com Botão Fechar */}
        <div className="pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-black/5 dark:hover:bg-white/10 hover:bg-black/10 dark:bg-white/5 text-xs font-bold text-[#111827] dark:text-[#F5F7F8] transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
