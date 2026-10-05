import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';

export const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export const MONTH_NAMES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface MonthYearPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string; // formato 'YYYY-MM'
  onChange: (monthStr: string) => void;
}

export const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  onChange,
}) => {
  const currentRealDate = new Date();
  const currentRealYear = currentRealDate.getFullYear();
  const currentRealMonth = currentRealDate.getMonth() + 1; // 1-12

  // Ano sendo visualizado no seletor
  const [viewYear, setViewYear] = useState<number>(() => {
    const [y] = (selectedMonth || '').split('-');
    return parseInt(y, 10) || currentRealYear;
  });

  // Modo de seleção de ano direto
  const [isYearSelectMode, setIsYearSelectMode] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const [y] = (selectedMonth || '').split('-');
      const parsedYear = parseInt(y, 10);
      if (!isNaN(parsedYear)) {
        setViewYear(parsedYear);
      }
      setIsYearSelectMode(false);
    }
  }, [isOpen, selectedMonth]);

  if (!isOpen) return null;

  const [selectedY, selectedM] = (selectedMonth || '').split('-');
  const selYear = parseInt(selectedY, 10);
  const selMonth = parseInt(selectedM, 10);

  const handlePrevYear = () => {
    setViewYear((prev) => prev - 1);
  };

  const handleNextYear = () => {
    setViewYear((prev) => prev + 1);
  };

  const handleSelectMonth = (monthIndex: number) => {
    const monthNum = monthIndex + 1;
    const formatted = `${viewYear}-${String(monthNum).padStart(2, '0')}`;
    onChange(formatted);
    onClose();
  };

  const handleSelectCurrentMonth = () => {
    const formatted = `${currentRealYear}-${String(currentRealMonth).padStart(2, '0')}`;
    onChange(formatted);
    onClose();
  };

  // Gerar faixa de anos para modo de seleção rápida de ano
  const startYear = Math.floor(viewYear / 12) * 12;
  const yearOptions = Array.from({ length: 12 }, (_, i) => startYear + i);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Popover / Modal de Calendário de Mês e Ano */}
      <div
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[340px] rounded-2xl bg-white dark:bg-[#172021] border border-gray-200 dark:border-[#222E30] shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do Calendário */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#222E30]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Calendário
              </span>
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {isYearSelectMode ? 'Escolher Ano' : 'Escolher Mês e Ano'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#222E30] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra de Navegação de Ano */}
        <div className="flex items-center justify-between my-3 px-1">
          <button
            type="button"
            onClick={isYearSelectMode ? () => setViewYear((y) => y - 12) : handlePrevYear}
            className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222E30] transition-colors cursor-pointer"
            title="Ano anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setIsYearSelectMode((prev) => !prev)}
            className="px-3 py-1 rounded-lg text-sm font-bold text-gray-800 dark:text-gray-100 hover:bg-[#22A45D]/10 dark:hover:bg-[#39D47A]/10 hover:text-[#22A45D] dark:hover:text-[#39D47A] transition-colors cursor-pointer flex items-center gap-1.5"
            title="Clique para alternar visão de anos"
          >
            <span>{isYearSelectMode ? `${startYear} - ${startYear + 11}` : viewYear}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {isYearSelectMode ? '▲' : '▼'}
            </span>
          </button>

          <button
            type="button"
            onClick={isYearSelectMode ? () => setViewYear((y) => y + 12) : handleNextYear}
            className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222E30] transition-colors cursor-pointer"
            title="Próximo ano"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Grade de 12 Anos (quando em modo seleção de ano) */}
        {isYearSelectMode ? (
          <div className="grid grid-cols-3 gap-2 my-2">
            {yearOptions.map((yr) => {
              const isSelected = yr === selYear;
              const isCurrent = yr === currentRealYear;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setViewYear(yr);
                    setIsYearSelectMode(false);
                  }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#22A45D] text-white shadow-md shadow-[#22A45D]/25 font-bold scale-[1.02]'
                      : isCurrent
                      ? 'border border-[#22A45D] text-[#22A45D] dark:text-[#39D47A] hover:bg-[#22A45D]/10'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222E30]'
                  }`}
                >
                  {yr}
                </button>
              );
            })}
          </div>
        ) : (
          /* Grade de 12 Meses (modo padrão calendário) */
          <div className="grid grid-cols-3 gap-2 my-2">
            {MONTH_NAMES_SHORT.map((mShort, idx) => {
              const mNum = idx + 1;
              const isSelected = viewYear === selYear && mNum === selMonth;
              const isCurrent = viewYear === currentRealYear && mNum === currentRealMonth;

              return (
                <button
                  key={mShort}
                  type="button"
                  onClick={() => handleSelectMonth(idx)}
                  className={`relative flex flex-col items-center justify-center py-2.5 px-1 rounded-xl text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#22A45D] text-white shadow-md shadow-[#22A45D]/25 font-bold scale-[1.02]'
                      : isCurrent
                      ? 'border border-[#22A45D] dark:border-[#39D47A] text-[#22A45D] dark:text-[#39D47A] bg-[#22A45D]/5 dark:bg-[#39D47A]/5 hover:bg-[#22A45D]/15 font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222E30] font-medium'
                  }`}
                >
                  <span className="text-[13px]">{mShort}</span>
                  <span
                    className={`text-[9px] mt-0.5 truncate max-w-[70px] ${
                      isSelected ? 'text-white/85' : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {MONTH_NAMES_FULL[idx]}
                  </span>
                  {isCurrent && !isSelected && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#22A45D] dark:bg-[#39D47A]" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Rodapé com atalho "Mês Atual" */}
        <div className="pt-3 mt-2 border-t border-gray-100 dark:border-[#222E30] flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleSelectCurrentMonth}
            className="text-xs font-semibold text-[#22A45D] dark:text-[#39D47A] hover:underline cursor-pointer"
          >
            Mês Atual ({MONTH_NAMES_SHORT[currentRealMonth - 1]}/{currentRealYear})
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  );
};
