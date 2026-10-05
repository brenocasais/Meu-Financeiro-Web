import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Trophy,
  ChevronRight,
  CreditCard,
  Banknote,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Bot,
  Bell,
  Settings,
  ChevronDown,
  X,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFinance, FinanceAlert } from '../context/FinanceContext';
import { TabType } from '../components/layout/BottomNav';
import {
  formatCurrencyBRL,
  calculateAccountBalance,
} from '../lib/financeLogic';
import { Account } from '../types/finance';
import { MonthYearPicker } from '../components/common/MonthYearPicker';

interface HomeScreenProps {
  onNavigateTab?: (tab: TabType) => void;
  onOpenSettings?: () => void;
}

const MONTH_NAMES_PT = [
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

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateTab,
  onOpenSettings,
}) => {
  const { user } = useAuth();
  const {
    data,
    loading,
    selectedMonth,
    setSelectedMonth,
    readyToAssignCalc,
    monthSummary,
    alerts,
    hideValues,
    toggleHideValues,
  } = useFinance();

  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // 1. Cabeçalho: Saudação dinâmica por horário
  // "Bom dia" (< 12h), "Boa tarde" (< 18h), "Boa noite" (>= 18h)
  const greeting = (() => {
    const hour = new Date().getHours();
    let timeGreeting = 'Bom dia';
    if (hour >= 18) {
      timeGreeting = 'Boa noite';
    } else if (hour >= 12) {
      timeGreeting = 'Boa tarde';
    }

    if (user?.displayName && user.displayName.trim().length > 0) {
      const firstName = user.displayName.trim().split(' ')[0];
      return `${timeGreeting}, ${firstName} 👋`;
    }

    if (user?.email && user.email.includes('@')) {
      const emailPrefix = user.email.split('@')[0];
      return `${timeGreeting}, ${emailPrefix} 👋`;
    }

    return 'Olá 👋';
  })();

  // Formatação do mês por extenso (ex: "Julho 2026")
  const formattedMonth = (() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const mIndex = parseInt(monthStr, 10) - 1;
    const name = MONTH_NAMES_PT[mIndex] || monthStr;
    return `${name} ${yearStr}`;
  })();

  // Helper para mascarar valores com o olho
  const maskValue = (formattedText: string): string => {
    if (hideValues) return '••••••';
    return formattedText;
  };

  // Contas ativas (não arquivadas)
  const activeAccounts = data.accounts.filter((acc) => !acc.archived);

  // Manipulador de clique em alerta
  const handleAlertClick = (alert: FinanceAlert) => {
    if (onNavigateTab) {
      onNavigateTab(alert.targetTab);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* 1. CABEÇALHO (Header superior do Dashboard) */}
      {/* ========================================================= */}
      <div
        id="dashboard-header"
        className="flex items-center justify-between pt-1 pb-1"
      >
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#111827] dark:text-[#F5F7F7]">
            {greeting}
          </h2>

          {/* Seletor de Mês por extenso em estilo Calendário */}
          <div className="relative mt-0.5">
            <button
              id="btn-select-month"
              type="button"
              onClick={() => setIsMonthPickerOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] cursor-pointer transition-colors"
              title="Clique para abrir calendário de mês e ano"
            >
              <Calendar className="w-3.5 h-3.5 text-[#22A45D] dark:text-[#39D47A]" />
              <span>{formattedMonth}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            <MonthYearPicker
              isOpen={isMonthPickerOpen}
              onClose={() => setIsMonthPickerOpen(false)}
              selectedMonth={selectedMonth}
              onChange={(newMonth) => setSelectedMonth(newMonth)}
            />
          </div>
        </div>

        {/* Ícones da direita: Notificações (com badge) e Ajustes */}
        <div className="flex items-center gap-1.5">
          {/* Sino de Notificações */}
          <div className="relative">
            <button
              id="btn-notifications"
              type="button"
              onClick={() => setIsNotificationsOpen((prev) => !prev)}
              className="relative p-2 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
              aria-label="Notificações e Alertas"
            >
              <Bell className="w-5 h-5" />
              {alerts.length > 0 && (
                <span
                  id="badge-notifications-count"
                  className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-[#EF4444] dark:bg-[#FF4D55] text-white text-[10px] font-bold flex items-center justify-center leading-none"
                >
                  {alerts.length}
                </span>
              )}
            </button>

            {/* Popover de Notificações */}
            {isNotificationsOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsNotificationsOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] shadow-lg p-3 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-[#E5E7EB] dark:border-[#222E30]">
                    <span className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
                      Alertas e Notificações
                    </span>
                    <span className="text-[10px] text-[#6B7280] dark:text-[#A9B1B1]">
                      {alerts.length} ativos
                    </span>
                  </div>
                  {alerts.length === 0 ? (
                    <div className="py-3 text-center text-xs text-[#6B7280] dark:text-[#A9B1B1]">
                      Nenhum alerta ativo no momento.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {alerts.map((al) => (
                        <div
                          key={al.id}
                          onClick={() => {
                            handleAlertClick(al);
                            setIsNotificationsOpen(false);
                          }}
                          className="p-2 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] cursor-pointer hover:border-[#22A45D] dark:hover:border-[#39D47A] transition-all"
                        >
                          <div className="text-[11px] font-bold text-[#111827] dark:text-[#F5F7F7]">
                            {al.title}
                          </div>
                          <div className="text-[10px] text-[#6B7280] dark:text-[#A9B1B1]">
                            {al.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Engrenagem de Ajustes */}
          <button
            id="btn-quick-settings"
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
            aria-label="Ajustes"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. CARD "Disponível para usar" (Hero) */}
      {/* ========================================================= */}
      <div
        id="card-hero-ready-to-assign"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] p-5 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] transition-colors"
      >
        {/* Linha 1: texto "Disponível para usar" à esquerda, olho à direita */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1]">
            Disponível para usar
          </span>
          <button
            id="btn-toggle-hide-values"
            type="button"
            onClick={toggleHideValues}
            className="p-1 rounded-lg text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] transition-colors cursor-pointer"
            aria-label={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
          >
            {hideValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Linha 2: Valor grande (Pronto para Atribuir) e Ícone de carteira num quadrado verde claro (52px) */}
        <div className="flex items-center justify-between mt-2">
          <div>
            <div
              id="value-ready-to-assign"
              className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                readyToAssignCalc.readyToAssign >= 0
                  ? 'text-[#22A45D] dark:text-[#39D47A]'
                  : 'text-[#EF4444] dark:text-[#FF4D55]'
              }`}
            >
              {maskValue(formatCurrencyBRL(readyToAssignCalc.readyToAssign))}
            </div>

            {/* Pílula verde clara com seta pra cima + texto "{diferença receitas-despesas do mês} este mês" */}
            <div className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] text-[11px] font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span>
                {maskValue(
                  `${formatCurrencyBRL(monthSummary.monthDiff)} este mês`
                )}
              </span>
            </div>
          </div>

          {/* Quadrado verde claro (52px) com ícone de carteira decorativo */}
          <div className="w-[52px] h-[52px] rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 flex items-center justify-center text-[#22A45D] dark:text-[#39D47A] shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Linha 3: Barra de progresso fina (5px) mostrando % do orçamento usado */}
        <div className="mt-5 space-y-1.5">
          <div className="w-full h-[5px] bg-[#E5E7EB] dark:bg-[#222E30] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                monthSummary.budgetUsedPercent > 100
                  ? 'bg-[#EF4444] dark:bg-[#FF4D55]'
                  : 'bg-[#22A45D] dark:bg-[#39D47A]'
              }`}
              style={{
                width: `${Math.min(monthSummary.budgetUsedPercent, 100)}%`,
              }}
            />
          </div>

          {/* Abaixo da barra: "{percentual}% do orçamento utilizado" à esquerda, "{valor restante} restantes" à direita */}
          <div className="flex items-center justify-between text-[11px] font-medium text-[#6B7280] dark:text-[#A9B1B1]">
            <span>{monthSummary.budgetUsedPercent}% do orçamento utilizado</span>
            <span>{maskValue(formatCurrencyBRL(monthSummary.budgetRemaining))} restantes</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. CARD "Resumo do mês" (3 colunas: Receitas | Despesas | Metas) */}
      {/* ========================================================= */}
      <div
        id="card-month-summary"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] p-4 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] transition-colors"
      >
        <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] dark:divide-[#222E30]">
          {/* Coluna 1: Receitas */}
          <div className="px-2 first:pl-0 last:pr-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-medium text-[#6B7280] dark:text-[#A9B1B1]">
                Receitas
              </span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-[#111827] dark:text-[#F5F7F7] truncate">
              {maskValue(formatCurrencyBRL(monthSummary.income))}
            </div>
            <div className="text-[10px] text-[#6B7280] dark:text-[#A9B1B1] mt-0.5 truncate">
              {monthSummary.incomeVariationPercent >= 0 ? '+' : ''}
              {monthSummary.incomeVariationPercent.toFixed(0)}% vs mês ant.
            </div>
          </div>

          {/* Coluna 2: Despesas */}
          <div className="px-2">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-[#EF4444]/10 dark:bg-[#FF4D55]/10 text-[#EF4444] dark:text-[#FF4D55] flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-medium text-[#6B7280] dark:text-[#A9B1B1]">
                Despesas
              </span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-[#111827] dark:text-[#F5F7F7] truncate">
              {maskValue(formatCurrencyBRL(monthSummary.expenses))}
            </div>
            <div className="text-[10px] text-[#6B7280] dark:text-[#A9B1B1] mt-0.5 truncate">
              {monthSummary.expensesVariationPercent >= 0 ? '+' : ''}
              {monthSummary.expensesVariationPercent.toFixed(0)}% vs mês ant.
            </div>
          </div>

          {/* Coluna 3: Metas */}
          <div className="px-2 first:pl-0 last:pr-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-full bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-medium text-[#6B7280] dark:text-[#A9B1B1]">
                Metas
              </span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-[#111827] dark:text-[#F5F7F7] truncate">
              {maskValue(formatCurrencyBRL(monthSummary.goalsContribution))}
            </div>
            <div className="text-[10px] text-[#6B7280] dark:text-[#A9B1B1] mt-0.5 truncate">
              {monthSummary.goalsVariationPercent >= 0 ? '+' : ''}
              {monthSummary.goalsVariationPercent.toFixed(0)}% vs mês ant.
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. SEÇÃO "Contas e cartões" */}
      {/* ========================================================= */}
      <div
        id="section-accounts"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] p-4 sm:p-5 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] transition-colors space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827] dark:text-[#F5F7F7]">
            Contas e cartões
          </h3>
          <button
            id="btn-view-all-accounts"
            type="button"
            onClick={onOpenSettings}
            className="text-xs font-semibold text-[#22A45D] dark:text-[#39D47A] hover:underline cursor-pointer"
          >
            Ver todas
          </button>
        </div>

        {activeAccounts.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1]">
              Nenhuma conta cadastrada
            </p>
            <button
              id="btn-add-account-empty"
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
            >
              Cadastrar Conta
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#222E30]">
            {activeAccounts.map((account) => {
              const balance = calculateAccountBalance(account, data.transactions);

              // Ícone e cores específicas conforme especificação do Android:
              // - CARTAO_CREDITO: ícone de cartão com fundo escuro #1E293B
              // - DINHEIRO: ícone de dinheiro
              // - CONTA_CORRENTE: ícone de banco, fundo verde claro
              let iconElement = <Building2 className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A]" />;
              let iconBgClass = 'bg-[#22A45D]/10 dark:bg-[#39D47A]/10';
              let typeLabel = 'Conta Corrente';

              if (account.type === 'CARTAO_CREDITO') {
                iconElement = <CreditCard className="w-4 h-4 text-white" />;
                iconBgClass = 'bg-[#1E293B]';
                typeLabel = 'Cartão de Crédito';
              } else if (account.type === 'DINHEIRO') {
                iconElement = <Banknote className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A]" />;
                iconBgClass = 'bg-[#22A45D]/10 dark:bg-[#39D47A]/10';
                typeLabel = 'Dinheiro';
              }

              // Saldo colorido: verde se positivo, vermelho se negativo ou cartão zerado
              const isPositive =
                account.type === 'CARTAO_CREDITO' ? balance > 0 : balance >= 0;

              return (
                <div
                  key={account.id}
                  onClick={onOpenSettings}
                  className="py-3 flex items-center justify-between cursor-pointer group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl ${iconBgClass} flex items-center justify-center shrink-0`}
                    >
                      {iconElement}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
                        {account.name}
                      </div>
                      <div className="text-[10px] text-[#6B7280] dark:text-[#A9B1B1]">
                        {typeLabel}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={`text-xs font-bold ${
                        isPositive
                          ? 'text-[#22A45D] dark:text-[#39D47A]'
                          : 'text-[#EF4444] dark:text-[#FF4D55]'
                      }`}
                    >
                      {maskValue(formatCurrencyBRL(balance))}
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#6B7280] dark:text-[#A9B1B1] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 5. SEÇÃO "Atenção necessária" */}
      {/* ========================================================= */}
      <div
        id="section-attention"
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] p-4 sm:p-5 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] transition-colors space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827] dark:text-[#F5F7F7]">
              Atenção necessária
            </h3>
            {alerts.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#EF4444] dark:bg-[#FF4D55] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {alerts.length}
              </span>
            )}
          </div>
        </div>

        {/* Se não houver alertas: card verde "Tudo sob controle! Nenhum orçamento estourado neste mês." */}
        {alerts.length === 0 ? (
          <div className="p-3.5 rounded-xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 border border-[#22A45D]/20 dark:border-[#39D47A]/20 flex items-center gap-3 text-xs text-[#22A45D] dark:text-[#39D47A]">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="font-semibold">
              Tudo sob controle! Nenhum orçamento estourado neste mês.
            </span>
          </div>
        ) : (
          /* Se houver alertas: lista com ícone colorido por severidade, título, mensagem, seta, clicável */
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#222E30]">
            {alerts.map((alert) => {
              let icon = <AlertTriangle className="w-4 h-4 text-[#EF4444] dark:text-[#FF4D55]" />;
              let bg = 'bg-[#EF4444]/10 dark:bg-[#FF4D55]/10';

              if (alert.type === 'warning') {
                icon = <AlertTriangle className="w-4 h-4 text-[#F59E0B] dark:text-[#FF9F1C]" />;
                bg = 'bg-[#F59E0B]/10 dark:bg-[#FF9F1C]/10';
              } else if (alert.type === 'success') {
                icon = <Trophy className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A]" />;
                bg = 'bg-[#22A45D]/10 dark:bg-[#39D47A]/10';
              }

              return (
                <div
                  key={alert.id}
                  onClick={() => handleAlertClick(alert)}
                  className="py-2.5 flex items-center justify-between cursor-pointer group hover:bg-black/[0.02] dark:hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0`}
                    >
                      {icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
                        {alert.title}
                      </div>
                      <div className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
                        {alert.message}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-[#6B7280] dark:text-[#A9B1B1] group-hover:translate-x-0.5 transition-transform shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 6. CARD "Assistente financeiro" */}
      {/* ========================================================= */}
      <div
        id="card-ai-assistant"
        onClick={() => setIsAiModalOpen(true)}
        className="rounded-[18px] bg-[#FFFFFF] dark:bg-[#172021] p-4 sm:p-5 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] transition-colors cursor-pointer group hover:border-[#22A45D] dark:hover:border-[#39D47A]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
                  Assistente financeiro
                </h3>
                <span className="px-1.5 py-0.5 rounded-md bg-[#22A45D] text-white dark:bg-[#39D47A] dark:text-[#0D1214] text-[10px] font-bold">
                  Novo
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1] mt-0.5">
                Pergunte, analise e tome melhores decisões com IA.
              </p>
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-[#6B7280] dark:text-[#A9B1B1] group-hover:translate-x-0.5 transition-transform shrink-0" />
        </div>
      </div>

      {/* Modal / Placeholder do Assistente Financeiro */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#22A45D] dark:text-[#39D47A]">
                <Sparkles className="w-5 h-5" />
                <h4 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F7]">
                  Assistente Financeiro IA
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center mx-auto">
                <Bot className="w-6 h-6" />
              </div>
              <h5 className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
                Em breve
              </h5>
              <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                A integração do assistente inteligente com o Gemini e análises preditivas do seu orçamento será disponibilizada em uma fase dedicada.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsAiModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-semibold shadow-xs cursor-pointer hover:opacity-90 transition-opacity"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
