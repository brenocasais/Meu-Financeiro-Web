import React, { useState, useMemo } from 'react';
import { X, FileText, Table, FileArchive, Calendar, Check, AlertCircle } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { MonthYearPicker, MONTH_NAMES_FULL } from '../common/MonthYearPicker';
import {
  filterTransactionsForExport,
  exportToCSV,
  exportToJSON,
  exportToPDF,
  ExportFilterParams,
} from '../../lib/exportHelper';

interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const ExportDataModal: React.FC<ExportDataModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const { data, selectedMonth } = useFinance();

  const [allPeriod, setAllPeriod] = useState(true);
  const [startMonth, setStartMonth] = useState(selectedMonth);
  const [endMonth, setEndMonth] = useState(selectedMonth);

  const [isStartPickerOpen, setIsStartPickerOpen] = useState(false);
  const [isEndPickerOpen, setIsEndPickerOpen] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = data.categories || [];
  const subcategories = data.subcategories || [];

  // Subcategorias disponíveis para a categoria selecionada
  const availableSubcategories = useMemo(() => {
    if (selectedCategoryId == null) return [];
    return subcategories.filter((s) => Number(s.category_id) === Number(selectedCategoryId));
  }, [subcategories, selectedCategoryId]);

  const formatMonthLabel = (mStr: string) => {
    if (!mStr || !mStr.includes('-')) return '';
    const [y, m] = mStr.split('-');
    const idx = parseInt(m, 10) - 1;
    const name = MONTH_NAMES_FULL[idx] || m;
    return `${name}/${y}`;
  };

  const handleStartMonthChange = (newStart: string) => {
    setStartMonth(newStart);
    if (endMonth < newStart) {
      setEndMonth(newStart);
    }
  };

  const handleEndMonthChange = (newEnd: string) => {
    setEndMonth(newEnd);
    if (newEnd < startMonth) {
      setStartMonth(newEnd);
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const numId = val === 'ALL' ? null : Number(val);
    setSelectedCategoryId(numId);
    setSelectedSubcategoryId(null); // zera a subcategoria
  };

  const handleSubcategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const numId = val === 'ALL' ? null : Number(val);
    setSelectedSubcategoryId(numId);
  };

  const getFilteredTransactions = () => {
    const params: ExportFilterParams = {
      allPeriod,
      startMonth,
      endMonth,
      categoryId: selectedCategoryId,
      subcategoryId: selectedSubcategoryId,
    };
    return filterTransactionsForExport(data.transactions || [], params);
  };

  const handleExportPDF = () => {
    setMessage(null);
    setErrorMessage(null);
    try {
      const txs = getFilteredTransactions();
      if (txs.length === 0) {
        setMessage('Nenhum dado encontrado para exportação.');
        return;
      }

      const periodLabel = allPeriod
        ? 'Todos os meses'
        : `${formatMonthLabel(startMonth)} até ${formatMonthLabel(endMonth)}`;

      const catName =
        selectedCategoryId != null
          ? categories.find((c) => Number(c.id) === selectedCategoryId)?.name || 'Categoria'
          : 'Todas as Categorias';

      const subName =
        selectedSubcategoryId != null
          ? subcategories.find((s) => Number(s.id) === selectedSubcategoryId)?.name || 'Subcategoria'
          : null;

      const filterLabel = subName ? `${catName} > ${subName}` : catName;

      exportToPDF(
        txs,
        categories,
        subcategories,
        data.accounts || [],
        periodLabel,
        filterLabel
      );
      onSuccessToast('PDF exportado com sucesso!');
    } catch (err: any) {
      console.error('[ExportDataModal] Erro ao exportar PDF:', err);
      setErrorMessage(`Erro ao gerar arquivo: ${err.message || 'Falha ao criar PDF'}`);
    }
  };

  const handleExportCSV = () => {
    setMessage(null);
    setErrorMessage(null);
    try {
      const txs = getFilteredTransactions();
      if (txs.length === 0) {
        setMessage('Nenhum dado encontrado para exportação.');
        return;
      }
      exportToCSV(txs, categories, subcategories, data.accounts || []);
      onSuccessToast('Planilha CSV exportada!');
    } catch (err: any) {
      console.error('[ExportDataModal] Erro ao exportar CSV:', err);
      setErrorMessage(`Erro ao gerar arquivo: ${err.message || 'Falha ao criar CSV'}`);
    }
  };

  const handleExportJSON = () => {
    setMessage(null);
    setErrorMessage(null);
    try {
      exportToJSON(data);
      onSuccessToast('Backup JSON exportado com sucesso!');
    } catch (err: any) {
      console.error('[ExportDataModal] Erro ao exportar JSON:', err);
      setErrorMessage(`Erro ao gerar arquivo: ${err.message || 'Falha ao criar backup'}`);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] p-6 shadow-xl space-y-4 animate-in zoom-in-95 duration-150 transition-colors flex flex-col max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Topo */}
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[#111827] dark:text-[#F5F7F7]">
              Exportar Dados
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#A9B1B1] hover:text-[#111827] dark:hover:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-[12px] text-[#6B7280] dark:text-[#A9B1B1] -mt-1">
            Gere relatórios e comprovantes em PDF, planilhas CSV/Excel ou backup completo em JSON.
          </p>

          {/* Filtro de Período */}
          <div className="space-y-2.5 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[#ECEFF1] dark:border-[#263233]">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-[#111827] dark:text-[#F5F7F7]">
                Filtro de Período
              </span>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allPeriod}
                  onChange={(e) => setAllPeriod(e.target.checked)}
                  className="rounded border-[#ECEFF1] dark:border-[#263233] text-[#22A45D] focus:ring-0 cursor-pointer accent-[#22A45D]"
                />
                <span className="text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
                  Todos os meses
                </span>
              </label>
            </div>

            {!allPeriod && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
                    De:
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsStartPickerOpen(true)}
                    className="w-full p-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] flex items-center justify-between cursor-pointer"
                  >
                    <span>{formatMonthLabel(startMonth)}</span>
                    <Calendar className="w-3.5 h-3.5 text-[#22A45D] dark:text-[#39D47A]" />
                  </button>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-[#6B7280] dark:text-[#A9B1B1]">
                    Até:
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEndPickerOpen(true)}
                    className="w-full p-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] flex items-center justify-between cursor-pointer"
                  >
                    <span>{formatMonthLabel(endMonth)}</span>
                    <Calendar className="w-3.5 h-3.5 text-[#22A45D] dark:text-[#39D47A]" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Filtro por Categoria e Subcategoria */}
          <div className="space-y-2.5 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[#ECEFF1] dark:border-[#263233]">
            <span className="text-[14px] font-bold text-[#111827] dark:text-[#F5F7F7]">
              Filtro por Categoria e Subcategoria
            </span>

            <div className="space-y-2">
              <select
                value={selectedCategoryId != null ? String(selectedCategoryId) : 'ALL'}
                onChange={handleCategoryChange}
                className="w-full p-2.5 rounded-xl text-xs bg-white dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#22A45D]"
              >
                <option value="ALL">Todas as Categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}{c.name}
                  </option>
                ))}
              </select>

              <select
                disabled={selectedCategoryId == null || availableSubcategories.length === 0}
                value={selectedSubcategoryId != null ? String(selectedSubcategoryId) : 'ALL'}
                onChange={handleSubcategoryChange}
                className="w-full p-2.5 rounded-xl text-xs bg-white dark:bg-[#172021] border border-[#ECEFF1] dark:border-[#263233] text-[#111827] dark:text-[#F5F7F7] focus:outline-none focus:border-[#22A45D] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="ALL">Todas as Subcategorias</option>
                {availableSubcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon ? `${s.icon} ` : ''}{s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mensagens de feedback */}
          {message && (
            <div className="p-2.5 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 flex items-center gap-2 text-xs text-[#D97706] dark:text-[#F59E0B] font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 flex items-center gap-2 text-xs text-[#EF4444] dark:text-[#FF4D55] font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Opções de Exportação */}
          <div className="space-y-2 pt-1">
            <span className="text-[14px] font-bold text-[#111827] dark:text-[#F5F7F7]">
              Opções de Exportação
            </span>

            <button
              type="button"
              onClick={handleExportPDF}
              className="w-full p-3 rounded-xl border border-[#22A45D] dark:border-[#39D47A] bg-[#22A45D]/10 dark:bg-[#39D47A]/10 hover:bg-[#22A45D]/15 dark:hover:bg-[#39D47A]/15 text-[#22A45D] dark:text-[#39D47A] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <FileText className="w-4 h-4" />
              <span>Exportar PDF (Comprovantes)</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="w-full p-3 rounded-xl border border-[#ECEFF1] dark:border-[#263233] bg-[#FAFAFB] dark:bg-[#0D1315] hover:bg-black/5 dark:hover:bg-white/5 text-[#111827] dark:text-[#F5F7F7] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <Table className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A]" />
              <span>Exportar CSV (Planilha)</span>
            </button>

            <button
              type="button"
              onClick={handleExportJSON}
              className="w-full p-3 rounded-xl border border-[#ECEFF1] dark:border-[#263233] bg-[#FAFAFB] dark:bg-[#0D1315] hover:bg-black/5 dark:hover:bg-white/5 text-[#111827] dark:text-[#F5F7F7] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <FileArchive className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B]" />
              <span>Exportar Tudo (Backup JSON)</span>
            </button>
          </div>

          {/* Rodapé */}
          <div className="pt-2 border-t border-[#ECEFF1] dark:border-[#263233] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-black/5 dark:bg-white/10 text-[#111827] dark:text-[#F5F7F7] hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      <MonthYearPicker
        isOpen={isStartPickerOpen}
        onClose={() => setIsStartPickerOpen(false)}
        selectedMonth={startMonth}
        onChange={handleStartMonthChange}
      />

      <MonthYearPicker
        isOpen={isEndPickerOpen}
        onClose={() => setIsEndPickerOpen(false)}
        selectedMonth={endMonth}
        onChange={handleEndMonthChange}
      />
    </>
  );
};
