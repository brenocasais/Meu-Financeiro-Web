import { doc, onSnapshot, getDoc, setDoc, updateDoc, arrayUnion, DocumentReference, Unsubscribe } from 'firebase/firestore';
import { db } from './config';
import { UserFirestoreData, Transaction, Category, Subcategory } from '../types/finance';
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
 */

export function getUserDocRef(userId: string): DocumentReference {
  return doc(db, 'users', userId);
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
    ? raw.transactions.map((t: any) => ({
        ...t,
        id: typeof t.id === 'number' ? t.id : Number(t.id) || t.id,
        account_id: typeof t.account_id === 'number' ? t.account_id : Number(t.account_id) || t.account_id,
        to_account_id: t.to_account_id != null ? (typeof t.to_account_id === 'number' ? t.to_account_id : Number(t.to_account_id) || null) : null,
        category_id: t.category_id != null ? (typeof t.category_id === 'number' ? t.category_id : Number(t.category_id) || null) : null,
        subcategory_id: t.subcategory_id != null ? (typeof t.subcategory_id === 'number' ? t.subcategory_id : Number(t.subcategory_id) || null) : null,
        installment_plan_id: t.installment_plan_id != null ? (typeof t.installment_plan_id === 'number' ? t.installment_plan_id : Number(t.installment_plan_id) || null) : null,
        recurrence_rule_id: t.recurrence_rule_id != null ? (typeof t.recurrence_rule_id === 'number' ? t.recurrence_rule_id : Number(t.recurrence_rule_id) || null) : null,
      }))
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

  // Objeto completo com todos os IDs estritamente tipados como NUMBER
  const savedTx: Transaction = {
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
  };

  if (tx.id) {
    // Modo Edição: substitui o item específico no array
    const updatedTransactions = currentTransactions.map((t) =>
      Number(t.id) === Number(targetId) ? savedTx : t
    );
    try {
      await updateDoc(docRef, { transactions: updatedTransactions });
    } catch {
      await setDoc(docRef, { transactions: updatedTransactions }, { merge: true });
    }
  } else {
    // Nova Transação: usa updateDoc com arrayUnion (ou fallback com setDoc)
    try {
      await updateDoc(docRef, { transactions: arrayUnion(savedTx) });
    } catch {
      const updatedTransactions = [savedTx, ...currentTransactions];
      await setDoc(docRef, { transactions: updatedTransactions }, { merge: true });
    }
  }

  return savedTx;
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
  try {
    await updateDoc(docRef, { transactions: updatedTransactions });
  } catch {
    await setDoc(docRef, { transactions: updatedTransactions }, { merge: true });
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
