import React from 'react';
import { X, HelpCircle } from 'lucide-react';

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FaqModal: React.FC<FaqModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const faqs = [
    {
      q: "Como funciona o 'Pronto para Atribuir'?",
      a: 'É o valor total de receitas e saldos acumulados ainda não alocados em envelopes de categorias ou metas.',
    },
    {
      q: 'O que são Transações Recorrentes?',
      a: 'São despesas ou receitas fixas (como aluguel, salários ou assinaturas) que ocorrem mensalmente.',
    },
    {
      q: 'Meus dados estão seguros?',
      a: 'Sim. Os dados ficam salvos na sua conta, na nuvem (Firebase Firestore), e são sincronizados com o aplicativo do celular.',
    },
    {
      q: 'Como exportar meus relatórios?',
      a: 'Em Ajustes -> Dados e backup -> Exportar dados, você pode gerar relatórios em JSON, CSV ou PDF.',
    },
  ];

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
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#22A45D] dark:text-[#39D47A]" />
            <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
              Central de Ajuda & FAQ
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
          {faqs.map((item, index) => (
            <div
              key={index}
              className="p-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-[#ECEFF1] dark:border-[#263233] space-y-1"
            >
              <h3 className="text-[13px] font-bold text-[#111827] dark:text-[#F5F7F7]">
                {item.q}
              </h3>
              <p className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-[#ECEFF1] dark:border-[#263233] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] hover:brightness-105 active:scale-98 transition-all shadow-xs cursor-pointer"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
