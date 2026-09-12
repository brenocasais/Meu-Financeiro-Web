import { doc, onSnapshot, getDoc, DocumentReference, Unsubscribe } from 'firebase/firestore';
import { db } from './config';
import { UserFirestoreData } from '../types/finance';

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
