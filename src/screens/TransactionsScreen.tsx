import React from 'react';
import { ArrowLeftRight, Clock, ShieldAlert } from 'lucide-react';

export const TransactionsScreen: React.FC = () => {
  return (
    <div className="space-y-4">
      <div
        id="card-transactions-placeholder"
        className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-6 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center mx-auto mb-3">
          <ArrowLeftRight className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1]">
          Fase 4 • Planejada
        </span>
        <h2 className="text-base font-bold text-[#111827] dark:text-[#F5F7F7] mt-0.5">
          Tela Transações
        </h2>
        <p className="mt-2 text-xs text-[#6B7280] dark:text-[#A9B1B1] max-w-sm mx-auto leading-relaxed">
          Esta tela será implementada na <strong>Fase 4</strong>, conectando-se diretamente à coleção de transações do Firestore real. Sem dados fixos ou simulados na Fase 1.
        </p>

        <div className="mt-5 p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-left text-xs space-y-1.5">
          <div className="font-semibold text-[#111827] dark:text-[#F5F7F7]">
            Fórmulas prontas em <span className="font-mono text-[11px]">financeLogic.ts</span>:
          </div>
          <ul className="list-disc list-inside text-[#6B7280] dark:text-[#A9B1B1] space-y-1 text-[11px]">
            <li>Saldo de conta: <code className="font-mono">initial_balance + créditos - débitos</code></li>
            <li>Classificação por RECEITA, DESPESA e TRANSFERENCIA</li>
            <li>Vínculo automático com categorias e subcategorias</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
