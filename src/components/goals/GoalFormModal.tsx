import React, { useState, useEffect } from 'react';
import { X, Loader2, Target, Check } from 'lucide-react';
import { Goal } from '../../types/finance';

export const GOAL_PALETTE = [
  '#2ECC71',
  '#3498DB',
  '#E74C3C',
  '#9B59B6',
  '#F1C40F',
  '#1ABC9C',
  '#E67E22',
];

/**
 * Converte cor hex (#RRGGBB) para inteiro ARGB com sinal de 32 bits:
 * ((0xFF000000 | 0xRRGGBB) | 0)
 * Exemplo: #2ECC71 -> -13840847
 */
export function hexToArgbInt(hex: string): number {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return ((0xff000000 | num) | 0);
}

/**
 * Converte inteiro ARGB com sinal de volta para hex da paleta/CSS
 */
export function argbIntToHex(argb?: number): string {
  if (argb == null || isNaN(argb)) return '#2ECC71';
  const u = argb >>> 0;
  const r = (u >>> 16) & 0xff;
  const g = (u >>> 8) & 0xff;
  const b = u & 0xff;
  const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  const match = GOAL_PALETTE.find((c) => c.toUpperCase() === hex);
  return match || hex;
}

/**
 * Adiciona N meses a uma string "YYYY-MM"
 */
export function addMonths(monthStr: string, n: number): string {
  if (!monthStr || !monthStr.includes('-')) {
    const now = new Date();
    monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  const [yStr, mStr] = monthStr.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) - 1 + n;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

interface GoalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalToEdit?: Goal | null;
  currentSelectedMonth: string; // "YYYY-MM"
  onSave: (goalData: {
    name: string;
    target_value: number;
    start_date: string;
    deadline: string;
    color: number;
  }) => Promise<void>;
}

export const GoalFormModal: React.FC<GoalFormModalProps> = ({
  isOpen,
  onClose,
  goalToEdit,
  currentSelectedMonth,
  onSave,
}) => {
  const isEditing = Boolean(goalToEdit);

  const [name, setName] = useState('');
  const [targetValueStr, setTargetValueStr] = useState('');
  const [startDate, setStartDate] = useState(currentSelectedMonth);
  const [deadline, setDeadline] = useState(addMonths(currentSelectedMonth, 12));
  const [selectedColor, setSelectedColor] = useState(GOAL_PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar estado quando o modal abre ou goalToEdit muda
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (goalToEdit) {
        setName(goalToEdit.name || '');
        setTargetValueStr(String(goalToEdit.target_value || ''));
        setStartDate(goalToEdit.start_date || currentSelectedMonth);
        setDeadline(goalToEdit.deadline || addMonths(currentSelectedMonth, 12));
        setSelectedColor(argbIntToHex(goalToEdit.color));
      } else {
        setName('');
        setTargetValueStr('');
        setStartDate(currentSelectedMonth);
        setDeadline(addMonths(currentSelectedMonth, 12));
        setSelectedColor(GOAL_PALETTE[0]);
      }
    }
  }, [isOpen, goalToEdit, currentSelectedMonth]);

  if (!isOpen) return null;

  // Validação: prazo não pode ser anterior ao início
  const isDeadlineBeforeStart = Boolean(startDate && deadline && deadline < startDate);

  const numericTarget = parseFloat(targetValueStr.replace(',', '.')) || 0;
  const isFormValid =
    name.trim().length > 0 &&
    numericTarget > 0 &&
    !isDeadlineBeforeStart;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || saving) return;

    if (isDeadlineBeforeStart) {
      setErrorMsg('O prazo não pode ser anterior ao mês de início.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg(null);

      const colorInt = hexToArgbInt(selectedColor);

      await onSave({
        name: name.trim(),
        target_value: numericTarget,
        start_date: startDate,
        deadline,
        color: colorInt,
      });

      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar meta:', err);
      setErrorMsg(err?.message || 'Erro ao salvar meta. Tente novamente.');
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
        className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#172022] border border-[#E6E9EC] dark:border-[#283438] p-5 shadow-2xl space-y-4 text-[#111827] dark:text-[#F5F7F8]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[#E6E9EC] dark:border-[#283438] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#22A45D]/15 dark:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center shrink-0">
              <Target className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold tracking-tight">
              {isEditing ? 'Editar Meta 🎯' : 'Nova Meta 🎯'}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Erro Geral */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-[#EF4444]/15 text-[#EF4444] dark:text-[#FF4D55] text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campo: Nome da Meta */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
              Nome da Meta
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Viagem para a praia, Reserva de Emergência"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A]"
              autoFocus
              required
            />
          </div>

          {/* Campo: Valor Alvo (R$) */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
              Valor Alvo (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6B7280] dark:text-[#9FA9AB]">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={targetValueStr}
                onChange={(e) => setTargetValueStr(e.target.value)}
                placeholder="0,00"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-xs font-bold focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A]"
                required
              />
            </div>
          </div>

          {/* Linha dupla: Mês de Início e Mês Limite (Prazo) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
                Mês de Início
              </label>
              <input
                type="month"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438] text-xs font-medium focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A]"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
                Mês Limite (Prazo)
              </label>
              <input
                type="month"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border text-xs font-medium focus:outline-hidden ${
                  isDeadlineBeforeStart
                    ? 'border-[#EF4444] text-[#EF4444]'
                    : 'border-[#E6E9EC] dark:border-[#283438] focus:border-[#22A45D] dark:focus:border-[#39D47A]'
                }`}
                required
              />
            </div>
          </div>

          {/* Aviso se prazo for anterior ao início */}
          {isDeadlineBeforeStart && (
            <div className="text-[11px] font-semibold text-[#EF4444] dark:text-[#FF4D55]">
              O prazo não pode ser anterior ao mês de início.
            </div>
          )}

          {/* Campo: Cor da Meta (7 bolinhas de cores da paleta) */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB]">
              Cor da Meta
            </label>
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#FAFAFB] dark:bg-[#0D1315] border border-[#E6E9EC] dark:border-[#283438]">
              {GOAL_PALETTE.map((color) => {
                const isSelected = selectedColor.toUpperCase() === color.toUpperCase();
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'ring-3 ring-offset-2 ring-[#111827] dark:ring-[#F5F7F8] dark:ring-offset-[#172022] scale-110 shadow-xs'
                        : 'hover:scale-105 opacity-90 hover:opacity-100'
                    }`}
                    title={color}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rodapé com Botões */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E9EC] dark:border-[#283438]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-[#E6E9EC] dark:border-[#283438] text-xs font-semibold text-[#6B7280] dark:text-[#9FA9AB] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!isFormValid || saving}
              className="px-5 py-2.5 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
