import { doc, onSnapshot, getDoc, setDoc, updateDoc, arrayUnion, DocumentReference, Unsubscribe } from 'firebase/firestore';
import { db } from './config';
import { UserFirestoreData, Transaction, Category, Subcategory, InstallmentPlan, RecurrenceRule } from '../types/finance';
import { generateNumericId } from '../lib/financeLogic';

/**
 * Serviço do Firestore para o "Meu Financeiro"
 * 
 * Regra de persistência no Firestore:
 * Os dados do usuário ficam em um ÚNICO documento: /users/{userId}
 * Campos:
 * - accounts: Account[]
 * - categories: Category[]
 * - subcategories: Subcategory[]
 * - transactions: Transaction[]
 * - budget_allocations: BudgetAllocation[]
 * - allocation_movements: AllocationMovement[]
 * - goals: Goal[]
 * - installment_plans: InstallmentPlan[]
 * - recurrence_rules: RecurrenceRule[]
 */

export function getUserDocRef(userId: string): DocumentReference {
  return doc(db, 'users', userId);
}

/**
 * Sanitiza recursivamente qualquer dado para o Firestore, removendo propriedades com valor undefined,
 * convertendo undefined para null ou descartando-os, evitando o erro "Unsupported field value: undefined".
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) return null as any;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  const clean: any = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

/**
 * Normaliza os dados brutos do Firestore garantindo que todos os arrays existam
 * e que os IDs sejam estritamente numéricos para total interoperabilidade com o Android.
 */
export function normalizeUserData(raw: any): UserFirestoreData {
  const accounts = Array.isArray(raw?.accounts)
    ? raw.accounts.map((a: any) => ({
        ...a,
        id: typeof a.id === 'number' ? a.id : Number(a.id) || a.id,
      }))
    : [];

  const categories = Array.isArray(raw?.categories)
    ? raw.categories.map((c: any) => ({
        ...c,
        id: typeof c.id === 'number' ? c.id : Number(c.id) || c.id,
      }))
    : [];

  const subcategories = Array.isArray(raw?.subcategories)
    ? raw.subcategories.map((s: any) => ({
        ...s,
        id: typeof s.id === 'number' ? s.id : Number(s.id) || s.id,
        category_id: typeof s.category_id === 'number' ? s.category_id : Number(s.category_id) || s.category_id,
      }))
    : [];

  const transactions = Array.isArray(raw?.transactions)
    ? raw.transactions.map((t: any) => {
        const item: any = {
          ...t,
          id: typeof t.id === 'number' ? t.id : Number(t.id) || t.id,
          account_id: typeof t.account_id === 'number' ? t.account_id : Number(t.account_id) || t.account_id,
          to_account_id: t.to_account_id != null ? (typeof t.to_account_id === 'number' ? t.to_account_id : Number(t.to_account_id) || null) : null,
          category_id: t.category_id != null ? (typeof t.category_id === 'number' ? t.category_id : Number(t.category_id) || null) : null,
          subcategory_id: t.subcategory_id != null ? (typeof t.subcategory_id === 'number' ? t.subcategory_id : Number(t.subcategory_id) || null) : null,
          installment_plan_id: t.installment_plan_id != null ? (typeof t.installment_plan_id === 'number' ? t.installment_plan_id : Number(t.installment_plan_id) || null) : null,
          installment_number: t.installment_number != null ? (typeof t.installment_number === 'number' ? t.installment_number : Number(t.installment_number) || null) : null,
          recurrence_rule_id: t.recurrence_rule_id != null ? (typeof t.recurrence_rule_id === 'number' ? t.recurrence_rule_id : Number(t.recurrence_rule_id) || null) : null,
          goal_id: t.goal_id != null ? (typeof t.goal_id === 'number' ? t.goal_id : Number(t.goal_id) || null) : null,
          is_recurrence_override: Boolean(t.is_recurrence_override ?? false),
          attachment_uri: t.attachment_uri ?? null,
          attachment_name: t.attachment_name ?? null,
          attachment_type: t.attachment_type ?? null,
        };
        if (typeof t.synced === 'boolean') {
          item.synced = t.synced;
        }
        return item;
      })
    : [];

  const budget_allocations = Array.isArray(raw?.budget_allocations)
    ? raw.budget_allocations.map((b: any) => ({
        ...b,
        id: typeof b.id === 'number' ? b.id : Number(b.id) || b.id,
        category_id: typeof b.category_id === 'number' ? b.category_id : Number(b.category_id) || b.category_id,
        subcategory_id: b.subcategory_id != null ? (typeof b.subcategory_id === 'number' ? b.subcategory_id : Number(b.subcategory_id) || null) : null,
      }))
    : [];

  const allocation_movements = Array.isArray(raw?.allocation_movements)
    ? raw.allocation_movements.map((m: any) => ({
        ...m,
        id: typeof m.id === 'number' ? m.id : Number(m.id) || m.id,
        source_budget_allocation_id: m.source_budget_allocation_id != null ? (typeof m.source_budget_allocation_id === 'number' ? m.source_budget_allocation_id : Number(m.source_budget_allocation_id) || null) : null,
        dest_budget_allocation_id: m.dest_budget_allocation_id != null ? (typeof m.dest_budget_allocation_id === 'number' ? m.dest_budget_allocation_id : Number(m.dest_budget_allocation_id) || null) : null,
        source_goal_id: m.source_goal_id != null ? (typeof m.source_goal_id === 'number' ? m.source_goal_id : Number(m.source_goal_id) || null) : null,
        dest_goal_id: m.dest_goal_id != null ? (typeof m.dest_goal_id === 'number' ? m.dest_goal_id : Number(m.dest_goal_id) || null) : null,
      }))
    : [];

  const goals = Array.isArray(raw?.goals)
    ? raw.goals.map((g: any) => ({
        ...g,
        id: typeof g.id === 'number' ? g.id : Number(g.id) || g.id,
      }))
    : [];

  const installment_plans = Array.isArray(raw?.installment_plans)
    ? raw.installment_plans.map((p: any) => ({
        ...p,
        id: typeof p.id === 'number' ? p.id : Number(p.id) || p.id,
        account_id: typeof p.account_id === 'number' ? p.account_id : Number(p.account_id) || p.account_id,
        category_id: p.category_id != null ? (typeof p.category_id === 'number' ? p.category_id : Number(p.category_id) || null) : null,
        subcategory_id: p.subcategory_id != null ? (typeof p.subcategory_id === 'number' ? p.subcategory_id : Number(p.subcategory_id) || null) : null,
        created_at: typeof p.created_at === 'number' ? p.created_at : Number(p.created_at) || Date.now(),
      }))
    : [];

  const recurrence_rules = Array.isArray(raw?.recurrence_rules)
    ? raw.recurrence_rules.map((r: any) => ({
        ...r,
        id: typeof r.id === 'number' ? r.id : Number(r.id) || r.id,
        account_id: typeof r.account_id === 'number' ? r.account_id : Number(r.account_id) || r.account_id,
        category_id: r.category_id != null ? (typeof r.category_id === 'number' ? r.category_id : Number(r.category_id) || null) : null,
        subcategory_id: r.subcategory_id != null ? (typeof r.subcategory_id === 'number' ? r.subcategory_id : Number(r.subcategory_id) || null) : null,
        description: String(r.description || ''),
        value: typeof r.value === 'number' ? r.value : Number(r.value) || 0,
        type: r.type === 'RECEITA' ? 'RECEITA' : 'DESPESA',
        frequency: r.frequency === 'ANUAL' ? 'ANUAL' : 'MENSAL',
        frequency_interval: typeof r.frequency_interval === 'number' ? r.frequency_interval : Number(r.frequency_interval) || 1,
        start_date: String(r.start_date || ''),
        end_month: r.end_month ?? null,
        active: Boolean(r.active ?? true),
      }))
    : [];

  return {
    accounts,
    categories,
    subcategories,
    transactions,
    budget_allocations,
    allocation_movements,
    goals,
    installment_plans,
    recurrence_rules,
  };
}

/**
 * Escuta em tempo real as atualizações no documento /users/{userId}.
 */
export function subscribeUserData(
  userId: string,
  onUpdate: (data: UserFirestoreData) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const docRef = getUserDocRef(userId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(normalizeUserData(snapshot.data()));
      } else {
        // Documento novo ou vazio
        onUpdate(normalizeUserData({}));
      }
    },
    (error) => {
      console.error('[Firestore] Erro ao escutar /users/' + userId, error);
      if (onError) onError(error);
    }
  );
}

/**
 * Lê uma única vez os dados do documento /users/{userId}.
 */
export function getUserData(userId: string): Promise<UserFirestoreData | null> {
  const docRef = getUserDocRef(userId);

  return getDoc(docRef).then((snapshot) => {
    if (snapshot.exists()) {
      return normalizeUserData(snapshot.data());
    }
    return null;
  });
}

/**
 * Salva ou atualiza uma transação no array `transactions` do documento /users/{userId}.
 * Garante que todos os campos de ID sejam gravados estritamente como NÚMEROS no Firestore.
 */
export async function saveTransaction(
  userId: string,
  tx: Omit<Transaction, 'id'> & { id?: number },
  currentTransactions: Transaction[]
): Promise<Transaction> {
  const docRef = getUserDocRef(userId);
  const targetId: number = tx.id ? Number(tx.id) : generateNumericId();

  // Procura transação original existente para não perder nenhum campo não gerenciado pelo formulário web (ex: anexos, metas, overrides)
  const originalTx = currentTransactions.find((t) => Number(t.id) === Number(targetId));
  const isEditing = Boolean(originalTx);

  let savedTx: Transaction;

  if (isEditing && originalTx) {
    // Ao EDITAR: parte da transação original completa e sobrescreve apenas os campos alterados
    const isRecurring = Boolean(originalTx.recurrence_rule_id != null || tx.recurrence_rule_id != null);
    savedTx = {
      ...originalTx,
      id: targetId,
      account_id: Number(tx.account_id),
      to_account_id: tx.type === 'TRANSFERENCIA' && tx.to_account_id != null ? Number(tx.to_account_id) : null,
      category_id: tx.type !== 'TRANSFERENCIA' && tx.category_id != null ? Number(tx.category_id) : null,
      subcategory_id: tx.type !== 'TRANSFERENCIA' && tx.subcategory_id != null ? Number(tx.subcategory_id) : null,
      type: tx.type,
      value: Number(tx.value),
      description: String(tx.description || '').trim(),
      date: String(tx.date),
      is_recurrence_override: isRecurring ? true : (originalTx.is_recurrence_override ?? false),
      ...(tx.installment_plan_id !== undefined ? { installment_plan_id: tx.installment_plan_id != null ? Number(tx.installment_plan_id) : null } : {}),
      ...(tx.installment_number !== undefined ? { installment_number: tx.installment_number != null ? Number(tx.installment_number) : null } : {}),
      ...(tx.recurrence_rule_id !== undefined ? { recurrence_rule_id: tx.recurrence_rule_id != null ? Number(tx.recurrence_rule_id) : null } : {}),
    };
  } else {
    // Nova Transação
    savedTx = {
      id: targetId,
      account_id: Number(tx.account_id),
      to_account_id: tx.type === 'TRANSFERENCIA' && tx.to_account_id != null ? Number(tx.to_account_id) : null,
      category_id: tx.type !== 'TRANSFERENCIA' && tx.category_id != null ? Number(tx.category_id) : null,
      subcategory_id: tx.type !== 'TRANSFERENCIA' && tx.subcategory_id != null ? Number(tx.subcategory_id) : null,
      type: tx.type,
      value: Number(tx.value),
      description: String(tx.description || '').trim(),
      date: String(tx.date),
      ...(tx.installment_plan_id != null ? { installment_plan_id: Number(tx.installment_plan_id) } : {}),
      ...(tx.installment_number != null ? { installment_number: Number(tx.installment_number) } : {}),
      ...(tx.recurrence_rule_id != null ? { recurrence_rule_id: Number(tx.recurrence_rule_id) } : {}),
      ...(tx.goal_id != null ? { goal_id: Number(tx.goal_id) } : {}),
      ...(tx.is_recurrence_override !== undefined ? { is_recurrence_override: tx.is_recurrence_override } : {}),
      ...(tx.attachment_uri !== undefined ? { attachment_uri: tx.attachment_uri } : {}),
      ...(tx.attachment_name !== undefined ? { attachment_name: tx.attachment_name } : {}),
      ...(tx.attachment_type !== undefined ? { attachment_type: tx.attachment_type } : {}),
      ...(tx.synced !== undefined ? { synced: tx.synced } : {}),
    };
  }

  const updatedTransactions = isEditing
    ? currentTransactions.map((t) => (Number(t.id) === Number(targetId) ? savedTx : t))
    : [savedTx, ...currentTransactions];

  const sanitizedTxs = sanitizeForFirestore(updatedTransactions);

  try {
    await updateDoc(docRef, { transactions: sanitizedTxs });
  } catch (firstErr: any) {
    console.warn('[Firestore] updateDoc falhou em saveTransaction, tentando setDoc merge...', firstErr);
    try {
      await setDoc(docRef, { transactions: sanitizedTxs }, { merge: true });
    } catch (fallbackErr: any) {
      console.error('[Firestore] setDoc fallback também falhou:', fallbackErr);
      throw new Error(
        `Falha no Firestore ao salvar transação: ${fallbackErr?.message || fallbackErr?.code || String(fallbackErr)}`
      );
    }
  }

  return savedTx;
}

/**
 * Cria um InstallmentPlan e suas N transações parceladas numa ÚNICA chamada atômica updateDoc:
 * updateDoc(docRef, { installment_plans: [...], transactions: [...] })
 */
export async function createInstallmentPlanWithTransactions(
  userId: string,
  plan: InstallmentPlan,
  newTransactions: Transaction[],
  currentPlans: InstallmentPlan[],
  currentTransactions: Transaction[]
): Promise<{ plan: InstallmentPlan; transactions: Transaction[] }> {
  const docRef = getUserDocRef(userId);
  const updatedPlans = [...currentPlans, plan];
  const updatedTransactions = [...newTransactions, ...currentTransactions];

  const sanitizedPlans = sanitizeForFirestore(updatedPlans);
  const sanitizedTxs = sanitizeForFirestore(updatedTransactions);

  try {
    await updateDoc(docRef, {
      installment_plans: sanitizedPlans,
      transactions: sanitizedTxs,
    });
  } catch (firstErr: any) {
    console.warn('[Firestore] updateDoc falhou em createInstallmentPlanWithTransactions, tentando setDoc merge...', firstErr);
    try {
      await setDoc(
        docRef,
        {
          installment_plans: sanitizedPlans,
          transactions: sanitizedTxs,
        },
        { merge: true }
      );
    } catch (fallbackErr: any) {
      console.error('[Firestore] setDoc fallback também falhou:', fallbackErr);
      throw new Error(
        `Falha no Firestore ao salvar parcelamento: ${fallbackErr?.message || fallbackErr?.code || String(fallbackErr)}`
      );
    }
  }

  return { plan, transactions: newTransactions };
}

/**
 * Cria uma RecurrenceRule e materializa suas transações na janela de 39 meses numa ÚNICA chamada atômica updateDoc:
 * updateDoc(docRef, { recurrence_rules: [...], transactions: [...] })
 */
export async function createRecurrenceRuleWithTransactions(
  userId: string,
  rule: RecurrenceRule,
  newTransactions: Transaction[],
  currentRules: RecurrenceRule[],
  currentTransactions: Transaction[]
): Promise<{ rule: RecurrenceRule; transactions: Transaction[] }> {
  const docRef = getUserDocRef(userId);
  const updatedRules = [...currentRules, rule];
  const updatedTransactions = [...newTransactions, ...currentTransactions];

  const sanitizedRules = sanitizeForFirestore(updatedRules);
  const sanitizedTxs = sanitizeForFirestore(updatedTransactions);

  try {
    await updateDoc(docRef, {
      recurrence_rules: sanitizedRules,
      transactions: sanitizedTxs,
    });
  } catch (firstErr: any) {
    console.warn('[Firestore] updateDoc falhou em createRecurrenceRuleWithTransactions, tentando setDoc merge...', firstErr);
    try {
      await setDoc(
        docRef,
        {
          recurrence_rules: sanitizedRules,
          transactions: sanitizedTxs,
        },
        { merge: true }
      );
    } catch (fallbackErr: any) {
      console.error('[Firestore] setDoc fallback também falhou:', fallbackErr);
      throw new Error(
        `Falha no Firestore ao salvar regra de recorrência: ${fallbackErr?.message || fallbackErr?.code || String(fallbackErr)}`
      );
    }
  }

  return { rule, transactions: newTransactions };
}

/**
 * Atualiza a regra de recorrência e suas transações em lote numa ÚNICA chamada atômica updateDoc (Fase 4e):
 * updateDoc(docRef, { recurrence_rules: updatedRules, transactions: updatedTransactions })
 */
export async function updateRecurringSeries(
  userId: string,
  updatedRules: RecurrenceRule[],
  updatedTransactions: Transaction[]
): Promise<void> {
  const docRef = getUserDocRef(userId);
  const sanitizedRules = sanitizeForFirestore(updatedRules);
  const sanitizedTxs = sanitizeForFirestore(updatedTransactions);

  try {
    await updateDoc(docRef, {
      recurrence_rules: sanitizedRules,
      transactions: sanitizedTxs,
    });
  } catch (firstErr: any) {
    console.warn('[Firestore] updateDoc falhou em updateRecurringSeries, tentando setDoc merge...', firstErr);
    try {
      await setDoc(
        docRef,
        {
          recurrence_rules: sanitizedRules,
          transactions: sanitizedTxs,
        },
        { merge: true }
      );
    } catch (fallbackErr: any) {
      console.error('[Firestore] setDoc fallback também falhou:', fallbackErr);
      throw new Error(
        `Falha no Firestore ao atualizar série recorrente: ${fallbackErr?.message || fallbackErr?.code || String(fallbackErr)}`
      );
    }
  }
}

/**
 * Atualiza o plano de parcelamento e suas transações em lote numa ÚNICA chamada atômica updateDoc (Fase 4e):
 * updateDoc(docRef, { installment_plans: updatedPlans, transactions: updatedTransactions })
 */
export async function updateInstallmentSeries(
  userId: string,
  updatedPlans: InstallmentPlan[],
  updatedTransactions: Transaction[]
): Promise<void> {
  const docRef = getUserDocRef(userId);
  const sanitizedPlans = sanitizeForFirestore(updatedPlans);
  const sanitizedTxs = sanitizeForFirestore(updatedTransactions);

  try {
    await updateDoc(docRef, {
      installment_plans: sanitizedPlans,
      transactions: sanitizedTxs,
    });
  } catch (firstErr: any) {
    console.warn('[Firestore] updateDoc falhou em updateInstallmentSeries, tentando setDoc merge...', firstErr);
    try {
      await setDoc(
        docRef,
        {
          installment_plans: sanitizedPlans,
          transactions: sanitizedTxs,
        },
        { merge: true }
      );
    } catch (fallbackErr: any) {
      console.error('[Firestore] setDoc fallback também falhou:', fallbackErr);
      throw new Error(
        `Falha no Firestore ao atualizar parcelamento em série: ${fallbackErr?.message || fallbackErr?.code || String(fallbackErr)}`
      );
    }
  }
}

/**
 * Exclui série recorrente a partir da transação selecionada numa ÚNICA chamada atômica updateDoc (Fase 4e):
 * updateDoc(docRef, { recurrence_rules: updatedRules, transactions: updatedTransactions })
 */
export async function deleteRecurringSeries(
  userId: string,
  updatedRules: RecurrenceRule[],
  updatedTransactions: Transaction[]
): Promise<void> {
  const docRef = getUserDocRef(userId);
  const sanitizedRules = sanitizeForFirestore(updatedRules);
  const sanitizedTxs = sanitizeForFirestore(updatedTransactions);

  try {
    await updateDoc(docRef, {
      recurrence_rules: sanitizedRules,
      transactions: sanitizedTxs,
    });
  } catch (firstErr: any) {
    console.warn('[Firestore] updateDoc falhou em deleteRecurringSeries, tentando setDoc merge...', firstErr);
    try {
      await setDoc(
        docRef,
        {
          recurrence_rules: sanitizedRules,
          transactions: sanitizedTxs,
        },
        { merge: true }
      );
    } catch (fallbackErr: any) {
      console.error('[Firestore] setDoc fallback também falhou:', fallbackErr);
      throw new Error(
        `Falha no Firestore ao excluir série recorrente: ${fallbackErr?.message || fallbackErr?.code || String(fallbackErr)}`
      );
    }
  }
}

/**
 * Exclui parcelas da série a partir da selecionada numa ÚNICA chamada atômica updateDoc (Fase 4e):
 * updateDoc(docRef, { transactions: updatedTransactions })
 */
export async function deleteInstallmentSeries(
  userId: string,
  updatedTransactions: Transaction[]
): Promise<void> {
  const docRef = getUserDocRef(userId);
  const sanitizedTxs = sanitizeForFirestore(updatedTransactions);

  try {
    await updateDoc(docRef, {
      transactions: sanitizedTxs,
    });
  } catch (firstErr: any) {
    console.warn('[Firestore] updateDoc falhou em deleteInstallmentSeries, tentando setDoc merge...', firstErr);
    try {
      await setDoc(
        docRef,
        {
          transactions: sanitizedTxs,
        },
        { merge: true }
      );
    } catch (fallbackErr: any) {
      console.error('[Firestore] setDoc fallback também falhou:', fallbackErr);
      throw new Error(
        `Falha no Firestore ao excluir parcelas em série: ${fallbackErr?.message || fallbackErr?.code || String(fallbackErr)}`
      );
    }
  }
}

/**
 * Exclui uma transação do array `transactions` do documento /users/{userId}.
 */
export async function deleteTransaction(
  userId: string,
  transactionId: number,
  currentTransactions: Transaction[]
): Promise<void> {
  const docRef = getUserDocRef(userId);
  const updatedTransactions = currentTransactions.filter(
    (t) => Number(t.id) !== Number(transactionId)
  );
  const sanitizedTxs = sanitizeForFirestore(updatedTransactions);

  try {
    await updateDoc(docRef, { transactions: sanitizedTxs });
  } catch {
    await setDoc(docRef, { transactions: sanitizedTxs }, { merge: true });
  }
}

/**
 * Cria uma nova Categoria simples e salva em /users/{userId}.
 * Garante que o campo `id` seja um número gerado por generateNumericId().
 */
export async function createCategory(
  userId: string,
  name: string,
  currentCategories: Category[]
): Promise<Category> {
  const docRef = getUserDocRef(userId);
  const newCat: Category = {
    id: generateNumericId(),
    name: name.trim(),
    archived: false,
    icon: null,
  };
  const updatedCategories = [...currentCategories, newCat];
  try {
    await updateDoc(docRef, { categories: arrayUnion(newCat) });
  } catch {
    await setDoc(docRef, { categories: updatedCategories }, { merge: true });
  }
  return newCat;
}

/**
 * Cria uma nova Subcategoria simples vinculada a uma Categoria e salva em /users/{userId}.
 * Garante que os campos `id` e `category_id` sejam números inteiros.
 */
export async function createSubcategory(
  userId: string,
  categoryId: number,
  name: string,
  currentSubcategories: Subcategory[]
): Promise<Subcategory> {
  const docRef = getUserDocRef(userId);
  const newSub: Subcategory = {
    id: generateNumericId(),
    category_id: Number(categoryId),
    name: name.trim(),
    archived: false,
    icon: null,
  };
  const updatedSubcategories = [...currentSubcategories, newSub];
  try {
    await updateDoc(docRef, { subcategories: arrayUnion(newSub) });
  } catch {
    await setDoc(docRef, { subcategories: updatedSubcategories }, { merge: true });
  }
  return newSub;
}
