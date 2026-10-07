import React, { useState } from 'react';
import { X, UploadCloud, DownloadCloud, Loader2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

interface BackupSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupSyncModal: React.FC<BackupSyncModalProps> = ({ isOpen, onClose }) => {
  const { syncStatus, syncLogs, pushNow, pullNow } = useFinance();
  const [isActing, setIsActing] = useState(false);

  if (!isOpen) return null;

  const handlePush = async () => {
    setIsActing(true);
    try {
      await pushNow();
    } finally {
      setIsActing(false);
    }
  };

  const handlePull = async () => {
    setIsActing(true);
    try {
      await pullNow();
    } finally {
      setIsActing(false);
    }
  };

  const getStatusColor = () => {
    switch (syncStatus) {
      case 'Sincronizado':
        return 'text-[#22A45D] dark:text-[#39D47A]';
      case 'Sincronizando...':
        return 'text-[#D97706] dark:text-[#F59E0B]';
      case 'Erro na sincronização':
        return 'text-[#EF4444] dark:text-[#FF4D55]';
      case 'Pronto':
      default:
        return 'text-[#6B7280] dark:text-[#A9B1B1]';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
            Backup e Sincronização
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status atual */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-[#ECEFF1] dark:border-[#263233]">
          <span className="text-xs text-[#6B7280] dark:text-[#A9B1B1]">Status atual:</span>
          <span className={`text-xs font-semibold ${getStatusColor()}`}>
            {syncStatus}
          </span>
        </div>

        {/* Botões Enviar e Baixar */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handlePush}
            disabled={isActing}
            className="py-2.5 px-3 rounded-xl text-xs font-bold border border-[#22A45D] dark:border-[#39D47A] text-[#22A45D] dark:text-[#39D47A] hover:bg-[#22A45D]/10 dark:hover:bg-[#39D47A]/15 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isActing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UploadCloud className="w-4 h-4" />
            )}
            <span>Enviar</span>
          </button>

          <button
            type="button"
            onClick={handlePull}
            disabled={isActing}
            className="py-2.5 px-3 rounded-xl text-xs font-bold bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] hover:brightness-105 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isActing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <DownloadCloud className="w-4 h-4" />
            )}
            <span>Baixar</span>
          </button>
        </div>

        {/* Registro de Auditoria (Sync Logs) */}
        <div className="space-y-1.5">
          <span className="text-[13px] font-bold text-[#111827] dark:text-[#F5F7F7]">
            Registro de Auditoria (Sync Logs)
          </span>
          <div className="h-[140px] overflow-y-auto p-3 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-[#ECEFF1] dark:border-[#263233] font-mono text-[11px] space-y-1.5 text-[#6B7280] dark:text-[#A9B1B1]">
            {syncLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center italic text-center">
                Nenhum evento registrado.
              </div>
            ) : (
              syncLogs.map((log, index) => (
                <div key={index} className="leading-snug break-words">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-[#ECEFF1] dark:border-[#263233] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
