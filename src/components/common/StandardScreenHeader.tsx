import React, { useState } from 'react';
import { Calendar, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { MonthYearPicker } from './MonthYearPicker';
import { useFinance } from '../../context/FinanceContext';

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

interface StandardScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  showMonthPicker?: boolean;
  showHideValues?: boolean;
  titleClassName?: string;
}

export const StandardScreenHeader: React.FC<StandardScreenHeaderProps> = ({
  title,
  subtitle,
  rightAction,
  showMonthPicker = true,
  showHideValues = true,
  titleClassName,
}) => {
  const { selectedMonth, setSelectedMonth, hideValues, toggleHideValues } = useFinance();
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  const formattedMonth = (() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const mIndex = parseInt(monthStr, 10) - 1;
    const name = MONTH_NAMES_PT[mIndex] || monthStr;
    return `${name} ${yearStr}`;
  })();

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={titleClassName || "text-xl font-bold tracking-tight text-[#111827] dark:text-[#F5F7F8]"}>
            {title}
          </h1>

          {/* Seletor de mês compartilhado */}
          {showMonthPicker && (
            <div className="relative mt-0.5">
              <button
                id="btn-standard-header-month-select"
                type="button"
                onClick={() => setIsMonthPickerOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB] hover:text-[#111827] dark:hover:text-[#F5F7F8] cursor-pointer transition-colors"
                title="Clique para selecionar o mês e ano"
              >
                <Calendar className="w-3.5 h-3.5 text-[#22A45D] dark:text-[#39D47A]" />
                <span>{formattedMonth}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              <MonthYearPicker
                isOpen={isMonthPickerOpen}
                onClose={() => setIsMonthPickerOpen(false)}
                selectedMonth={selectedMonth}
                onChange={(newMonth) => setSelectedMonth(newMonth)}
              />
            </div>
          )}

          {!showMonthPicker && subtitle && (
            <p className="text-[13px] text-[#6B7280] dark:text-[#A9B1B1] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Ações à direita */}
        <div className="flex items-center gap-2">
          {rightAction}

          {/* Botão de ocultar/exibir valores */}
          {showHideValues && (
            <button
              id="btn-header-toggle-hide-values"
              type="button"
              onClick={toggleHideValues}
              className="p-2 rounded-xl text-[#6B7280] dark:text-[#9FA9AB] hover:text-[#111827] dark:hover:text-[#F5F7F8] hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
              aria-label={hideValues ? 'Exibir valores' : 'Ocultar valores'}
              title={hideValues ? 'Exibir valores' : 'Ocultar valores'}
            >
              {hideValues ? (
                <EyeOff className="w-4 h-4 text-[#EF4444] dark:text-[#FF4D55]" />
              ) : (
                <Eye className="w-4 h-4 text-[#6B7280] dark:text-[#9FA9AB]" />
              )}
            </button>
          )}
        </div>
      </div>

      {showMonthPicker && subtitle && (
        <p className="text-xs text-[#6B7280] dark:text-[#9FA9AB]">
          {subtitle}
        </p>
      )}
    </div>
  );
};
