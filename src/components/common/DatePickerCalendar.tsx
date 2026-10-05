import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { MONTH_NAMES_FULL, MONTH_NAMES_SHORT } from './MonthYearPicker';

interface DatePickerCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDateIso?: string; // formato YYYY-MM-DD
  onSelectDate: (isoDate: string, brlDate: string) => void;
}

export const DatePickerCalendar: React.FC<DatePickerCalendarProps> = ({
  isOpen,
  onClose,
  selectedDateIso,
  onSelectDate,
}) => {
  const today = new Date();
  const todayIso = today.toISOString().substring(0, 10);

  // Mês e Ano sendo exibidos no calendário
  const [viewYear, setViewYear] = useState<number>(() => {
    if (selectedDateIso && selectedDateIso.length >= 4) {
      const y = parseInt(selectedDateIso.substring(0, 4), 10);
      if (!isNaN(y)) return y;
    }
    return today.getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (selectedDateIso && selectedDateIso.length >= 7) {
      const m = parseInt(selectedDateIso.substring(5, 7), 10);
      if (!isNaN(m)) return m; // 1-12
    }
    return today.getMonth() + 1;
  });

  // Modos de visualização alternativos (para trocar rapidamente mês ou ano)
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');

  useEffect(() => {
    if (isOpen) {
      if (selectedDateIso && selectedDateIso.length >= 10) {
        const [y, m] = selectedDateIso.split('-');
        const parsedY = parseInt(y, 10);
        const parsedM = parseInt(m, 10);
        if (!isNaN(parsedY)) setViewYear(parsedY);
        if (!isNaN(parsedM)) setViewMonth(parsedM);
      }
      setViewMode('days');
    }
  }, [isOpen, selectedDateIso]);

  if (!isOpen) return null;

  // Dias da semana em português
  const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Navegar meses
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Selecionar dia
  const handleDayClick = (dayNumber: number) => {
    const formattedY = viewYear;
    const formattedM = String(viewMonth).padStart(2, '0');
    const formattedD = String(dayNumber).padStart(2, '0');

    const iso = `${formattedY}-${formattedM}-${formattedD}`;
    const brl = `${formattedD}/${formattedM}/${formattedY}`;

    onSelectDate(iso, brl);
    onClose();
  };

  // Selecionar "Hoje"
  const handleSelectToday = () => {
    const tYear = today.getFullYear();
    const tMonth = String(today.getMonth() + 1).padStart(2, '0');
    const tDay = String(today.getDate()).padStart(2, '0');

    const iso = `${tYear}-${tMonth}-${tDay}`;
    const brl = `${tDay}/${tMonth}/${tYear}`;

    onSelectDate(iso, brl);
    onClose();
  };

  // Cálculo da matriz de dias do mês
  // 1º dia do mês (0 = domingo, 1 = segunda, ..., 6 = sábado)
  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay();
  // Quantidade de dias no mês atual
  const daysInCurrentMonth = new Date(viewYear, viewMonth, 0).getDate();
  // Quantidade de dias no mês anterior
  const daysInPrevMonth = new Date(viewYear, viewMonth - 1, 0).getDate();

  // Dias a exibir antes do dia 1
  const prevMonthDays = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevMonthDays.push(daysInPrevMonth - i);
  }

  // Dias do mês atual
  const currentDays = Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1);

  // Dias a exibir depois do último dia para completar a grade
  const totalSlots = prevMonthDays.length + currentDays.length;
  const remainingSlots = totalSlots % 7 === 0 ? 0 : 7 - (totalSlots % 7);
  const nextMonthDays = Array.from({ length: remainingSlots }, (_, i) => i + 1);

  // Faixa de anos para seleção rápida
  const startYear = Math.floor(viewYear / 12) * 12;
  const yearRange = Array.from({ length: 12 }, (_, i) => startYear + i);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Popover / Calendário Modal */}
      <div
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[94vw] max-w-[340px] rounded-2xl bg-white dark:bg-[#172021] border border-gray-200 dark:border-[#222E30] shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150"
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
                Seletor de Data
              </span>
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {MONTH_NAMES_FULL[viewMonth - 1]} de {viewYear}
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

        {/* Barra de Navegação: Mês e Ano */}
        <div className="flex items-center justify-between my-3 px-0.5">
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'years') setViewYear((y) => y - 12);
              else if (viewMode === 'months') setViewYear((y) => y - 1);
              else handlePrevMonth();
            }}
            className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222E30] transition-colors cursor-pointer"
            title="Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Botões para alternar mês e ano */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === 'months' ? 'days' : 'months'))}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'months'
                  ? 'bg-[#22A45D] text-white'
                  : 'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#222E30]'
              }`}
            >
              <span>{MONTH_NAMES_FULL[viewMonth - 1]}</span>
              <span className="text-[9px]">▼</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode((m) => (m === 'years' ? 'days' : 'years'))}
              className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'years'
                  ? 'bg-[#22A45D] text-white'
                  : 'text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#222E30]'
              }`}
            >
              <span>{viewMode === 'years' ? `${startYear} - ${startYear + 11}` : viewYear}</span>
              <span className="text-[9px]">▼</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (viewMode === 'years') setViewYear((y) => y + 12);
              else if (viewMode === 'months') setViewYear((y) => y + 1);
              else handleNextMonth();
            }}
            className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222E30] transition-colors cursor-pointer"
            title="Próximo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo Dinâmico Conforme Modo de Exibição */}
        {viewMode === 'years' ? (
          /* Grade de Anos */
          <div className="grid grid-cols-3 gap-2 my-2">
            {yearRange.map((yr) => {
              const isSelected = yr === viewYear;
              const isCurrent = yr === today.getFullYear();
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setViewYear(yr);
                    setViewMode('months');
                  }}
                  className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#22A45D] text-white font-bold shadow-md shadow-[#22A45D]/25'
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
        ) : viewMode === 'months' ? (
          /* Grade de Meses */
          <div className="grid grid-cols-3 gap-2 my-2">
            {MONTH_NAMES_SHORT.map((mShort, idx) => {
              const mNum = idx + 1;
              const isSelected = mNum === viewMonth;
              const isCurrent = viewYear === today.getFullYear() && mNum === today.getMonth() + 1;
              return (
                <button
                  key={mShort}
                  type="button"
                  onClick={() => {
                    setViewMonth(mNum);
                    setViewMode('days');
                  }}
                  className={`py-2.5 px-2 rounded-xl text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#22A45D] text-white font-bold shadow-md shadow-[#22A45D]/25'
                      : isCurrent
                      ? 'border border-[#22A45D] text-[#22A45D] dark:text-[#39D47A] bg-[#22A45D]/5 font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222E30] font-medium'
                  }`}
                >
                  <span className="block text-xs font-bold">{mShort}</span>
                  <span className="block text-[9px] text-gray-400 dark:text-gray-500 truncate">
                    {MONTH_NAMES_FULL[idx]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Grade de Dias (Calendário Completo) */
          <div>
            {/* Dias da semana */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEK_DAYS.map((wd) => (
                <div
                  key={wd}
                  className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 py-1"
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Matriz de Dias */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Dias do mês anterior (desativados) */}
              {prevMonthDays.map((d) => (
                <div
                  key={`prev-${d}`}
                  className="h-8 flex items-center justify-center text-xs text-gray-300 dark:text-gray-600 cursor-not-allowed select-none"
                >
                  {d}
                </div>
              ))}

              {/* Dias do mês atual */}
              {currentDays.map((d) => {
                const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isSelected = selectedDateIso === dateStr;
                const isToday = todayIso === dateStr;

                return (
                  <button
                    key={`curr-${d}`}
                    type="button"
                    onClick={() => handleDayClick(d)}
                    className={`h-8 w-8 mx-auto rounded-lg text-xs font-medium transition-all flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#22A45D] text-white font-bold shadow-md shadow-[#22A45D]/30 scale-105'
                        : isToday
                        ? 'border border-[#22A45D] dark:border-[#39D47A] text-[#22A45D] dark:text-[#39D47A] font-bold hover:bg-[#22A45D]/10'
                        : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#222E30]'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}

              {/* Dias do próximo mês (desativados) */}
              {nextMonthDays.map((d) => (
                <div
                  key={`next-${d}`}
                  className="h-8 flex items-center justify-center text-xs text-gray-300 dark:text-gray-600 cursor-not-allowed select-none"
                >
                  {d}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rodapé com atalho "Hoje" */}
        <div className="pt-3 mt-3 border-t border-gray-100 dark:border-[#222E30] flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleSelectToday}
            className="text-xs font-semibold text-[#22A45D] dark:text-[#39D47A] hover:underline cursor-pointer"
          >
            Hoje ({String(today.getDate()).padStart(2, '0')}/{String(today.getMonth() + 1).padStart(2, '0')}/{today.getFullYear()})
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
