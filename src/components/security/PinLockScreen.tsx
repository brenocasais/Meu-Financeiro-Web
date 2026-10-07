import React, { useState, useEffect } from 'react';
import { Lock, Delete, Loader2, AlertCircle } from 'lucide-react';
import { verifyPin, clearSecurityCredentials } from '../../lib/securityHelper';
import { useAuth } from '../../context/AuthContext';

interface PinLockScreenProps {
  onUnlock: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock }) => {
  const { signOut } = useAuth();
  const [enteredPin, setEnteredPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);

  // Contador de bloqueio de 30 segundos
  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          setFailCount(0); // reseta após os 30s
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const handleKeyPress = (num: string) => {
    if (lockoutTimer > 0 || isVerifying) return;
    if (enteredPin.length < 6) {
      setEnteredPin((prev) => prev + num);
      setErrorMessage(null);
    }
  };

  const handleDelete = () => {
    if (lockoutTimer > 0 || isVerifying) return;
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleUnlock = async () => {
    if (lockoutTimer > 0 || enteredPin.length < 4 || isVerifying) return;

    setIsVerifying(true);
    try {
      const isValid = await verifyPin(enteredPin);
      if (isValid) {
        onUnlock();
      } else {
        const nextFails = failCount + 1;
        setFailCount(nextFails);
        setEnteredPin('');
        if (nextFails >= 5) {
          setLockoutTimer(30);
          setErrorMessage('Muitas tentativas incorretas. Aguarde 30 segundos.');
        } else {
          setErrorMessage('PIN incorreto.');
        }
      }
    } catch (err) {
      console.error('[PinLockScreen] Erro ao verificar PIN:', err);
      setErrorMessage('Erro ao verificar PIN. Tente novamente.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleForgotPin = async () => {
    // Esqueci o PIN -> sair da conta (o PIN é removido ao deslogar) e voltar ao login
    clearSecurityCredentials();
    await signOut();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#FAFAFB] dark:bg-[#0D1214] flex flex-col items-center justify-between p-6 transition-colors">
      {/* Topo: Logo & Título */}
      <div className="w-full max-w-xs flex flex-col items-center pt-8 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#22A45D]/15 dark:bg-[#39D47A]/15 border-2 border-[#22A45D]/30 flex items-center justify-center text-[#22A45D] dark:text-[#39D47A] shadow-xs">
          <Lock className="w-7 h-7" />
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-[#111827] dark:text-[#F5F7F7]">
            Digite seu PIN
          </h2>
          <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1]">
            Proteção de acesso ativada
          </p>
        </div>

        {/* Indicadores de bolinhas do PIN */}
        <div className="flex items-center justify-center gap-3 py-3">
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const isFilled = index < enteredPin.length;
            return (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  isFilled
                    ? 'bg-[#22A45D] dark:bg-[#39D47A] scale-110'
                    : 'border-2 border-[#6B7280]/30 dark:border-[#A9B1B1]/30 bg-transparent'
                }`}
              />
            );
          })}
        </div>

        {/* Mensagem de Erro ou Bloqueio */}
        {errorMessage && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55] text-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {lockoutTimer > 0 && (
          <p className="text-xs font-bold text-[#D97706] dark:text-[#F59E0B]">
            Bloqueado por {lockoutTimer}s
          </p>
        )}
      </div>

      {/* Meio: Teclado numérico */}
      <div className="w-full max-w-xs space-y-3 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={lockoutTimer > 0 || isVerifying}
              onClick={() => handleKeyPress(digit)}
              className="h-14 rounded-2xl bg-white dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] text-xl font-semibold text-[#111827] dark:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all shadow-xs disabled:opacity-40 cursor-pointer"
            >
              {digit}
            </button>
          ))}

          {/* Botão limpar/apagar */}
          <button
            type="button"
            disabled={lockoutTimer > 0 || enteredPin.length === 0 || isVerifying}
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-white dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] text-[#6B7280] dark:text-[#A9B1B1] flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all shadow-xs disabled:opacity-40 cursor-pointer"
          >
            <Delete className="w-6 h-6" />
          </button>

          {/* Dígito 0 */}
          <button
            type="button"
            disabled={lockoutTimer > 0 || isVerifying}
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-white dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] text-xl font-semibold text-[#111827] dark:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all shadow-xs disabled:opacity-40 cursor-pointer"
          >
            0
          </button>

          {/* Botão Desbloquear */}
          <button
            type="button"
            disabled={lockoutTimer > 0 || enteredPin.length < 4 || isVerifying}
            onClick={handleUnlock}
            className="h-14 rounded-2xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] font-bold text-xs flex items-center justify-center hover:brightness-105 active:scale-95 transition-all shadow-xs disabled:opacity-40 cursor-pointer"
          >
            {isVerifying ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span>Desbloquear</span>
            )}
          </button>
        </div>

        {/* Link Esqueci o PIN */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={handleForgotPin}
            className="text-xs font-semibold text-[#EF4444] dark:text-[#FF4D55] hover:underline cursor-pointer"
          >
            Esqueci o PIN
          </button>
        </div>
      </div>
    </div>
  );
};
