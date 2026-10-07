import React, { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clearSecurityCredentials } from '../../lib/securityHelper';

interface SignOutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignOutConfirmModal: React.FC<SignOutConfirmModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!isOpen) return null;

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      // Limpa credenciais de PIN ao deslogar (mas preserva a foto local)
      clearSecurityCredentials();
      await signOut();
    } catch (err) {
      console.error('[SignOutConfirmModal] Erro ao sair da conta:', err);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#EF4444]/15 dark:bg-[#FF4D55]/20 text-[#EF4444] dark:text-[#FF4D55] flex items-center justify-center shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
            Sair da Conta
          </h2>
        </div>

        <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
          Deseja realmente encerrar a sessão? Seus dados sincronizados na nuvem ou locais permanecerão salvos com segurança.
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#ECEFF1] dark:border-[#263233]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSigningOut}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#EF4444] dark:bg-[#FF4D55] text-white hover:brightness-105 active:scale-98 transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            {isSigningOut && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Sair</span>
          </button>
        </div>
      </div>
    </div>
  );
};
