import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Trash2, Plus, AlertCircle, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import {
  saveTransaction,
  deleteTransaction,
  createCategory,
  createSubcategory,
} from '../../firebase/firestore';
import { Transaction } from '../../types/finance';
import { generateNumericId } from '../../lib/financeLogic';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionToEdit?: Transaction | null;
}

type TxType = 'DESPESA' | 'RECEITA' | 'TRANSFERENCIA';

// Converte YYYY-MM-DD -> DD/MM/AAAA
function isoToBrl(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  return iso;
}

// Converte DD/MM/AAAA -> YYYY-MM-DD
function brlToIso(brl: string): string | null {
  if (!brl) return null;
  const clean = brl.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const parts = clean.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    if (day.length === 2 && month.length === 2 && year.length === 4) {
      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
        return `${year}-${month}-${day}`;
      }
    }
  }
  return null;
}

// Obtém a data de hoje no formato brasileiro DD/MM/AAAA
function getTodayBrl(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  isOpen,
  onClose,
  transactionToEdit,
}) => {
  const { user } = useAuth();
  const { data } = useFinance();

  // Estados dos campos do formulário
  const [type, setType] = useState<TxType>('DESPESA');
  const [valueStr, setValueStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [dateBrl, setDateBrl] = useState<string>('');

  // Estados de controle e feedback
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  // Estados para modais de criar categoria/subcategoria rápida
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [isCreatingSubcategory, setIsCreatingSubcategory] = useState<boolean>(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState<string>('');

  // Referência para o seletor nativo de calendário
  const hiddenDateInputRef = useRef<HTMLInputElement>(null);

  const isEditing = Boolean(transactionToEdit);

  // Lista de contas disponíveis (não arquivadas + conta da transação atual se estiver arquivada)
  const availableAccounts = useMemo(() => {
    return data.accounts.filter(
      (acc) =>
        !acc.archived ||
        (transactionToEdit &&
          (String(acc.id) === String(transactionToEdit.account_id) ||
            String(acc.id) === String(transactionToEdit.to_account_id)))
    );
  }, [data.accounts, transactionToEdit]);

  // Lista de categorias disponíveis (não arquivadas + categoria da transação se arquivada)
  const availableCategories = useMemo(() => {
    return data.categories.filter(
      (cat) =>
        !cat.archived ||
        (transactionToEdit && String(cat.id) === String(transactionToEdit.category_id))
    );
  }, [data.categories, transactionToEdit]);

  // Subcategorias da categoria selecionada
  const availableSubcategories = useMemo(() => {
    if (!categoryId) return [];
    return data.subcategories.filter(
      (sub) =>
        String(sub.category_id) === String(categoryId) &&
        (!sub.archived ||
          (transactionToEdit && String(sub.id) === String(transactionToEdit.subcategory_id)))
    );
  }, [data.subcategories, categoryId, transactionToEdit]);

  // Inicializar o formulário ao abrir ou trocar transactionToEdit
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false);
      setFormError(null);
      setIsCreatingCategory(false);
      setIsCreatingSubcategory(false);
      return;
    }

    if (transactionToEdit) {
      // Modo Edição: carregar dados existentes
      setType(transactionToEdit.type || 'DESPESA');
      setValueStr(
        transactionToEdit.value != null
          ? transactionToEdit.value.toFixed(2).replace('.', ',')
          : ''
      );
      setDescription(transactionToEdit.description || '');
      setAccountId(String(transactionToEdit.account_id || ''));
      setToAccountId(transactionToEdit.to_account_id ? String(transactionToEdit.to_account_id) : '');
      setCategoryId(transactionToEdit.category_id ? String(transactionToEdit.category_id) : '');
      setSubcategoryId(
        transactionToEdit.subcategory_id ? String(transactionToEdit.subcategory_id) : ''
      );
      setDateBrl(isoToBrl(transactionToEdit.date || ''));
    } else {
      // Modo Nova Transação: valores padrão
      setType('DESPESA');
      setValueStr('');
      setDescription('');

      // Conta padrão: primeira conta disponível
      const firstAcc = availableAccounts[0];
      setAccountId(firstAcc ? String(firstAcc.id) : '');

      // Conta de destino padrão para transferência: segunda conta disponível
      const secondAcc = availableAccounts[1];
      setToAccountId(secondAcc ? String(secondAcc.id) : '');

      // Categoria padrão: primeira categoria disponível
      const firstCat = availableCategories[0];
      const initialCatId = firstCat ? String(firstCat.id) : '';
      setCategoryId(initialCatId);

      // Subcategoria padrão: primeira subcategoria da categoria
      if (initialCatId) {
        const firstSub = data.subcategories.find(
          (sub) => String(sub.category_id) === initialCatId && !sub.archived
        );
        setSubcategoryId(firstSub ? String(firstSub.id) : '');
      } else {
        setSubcategoryId('');
      }

      // Data padrão: hoje em formato brasileiro DD/MM/AAAA
      setDateBrl(getTodayBrl());
    }
  }, [isOpen, transactionToEdit, availableAccounts, availableCategories, data.subcategories]);

  // Ao trocar categoria: resetar subcategoria automaticamente para a primeira disponível
  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    if (!newCatId) {
      setSubcategoryId('');
      return;
    }
    const matchingSubs = data.subcategories.filter(
      (sub) => String(sub.category_id) === String(newCatId) && !sub.archived
    );
    setSubcategoryId(matchingSubs[0] ? String(matchingSubs[0].id) : '');
  };

  // Tratar entrada do valor aceitando números com até 2 casas decimais (vírgula ou ponto)
  const handleValueChange = (text: string) => {
    let clean = text.replace(/[^0-9.,]/g, '');

    const parts = clean.split(/[.,]/);
    if (parts.length > 2) {
      clean = parts[0] + ',' + parts.slice(1).join('');
    } else if (parts.length === 2) {
      clean = parts[0] + ',' + parts[1].slice(0, 2);
    }

    setValueStr(clean);
  };

  // Tratar entrada da data em formato brasileiro DD/MM/AAAA com máscara automática
  const handleDateChange = (text: string) => {
    let digits = text.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setDateBrl(formatted);
  };

  // Criação rápida de categoria
  const handleCreateCategorySubmit = async () => {
    if (!user || !newCategoryName.trim()) return;
    try {
      setSaving(true);
      const created = await createCategory(
        user.uid,
        newCategoryName.trim(),
        data.categories
      );
      setCategoryId(String(created.id));
      setSubcategoryId('');
      setNewCategoryName('');
      setIsCreatingCategory(false);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao criar categoria');
    } finally {
      setSaving(false);
    }
  };

  // Criação rápida de subcategoria
  const handleCreateSubcategorySubmit = async () => {
    if (!user || !categoryId || !newSubcategoryName.trim()) return;
    try {
      setSaving(true);
      const created = await createSubcategory(
        user.uid,
        Number(categoryId),
        newSubcategoryName.trim(),
        data.subcategories
      );
      setSubcategoryId(String(created.id));
      setNewSubcategoryName('');
      setIsCreatingSubcategory(false);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao criar subcategoria');
    } finally {
      setSaving(false);
    }
  };

  // Salvar transação no Firestore com validação rigorosa
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user) {
      setFormError('Usuário não autenticado.');
      return;
    }

    // 1. Validação de Valor: não permitir vazio ou zero
    const numericValue = parseFloat(valueStr.replace(',', '.'));
    if (isNaN(numericValue) || numericValue <= 0) {
      setFormError('Informe um valor válido maior que zero.');
      return;
    }

    // 2. Validação de Conta
    if (!accountId) {
      setFormError('Selecione uma conta.');
      return;
    }

    // 3. Validação se Transferência
    if (type === 'TRANSFERENCIA') {
      if (!toAccountId) {
        setFormError('Selecione a conta de destino.');
        return;
      }
      if (accountId === toAccountId) {
        setFormError('A conta de origem e a de destino não podem ser iguais.');
        return;
      }
    } else {
      // 4. Validação de Categoria (se não for transferência)
      if (!categoryId) {
        setFormError('Selecione uma categoria.');
        return;
      }
    }

    // 5. Validação e conversão de Data DD/MM/AAAA -> YYYY-MM-DD
    const isoDate = brlToIso(dateBrl);
    if (!isoDate) {
      setFormError('Informe uma data válida no formato DD/MM/AAAA (ex: 12/09/2026).');
      return;
    }

    try {
      setSaving(true);

      // Objeto da transação com TODOS os campos solicitados e IDs estritamente numéricos
      const txPayload: Omit<Transaction, 'id'> & { id?: number } = {
        ...(transactionToEdit?.id ? { id: Number(transactionToEdit.id) } : { id: generateNumericId() }),
        account_id: Number(accountId),
        to_account_id: type === 'TRANSFERENCIA' && toAccountId ? Number(toAccountId) : null,
        category_id: type !== 'TRANSFERENCIA' && categoryId ? Number(categoryId) : null,
        subcategory_id: type !== 'TRANSFERENCIA' && subcategoryId ? Number(subcategoryId) : null,
        type,
        value: numericValue,
        description: description.trim(),
        date: isoDate, // Salvo estritamente como YYYY-MM-DD
        ...(transactionToEdit?.installment_plan_id != null
          ? { installment_plan_id: Number(transactionToEdit.installment_plan_id) }
          : {}),
        ...(transactionToEdit?.installment_number != null
          ? { installment_number: Number(transactionToEdit.installment_number) }
          : {}),
        ...(transactionToEdit?.recurrence_rule_id != null
          ? { recurrence_rule_id: Number(transactionToEdit.recurrence_rule_id) }
          : {}),
      };

      await saveTransaction(user.uid, txPayload, data.transactions);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar transação no Firestore:', err);
      setFormError(err.message || 'Erro ao salvar transação no Firestore.');
    } finally {
      setSaving(false);
    }
  };

  // Exclusão da transação no Firestore
  const handleDelete = async () => {
    if (!user || !transactionToEdit?.id) return;
    try {
      setSaving(true);
      await deleteTransaction(user.uid, Number(transactionToEdit.id), data.transactions);
      onClose();
    } catch (err: any) {
      console.error('Erro ao excluir transação no Firestore:', err);
      setFormError(err.message || 'Erro ao excluir transação no Firestore.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // Valor ISO para o picker nativo
  const currentIsoDate = brlToIso(dateBrl) || new Date().toISOString().substring(0, 10);

  return (
    <div
      id="modal-transaction-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="modal-transaction-container"
        className="w-full max-w-lg rounded-[20px] bg-[#FFFFFF] dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] shadow-xl overflow-hidden my-auto"
      >
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#222E30]">
          <h2 className="text-base font-bold text-[#111827] dark:text-[#F5F7F7]">
            {isEditing ? 'Editar Transação' : 'Nova Transação'}
          </h2>
          <button
            id="btn-close-transaction-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diálogo de confirmação de exclusão */}
        {showDeleteConfirm ? (
          <div className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EF4444]/10 text-[#EF4444] dark:text-[#FF4D55] flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-[#111827] dark:text-[#F5F7F7]">
                Excluir esta transação?
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] max-w-xs mx-auto">
                Esta ação removerá a transação do seu extrato e atualizará o saldo das contas no Firestore. Esta operação não pode ser desfeita.
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-[#EF4444]/10 text-[#EF4444] dark:text-[#FF4D55] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#222E30] text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                Voltar
              </button>
              <button
                id="btn-confirm-delete-tx"
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-[#EF4444] dark:bg-[#FF4D55] text-white text-xs font-bold shadow-xs hover:opacity-95 active:scale-95 cursor-pointer transition-all"
              >
                {saving ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Mensagem de Erro Geral */}
            {formError && (
              <div className="p-3 rounded-xl bg-[#EF4444]/10 text-[#EF4444] dark:text-[#FF4D55] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* === 1. SELETOR DE TIPO (3 botões lado a lado, 10px rounded) === */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1] mb-1.5">
                Tipo
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  id="btn-type-despesa"
                  type="button"
                  onClick={() => setType('DESPESA')}
                  className={`py-2 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
                    type === 'DESPESA'
                      ? 'bg-[#EF4444] dark:bg-[#FF4D55] text-white shadow-xs'
                      : 'bg-[#F3F4F6] dark:bg-[#222E30] text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  Despesa
                </button>

                <button
                  id="btn-type-receita"
                  type="button"
                  onClick={() => setType('RECEITA')}
                  className={`py-2 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
                    type === 'RECEITA'
                      ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] shadow-xs'
                      : 'bg-[#F3F4F6] dark:bg-[#222E30] text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  Receita
                </button>

                <button
                  id="btn-type-transf"
                  type="button"
                  onClick={() => setType('TRANSFERENCIA')}
                  className={`py-2 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
                    type === 'TRANSFERENCIA'
                      ? 'bg-[#8B5CF6] text-white shadow-xs'
                      : 'bg-[#F3F4F6] dark:bg-[#222E30] text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  Transf.
                </button>
              </div>
            </div>

            {/* === 2. CAMPO VALOR === */}
            <div>
              <label
                htmlFor="input-tx-value"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1] mb-1.5"
              >
                Valor (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B7280] dark:text-[#A9B1B1]">
                  R$
                </span>
                <input
                  id="input-tx-value"
                  type="text"
                  inputMode="decimal"
                  value={valueStr}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-sm font-bold text-[#111827] dark:text-[#F5F7F7] placeholder-[#9CA3AF] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors"
                />
              </div>
            </div>

            {/* === 3. CAMPO DESCRIÇÃO === */}
            <div>
              <label
                htmlFor="input-tx-description"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1] mb-1.5"
              >
                Descrição
              </label>
              <input
                id="input-tx-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Supermercado, Almoço, etc."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-sm text-[#111827] dark:text-[#F5F7F7] placeholder-[#9CA3AF] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors"
              />
            </div>

            {/* === 4. CONTA(S) === */}
            {type === 'TRANSFERENCIA' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="select-tx-origin-account"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1] mb-1.5"
                  >
                    Conta de Origem
                  </label>
                  <select
                    id="select-tx-origin-account"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-sm text-[#111827] dark:text-[#F5F7F7] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors"
                  >
                    <option value="">Selecione...</option>
                    {availableAccounts.map((acc) => (
                      <option key={String(acc.id)} value={String(acc.id)}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="select-tx-dest-account"
                    className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1] mb-1.5"
                  >
                    Conta de Destino
                  </label>
                  <select
                    id="select-tx-dest-account"
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-sm text-[#111827] dark:text-[#F5F7F7] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors"
                  >
                    <option value="">Selecione...</option>
                    {availableAccounts.map((acc) => (
                      <option key={String(acc.id)} value={String(acc.id)}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="select-tx-account"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1] mb-1.5"
                >
                  Conta
                </label>
                <select
                  id="select-tx-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-sm text-[#111827] dark:text-[#F5F7F7] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors"
                >
                  <option value="">Selecione uma conta...</option>
                  {availableAccounts.map((acc) => (
                    <option key={String(acc.id)} value={String(acc.id)}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* === 5. CATEGORIA E SUBCATEGORIA (apenas se NÃO for Transferência) === */}
            {type !== 'TRANSFERENCIA' && (
              <div className="space-y-3 pt-1">
                {/* Categoria */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="select-tx-category"
                      className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1]"
                    >
                      Categoria
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCreatingCategory(true)}
                      className="text-xs font-semibold text-[#22A45D] dark:text-[#39D47A] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Criar Nova Categoria</span>
                    </button>
                  </div>

                  {isCreatingCategory ? (
                    <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1214] border border-[#22A45D]/40 dark:border-[#39D47A]/40 space-y-2">
                      <div className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
                        Nova Categoria
                      </div>
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Nome da categoria (Ex: Alimentação)"
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] text-xs text-[#111827] dark:text-[#F5F7F7] focus:outline-hidden"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingCategory(false);
                            setNewCategoryName('');
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateCategorySubmit}
                          disabled={saving || !newCategoryName.trim()}
                          className="px-3 py-1 rounded-lg bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          {saving ? 'Criando...' : 'Adicionar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      id="select-tx-category"
                      value={categoryId}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-sm text-[#111827] dark:text-[#F5F7F7] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors"
                    >
                      <option value="">Selecione uma categoria...</option>
                      {availableCategories.map((cat) => (
                        <option key={String(cat.id)} value={String(cat.id)}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Subcategoria (filtrada pela categoria selecionada) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="select-tx-subcategory"
                      className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1]"
                    >
                      Subcategoria
                    </label>
                    {categoryId && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingSubcategory(true)}
                        className="text-xs font-semibold text-[#22A45D] dark:text-[#39D47A] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Criar Nova Subcategoria</span>
                      </button>
                    )}
                  </div>

                  {isCreatingSubcategory ? (
                    <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1214] border border-[#22A45D]/40 dark:border-[#39D47A]/40 space-y-2">
                      <div className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
                        Nova Subcategoria
                      </div>
                      <input
                        type="text"
                        value={newSubcategoryName}
                        onChange={(e) => setNewSubcategoryName(e.target.value)}
                        placeholder="Nome da subcategoria (Ex: Restaurante)"
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] text-xs text-[#111827] dark:text-[#F5F7F7] focus:outline-hidden"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingSubcategory(false);
                            setNewSubcategoryName('');
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateSubcategorySubmit}
                          disabled={saving || !newSubcategoryName.trim()}
                          className="px-3 py-1 rounded-lg bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold cursor-pointer disabled:opacity-50"
                        >
                          {saving ? 'Criando...' : 'Adicionar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <select
                      id="select-tx-subcategory"
                      value={subcategoryId}
                      onChange={(e) => setSubcategoryId(e.target.value)}
                      disabled={!categoryId}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-sm text-[#111827] dark:text-[#F5F7F7] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors disabled:opacity-50"
                    >
                      <option value="">
                        {availableSubcategories.length === 0
                          ? 'Nenhuma subcategoria disponível'
                          : 'Selecione uma subcategoria...'}
                      </option>
                      {availableSubcategories.map((sub) => (
                        <option key={String(sub.id)} value={String(sub.id)}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* === 6. CAMPO DATA (Formato Brasileiro DD/MM/AAAA) === */}
            <div>
              <label
                htmlFor="input-tx-date"
                className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1] mb-1.5"
              >
                Data
              </label>
              <div className="relative">
                <input
                  id="input-tx-date"
                  type="text"
                  placeholder="DD/MM/AAAA"
                  value={dateBrl}
                  onChange={(e) => handleDateChange(e.target.value)}
                  maxLength={10}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] text-sm text-[#111827] dark:text-[#F5F7F7] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors"
                />

                {/* Input nativo oculto sincronizado para disparar o seletor nativo de calendário */}
                <input
                  type="date"
                  ref={hiddenDateInputRef}
                  tabIndex={-1}
                  value={currentIsoDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDateBrl(isoToBrl(e.target.value));
                    }
                  }}
                  className="sr-only"
                />

                <button
                  type="button"
                  onClick={() => {
                    if (hiddenDateInputRef.current && 'showPicker' in hiddenDateInputRef.current) {
                      try {
                        hiddenDateInputRef.current.showPicker();
                      } catch {
                        hiddenDateInputRef.current.focus();
                      }
                    } else if (hiddenDateInputRef.current) {
                      hiddenDateInputRef.current.focus();
                    }
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                  title="Abrir calendário"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* === 7. BOTÕES DE AÇÃO === */}
            <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#222E30] flex items-center justify-between gap-2">
              {isEditing ? (
                <button
                  id="btn-delete-tx"
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving}
                  className="px-3.5 py-2.5 rounded-xl bg-[#EF4444]/10 text-[#EF4444] dark:text-[#FF4D55] text-xs font-bold hover:bg-[#EF4444]/20 cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  id="btn-cancel-tx"
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#222E30] text-xs font-semibold text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>

                <button
                  id="btn-save-tx"
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold shadow-xs hover:opacity-95 active:scale-95 cursor-pointer transition-all disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
