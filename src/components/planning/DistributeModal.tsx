import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import { formatCurrencyBRL } from '../../lib/financeLogic';
import { moveMoney } from '../../firebase/firestore';

export type EntityType = 'PRONTO' | 'ENVELOPE' | 'META';

export interface EnvelopeOption {
  key: string; // `${catId}:${subId ?? 'null'}`
  categoryId: number;
  subcategoryId: number | null;
  categoryName: string;
  subcategoryName: string | null;
  label: string;
  isSubcategory: boolean;
  sobraAcumulada: number;
  archived: boolean;
}

export interface MetaOption {
  id: number;
  name: string;
  saldo: number;
}

interface DistributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: string; // "YYYY-MM"
  readyToAssign: number;
  envelopeOptions: EnvelopeOption[];
  metaOptions: MetaOption[];
  initialSource?: {
    type: EntityType;
    categoryId?: number | null;
    subcategoryId?: number | null;
    goalId?: number | null;
  };
  onSuccess: (message: string) => void;
}

export const DistributeModal: React.FC<DistributeModalProps> = ({
  isOpen,
  onClose,
  month,
  readyToAssign,
  envelopeOptions,
  metaOptions,
  initialSource,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { data } = useFinance();

  const [valueStr, setValueStr] = useState<string>('');
  const [sourceType, setSourceType] = useState<EntityType>('PRONTO');
  const [sourceEnvelopeKey, setSourceEnvelopeKey] = useState<string>('');
  const [sourceGoalId, setSourceGoalId] = useState<string>('');

  const [destType, setDestType] = useState<EntityType>('ENVELOPE');
  const [destEnvelopeKey, setDestEnvelopeKey] = useState<string>('');
  const [destGoalId, setDestGoalId] = useState<string>('');

  const [note, setNote] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Inicialização ao abrir
  useEffect(() => {
    if (isOpen) {
      setValueStr('');
      setNote('');
      setError(null);

      // Origem
      const srcType = initialSource?.type || 'PRONTO';
      setSourceType(srcType);

      if (srcType === 'ENVELOPE' && initialSource?.categoryId != null) {
        setSourceEnvelopeKey(`${initialSource.categoryId}:${initialSource.subcategoryId ?? 'null'}`);
      } else {
        const firstEnv = envelopeOptions.find((e) => !e.archived);
        setSourceEnvelopeKey(firstEnv ? firstEnv.key : '');
      }

      if (srcType === 'META' && initialSource?.goalId != null) {
        setSourceGoalId(String(initialSource.goalId));
      } else {
        setSourceGoalId(metaOptions[0] ? String(metaOptions[0].id) : '');
      }

      // Destino padrão: se origem for Pronto, destino default = Envelope; se origem for Envelope/Meta, destino default = Pronto
      if (srcType === 'PRONTO') {
        setDestType('ENVELOPE');
        const firstEnv = envelopeOptions.find((e) => !e.archived);
        setDestEnvelopeKey(firstEnv ? firstEnv.key : '');
        setDestGoalId(metaOptions[0] ? String(metaOptions[0].id) : '');
      } else {
        setDestType('PRONTO');
        const firstEnv = envelopeOptions.find((e) => !e.archived);
        setDestEnvelopeKey(firstEnv ? firstEnv.key : '');
        setDestGoalId(metaOptions[0] ? String(metaOptions[0].id) : '');
      }
    }
  }, [isOpen, initialSource, envelopeOptions, metaOptions]);

  // Envelopes de origem filtrados: ocultar arquivadas, exceto a selecionada
  const sourceEnvelopeOptionsFiltered = useMemo(() => {
    return envelopeOptions.filter((e) => !e.archived || e.key === sourceEnvelopeKey);
  }, [envelopeOptions, sourceEnvelopeKey]);

  // Envelopes de destino filtrados: ocultar arquivadas, exceto a selecionada
  const destEnvelopeOptionsFiltered = useMemo(() => {
    return envelopeOptions.filter((e) => !e.archived || e.key === destEnvelopeKey);
  }, [envelopeOptions, destEnvelopeKey]);

  // Saldo da Origem
  const { saldoOrigem, nomeOrigem } = useMemo(() => {
    if (sourceType === 'PRONTO') {
      return {
        saldoOrigem: readyToAssign,
        nomeOrigem: 'Pronto para Atribuir',
      };
    }
    if (sourceType === 'ENVELOPE') {
      const env = envelopeOptions.find((e) => e.key === sourceEnvelopeKey);
      return {
        saldoOrigem: Math.max(0, env?.sobraAcumulada || 0),
        nomeOrigem: env ? env.label : 'Envelope',
      };
    }
    if (sourceType === 'META') {
      const meta = metaOptions.find((m) => String(m.id) === sourceGoalId);
      return {
        saldoOrigem: meta?.saldo || 0,
        nomeOrigem: meta ? meta.name : 'Meta',
      };
    }
    return { saldoOrigem: 0, nomeOrigem: '' };
  }, [sourceType, sourceEnvelopeKey, sourceGoalId, readyToAssign, envelopeOptions, metaOptions]);

  // Nome do Destino
  const nomeDestino = useMemo(() => {
    if (destType === 'PRONTO') return 'Pronto para Atribuir';
    if (destType === 'ENVELOPE') {
      const env = envelopeOptions.find((e) => e.key === destEnvelopeKey);
      return env ? env.label : 'Envelope';
    }
    if (destType === 'META') {
      const meta = metaOptions.find((m) => String(m.id) === destGoalId);
      return meta ? meta.name : 'Meta';
    }
    return '';
  }, [destType, destEnvelopeKey, destGoalId, envelopeOptions, metaOptions]);

  // Validação
  const numericValue = useMemo(() => {
    const cleanStr = valueStr.replace(/\./g, '').replace(',', '.').trim();
    const val = parseFloat(cleanStr);
    return isNaN(val) ? 0 : val;
  }, [valueStr]);

  const isExceeded = numericValue > saldoOrigem;

  // Verificação de origem e destino idênticos
  const isIdentical = useMemo(() => {
    if (sourceType === 'PRONTO' && destType === 'PRONTO') return true;
    if (sourceType === 'ENVELOPE' && destType === 'ENVELOPE') {
      return sourceEnvelopeKey === destEnvelopeKey;
    }
    if (sourceType === 'META' && destType === 'META') {
      return sourceGoalId === destGoalId;
    }
    return false;
  }, [sourceType, destType, sourceEnvelopeKey, destEnvelopeKey, sourceGoalId, destGoalId]);

  const isDestValid = useMemo(() => {
    if (destType === 'PRONTO') return true;
    if (destType === 'ENVELOPE') return Boolean(destEnvelopeKey);
    if (destType === 'META') return Boolean(destGoalId);
    return false;
  }, [destType, destEnvelopeKey, destGoalId]);

  const canTransfer = numericValue > 0 && !isExceeded && !isIdentical && isDestValid && !saving;

  if (!isOpen) return null;

  const handleTransfer = async () => {
    if (!user || !canTransfer) return;
    setError(null);

    // Mapeia origem
    let sourceCat: number | null = null;
    let sourceSub: number | null = null;
    let sGoalId: number | null = null;

    if (sourceType === 'ENVELOPE' && sourceEnvelopeKey) {
      const [cStr, sStr] = sourceEnvelopeKey.split(':');
      sourceCat = parseInt(cStr, 10);
      sourceSub = sStr === 'null' ? null : parseInt(sStr, 10);
    } else if (sourceType === 'META' && sourceGoalId) {
      sGoalId = parseInt(sourceGoalId, 10);
    }

    // Mapeia destino
    let destCat: number | null = null;
    let destSub: number | null = null;
    let dGoalId: number | null = null;

    if (destType === 'ENVELOPE' && destEnvelopeKey) {
      const [cStr, sStr] = destEnvelopeKey.split(':');
      destCat = parseInt(cStr, 10);
      destSub = sStr === 'null' ? null : parseInt(sStr, 10);
    } else if (destType === 'META' && destGoalId) {
      dGoalId = parseInt(destGoalId, 10);
    }

    try {
      setSaving(true);
      await moveMoney(
        user.uid,
        {
          sourceCat,
          sourceSub,
          destCat,
          destSub,
          sourceGoalId: sGoalId,
          destGoalId: dGoalId,
          month,
          amount: numericValue,
          note: note.trim() || 'Distribuição de dinheiro',
        },
        data.budget_allocations || [],
        data.allocation_movements || [],
        data
      );

      onSuccess(`Transferido ${formatCurrencyBRL(numericValue)} de ${nomeOrigem} para ${nomeDestino} com sucesso!`);
      onClose();
    } catch (err: any) {
      console.error('Erro ao transferir dinheiro:', err);
      setError(err?.message || 'Erro ao realizar transferência.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-5 shadow-2xl space-y-4 text-[#111827] dark:text-[#F5F7F8] max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[#E6E9EC] dark:border-[#283438] pb-3">
          <div>
            <h3 className="text-base font-bold tracking-tight">Distribuir Dinheiro</h3>
            <p className="text-xs text-[#6B7280] dark:text-[#9FA9AB]">
              Mover recursos entre envelopes, metas ou pronto para atribuir
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Campo Valor a Transferir */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
            Valor a Transferir (R$)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B7280] dark:text-[#9FA9AB]">
              R$
            </span>
            <input
              id="input-distribute-amount"
              type="text"
              inputMode="decimal"
              value={valueStr}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9,]/g, '');
                setValueStr(val);
              }}
              placeholder="0,00"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-base font-bold text-[#111827] dark:text-[#F5F7F8] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors"
              autoFocus
            />
          </div>
        </div>

        {/* SELEÇÃO DA ORIGEM */}
        <div className="space-y-2 p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438]">
          <span className="block text-xs font-bold">Origem</span>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setSourceType('PRONTO')}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer truncate ${
                sourceType === 'PRONTO'
                  ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214]'
                  : 'bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#6B7280] dark:text-[#9FA9AB]'
              }`}
            >
              Pronto
            </button>
            <button
              type="button"
              onClick={() => setSourceType('ENVELOPE')}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer truncate ${
                sourceType === 'ENVELOPE'
                  ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214]'
                  : 'bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#6B7280] dark:text-[#9FA9AB]'
              }`}
            >
              Envelope
            </button>
            <button
              type="button"
              onClick={() => setSourceType('META')}
              disabled={metaOptions.length === 0}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer truncate ${
                sourceType === 'META'
                  ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214]'
                  : 'bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#6B7280] dark:text-[#9FA9AB]'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Meta
            </button>
          </div>

          {/* Seletor quando Envelope */}
          {sourceType === 'ENVELOPE' && (
            <div className="pt-1">
              <select
                id="select-source-envelope"
                value={sourceEnvelopeKey}
                onChange={(e) => setSourceEnvelopeKey(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold focus:outline-hidden"
              >
                {sourceEnvelopeOptionsFiltered.map((env) => (
                  <option key={env.key} value={env.key} className={env.isSubcategory ? 'pl-4' : 'font-bold'}>
                    {env.label} ({env.sobraAcumulada >= 0 ? `Sobra: ${formatCurrencyBRL(env.sobraAcumulada)}` : `Falta: ${formatCurrencyBRL(env.sobraAcumulada)}`})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Seletor quando Meta */}
          {sourceType === 'META' && (
            <div className="pt-1">
              <select
                id="select-source-goal"
                value={sourceGoalId}
                onChange={(e) => setSourceGoalId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold focus:outline-hidden"
              >
                {metaOptions.map((meta) => (
                  <option key={meta.id} value={meta.id}>
                    {meta.name} ({formatCurrencyBRL(meta.saldo)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Saldo disponível na origem */}
          <div className="pt-1 text-[11px] font-semibold text-[#6B7280] dark:text-[#9FA9AB] flex items-center justify-between">
            <span>Saldo disponível em {nomeOrigem}:</span>
            <span
              className={`font-bold ${
                saldoOrigem >= 0
                  ? 'text-[#22A45D] dark:text-[#39D47A]'
                  : 'text-[#EF4444] dark:text-[#FF4D55]'
              }`}
            >
              {formatCurrencyBRL(saldoOrigem)}
            </span>
          </div>

          {/* Alerta de saldo insuficiente */}
          {isExceeded && (
            <div className="text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 pt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Não é possível transferir pois não há saldo suficiente na origem.</span>
            </div>
          )}
        </div>

        {/* SELEÇÃO DO DESTINO */}
        <div className="space-y-2 p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438]">
          <span className="block text-xs font-bold">Destino</span>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => setDestType('ENVELOPE')}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer truncate ${
                destType === 'ENVELOPE'
                  ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214]'
                  : 'bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#6B7280] dark:text-[#9FA9AB]'
              }`}
            >
              Envelope
            </button>
            <button
              type="button"
              onClick={() => setDestType('PRONTO')}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer truncate ${
                destType === 'PRONTO'
                  ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214]'
                  : 'bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#6B7280] dark:text-[#9FA9AB]'
              }`}
            >
              Pronto
            </button>
            <button
              type="button"
              onClick={() => setDestType('META')}
              disabled={metaOptions.length === 0}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer truncate ${
                destType === 'META'
                  ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214]'
                  : 'bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-[#6B7280] dark:text-[#9FA9AB]'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Meta
            </button>
          </div>

          {/* Seletor quando Envelope */}
          {destType === 'ENVELOPE' && (
            <div className="pt-1">
              <select
                id="select-dest-envelope"
                value={destEnvelopeKey}
                onChange={(e) => setDestEnvelopeKey(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold focus:outline-hidden"
              >
                {destEnvelopeOptionsFiltered.map((env) => (
                  <option key={env.key} value={env.key} className={env.isSubcategory ? 'pl-4' : 'font-bold'}>
                    {env.label} ({env.sobraAcumulada >= 0 ? `Sobra: ${formatCurrencyBRL(env.sobraAcumulada)}` : `Falta: ${formatCurrencyBRL(env.sobraAcumulada)}`})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Seletor quando Meta */}
          {destType === 'META' && (
            <div className="pt-1">
              <select
                id="select-dest-goal"
                value={destGoalId}
                onChange={(e) => setDestGoalId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold focus:outline-hidden"
              >
                {metaOptions.map((meta) => (
                  <option key={meta.id} value={meta.id}>
                    {meta.name} ({formatCurrencyBRL(meta.saldo)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isIdentical && (
            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 pt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>A origem e o destino selecionados são idênticos.</span>
            </div>
          )}
        </div>

        {/* Nota Opcional */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
            Nota (Opcional)
          </label>
          <input
            id="input-distribute-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: Ajuste de final de mês"
            className="w-full px-3.5 py-2 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-xs font-medium focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A]"
          />
        </div>

        {/* Rodapé com botões de ação */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            id="btn-confirm-distribute"
            type="button"
            onClick={handleTransfer}
            disabled={!canTransfer}
            className="px-4 py-2 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold hover:opacity-90 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Transferindo...</span>
              </>
            ) : (
              <span>Transferir</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
