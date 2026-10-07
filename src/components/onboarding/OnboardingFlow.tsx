import React, { useState } from 'react';
import {
  Wallet,
  FolderTree,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrencyBRL } from '../../lib/financeLogic';
import { AccountFormModal } from '../settings/AccountFormModal';
import { SuggestedCategoriesModal } from '../settings/SuggestedCategoriesModal';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const { data } = useFinance();

  const [step, setStep] = useState<number>(1);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isSuggestedCatModalOpen, setIsSuggestedCatModalOpen] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleFinish = () => {
    if (user?.uid) {
      localStorage.setItem(`mf_onboarding_done_${user.uid}`, '1');
    }
    onComplete();
  };

  const accounts = data.accounts || [];
  const categories = data.categories || [];
  const subcategories = data.subcategories || [];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-[#FAFAFB] dark:bg-[#0D1214] text-[#111827] dark:text-[#F5F7F7] transition-colors">
      <div className="max-w-md w-full space-y-4">
        {/* Toast Flutuante */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-60 animate-in fade-in slide-in-from-top-3">
            <div className="px-4 py-2.5 rounded-xl bg-[#22A45D] text-white text-xs font-semibold shadow-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Card Principal */}
        <div className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-6 shadow-xs border border-[#ECEFF1] dark:border-[#263233] transition-colors space-y-5">
          {/* Topo do Assistente: Logo, Progresso e Botão Pular */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] font-bold text-sm flex items-center justify-center shadow-xs">
                  MF
                </div>
                <span className="text-xs font-bold text-[#6B7280] dark:text-[#A9B1B1]">
                  Passo {step} de 4
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowSkipConfirm(true)}
                className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] transition-colors cursor-pointer"
              >
                Pular
              </button>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full h-1.5 rounded-full bg-[#E5E7EB] dark:bg-[#222E30] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#22A45D] dark:bg-[#39D47A] transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* PASSO 1: Boas-vindas */}
          {/* ========================================================= */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h1 className="text-xl font-bold tracking-tight text-[#111827] dark:text-[#F5F7F7]">
                  Bem-vindo ao Meu Financeiro 2.0!
                </h1>
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                  Organize suas finanças de forma simples e intuitiva usando a clássica metodologia de envelopes. Aloque limites em cada envelope e acompanhe seus gastos.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full py-3 px-4 rounded-xl bg-[#22A45D] hover:bg-[#1E9152] dark:bg-[#39D47A] dark:hover:bg-[#2FBD6B] text-white dark:text-[#0D1214] text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <span>Começar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASSO 2: Contas */}
          {/* ========================================================= */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold tracking-tight text-[#111827] dark:text-[#F5F7F7]">
                  Cadastrar suas Contas e Cartões
                </h2>
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                  Cadastre suas carteiras, contas bancárias ou limites de cartão de crédito para ter o saldo inicial total.
                </p>
              </div>

              {/* Botão Adicionar Conta */}
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#22A45D] dark:border-[#39D47A] text-[#22A45D] dark:text-[#39D47A] hover:bg-[#22A45D]/5 dark:hover:bg-[#39D47A]/5 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar conta</span>
              </button>

              {/* Lista de Contas Criadas */}
              {accounts.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-center text-xs text-[#6B7280] dark:text-[#A9B1B1]">
                  Nenhuma conta cadastrada ainda. Clique no botão acima para adicionar.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {accounts.map((acc) => {
                    const typeLabel =
                      acc.type === 'DINHEIRO'
                        ? 'Dinheiro'
                        : acc.type === 'CONTA_CORRENTE'
                        ? 'Conta Corrente'
                        : 'Cartão de Crédito';
                    return (
                      <div
                        key={acc.id}
                        className="p-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
                            {acc.name}
                          </div>
                          <div className="text-[10px] text-[#6B7280] dark:text-[#A9B1B1]">
                            {typeLabel}
                          </div>
                        </div>
                        <div className="text-xs font-semibold text-[#22A45D] dark:text-[#39D47A]">
                          {formatCurrencyBRL(Number(acc.initial_balance) || 0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ações: Voltar e Salvar e Continuar */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-2.5 px-4 rounded-xl border border-[#E5E7EB] dark:border-[#263233] text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>

                <button
                  type="button"
                  disabled={accounts.length === 0}
                  onClick={() => setStep(3)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#22A45D] hover:bg-[#1E9152] dark:bg-[#39D47A] dark:hover:bg-[#2FBD6B] text-white dark:text-[#0D1214] text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>Salvar e Continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASSO 3: Categorias */}
          {/* ========================================================= */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center">
                <FolderTree className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold tracking-tight text-[#111827] dark:text-[#F5F7F7]">
                  Criar suas Categorias
                </h2>
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                  Oferecemos um modelo sugerido de categorias e subcategorias. Selecione as que deseja criar:
                </p>
              </div>

              {/* Botão Abrir Modelo Sugerido */}
              <button
                type="button"
                onClick={() => setIsSuggestedCatModalOpen(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-[#22A45D]/10 hover:bg-[#22A45D]/15 dark:bg-[#39D47A]/10 dark:hover:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                <span>Abrir modelo sugerido</span>
              </button>

              {/* Contador e Lista das Categorias Criadas */}
              {categories.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] text-center text-xs text-[#6B7280] dark:text-[#A9B1B1]">
                  Nenhuma categoria criada ainda. Clique no botão acima para importar o modelo sugerido.
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#ECEFF1] dark:border-[#263233] space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
                    <span>Categorias criadas</span>
                    <span className="text-[#22A45D] dark:text-[#39D47A]">
                      {categories.length} categoria{categories.length > 1 ? 's' : ''} ({subcategories.length} sub)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                    {categories.map((c) => (
                      <span
                        key={c.id}
                        className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[11px] text-[#111827] dark:text-[#F5F7F7] font-medium"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações: Voltar e Continuar */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-2.5 px-4 rounded-xl border border-[#E5E7EB] dark:border-[#263233] text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>

                <button
                  type="button"
                  disabled={categories.length === 0}
                  onClick={() => setStep(4)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#22A45D] hover:bg-[#1E9152] dark:bg-[#39D47A] dark:hover:bg-[#2FBD6B] text-white dark:text-[#0D1214] text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASSO 4: Pronto! */}
          {/* ========================================================= */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="w-12 h-12 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-bold tracking-tight text-[#111827] dark:text-[#F5F7F7]">
                  Tudo pronto!
                </h2>
                <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                  Seu 'Pronto para Atribuir' é a soma dos saldos das suas contas. Na aba Planejamento você distribui esse valor entre os envelopes, e na aba Metas guarda dinheiro para seus objetivos.
                </p>
              </div>

              {/* Ações: Voltar e Finalizar */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="py-3 px-4 rounded-xl border border-[#E5E7EB] dark:border-[#263233] text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#22A45D] hover:bg-[#1E9152] dark:bg-[#39D47A] dark:hover:bg-[#2FBD6B] text-white dark:text-[#0D1214] text-xs font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <span>Finalizar Configuração</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação para Pular */}
      {showSkipConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowSkipConfirm(false)}
        >
          <div
            className="max-w-sm w-full bg-[#FFFFFF] dark:bg-[#172021] rounded-2xl shadow-xl border border-[#ECEFF1] dark:border-[#263233] p-5 space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-[#111827] dark:text-[#F5F7F7]">
                Pular configuração?
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] leading-relaxed">
                Pular a configuração inicial? Você poderá cadastrar tudo depois em Ajustes.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSkipConfirm(false)}
                className="py-2 px-3.5 rounded-xl text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSkipConfirm(false);
                  handleFinish();
                }}
                className="py-2 px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Pular
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro de Conta (Existente) */}
      <AccountFormModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        onSuccess={(msg) => {
          showToast(msg);
          setIsAccountModalOpen(false);
        }}
      />

      {/* Modal de Modelo Sugerido de Categorias (Existente) */}
      <SuggestedCategoriesModal
        isOpen={isSuggestedCatModalOpen}
        onClose={() => setIsSuggestedCatModalOpen(false)}
        onSuccessToast={(msg) => {
          showToast(msg);
          setIsSuggestedCatModalOpen(false);
        }}
      />
    </div>
  );
};
