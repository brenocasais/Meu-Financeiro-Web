import React, { useState } from 'react';
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
import { Loader2 } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setIsSettingsOpen(false);
  };

  const toggleSettings = () => {
    setIsSettingsOpen((prev) => !prev);
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
            {activeTab === 'transactions' && <TransactionsScreen />}
            {activeTab === 'planning' && <PlanningScreen />}
            {activeTab === 'metrics' && <MetricsScreen />}
            {activeTab === 'goals' && <GoalsScreen />}
            
            {/* Built-in interactive formula validation for Phase 1 verification */}
            <FormulaValidator />
          </>
        )}
      </main>

      {/* Fixed bottom navigation bar with 5 items on ALL screen sizes */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
      />
    </div>
  );
};
