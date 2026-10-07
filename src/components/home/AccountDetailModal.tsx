import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Account, Transaction, InstallmentPlan } from '../../types/finance';
import { useFinance } from '../../context/FinanceContext';
import {
  formatCurrencyBRL,
  calculateAccountBalance,
} from '../../lib/financeLogic';

interface AccountDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
}

const MONTH_NAMES_FULL = [
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

function formatDateBRL(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function getPreviousMonth(monthStr: string): string {
  const [yStr, mStr] = monthStr.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) - 1;
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

function getNextMonth(monthStr: string): string {
  const [yStr, mStr] = monthStr.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  isOpen,
  onClose,
  account,
}) => {
  const { data, selectedMonth, hideValues } = useFinance();

  // Seletor de mês exclusivo do cartão (começa no mês selecionado do app)
  const [cardMonth, setCardMonth] = useState<string>(selectedMonth);
  // Paginação do extrato
  const [visibleCount, setVisibleCount] = useState<number>(50);

  // Reseta estado sempre que abrir ou mudar de conta
  useEffect(() => {
    if (isOpen) {
      setCardMonth(selectedMonth);
      setVisibleCount(50);
    }
  }, [isOpen, account, selectedMonth]);

  // Fechar com tecla ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const maskValue = (val: string) => (hideValues ? '••••••' : val);

  // Mês real atual para contagem de parcelas pagas
  const realTodayMonthStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  // Mapas rápidos de categorias e subcategorias
  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    (data.categories || []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [data.categories]);

  const subcategoryMap = useMemo(() => {
    const map = new Map<number, string>();
    (data.subcategories || []).forEach((s) => map.set(s.id, s.name));
    return map;
  }, [data.subcategories]);

  const installmentPlanMap = useMemo(() => {
    const map = new Map<number, InstallmentPlan>();
    (data.installment_plans || []).forEach((p) => map.set(p.id, p));
    return map;
  }, [data.installment_plans]);

  // Tipo legível da conta
  const readableType = useMemo(() => {
    if (!account) return '';
    if (account.type === 'DINHEIRO') return 'Dinheiro';
    if (account.type === 'CONTA_CORRENTE') return 'Conta Corrente';
    if (account.type === 'CARTAO_CREDITO') return 'Cartão de Crédito';
    return account.type;
  }, [account]);

  // Transações ordenadas da mais recente para a mais antiga (date desc, id desc)
  const allAccountTransactions = useMemo(() => {
    if (!account) return [];
    return (data.transactions || [])
      .filter((t) => t.account_id === account.id || t.to_account_id === account.id)
      .sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return Number(b.id) - Number(a.id);
      });
  }, [account, data.transactions]);

  // Saldo real da conta comum
  const realBalance = useMemo(() => {
    if (!account) return 0;
    return calculateAccountBalance(account, data.transactions || []);
  }, [account, data.transactions]);

  // Fatura do Cartão de Crédito no mês selecionado do modal
  // Fatura = Σ DESPESA do cartão - Σ RECEITA do cartão - Σ TRANSFERENCIA recebida + Σ TRANSFERENCIA enviada
  const cardInvoice = useMemo(() => {
    if (!account || account.type !== 'CARTAO_CREDITO') return 0;
    let sum = 0;
    (data.transactions || []).forEach((t) => {
      const tMonth = t.date ? t.date.slice(0, 7) : '';
      if (tMonth !== cardMonth) return;

      if (t.type === 'DESPESA' && t.account_id === account.id) {
        sum += Number(t.value) || 0;
      } else if (t.type === 'RECEITA' && t.account_id === account.id) {
        sum -= Number(t.value) || 0;
      } else if (t.type === 'TRANSFERENCIA') {
        if (t.to_account_id === account.id) {
          // Pagamento de fatura recebido pelo cartão
          sum -= Number(t.value) || 0;
        } else if (t.account_id === account.id) {
          // Transferência enviada pelo cartão
          sum += Number(t.value) || 0;
        }
      }
    });
    return sum;
  }, [account, cardMonth, data.transactions]);

  // Transações da fatura do mês atual do cartão
  const cardMonthTransactions = useMemo(() => {
    if (!account || account.type !== 'CARTAO_CREDITO') return [];
    return allAccountTransactions.filter(
      (t) => t.date && t.date.slice(0, 7) === cardMonth
    );
  }, [account, allAccountTransactions, cardMonth]);

  // Parcelamentos ativos da conta
  const accountInstallmentPlans = useMemo(() => {
    if (!account) return [];
    const plans = (data.installment_plans || []).filter(
      (p) => p.account_id === account.id
    );

    return plans
      .map((plan) => {
        const planTxs = (data.transactions || []).filter(
          (t) => t.installment_plan_id === plan.id
        );
        const pagasCount = planTxs.filter(
          (t) => t.date && t.date.slice(0, 7) <= realTodayMonthStr
        ).length;
        const isQuitado = pagasCount >= plan.installments_count;
        return {
          plan,
          pagasCount,
          isQuitado,
          monthlyValue:
            plan.installments_count > 0
              ? plan.total_value / plan.installments_count
              : plan.total_value,
        };
      })
      .sort((a, b) => {
        // Planos em andamento primeiro, quitados por último
        if (a.isQuitado === b.isQuitado) {
          return b.plan.id - a.plan.id;
        }
        return a.isQuitado ? 1 : -1;
      });
  }, [account, data.installment_plans, data.transactions, realTodayMonthStr]);

  if (!isOpen || !account) return null;

  const isCreditCard = account.type === 'CARTAO_CREDITO';
  const displayedTransactions = isCreditCard
    ? cardMonthTransactions
    : allAccountTransactions;
  const paginatedTransactions = displayedTransactions.slice(0, visibleCount);

  // Formatação do mês da fatura (ex: "Outubro/2026")
  const formattedCardMonthLabel = (() => {
    const [yStr, mStr] = cardMonth.split('-');
    const mIdx = parseInt(mStr, 10) - 1;
    return `${MONTH_NAMES_FULL[mIdx] || mStr}/${yStr}`;
  })();

  const renderTransactionRow = (tx: Transaction) => {
    // 1. Selo N/M se for parcela
    let installmentBadge: React.ReactNode = null;
    if (tx.installment_plan_id && tx.installment_number) {
      const plan = installmentPlanMap.get(tx.installment_plan_id);
      const totalCount = plan?.installments_count ?? '?';
      installmentBadge = (
        <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
          {tx.installment_number}/{totalCount}
        </span>
      );
    }

    // 2. Subtítulo: DD/MM/AAAA • Categoria/Subcategoria ou Transferência
    let subtitle = formatDateBRL(tx.date);
    if (tx.type === 'TRANSFERENCIA') {
      subtitle += ' • Transferência';
    } else {
      const catName = tx.category_id ? categoryMap.get(tx.category_id) : null;
      const subName = tx.subcategory_id ? subcategoryMap.get(tx.subcategory_id) : null;
      if (catName && subName) {
        subtitle += ` • ${catName}/${subName}`;
      } else if (catName) {
        subtitle += ` • ${catName}`;
      }
    }

    // 3. Valor com sinal e cor
    let sign = '';
    let isIncome = false;
    let isExpense = false;

    if (tx.type === 'RECEITA') {
      sign = '+ ';
      isIncome = true;
    } else if (tx.type === 'DESPESA') {
      sign = '- ';
      isExpense = true;
    } else if (tx.type === 'TRANSFERENCIA') {
      if (tx.account_id === account.id) {
        // Origem (saída)
        sign = '- ';
        isExpense = true;
      } else {
        // Destino (entrada)
        sign = '+ ';
        isIncome = true;
      }
    }

    const valueColorClass = isIncome
      ? 'text-[#22A45D] dark:text-[#39D47A]'
      : isExpense
      ? 'text-[#EF4444] dark:text-[#FF4D55]'
      : 'text-[#111827] dark:text-[#F5F7F7]';

    return (
      <div
        key={tx.id}
        className="py-2.5 flex items-center justify-between border-b border-[#ECEFF1] dark:border-[#263233] last:border-b-0"
      >
        <div className="min-w-0 pr-3">
          <div className="flex items-center text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
            <span className="truncate">{tx.description}</span>
            {installmentBadge}
          </div>
          <div className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1] mt-0.5">
            {subtitle}
          </div>
        </div>

        <div className={`text-xs font-bold shrink-0 ${valueColorClass}`}>
          {sign}
          {maskValue(formatCurrencyBRL(tx.value))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="max-w-md w-full max-h-[85vh] flex flex-col bg-[#FFFFFF] dark:bg-[#172021] rounded-2xl shadow-xl border border-[#ECEFF1] dark:border-[#263233] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-4 border-b border-[#ECEFF1] dark:border-[#263233] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#111827] dark:text-[#F5F7F7] leading-tight">
              {account.name}
            </h2>
            <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1]">
              {readableType}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com rolagem interna */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Seletor de mês exclusivo do Cartão de Crédito */}
          {isCreditCard && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233]">
              <button
                type="button"
                onClick={() => setCardMonth((prev) => getPreviousMonth(prev))}
                className="p-1 rounded-lg text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Mês anterior"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
                {formattedCardMonthLabel}
              </span>
              <button
                type="button"
                onClick={() => setCardMonth((prev) => getNextMonth(prev))}
                className="p-1 rounded-lg text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title="Próximo mês"
                aria-label="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Card de Saldo ou Fatura */}
          {isCreditCard ? (
            <div className="p-4 rounded-2xl bg-[#EF4444]/10 dark:bg-[#FF4D55]/10 border border-[#EF4444]/20 dark:border-[#FF4D55]/20 space-y-1">
              <div className="text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55]">
                Fatura de {formattedCardMonthLabel}
              </div>
              <div
                className={`text-2xl font-extrabold ${
                  cardInvoice < 0
                    ? 'text-[#22A45D] dark:text-[#39D47A]'
                    : 'text-[#EF4444] dark:text-[#FF4D55]'
                }`}
              >
                {maskValue(formatCurrencyBRL(cardInvoice))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 border border-[#22A45D]/20 dark:border-[#39D47A]/20 space-y-1">
              <div className="text-xs font-semibold text-[#22A45D] dark:text-[#39D47A]">
                Saldo Atual
              </div>
              <div
                className={`text-2xl font-extrabold ${
                  realBalance >= 0
                    ? 'text-[#22A45D] dark:text-[#39D47A]'
                    : 'text-[#EF4444] dark:text-[#FF4D55]'
                }`}
              >
                {maskValue(formatCurrencyBRL(realBalance))}
              </div>
            </div>
          )}

          {/* Histórico / Transações */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F7]">
              {isCreditCard ? 'Transações deste mês:' : 'Histórico (Extrato):'}
            </h3>

            {displayedTransactions.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#6B7280] dark:text-[#A9B1B1]">
                {isCreditCard
                  ? 'Nenhuma despesa registrada nesta fatura.'
                  : 'Nenhuma movimentação para esta conta.'}
              </div>
            ) : (
              <div className="divide-y divide-[#ECEFF1] dark:divide-[#263233]">
                {paginatedTransactions.map(renderTransactionRow)}
              </div>
            )}

            {displayedTransactions.length > visibleCount && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 50)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[#111827] dark:text-[#F5F7F7] transition-colors cursor-pointer"
                >
                  Mostrar mais
                </button>
              </div>
            )}
          </div>

          {/* 1.4 Parcelamentos Ativos (para QUALQUER tipo de conta) */}
          {accountInstallmentPlans.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#ECEFF1] dark:border-[#263233]">
              <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F7]">
                Parcelamentos ativos:
              </h3>

              <div className="space-y-2.5">
                {accountInstallmentPlans.map(
                  ({ plan, pagasCount, isQuitado, monthlyValue }) => {
                    const catName = plan.category_id
                      ? categoryMap.get(plan.category_id)
                      : null;
                    const subName = plan.subcategory_id
                      ? subcategoryMap.get(plan.subcategory_id)
                      : null;

                    let catSubStr = '';
                    if (catName && subName) {
                      catSubStr = `${catName} / ${subName}`;
                    } else if (catName) {
                      catSubStr = catName;
                    }

                    const progressPercent = Math.min(
                      100,
                      Math.max(
                        0,
                        plan.installments_count > 0
                          ? (pagasCount / plan.installments_count) * 100
                          : 100
                      )
                    );

                    return (
                      <div
                        key={plan.id}
                        className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] space-y-2"
                      >
                        {/* Linha 1 */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7] truncate">
                              {plan.description}
                            </div>
                            {catSubStr && (
                              <div className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
                                {catSubStr}
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 text-right">
                            {isQuitado ? (
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#22A45D]/10 text-[#22A45D] dark:bg-[#39D47A]/10 dark:text-[#39D47A]">
                                Quitado
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-[#22A45D] dark:text-[#39D47A]">
                                {maskValue(formatCurrencyBRL(monthlyValue))} / mês
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Linha 2 */}
                        <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-[#A9B1B1]">
                          <span>
                            {pagasCount} de {plan.installments_count} pagas
                          </span>
                          <span>
                            Total: {maskValue(formatCurrencyBRL(plan.total_value))}
                          </span>
                        </div>

                        {/* Linha 3: Barra de progresso */}
                        <div className="w-full h-1.5 rounded-full bg-[#22A45D]/10 dark:bg-[#39D47A]/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#22A45D] dark:bg-[#39D47A] transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>

        {/* 1.5 Rodapé */}
        <div className="p-4 border-t border-[#ECEFF1] dark:border-[#263233] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-[#222E30] hover:bg-gray-200 dark:hover:bg-[#2A393C] text-xs font-bold text-[#111827] dark:text-[#F5F7F7] transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
