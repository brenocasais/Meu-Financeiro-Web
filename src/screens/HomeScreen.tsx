import React from 'react';
import { Home, Sparkles, CheckCircle2, ShieldCheck, Database, Layers, ArrowRight } from 'lucide-react';
import { firebaseConfig } from '../firebase/config';

export const HomeScreen: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* Foundation Card */}
      <div
        id="card-foundation-status"
        className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-5 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#22A45D]/10 dark:bg-[#39D47A]/10 flex items-center justify-center text-[#22A45D] dark:text-[#39D47A]">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#22A45D] dark:text-[#39D47A]">
                Fase 1 Concluída • Fundação
              </span>
              <h2 className="text-base font-bold text-[#111827] dark:text-[#F5F7F7]">
                Tela Início (Dashboard)
              </h2>
            </div>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#22A45D]/10 text-[#22A45D] dark:bg-[#39D47A]/10 dark:text-[#39D47A]">
            Pronto para Fase 2 & 3
          </span>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-[#6B7280] dark:text-[#A9B1B1]">
          A fundação do app Web está pronta e conectada ao mesmo banco de dados do app Android nativo. Conforme planejado na Fase 1, não há dados fixos ou simulados. O conteúdo do painel será exibido nas Fases 2 (Login) e 3 (Dashboard real do Firestore).
        </p>

        {/* Phase checklist */}
        <div className="mt-4 pt-3 border-t border-[#E5E7EB] dark:border-[#222E30] grid grid-cols-1 gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#111827] dark:text-[#F5F7F7]">
            <CheckCircle2 className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A] shrink-0" />
            <span>Firebase SDK inicializado (<code className="text-[11px] font-mono text-[#6B7280] dark:text-[#A9B1B1]">{firebaseConfig.projectId}</code>)</span>
          </div>
          <div className="flex items-center gap-2 text-[#111827] dark:text-[#F5F7F7]">
            <CheckCircle2 className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A] shrink-0" />
            <span>PWA configurado para Android (Chrome) e iOS (Safari)</span>
          </div>
          <div className="flex items-center gap-2 text-[#111827] dark:text-[#F5F7F7]">
            <CheckCircle2 className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A] shrink-0" />
            <span>Design system do Android aplicado (Modo claro & escuro)</span>
          </div>
          <div className="flex items-center gap-2 text-[#111827] dark:text-[#F5F7F7]">
            <CheckCircle2 className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A] shrink-0" />
            <span>Camada de lógica financeira validada (<code className="text-[11px] font-mono text-[#6B7280] dark:text-[#A9B1B1]">financeLogic.ts</code>)</span>
          </div>
        </div>
      </div>

      {/* Next Phase Preview Card */}
      <div
        id="card-roadmap-fases"
        className="rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] p-5 shadow-xs border border-[#E5E7EB] dark:border-[#222E30] transition-colors"
      >
        <h3 className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] uppercase tracking-wider mb-3">
          Próximas Fases Programadas
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30]">
            <div>
              <div className="text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
                Fase 2: Autenticação & Login
              </div>
              <div className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
                E-mail/Senha e Google Sign-In sincronizados com a conta do Android
              </div>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#22A45D] text-white dark:bg-[#39D47A] dark:text-[#0D1214]">
              Próxima
            </span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30]">
            <div>
              <div className="text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
                Fase 3: Dashboard em Tempo Real
              </div>
              <div className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
                Saldo total, contas reais e resumo do mês
              </div>
            </div>
            <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#A9B1B1]">
              A seguir
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
