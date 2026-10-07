import React, { useState, useEffect } from 'react';
import { X, Lock, Loader2 } from 'lucide-react';
import { savePin, hasPinConfigured } from '../../lib/securityHelper';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isChanging = hasPinConfigured();

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setConfirmPin('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePinChange = (val: string, setter: (v: string) => void) => {
    // Apenas dígitos, máximo 6 caracteres
    const digitsOnly = val.replace(/\D/g, '').slice(0, 6);
    setter(digitsOnly);
  };

  const handleSave = async () => {
    if (pin.length < 4) {
      setErrorMessage('O PIN deve ter pelo menos 4 dígitos.');
      return;
    }

    if (pin !== confirmPin) {
      setErrorMessage('Os PINs digitados não coincidem.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await savePin(pin);
      onSuccessToast(isChanging ? 'PIN alterado com sucesso!' : 'PIN cadastrado com sucesso!');
      onClose();
    } catch (err: any) {
      console.error('[PinSetupModal] Erro ao salvar PIN:', err);
      setErrorMessage('Não foi possível salvar o PIN.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#22A45D] dark:text-[#39D47A]" />
            <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
              {isChanging ? 'Alterar PIN de Acesso' : 'Cadastrar PIN de Acesso'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
          Digite um PIN numérico de 4 a 6 dígitos para proteger o aplicativo.
        </p>

        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Novo PIN (4-6 dígitos)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => handlePinChange(e.target.value, setPin)}
              placeholder="••••"
              className="w-full px-3.5 py-2.5 rounded-xl text-center text-lg font-mono tracking-widest bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#22A45D] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
              Confirmar Novo PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => handlePinChange(e.target.value, setConfirmPin)}
              placeholder="••••"
              className="w-full px-3.5 py-2.5 rounded-xl text-center text-lg font-mono tracking-widest bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#22A45D] transition-colors"
            />
          </div>

          {errorMessage && (
            <p className="text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55] text-center">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#ECEFF1] dark:border-[#263233]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!pin || !confirmPin || isSaving}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              !pin || !confirmPin || isSaving
                ? 'opacity-40 cursor-not-allowed bg-black/10 dark:bg-white/10 text-[#6B7280]'
                : 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] hover:brightness-105 active:scale-98'
            }`}
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Salvar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
