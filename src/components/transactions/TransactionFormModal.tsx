import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Trash2, Plus, AlertCircle, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useFinance } from '../../context/FinanceContext';
import {
  saveTransaction,
  deleteTransaction,
  createCategory,
  createSubcategory,
  createInstallmentPlanWithTransactions,
  createRecurrenceRuleWithTransactions,
  updateRecurringSeries,
  updateInstallmentSeries,
  deleteRecurringSeries,
  deleteInstallmentSeries,
} from '../../firebase/firestore';
import { Transaction } from '../../types/finance';
import {
  generateNumericId,
  generateInstallmentTransactions,
  generateRecurrenceTransactions,
  collectAllExistingNumericIds,
  updateRecurringSeriesLogic,
  updateInstallmentSeriesLogic,
  deleteRecurringSeriesLogic,
  deleteInstallmentSeriesLogic,
  removeInstallmentSuffix,
} from '../../lib/financeLogic';
import { DatePickerCalendar } from '../common/DatePickerCalendar';
import { MonthYearPicker, MONTH_NAMES_FULL } from '../common/MonthYearPicker';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionToEdit?: Transaction | null;
  initialCategoryId?: number | null;
  initialSubcategoryId?: number | null;
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
  initialCategoryId,
  initialSubcategoryId,
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
  const [showToast, setShowToast] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  // Timer para fechar automaticamente o toast discreto em 3 segundos
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Estados para modais de criar categoria/subcategoria rápida
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [isCreatingSubcategory, setIsCreatingSubcategory] = useState<boolean>(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState<string>('');

  // Referência para o seletor nativo de calendário e estado do calendário interativo
  const hiddenDateInputRef = useRef<HTMLInputElement>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);

  // Estados para Parcelamento (Fase 4c)
  const [isInstallment, setIsInstallment] = useState<boolean>(false);
  const [installmentsCountStr, setInstallmentsCountStr] = useState<string>('2');

  // Estados para Recorrência (Fase 4c)
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'MENSAL' | 'ANUAL'>('MENSAL');
  const [hasEndMonth, setHasEndMonth] = useState<boolean>(false);
  const [endMonth, setEndMonth] = useState<string>('');
  const [isEndMonthPickerOpen, setIsEndMonthPickerOpen] = useState<boolean>(false);

  // Diálogo de Opções de Edição para Séries (Fase 4e)
  const [showEditOptionsModal, setShowEditOptionsModal] = useState<boolean>(false);

  const isEditing = Boolean(transactionToEdit);
  const isRecurringTx = Boolean(
    isEditing &&
    transactionToEdit?.recurrence_rule_id !== undefined &&
    transactionToEdit?.recurrence_rule_id !== null &&
    String(transactionToEdit.recurrence_rule_id).trim() !== ''
  );
  const isInstallmentTx = Boolean(
    isEditing &&
    transactionToEdit?.installment_plan_id !== undefined &&
    transactionToEdit?.installment_plan_id !== null &&
    String(transactionToEdit.installment_plan_id).trim() !== ''
  );
  const isSeriesTx = isRecurringTx || isInstallmentTx;

  const showSeriesBlock = type !== 'TRANSFERENCIA';
  const showInstallmentToggle = type === 'DESPESA';
  const showRecurringToggle = type === 'DESPESA' || type === 'RECEITA';

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
      setShowEditOptionsModal(false);
      setFormError(null);
      setIsCreatingCategory(false);
      setIsCreatingSubcategory(false);
      setIsCalendarOpen(false);
      setIsInstallment(false);
      setIsRecurring(false);
      setInstallmentsCountStr('2');
      setRecurrenceInterval(1);
      setRecurrenceFrequency('MENSAL');
      setHasEndMonth(false);
      setEndMonth('');
      setIsEndMonthPickerOpen(false);
      return;
    }

    setFormError(null);
    setShowDeleteConfirm(false);
    setShowEditOptionsModal(false);
    setIsCalendarOpen(false);

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

      // Fase 4e: Ao editar uma transação com recurrence_rule_id
      if (isRecurringTx) {
        setIsRecurring(true);
        setIsInstallment(false);
        const ruleId = Number(transactionToEdit.recurrence_rule_id);
        const rule = (data.recurrence_rules || []).find(
          (r) => Number(r.id) === ruleId
        );
        if (rule) {
          setRecurrenceInterval(rule.frequency_interval || 1);
          setRecurrenceFrequency(rule.frequency === 'ANUAL' ? 'ANUAL' : 'MENSAL');
          if (rule.end_month) {
            setHasEndMonth(true);
            setEndMonth(rule.end_month);
          } else {
            setHasEndMonth(false);
            setEndMonth('');
          }
        } else {
          setRecurrenceInterval(1);
          setRecurrenceFrequency('MENSAL');
          setHasEndMonth(false);
          setEndMonth('');
        }
      } else if (isInstallmentTx) {
        // Fase 4e: Ao editar uma transação com installment_plan_id
        setIsInstallment(true);
        setIsRecurring(false);
        const planId = Number(transactionToEdit.installment_plan_id);
        const plan = (data.installment_plans || []).find(
          (p) => Number(p.id) === planId
        );
        if (plan) {
          setInstallmentsCountStr(String(plan.installments_count || '2'));
          if (plan.description) {
            setDescription(plan.description);
          } else {
            setDescription(removeInstallmentSuffix(transactionToEdit.description || ''));
          }
        } else {
          setInstallmentsCountStr('2');
          setDescription(removeInstallmentSuffix(transactionToEdit.description || ''));
        }
      } else {
        // Transação avulsa comum: esconde ambos os toggles
        setIsInstallment(false);
        setIsRecurring(false);
        setInstallmentsCountStr('2');
        setRecurrenceInterval(1);
        setRecurrenceFrequency('MENSAL');
        setHasEndMonth(false);
        setEndMonth('');
      }
    } else {
      // Modo Nova Transação: valores padrão
      setType('DESPESA');
      setValueStr('');
      setDescription('');
      setIsInstallment(false);
      setIsRecurring(false);
      setInstallmentsCountStr('2');
      setRecurrenceInterval(1);
      setRecurrenceFrequency('MENSAL');
      setHasEndMonth(false);
      setEndMonth('');

      // Conta padrão: primeira conta disponível
      const firstAcc = availableAccounts[0];
      setAccountId(firstAcc ? String(firstAcc.id) : '');

      // Conta de destino padrão para transferência: segunda conta disponível
      const secondAcc = availableAccounts[1];
      setToAccountId(secondAcc ? String(secondAcc.id) : '');

      // Categoria padrão: initialCategoryId se fornecido, senão primeira categoria disponível
      const targetCatId = initialCategoryId != null
        ? String(initialCategoryId)
        : (availableCategories[0] ? String(availableCategories[0].id) : '');
      setCategoryId(targetCatId);

      // Subcategoria padrão: initialSubcategoryId se fornecido, senão primeira subcategoria da categoria
      if (initialSubcategoryId != null) {
        setSubcategoryId(String(initialSubcategoryId));
      } else if (targetCatId) {
        const firstSub = data.subcategories.find(
          (sub) => String(sub.category_id) === targetCatId && !sub.archived
        );
        setSubcategoryId(firstSub ? String(firstSub.id) : '');
      } else {
        setSubcategoryId('');
      }

      // Data padrão: hoje em formato brasileiro DD/MM/AAAA
      setDateBrl(getTodayBrl());
    }
  }, [isOpen, transactionToEdit, initialCategoryId, initialSubcategoryId, availableAccounts, availableCategories, data.subcategories, data.recurrence_rules, data.installment_plans]);

  // Ao trocar o tipo de transação
  const handleTypeSelect = (newType: TxType) => {
    setType(newType);
    if (newType === 'TRANSFERENCIA') {
      setIsInstallment(false);
      setIsRecurring(false);
    } else if (newType === 'RECEITA') {
      setIsInstallment(false);
    }
  };

  // Texto de prévia em tempo real para parcelamento
  const installmentPreview = useMemo(() => {
    if (!isInstallment || type !== 'DESPESA') return null;
    const n = parseInt(installmentsCountStr, 10);
    if (isNaN(n) || n < 2) return null;

    const numericVal = parseFloat(valueStr.replace(',', '.'));
    if (isNaN(numericVal) || numericVal <= 0) return null;

    const iso = brlToIso(dateBrl);
    if (!iso) return null;

    const totalCents = Math.round(numericVal * 100);
    const baseCents = Math.floor(totalCents / n);
    const lastCents = totalCents - baseCents * (n - 1);

    const valBaseStr = (baseCents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const valLastStr = (lastCents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const [baseYearStr, baseMonthStr] = iso.slice(0, 7).split('-');
    const baseYear = parseInt(baseYearStr, 10);
    const baseMonth = parseInt(baseMonthStr, 10);

    const startMonthFormatted = `${String(baseMonth).padStart(2, '0')}/${baseYear}`;

    const lastOffset = n - 1;
    const lastTotalMonth = baseMonth - 1 + lastOffset;
    const lastYear = baseYear + Math.floor(lastTotalMonth / 12);
    const lastMonth = (lastTotalMonth % 12) + 1;
    const endMonthFormatted = `${String(lastMonth).padStart(2, '0')}/${lastYear}`;

    if (baseCents === lastCents) {
      return `Vai gerar ${n} lançamentos de R$ ${valBaseStr}, de ${startMonthFormatted} a ${endMonthFormatted}.`;
    } else {
      return `Vai gerar ${n - 1} lançamentos de R$ ${valBaseStr} e 1 de R$ ${valLastStr}, de ${startMonthFormatted} a ${endMonthFormatted}.`;
    }
  }, [isInstallment, type, installmentsCountStr, valueStr, dateBrl]);

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
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!user) {
      setFormError('Usuário não autenticado no Firebase.');
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
      if (!isEditing && isInstallment) {
        if (!categoryId) {
          setFormError('Selecione uma categoria para o parcelamento.');
          return;
        }
      } else if (!isEditing && isRecurring) {
        if (!categoryId) {
          setFormError('Selecione uma categoria para o lançamento recorrente.');
          return;
        }
      } else {
        if (!categoryId) {
          setFormError('Selecione uma categoria.');
          return;
        }
      }
    }

    // 5. Validação e conversão de Data DD/MM/AAAA -> YYYY-MM-DD
    const isoDate = brlToIso(dateBrl);
    if (!isoDate) {
      setFormError('Informe uma data válida no formato DD/MM/AAAA (ex: 12/09/2026).');
      return;
    }

    // Validações específicas de parcelamento e recorrência
    if (type === 'DESPESA' && isInstallment) {
      const n = parseInt(installmentsCountStr, 10);
      if (isNaN(n) || n < 2) {
        setFormError('Insira um número de parcelas válido maior ou igual a 2.');
        return;
      }
    }

    if ((type === 'DESPESA' || type === 'RECEITA') && isRecurring) {
      const interval = parseInt(String(recurrenceInterval), 10);
      if (isNaN(interval) || interval < 1) {
        setFormError('O intervalo deve ser um número inteiro maior ou igual a 1.');
        return;
      }
      if (hasEndMonth && endMonth) {
        const startMonth = isoDate.slice(0, 7);
        if (endMonth < startMonth) {
          setFormError('O mês de término não pode ser anterior ao mês da data inicial.');
          return;
        }
      }
    }

    // Fase 4e: Ao editar uma transação que faz parte de série e permanece como série, abre o diálogo "Opções de Edição"
    if (isEditing && ((isRecurringTx && isRecurring) || (isInstallmentTx && isInstallment))) {
      setShowEditOptionsModal(true);
      return;
    }

    try {
      setSaving(true);

      if (type === 'DESPESA' && isInstallment && !isInstallmentTx) {
        // === PARCELAMENTO: Criar InstallmentPlan e N transações numa ÚNICA chamada updateDoc atômica ===
        const n = parseInt(installmentsCountStr, 10);
        const usedIds = collectAllExistingNumericIds(data);
        const firstMonth = isoDate.slice(0, 7);

        const { plan, transactions: newTxs } = generateInstallmentTransactions({
          accountId: Number(accountId),
          categoryId: Number(categoryId),
          subcategoryId: subcategoryId ? Number(subcategoryId) : null,
          description: description.trim(),
          totalValue: numericValue,
          installmentsCount: n,
          firstInstallmentMonth: firstMonth,
          createdAtMs: Date.now(),
          usedIds,
        });

        const txsBase = isEditing && transactionToEdit
          ? data.transactions.filter((t) => Number(t.id) !== Number(transactionToEdit.id))
          : data.transactions;

        await createInstallmentPlanWithTransactions(
          user.uid,
          plan,
          newTxs,
          data.installment_plans || [],
          txsBase
        );
      } else if ((type === 'DESPESA' || type === 'RECEITA') && isRecurring && !isRecurringTx) {
        // === RECORRÊNCIA: Criar RecurrenceRule e materializar transações (39 meses) numa ÚNICA updateDoc ===
        const usedIds = collectAllExistingNumericIds(data);
        const { rule, transactions: newTxs } = generateRecurrenceTransactions({
          accountId: Number(accountId),
          categoryId: Number(categoryId),
          subcategoryId: subcategoryId ? Number(subcategoryId) : null,
          description: description.trim(),
          value: numericValue,
          type,
          frequency: recurrenceFrequency,
          frequency_interval: Number(recurrenceInterval),
          startDate: isoDate,
          endMonth: hasEndMonth && endMonth ? endMonth : null,
          usedIds,
        });

        const txsBase = isEditing && transactionToEdit
          ? data.transactions.filter((t) => Number(t.id) !== Number(transactionToEdit.id))
          : data.transactions;

        await createRecurrenceRuleWithTransactions(
          user.uid,
          rule,
          newTxs,
          data.recurrence_rules || [],
          txsBase
        );
      } else {
        // === Transação Padrão ou Edição de Transação Comum ===
        const isEditingTx = Boolean(transactionToEdit?.id);
        const targetNumericId = isEditingTx ? Number(transactionToEdit!.id) : generateNumericId();
        const txPayload: Omit<Transaction, 'id'> & { id?: number } = {
          ...(isEditingTx ? { id: targetNumericId } : {}),
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
            ? {
                recurrence_rule_id: Number(transactionToEdit.recurrence_rule_id),
                is_recurrence_override: true,
              }
            : {}),
        };

        await saveTransaction(user.uid, txPayload, data.transactions);
      }

      setShowToast(true);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar transação no Firestore:', err);
      setFormError(err?.message || 'Erro ao salvar transação no Firestore.');
    } finally {
      setSaving(false);
    }
  };

  // Fase 4e: Opções de Edição — "Só esta"
  const handleSaveSingleOccurrence = async () => {
    if (!user || !transactionToEdit) return;
    try {
      setSaving(true);
      setFormError(null);
      const isoDate = brlToIso(dateBrl);
      if (!isoDate) {
        setFormError('Informe uma data válida no formato DD/MM/AAAA (ex: 12/09/2026).');
        return;
      }
      const numericValue = parseFloat(valueStr.replace(',', '.'));

      const txPayload: Omit<Transaction, 'id'> & { id?: number } = {
        id: Number(transactionToEdit.id),
        account_id: Number(accountId),
        to_account_id: type === 'TRANSFERENCIA' && toAccountId ? Number(toAccountId) : null,
        category_id: type !== 'TRANSFERENCIA' && categoryId ? Number(categoryId) : null,
        subcategory_id: type !== 'TRANSFERENCIA' && subcategoryId ? Number(subcategoryId) : null,
        type,
        value: numericValue,
        description: description.trim(),
        date: isoDate,
        ...(transactionToEdit.installment_plan_id != null
          ? { installment_plan_id: Number(transactionToEdit.installment_plan_id) }
          : {}),
        ...(transactionToEdit.installment_number != null
          ? { installment_number: Number(transactionToEdit.installment_number) }
          : {}),
        ...(transactionToEdit.recurrence_rule_id != null
          ? {
              recurrence_rule_id: Number(transactionToEdit.recurrence_rule_id),
              is_recurrence_override: true,
            }
          : {
              is_recurrence_override: transactionToEdit.is_recurrence_override ?? false,
            }),
      };

      await saveTransaction(user.uid, txPayload, data.transactions);
      setShowEditOptionsModal(false);
      setShowToast(true);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar transação única:', err);
      setFormError(err?.message || 'Erro ao salvar transação.');
      setShowEditOptionsModal(false);
    } finally {
      setSaving(false);
    }
  };

  // Fase 4e: Opções de Edição — "Esta e as futuras"
  const handleSaveSeriesFuture = async () => {
    if (!user || !transactionToEdit) return;
    try {
      setSaving(true);
      setFormError(null);
      const isoDate = brlToIso(dateBrl);
      if (!isoDate) {
        setFormError('Informe uma data válida no formato DD/MM/AAAA (ex: 12/09/2026).');
        return;
      }
      const numericValue = parseFloat(valueStr.replace(',', '.'));
      const usedIds = collectAllExistingNumericIds(data);

      if (isRecurringTx) {
        const ruleId = Number(transactionToEdit.recurrence_rule_id);
        const existingRule = data.recurrence_rules.find((r) => Number(r.id) === ruleId);
        if (!existingRule) {
          throw new Error('Regra de recorrência correspondente não encontrada.');
        }

        const fromMonth = isoDate.slice(0, 7);
        const { updatedRules, updatedTransactions } = updateRecurringSeriesLogic({
          ruleId,
          existingRule,
          fromMonth,
          formData: {
            account_id: Number(accountId),
            category_id: categoryId ? Number(categoryId) : null,
            subcategory_id: subcategoryId ? Number(subcategoryId) : null,
            description: description.trim(),
            value: numericValue,
            type: type as 'DESPESA' | 'RECEITA',
            frequency: recurrenceFrequency,
            frequency_interval: Number(recurrenceInterval),
            end_month: hasEndMonth && endMonth ? endMonth : null,
          },
          currentTransactions: data.transactions,
          currentRules: data.recurrence_rules,
          usedIds,
        });

        await updateRecurringSeries(user.uid, updatedRules, updatedTransactions);
      } else if (isInstallmentTx) {
        const planId = Number(transactionToEdit.installment_plan_id);
        const existingPlan = data.installment_plans.find((p) => Number(p.id) === planId);
        if (!existingPlan) {
          throw new Error('Plano de parcelamento correspondente não encontrado.');
        }

        const finalCount = parseInt(installmentsCountStr, 10);
        const fromNumber = Number(transactionToEdit.installment_number) || 1;

        const { updatedPlans, updatedTransactions } = updateInstallmentSeriesLogic({
          planId,
          existingPlan,
          fromNumber,
          formData: {
            account_id: Number(accountId),
            category_id: categoryId ? Number(categoryId) : null,
            subcategory_id: subcategoryId ? Number(subcategoryId) : null,
            description: description.trim(),
            value: numericValue,
            finalCount,
          },
          currentTransactions: data.transactions,
          currentPlans: data.installment_plans,
          usedIds,
        });

        await updateInstallmentSeries(user.uid, updatedPlans, updatedTransactions);
      }

      setShowEditOptionsModal(false);
      setShowToast(true);
      onClose();
    } catch (err: any) {
      console.error('Erro ao atualizar série:', err);
      setFormError(err?.message || 'Erro ao atualizar série.');
      setShowEditOptionsModal(false);
    } finally {
      setSaving(false);
    }
  };

  // Exclusão de ocorrência única ("Só esta" ou transação avulsa)
  const handleDeleteSingle = async () => {
    if (!user || !transactionToEdit?.id) return;
    try {
      setSaving(true);
      setFormError(null);
      await deleteTransaction(user.uid, Number(transactionToEdit.id), data.transactions);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      console.error('Erro ao excluir transação no Firestore:', err);
      setFormError(err.message || 'Erro ao excluir transação no Firestore.');
    } finally {
      setSaving(false);
    }
  };

  // Fase 4e: Exclusão de série ("Esta e as futuras")
  const handleDeleteSeriesFuture = async () => {
    if (!user || !transactionToEdit) return;
    try {
      setSaving(true);
      setFormError(null);

      if (isRecurringTx) {
        const ruleId = Number(transactionToEdit.recurrence_rule_id);
        const txMonth = String(transactionToEdit.date || '').slice(0, 7);

        const { updatedRules, updatedTransactions } = deleteRecurringSeriesLogic({
          ruleId,
          fromMonth: txMonth,
          currentTransactions: data.transactions,
          currentRules: data.recurrence_rules,
        });

        await deleteRecurringSeries(user.uid, updatedRules, updatedTransactions);
      } else if (isInstallmentTx) {
        const planId = Number(transactionToEdit.installment_plan_id);
        const fromNumber = Number(transactionToEdit.installment_number) || 1;

        const { updatedTransactions } = deleteInstallmentSeriesLogic({
          planId,
          fromNumber,
          currentTransactions: data.transactions,
        });

        await deleteInstallmentSeries(user.uid, updatedTransactions);
      }

      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      console.error('Erro ao excluir série:', err);
      setFormError(err?.message || 'Erro ao excluir série.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen && !showToast) return null;

  // Valor ISO para o picker nativo
  const currentIsoDate = brlToIso(dateBrl) || new Date().toISOString().substring(0, 10);

  return (
    <>
      {/* Toast discreto no canto da tela ao concluir, que some sozinho em 3 segundos */}
      {showToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#111827] dark:bg-[#1E292B] text-white dark:text-[#F5F7F7] shadow-xl border border-gray-700/30 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none"
        >
          <div className="w-5 h-5 rounded-full bg-[#22A45D]/20 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center shrink-0">
            <CheckCircle className="w-3.5 h-3.5" />
          </div>
          <span>Transação salva</span>
        </div>
      )}

      {isOpen && (
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
                Excluir transação
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] max-w-sm mx-auto">
                {isRecurringTx
                  ? 'Esta transação é recorrente. Deseja excluir apenas esta ocorrência ou desativar a recorrência e excluir todas as ocorrências futuras?'
                  : isInstallmentTx
                  ? 'Esta transação é uma parcela. Deseja excluir apenas esta parcela ou excluir esta e todas as parcelas futuras desse plano?'
                  : 'Esta ação removerá a transação do seu extrato e atualizará o saldo das contas no Firestore. Esta operação não pode ser desfeita.'}
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-[#EF4444]/10 text-[#EF4444] dark:text-[#FF4D55] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {isSeriesTx ? (
              <div className="space-y-2 pt-2">
                <button
                  id="btn-delete-series-future"
                  type="button"
                  onClick={handleDeleteSeriesFuture}
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl bg-[#EF4444] dark:bg-[#FF4D55] text-white text-xs font-bold shadow-xs hover:opacity-95 active:scale-95 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? 'Excluindo...' : 'Esta e as futuras'}</span>
                </button>

                <button
                  id="btn-delete-series-single"
                  type="button"
                  onClick={handleDeleteSingle}
                  disabled={saving}
                  className="w-full py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#222E30] text-xs font-semibold text-[#111827] dark:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                >
                  Só esta
                </button>

                <button
                  id="btn-delete-series-cancel"
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={saving}
                  className="w-full py-2 text-center text-xs text-[#6B7280] dark:text-[#A9B1B1] hover:underline cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
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
                  onClick={handleDeleteSingle}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#EF4444] dark:bg-[#FF4D55] text-white text-xs font-bold shadow-xs hover:opacity-95 active:scale-95 cursor-pointer transition-all"
                >
                  {saving ? 'Excluindo...' : 'Confirmar Exclusão'}
                </button>
              </div>
            )}
          </div>
        ) : showEditOptionsModal ? (
          /* Diálogo Opções de Edição (Fase 4e) */
          <div className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#22A45D]/10 text-[#22A45D] dark:text-[#39D47A] flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-[#111827] dark:text-[#F5F7F7]">
                Opções de Edição
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#A9B1B1] max-w-sm mx-auto">
                {isRecurringTx
                  ? 'Esta transação é recorrente. Deseja aplicar as alterações apenas a esta ocorrência ou a esta e todas as ocorrências futuras?'
                  : 'Esta transação faz parte de um parcelamento. Deseja aplicar as alterações apenas a esta parcela ou a esta e todas as parcelas futuras?'}
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-[#EF4444]/10 text-[#EF4444] dark:text-[#FF4D55] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                id="btn-edit-series-future"
                type="button"
                onClick={handleSaveSeriesFuture}
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold shadow-xs hover:opacity-95 active:scale-95 cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{saving ? 'Salvando...' : 'Esta e as futuras'}</span>
              </button>

              <button
                id="btn-edit-series-single"
                type="button"
                onClick={handleSaveSingleOccurrence}
                disabled={saving}
                className="w-full py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#222E30] text-xs font-semibold text-[#111827] dark:text-[#F5F7F7] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                Só esta
              </button>

              <button
                id="btn-edit-series-cancel"
                type="button"
                onClick={() => setShowEditOptionsModal(false)}
                disabled={saving}
                className="w-full py-2 text-center text-xs text-[#6B7280] dark:text-[#A9B1B1] hover:underline cursor-pointer transition-colors"
              >
                Cancelar
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
                  onClick={() => handleTypeSelect('DESPESA')}
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
                  onClick={() => handleTypeSelect('RECEITA')}
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
                  onClick={() => handleTypeSelect('TRANSFERENCIA')}
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

            {/* === 6. CAMPO DATA (Formato Brasileiro DD/MM/AAAA com Calendário) === */}
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

                <button
                  type="button"
                  onClick={() => setIsCalendarOpen(true)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#22A45D] dark:text-[#39D47A] hover:bg-[#22A45D]/10 cursor-pointer transition-colors"
                  title="Abrir calendário para escolher ano, mês e dia"
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>

              {/* Calendário Interativo para escolher ano, mês e dia */}
              <DatePickerCalendar
                isOpen={isCalendarOpen}
                onClose={() => setIsCalendarOpen(false)}
                selectedDateIso={brlToIso(dateBrl) || undefined}
                onSelectDate={(_iso, brl) => {
                  setDateBrl(brl);
                }}
              />
            </div>

            {/* === 6.1. PARCELAMENTO E RECORRÊNCIA (Criar ou Editar Séries) === */}
            {showSeriesBlock && (
              <div
                id="block-installment-recurrence"
                className="p-3.5 rounded-[12px] bg-[#F9FAFB] dark:bg-[#0D1214] border border-[#E5E7EB] dark:border-[#222E30] space-y-3.5"
              >
                {/* a) Toggle "Compra parcelada?" (Só aparece quando o tipo é Despesa ou é edição de parcela) */}
                {showInstallmentToggle && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
                          Compra parcelada?
                        </div>
                        <div className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
                          Dividir o valor em parcelas mensais
                        </div>
                      </div>
                      <button
                        id="toggle-installment"
                        type="button"
                        role="switch"
                        aria-checked={isInstallment}
                        onClick={() => {
                          const next = !isInstallment;
                          setIsInstallment(next);
                          if (next) setIsRecurring(false);
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          isInstallment ? 'bg-[#22A45D] dark:bg-[#39D47A]' : 'bg-gray-300 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            isInstallment ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {isInstallment && (
                      <div className="pt-1.5 space-y-2">
                        <div>
                          <label
                            htmlFor="input-installments-count"
                            className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1] mb-1"
                          >
                            Número de parcelas
                          </label>
                          <input
                            id="input-installments-count"
                            type="text"
                            inputMode="numeric"
                            value={installmentsCountStr}
                            onChange={(e) => setInstallmentsCountStr(e.target.value.replace(/\D/g, ''))}
                            placeholder="Ex: 2"
                            className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] text-xs font-bold text-[#111827] dark:text-[#F5F7F7] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] transition-colors"
                          />
                        </div>

                        {/* Texto de prévia em tempo real (apenas ao criar nova transação) */}
                        {!isEditing && installmentPreview && (
                          <div
                            id="installment-preview-banner"
                            className="p-2.5 rounded-lg bg-[#22A45D]/10 text-[#22A45D] dark:text-[#39D47A] text-[11px] font-semibold"
                          >
                            {installmentPreview}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Linha divisória se ambos os toggles coexistirem */}
                {showInstallmentToggle && showRecurringToggle && (
                  <div className="border-t border-[#E5E7EB] dark:border-[#222E30]" />
                )}

                {/* b) Toggle "É recorrente?" (Aparece para Despesa e Receita ao criar, ou na edição de recorrente) */}
                {showRecurringToggle && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-[#111827] dark:text-[#F5F7F7]">
                          É recorrente?
                        </div>
                        <div className="text-[11px] text-[#6B7280] dark:text-[#A9B1B1]">
                          Repetir esta transação mensalmente
                        </div>
                      </div>
                      <button
                        id="toggle-recurring"
                        type="button"
                        role="switch"
                        aria-checked={isRecurring}
                        onClick={() => {
                          const next = !isRecurring;
                          setIsRecurring(next);
                          if (next) setIsInstallment(false);
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          isRecurring ? 'bg-[#22A45D] dark:bg-[#39D47A]' : 'bg-gray-300 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            isRecurring ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                  {isRecurring && (
                    <div className="pt-1.5 space-y-3">
                      {/* Campo "A cada" + seletor de dois botões MENSAL / ANUAL */}
                      <div>
                        <label
                          htmlFor="input-recurrence-interval"
                          className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1] mb-1"
                        >
                          A cada
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="input-recurrence-interval"
                            type="number"
                            min="1"
                            step="1"
                            value={recurrenceInterval}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setRecurrenceInterval(isNaN(val) ? 1 : val);
                            }}
                            className="w-20 px-3 py-2 rounded-xl bg-white dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] text-xs font-bold text-[#111827] dark:text-[#F5F7F7] focus:outline-hidden focus:border-[#22A45D] dark:focus:border-[#39D47A] text-center"
                          />
                          <div className="grid grid-cols-2 gap-1.5 flex-1">
                            <button
                              id="btn-freq-mensal"
                              type="button"
                              onClick={() => setRecurrenceFrequency('MENSAL')}
                              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                recurrenceFrequency === 'MENSAL'
                                  ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] shadow-xs'
                                  : 'bg-white dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5'
                              }`}
                            >
                              MENSAL
                            </button>
                            <button
                              id="btn-freq-anual"
                              type="button"
                              onClick={() => setRecurrenceFrequency('ANUAL')}
                              className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                recurrenceFrequency === 'ANUAL'
                                  ? 'bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] shadow-xs'
                                  : 'bg-white dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] text-[#6B7280] dark:text-[#A9B1B1] hover:bg-black/5 dark:hover:bg-white/5'
                              }`}
                            >
                              ANUAL
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Toggle "Definir mês de término?" */}
                      <div className="pt-1 border-t border-[#E5E7EB] dark:border-[#222E30]/60 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold text-[#111827] dark:text-[#F5F7F7]">
                            Definir mês de término?
                          </span>
                          <button
                            id="toggle-has-end-month"
                            type="button"
                            role="switch"
                            aria-checked={hasEndMonth}
                            onClick={() => {
                              const next = !hasEndMonth;
                              setHasEndMonth(next);
                              if (next && !endMonth) {
                                const curIso = brlToIso(dateBrl) || new Date().toISOString().slice(0, 10);
                                const [y, m] = curIso.slice(0, 7).split('-').map(Number);
                                setEndMonth(`${y + 1}-${String(m).padStart(2, '0')}`);
                              }
                            }}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                              hasEndMonth ? 'bg-[#22A45D] dark:bg-[#39D47A]' : 'bg-gray-300 dark:bg-gray-700'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                hasEndMonth ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {hasEndMonth && (
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#A9B1B1] mb-1">
                              Terminar em: mês/ano
                            </label>
                            <button
                              id="btn-select-end-month"
                              type="button"
                              onClick={() => setIsEndMonthPickerOpen(true)}
                              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#172021] border border-[#E5E7EB] dark:border-[#222E30] text-xs font-bold text-[#111827] dark:text-[#F5F7F7] hover:border-[#22A45D] dark:hover:border-[#39D47A] transition-colors cursor-pointer"
                            >
                              <span>
                                {endMonth ? (() => {
                                  const [y, m] = endMonth.split('-');
                                  const mNum = parseInt(m, 10);
                                  const name = MONTH_NAMES_FULL[mNum - 1] || m;
                                  return `${name} de ${y} (${m}/${y})`;
                                })() : 'Selecione o mês de término...'}
                              </span>
                              <Calendar className="w-4 h-4 text-[#22A45D] dark:text-[#39D47A]" />
                            </button>

                            <MonthYearPicker
                              isOpen={isEndMonthPickerOpen}
                              onClose={() => setIsEndMonthPickerOpen(false)}
                              selectedMonth={endMonth || brlToIso(dateBrl)?.slice(0, 7) || new Date().toISOString().slice(0, 7)}
                              onChange={(monthStr) => {
                                setEndMonth(monthStr);
                                setIsEndMonthPickerOpen(false);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

            {/* UMA única área de mensagem de erro (formError), visível dentro do modal */}
            {formError && (
              <div
                id="form-error-alert"
                className="p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] dark:text-[#FF4D55] text-xs font-semibold flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

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
                  className="px-5 py-2.5 rounded-xl bg-[#22A45D] dark:bg-[#39D47A] text-white dark:text-[#0D1214] text-xs font-bold shadow-xs hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? 'Salvando...' : 'Salvar'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
          </div>
        </div>
      )}
    </>
  );
};
