import React from 'react';
import { Settings, Database, Moon, Sun, ShieldCheck, Smartphone, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { firebaseConfig } from '../firebase/config';
import { PWAInstallPrompt } from '../components/pwa/PWAInstallPrompt';

interface SettingsScreenProps {
  onClose?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onClose }) => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div
        id="card-settings-header"
        className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-5 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1]">
                Fase 8 • Planejada
              </span>
              <h2 className="text-base font-bold text-[#111827] dark:text-[#F5F7F7]">
                Tela Ajustes
              </h2>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-xl border border-[#E5E7EB] dark:border-[#222E30] text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] cursor-pointer"
            >
              Voltar
            </button>
          )}
        </div>
      </div>

      {/* Visual Theme Selection */}
      <div
        id="card-theme-settings"
        className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-5 shadow-xs border border-[#E5E7EB] dark:border-[#222E30]"
      >
        <h3 className="text-xs font-semibold text-[#111827] dark:text-[#F5F7F7] mb-3">
          Tema Visual (Cores Oficiais Android)
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            id="btn-theme-light"
            onClick={() => setTheme('light')}
            className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              theme === 'light'
                ? 'border-[#22A45D] bg-[#22A45D]/5 text-[#111827]'
                : 'border-[#E5E7EB] text-[#6B7280] hover:border-gray-300'
            }`}
          >
            <Sun className="w-4 h-4 text-[#F59E0B]" />
            <span>Modo Claro</span>
          </button>

          <button
            id="btn-theme-dark"
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border-[#39D47A] bg-[#39D47A]/10 text-[#F5F7F7]'
                : 'border-[#222E30] text-[#A9B1B1] hover:border-gray-700'
            }`}
          >
            <Moon className="w-4 h-4 text-[#39D47A]" />
            <span>Modo Escuro</span>
          </button>
        </div>
      </div>

      {/* Firebase Details */}
      <div
        id="card-firebase-details"
        className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-5 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] space-y-3"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
          <Database className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A]" />
          <span>Configuração Firebase Conectada</span>
        </div>
        <div className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] font-mono text-[11px] space-y-1 text-[#6B7280] dark:text-[#A9B1B1]">
          <div><strong className="text-[#111827] dark:text-[#F5F7F7]">Project ID:</strong> {firebaseConfig.projectId}</div>
          <div><strong className="text-[#111827] dark:text-[#F5F7F7]">Auth Domain:</strong> {firebaseConfig.authDomain}</div>
          <div><strong className="text-[#111827] dark:text-[#F5F7F7]">App ID:</strong> {firebaseConfig.appId}</div>
          <div><strong className="text-[#111827] dark:text-[#F5F7F7]">Status:</strong> <span className="text-[#22A45D] dark:text-[#39D47A]">Conectado ao mesmo banco do Android</span></div>
        </div>
      </div>

      {/* PWA & Mobile Installation */}
      <div
        id="card-pwa-settings"
        className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-5 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] space-y-2"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
          <Smartphone className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A]" />
          <span>Progressive Web App (PWA)</span>
        </div>
        <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1]">
          O aplicativo pode ser instalado no Android (Chrome) e no iOS (Safari) para funcionar como app nativo em tela cheia com ícone dedicado.
        </p>
        <div className="pt-2">
          <PWAInstallPrompt />
        </div>
      </div>
    </div>
  );
};
