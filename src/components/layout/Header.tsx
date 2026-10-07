import React from 'react';
import { Sun, Moon, Settings, ShieldCheck, Database } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { PWAInstallPrompt } from '../pwa/PWAInstallPrompt';

interface HeaderProps {
  onOpenSettings?: () => void;
  isSettingsOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, isSettingsOpen }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header
      id="main-app-header"
      className="sticky top-0 z-30 bg-[#FAFAFB]/90 dark:bg-[#0D1214]/90 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#222E30] transition-colors"
    >
      <div className="max-w-2xl mx-auto px-4 h-15 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] flex items-center justify-center text-white dark:text-[#0D1214] font-bold text-sm shadow-xs">
            MF
          </div>
          <div>
            <h1 className="text-base font-bold text-[#111827] dark:text-[#F5F7F7] tracking-tight leading-none">
              Meu Financeiro
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22A45D] dark:bg-[#39D47A] animate-pulse" />
              <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#A9B1B1]">
                Firebase v2 conectado
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <PWAInstallPrompt />

          {/* Theme toggle button */}
          <button
            id="btn-toggle-theme"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-[#FF9F1C]" />
            ) : (
              <Moon className="w-4 h-4 text-[#6B7280]" />
            )}
          </button>

          {/* Settings button (Fase 8) */}
          {onOpenSettings && (
            <button
              id="btn-open-settings"
              onClick={onOpenSettings}
              className={`p-2 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer ${
                isSettingsOpen ? 'bg-black/5 dark:bg-white/5 text-[#22A45D] dark:text-[#39D47A]' : ''
              }`}
              aria-label="Ajustes do aplicativo"
              title="Ajustes (Fase 8)"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
