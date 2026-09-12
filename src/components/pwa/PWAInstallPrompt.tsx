import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X, Smartphone, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export const PWAInstallPrompt: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed in standalone mode, hide the prompt
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* Chromium / Android install button */}
      {isInstallable && (
        <button
          id="btn-pwa-install"
          onClick={install}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl text-white bg-[#22A45D] dark:bg-[#39D47A] dark:text-[#0D1214] hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
          title="Instalar Meu Financeiro no dispositivo"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Instalar App</span>
        </button>
      )}

      {/* iOS Safari manual install guide button */}
      {isIOS && (
        <button
          id="btn-pwa-ios-guide"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl text-[#111827] dark:text-[#F5F7F7] border border-[#E5E7EB] dark:border-[#222E30] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#22A45D] dark:text-[#39D47A]" />
          <span>Adicionar à Tela Inicial</span>
        </button>
      )}

      {/* iOS Safari step-by-step modal guide */}
      {showIOSGuide && (
        <div
          id="modal-ios-install-guide"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm rounded-[22px] bg-[#FFFFFF] dark:bg-[#172021] p-6 shadow-2xl border border-[#E5E7EB] dark:border-[#222E30]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB] dark:border-[#222E30]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#22A45D]/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-[#22A45D] dark:text-[#39D47A]" />
                </div>
                <h3 className="text-base font-semibold text-[#111827] dark:text-[#F5F7F7]">
                  Instalar no iPhone / iPad
                </h3>
              </div>
              <button
                id="btn-close-ios-guide"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-lg text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-sm text-[#111827] dark:text-[#F5F7F7]">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </div>
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1]">
                  Toque no botão <strong className="text-[#111827] dark:text-[#F5F7F7] inline-flex items-center gap-1"><Share2 className="w-3.5 h-3.5 inline" /> Compartilhar</strong> na barra do Safari (na parte inferior ou superior da tela).
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </div>
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1]">
                  Role as opções e toque em <strong className="text-[#111827] dark:text-[#F5F7F7] inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5 inline" /> Adicionar à Tela de Início</strong>.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </div>
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1]">
                  Toque em <strong className="text-[#111827] dark:text-[#F5F7F7]">Adicionar</strong> no canto superior direito para concluir.
                </p>
              </div>
            </div>

            <button
              id="btn-confirm-ios-guide"
              onClick={() => setShowIOSGuide(false)}
              className="mt-6 w-full py-2.5 rounded-xl font-medium text-xs text-white bg-[#22A45D] dark:bg-[#39D47A] dark:text-[#0D1214] hover:opacity-90 transition-all cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
