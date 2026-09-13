import { doc, onSnapshot, getDoc, setDoc, updateDoc, arrayUnion, DocumentReference, Unsubscribe } from 'firebase/firestore';
import { db } from './config';
import { UserFirestoreData, Transaction, Category, Subcategory } from '../types/finance';

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
 */

export function getUserDocRef(userId: string): DocumentReference {
  return doc(db, 'users', userId);
}

/**
 * Normaliza os dados brutos do Firestore garantindo que todos os arrays existam.
 */
export function normalizeUserData(raw: any): UserFirestoreData {
  return {
    accounts: Array.isArray(raw?.accounts) ? raw.accounts : [],
    categories: Array.isArray(raw?.categories) ? raw.categories : [],
    subcategories: Array.isArray(raw?.subcategories) ? raw.subcategories : [],
    transactions: Array.isArray(raw?.transactions) ? raw.transactions : [],
    budget_allocations: Array.isArray(raw?.budget_allocations) ? raw.budget_allocations : [],
    allocation_movements: Array.isArray(raw?.allocation_movements) ? raw.allocation_movements : [],
    goals: Array.isArray(raw?.goals) ? raw.goals : [],
    installment_plans: Array.isArray(raw?.installment_plans) ? raw.installment_plans : [],
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
 */
export async function saveTransaction(
  userId: string,
  tx: Omit<Transaction, 'id'> & { id?: string },
  currentTransactions: Transaction[]
): Promise<Transaction> {
  const docRef = getUserDocRef(userId);
  const targetId = tx.id ? String(tx.id) : crypto.randomUUID();

  // Objeto completo com todos os campos especificados rigorosamente
  const savedTx: Transaction = {
    id: targetId,
    account_id: String(tx.account_id),
    to_account_id: tx.type === 'TRANSFERENCIA' && tx.to_account_id ? String(tx.to_account_id) : null,
    category_id: tx.type !== 'TRANSFERENCIA' && tx.category_id ? String(tx.category_id) : null,
    subcategory_id: tx.type !== 'TRANSFERENCIA' && tx.subcategory_id ? String(tx.subcategory_id) : null,
    type: tx.type,
    value: Number(tx.value),
    description: String(tx.description || '').trim(),
    date: String(tx.date),
    ...(tx.installment_plan_id ? { installment_plan_id: String(tx.installment_plan_id) } : {}),
    ...(tx.installment_number ? { installment_number: Number(tx.installment_number) } : {}),
    ...(tx.recurrence_rule_id ? { recurrence_rule_id: String(tx.recurrence_rule_id) } : {}),
  };

  if (tx.id) {
    // Modo Edição: substitui o item específico no array
    const updatedTransactions = currentTransactions.map((t) =>
      String(t.id) === String(targetId) ? savedTx : t
    );
    try {
      await updateDoc(docRef, { transactions: updatedTransactions });
    } catch {
      await setDoc(docRef, { transactions: updatedTransactions }, { merge: true });
    }
  } else {
    // Nova Transação: usa updateDoc com arrayUnion (e fallback seguro com setDoc se o doc ainda não foi criado)
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
  transactionId: string,
  currentTransactions: Transaction[]
): Promise<void> {
  const docRef = getUserDocRef(userId);
  const updatedTransactions = currentTransactions.filter(
    (t) => String(t.id) !== String(transactionId)
  );
  try {
    await updateDoc(docRef, { transactions: updatedTransactions });
  } catch {
    await setDoc(docRef, { transactions: updatedTransactions }, { merge: true });
  }
}

/**
 * Cria uma nova Categoria simples e salva em /users/{userId}.
 */
export async function createCategory(
  userId: string,
  name: string,
  currentCategories: Category[]
): Promise<Category> {
  const docRef = getUserDocRef(userId);
  const newCat: Category = {
    id: crypto.randomUUID(),
    name: name.trim(),
    archived: false,
    icon: null,
  };
  const updatedCategories = [...currentCategories, newCat];
  await setDoc(docRef, { categories: updatedCategories }, { merge: true });
  return newCat;
}

/**
 * Cria uma nova Subcategoria simples vinculada a uma Categoria e salva em /users/{userId}.
 */
export async function createSubcategory(
  userId: string,
  categoryId: string,
  name: string,
  currentSubcategories: Subcategory[]
): Promise<Subcategory> {
  const docRef = getUserDocRef(userId);
  const newSub: Subcategory = {
    id: crypto.randomUUID(),
    category_id: String(categoryId),
    name: name.trim(),
    archived: false,
    icon: null,
  };
  const updatedSubcategories = [...currentSubcategories, newSub];
  await setDoc(docRef, { subcategories: updatedSubcategories }, { merge: true });
  return newSub;
}
