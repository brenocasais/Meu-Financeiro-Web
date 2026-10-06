import React, { useState, useRef } from 'react';
import { Header } from './Header';
import { BottomNav, TabType } from './BottomNav';
import { OfflineBanner } from '../pwa/OfflineBanner';
import { HomeScreen } from '../../screens/HomeScreen';
import { TransactionsScreen } from '../../screens/TransactionsScreen';
import { PlanningScreen } from '../../screens/PlanningScreen';
import { MetricsScreen } from '../../screens/MetricsScreen';
import { GoalsScreen } from '../../screens/GoalsScreen';
import { SettingsScreen } from '../../screens/SettingsScreen';
import { LoginScreen } from '../../screens/LoginScreen';
import { FormulaValidator } from '../common/FormulaValidator';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { Loader2, ArrowLeft } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const { data, selectedMonth, setSelectedMonth } = useFinance();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Estados para destaque de transação vindo do Planejamento (Fase 5c)
  const [highlightedTransactionId, setHighlightedTransactionId] = useState<string | number | null>(null);
  const [previousTab, setPreviousTab] = useState<TabType | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setIsSettingsOpen(false);
  };

  const toggleSettings = () => {
    setIsSettingsOpen((prev) => !prev);
  };

  // Abrir e destacar transação a partir do histórico do Planejamento
  const handleOpenTransaction = (id: string | number) => {
    // Procura a transação para saber seu mês
    const tx = data.transactions.find((t) => String(t.id) === String(id));
    if (tx && tx.date) {
      const txMonth = String(tx.date).slice(0, 7);
      if (txMonth && txMonth !== selectedMonth) {
        setSelectedMonth(txMonth);
      }
    }

    setPreviousTab('planning');
    setHighlightedTransactionId(id);
    setActiveTab('transactions');

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    // Destaque pulsa por ~3s
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedTransactionId(null);
    }, 3500);
  };

  // Voltar ao Planejamento a partir do botão flutuante
  const handleBackToPlanning = () => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightedTransactionId(null);
    setPreviousTab(null);
    setActiveTab('planning');
  };

  // 1. Estado de carregamento: enquanto o Firebase verifica a sessão ativa
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFB] dark:bg-[#0D1214] flex flex-col items-center justify-center p-4 transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] font-bold text-lg flex items-center justify-center shadow-xs">
            MF
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
            <Loader2 className="w-4 h-4 animate-spin text-[#22A45D] dark:text-[#39D47A]" />
            <span>Verificando sessão...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Proteção de rota: se não estiver autenticado, renderizar estritamente a tela de Login
  // Ocultando Header principal, BottomNav e todas as telas internas
  if (!isAuthenticated) {
    return (
      <>
        <OfflineBanner />
        <LoginScreen />
      </>
    );
  }

  // 3. Usuário autenticado: exibir Header, telas internas e BottomNav
  return (
    <div className="min-h-screen bg-[#FAFAFB] dark:bg-[#0D1214] text-[#111827] dark:text-[#F5F7F7] flex flex-col transition-colors duration-150">
      <OfflineBanner />
      
      {/* Header global do app */}
      <Header
        onOpenSettings={toggleSettings}
        isSettingsOpen={isSettingsOpen}
      />

      {/* Main content container: centered on desktop and mobile, with bottom padding for fixed nav */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 pb-24 space-y-4">
        {/* Render Settings view if active, otherwise the selected tab */}
        {isSettingsOpen ? (
          <SettingsScreen onClose={() => setIsSettingsOpen(false)} />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeScreen
                onNavigateTab={handleSelectTab}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            )}
            {activeTab === 'transactions' && (
              <TransactionsScreen
                highlightedTransactionId={highlightedTransactionId}
                onClearHighlight={() => setHighlightedTransactionId(null)}
              />
            )}
            {activeTab === 'planning' && (
              <PlanningScreen
                onOpenTransaction={handleOpenTransaction}
              />
            )}
            {activeTab === 'metrics' && <MetricsScreen />}
            {activeTab === 'goals' && <GoalsScreen />}
            
            {/* Built-in interactive formula validation for Phase 1 verification */}
            <FormulaValidator />
          </>
        )}
      </main>

      {/* Botão flutuante "← Voltar ao Planejamento" enquanto o destaque estiver ativo */}
      {highlightedTransactionId != null && activeTab === 'transactions' && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <button
            type="button"
            onClick={handleBackToPlanning}
            className="px-4 py-2.5 rounded-full bg-[#111827] dark:bg-[#1E292B] text-white dark:text-[#F5F7F8] text-xs font-bold shadow-2xl border border-gray-700/40 hover:bg-black dark:hover:bg-[#283438] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Planejamento</span>
          </button>
        </div>
      )}

      {/* Fixed bottom navigation bar with 5 items on ALL screen sizes */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
      />
    </div>
  );
};
