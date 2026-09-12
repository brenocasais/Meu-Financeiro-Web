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
import { FormulaValidator } from '../common/FormulaValidator';

export const AppLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setIsSettingsOpen(false);
  };

  const toggleSettings = () => {
    setIsSettingsOpen((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB] dark:bg-[#0D1214] text-[#111827] dark:text-[#F5F7F7] flex flex-col transition-colors duration-150">
      <OfflineBanner />
      
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
            {activeTab === 'home' && <HomeScreen />}
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
