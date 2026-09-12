import React from 'react';
import { BarChart3 } from 'lucide-react';

export const MetricsScreen: React.FC = () => {
  return (
    <div className="space-y-4">
      <div
        id="card-metrics-placeholder"
        className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-6 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center mx-auto mb-3">
          <BarChart3 className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1]">
          Fase 7 • Planejada
        </span>
        <h2 className="text-base font-bold text-[#111827] dark:text-[#F5F7F7] mt-0.5">
          Tela Métricas
        </h2>
        <p className="mt-2 text-xs text-[#6B7280] dark:text-[#A9B1B1] max-w-sm mx-auto leading-relaxed">
          Gráficos e relatórios analíticos de fluxo de caixa, distribuição de despesas por categoria e evolução patrimonial.
        </p>

        <div className="mt-5 p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-left text-xs space-y-1 text-[#6B7280] dark:text-[#A9B1B1]">
          <p className="text-[11px]">
            • Respeito ao design system: cores de indicadores financeiros estritamente verde, vermelho ou laranja. Azul só para identificação de categoria no gráfico.
          </p>
        </div>
      </div>
    </div>
  );
};
