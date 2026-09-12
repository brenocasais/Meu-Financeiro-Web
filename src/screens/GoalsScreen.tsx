import React from 'react';
import { Target } from 'lucide-react';

export const GoalsScreen: React.FC = () => {
  return (
    <div className="space-y-4">
      <div
        id="card-goals-placeholder"
        className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-6 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center mx-auto mb-3">
          <Target className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1]">
          Fase 6 • Planejada
        </span>
        <h2 className="text-base font-bold text-[#111827] dark:text-[#F5F7F7] mt-0.5">
          Tela Metas
        </h2>
        <p className="mt-2 text-xs text-[#6B7280] dark:text-[#A9B1B1] max-w-sm mx-auto leading-relaxed">
          Gerenciamento de metas financeiras de curto, médio e longo prazo com cálculo contínuo de valor acumulado.
        </p>

        <div className="mt-5 p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-left text-xs space-y-1.5">
          <div className="font-semibold text-[#111827] dark:text-[#F5F7F7]">
            Fórmula de Meta (validada na Fase 1):
          </div>
          <div className="p-2 rounded-lg bg-[#FFFFFF] dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] font-mono text-[11px] text-[#22A45D] dark:text-[#39D47A]">
            current_value = Σ(dest_goal_id) - Σ(source_goal_id) (nunca reseta)
          </div>
        </div>
      </div>
    </div>
  );
};
