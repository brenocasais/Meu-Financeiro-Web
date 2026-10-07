import React from 'react';
import { ChevronRight, LucideIcon } from 'lucide-react';

interface SettingsItemRowProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  isDestructive?: boolean;
  showChevron?: boolean;
}

export const SettingsItemRow: React.FC<SettingsItemRowProps> = ({
  icon: Icon,
  title,
  subtitle,
  onClick,
  trailing,
  isDestructive = false,
  showChevron = true,
}) => {
  const iconColor = isDestructive
    ? 'text-[#EF4444] dark:text-[#FF4D55]'
    : 'text-[#22A45D] dark:text-[#39D47A]';

  const iconBg = isDestructive
    ? 'bg-[#EF4444]/12 dark:bg-[#FF4D55]/15'
    : 'bg-[#22A45D]/12 dark:bg-[#39D47A]/15';

  const titleColor = isDestructive
    ? 'text-[#EF4444] dark:text-[#FF4D55]'
    : 'text-[#111827] dark:text-[#F5F7F7]';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`min-h-[60px] px-4 py-3 flex items-center justify-between transition-colors select-none ${
        onClick
          ? 'cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03] active:bg-black/[0.04] dark:active:bg-white/[0.06]'
          : ''
      }`}
    >
      {/* Esquerda: Ícone + Título e Subtítulo */}
      <div className="flex items-center gap-[14px] min-w-0 pr-2">
        <div
          className={`w-9 h-9 rounded-[10px] ${iconBg} flex items-center justify-center shrink-0`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>

        <div className="flex flex-col gap-[2px] min-w-0">
          <span className={`text-[14px] font-semibold leading-tight truncate ${titleColor}`}>
            {title}
          </span>
          <span className="text-[12px] text-[#6B7280] dark:text-[#A9B1B1] leading-tight truncate">
            {subtitle}
          </span>
        </div>
      </div>

      {/* Direita: Trailing ou ChevronRight */}
      <div className="shrink-0 flex items-center">
        {trailing ? (
          trailing
        ) : showChevron && onClick ? (
          <ChevronRight className="w-5 h-5 text-[#6B7280]/60 dark:text-[#A9B1B1]/60" />
        ) : null}
      </div>
    </div>
  );
};
