import React from 'react';
import { X, Check } from 'lucide-react';
import { useTheme, ThemeMode } from '../../context/ThemeContext';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppearanceModal: React.FC<AppearanceModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  const options: { mode: ThemeMode; label: string; desc: string }[] = [
    {
      mode: 'system',
      label: 'Seguir Sistema',
      desc: 'Adapta-se automaticamente às preferências do seu dispositivo',
    },
    {
      mode: 'light',
      label: 'Tema Claro',
      desc: 'Cores claras e visual limpo para o dia',
    },
    {
      mode: 'dark',
      label: 'Tema Escuro',
      desc: 'Fundo escuro e economia de bateria para a noite',
    },
  ];

  const handleSelect = (mode: ThemeMode) => {
    setTheme(mode);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-5 shadow-xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
            Aparência e Tema
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {options.map((opt) => {
            const isSelected = theme === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => handleSelect(opt.mode)}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#22A45D] dark:border-[#39D47A] bg-[#22A45D]/8 dark:bg-[#39D47A]/10'
                    : 'border-[#ECEFF1] dark:border-[#263233] bg-[#FAFAFB] dark:bg-[#0D1315] hover:border-[#6B7280]/40'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="text-[14px] font-semibold text-[#111827] dark:text-[#F5F7F7]">
                    {opt.label}
                  </div>
                  <div className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
                    {opt.desc}
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'border-[#22A45D] dark:border-[#39D47A] bg-[#22A45D] dark:bg-[#39D47A]'
                      : 'border-[#6B7280]/40 dark:border-[#A9B1B1]/40'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white dark:text-[#0D1214] stroke-[3]" />}
                </div>
              </button>
            );
          })}
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
