import React from 'react';
import { Layers, ShieldCheck } from 'lucide-react';

export const PlanningScreen: React.FC = () => {
  return (
    <div className="space-y-4">
      <div
        id="card-planning-placeholder"
        className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-6 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center mx-auto mb-3">
          <Layers className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1]">
          Fase 5 • Planejada
        </span>
        <h2 className="text-base font-bold text-[#111827] dark:text-[#F5F7F7] mt-0.5">
          Tela Planejamento
        </h2>
        <p className="mt-2 text-xs text-[#6B7280] dark:text-[#A9B1B1] max-w-sm mx-auto leading-relaxed">
          Estrutura do orçamento por envelopes (YNAB): categorias, subcategorias, saldo Disponível e o valor do <strong>Pronto para Atribuir</strong>.
        </p>

        <div className="mt-5 p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-left text-xs space-y-2">
          <div className="font-semibold text-[#111827] dark:text-[#F5F7F7]">
            Fórmulas validadas na Fundação (Fase 1):
          </div>
          <div className="p-2 rounded-lg bg-[#FFFFFF] dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] font-mono text-[10.5px] text-[#22A45D] dark:text-[#39D47A] leading-relaxed">
            Alocado = Σ(Movements destino) - Σ(Movements origem)<br />
            Gasto = Σ(DESPESAS no mês)<br />
            Disponível = Alocado - Gasto<br />
            Pronto para Atribuir = Saldo total - Σ(Disponível acumulado m ≤ mês) - Σ(current_value metas)
          </div>
        </div>
      </div>
    </div>
  );
};
