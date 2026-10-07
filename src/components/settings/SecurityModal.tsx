import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Check } from 'lucide-react';
import {
  isSecurityEnabled,
  hasPinConfigured,
  setSecurityEnabled,
} from '../../lib/securityHelper';
import { PinSetupModal } from './PinSetupModal';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const [enabled, setEnabled] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEnabled(isSecurityEnabled());
      setHasPin(hasPinConfigured());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSwitch = () => {
    if (!enabled) {
      // Quer ligar: se não tem PIN, abre modal de cadastro
      if (!hasPinConfigured()) {
        setIsPinModalOpen(true);
      } else {
        setSecurityEnabled(true);
        setEnabled(true);
        onSuccessToast('Proteção por PIN ativada!');
      }
    } else {
      // Quer desligar: só desliga (mantém o PIN guardado)
      setSecurityEnabled(false);
      setEnabled(false);
      onSuccessToast('Proteção por PIN desativada.');
    }
  };

  const handlePinSuccess = (msg: string) => {
    setEnabled(true);
    setHasPin(true);
    onSuccessToast(msg);
    setIsPinModalOpen(false);
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#22A45D] dark:text-[#39D47A]" />
              <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
                Segurança e Acesso
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Linha com Switch */}
          <div
            onClick={handleToggleSwitch}
            className="flex items-center justify-between p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-[#ECEFF1] dark:border-[#263233] cursor-pointer transition-colors"
          >
            <div className="space-y-0.5 pr-2">
              <div className="text-[14px] font-semibold text-[#111827] dark:text-[#F5F7F7]">
                Proteger com senha/biometria
              </div>
              <div className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
                Exige autenticação ao abrir o aplicativo
              </div>
            </div>

            {/* Switch visual */}
            <div
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                enabled
                  ? 'bg-[#22A45D] dark:bg-[#39D47A]'
                  : 'bg-[#6B7280]/30 dark:bg-[#A9B1B1]/30'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>

          {/* Opções com proteção ligada */}
          {enabled && (
            <div className="space-y-3 pt-1 border-t border-[#ECEFF1] dark:border-[#263233] animate-in fade-in duration-150">
              <span className="text-[13px] font-bold text-[#111827] dark:text-[#F5F7F7]">
                Método de Autenticação
              </span>

              {/* Opção radio única PIN de 4-6 dígitos */}
              <div className="p-3 rounded-xl border border-[#22A45D] dark:border-[#39D47A] bg-[#22A45D]/10 dark:bg-[#39D47A]/15 flex items-center justify-between text-xs">
                <span className="font-semibold text-[#111827] dark:text-[#F5F7F7]">
                  PIN de 4-6 dígitos
                </span>
                <div className="w-4 h-4 rounded-full bg-[#22A45D] dark:bg-[#39D47A] flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white dark:text-[#0D1214] stroke-[3]" />
                </div>
              </div>

              {/* Botão outline Alterar PIN / Cadastrar PIN */}
              <button
                type="button"
                onClick={() => setIsPinModalOpen(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-[#ECEFF1] dark:border-[#263233] hover:border-[#6B7280]/40 text-xs font-bold text-[#111827] dark:text-[#F5F7F7] bg-white dark:bg-[#172021] transition-colors cursor-pointer text-center"
              >
                {hasPin ? 'Alterar PIN' : 'Cadastrar PIN'}
              </button>
            </div>
          )}

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

      <PinSetupModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccessToast={handlePinSuccess}
      />
    </>
  );
};
