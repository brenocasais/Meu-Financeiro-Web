import {
  Account,
  Category,
  Subcategory,
  Transaction,
  BudgetAllocation,
  AllocationMovement,
  Goal,
  InstallmentPlan,
  RecurrenceRule,
  UserFirestoreData,
  CategoryMonthCalculation,
  ReadyToAssignCalculation,
} from '../types/finance';

/**
 * Camada de Lógica Financeira Compartilhada - Meu Financeiro
 * 
 * Fórmulas 100% alinhadas com as regras de negócio do app nativo Android em produção.
 * Utiliza estritamente os campos reais do Firestore (/users/{userId}).
 */

/**
 * Gera um ID numérico inteiro compatível com o tipo Int (32-bit signed) do Kotlin no Android.
 * Evita colisões com os IDs sequenciais baixos (1, 2, 3...) já existentes.
 */
export function generateNumericId(): number {
  return Math.floor(Math.random() * 1_000_000_000) + 1_000_000;
}

/**
 * Gera um ID numérico único garantindo que não colida com nenhum ID existente
 * ou gerado anteriormente no mesmo lote.
 */
export function generateUniqueNumericId(usedIds: Set<number>): number {
  let id = generateNumericId();
  while (usedIds.has(id)) {
    id = generateNumericId();
  }
  usedIds.add(id);
  return id;
}

/**
 * Coleta todos os IDs numéricos em uso nas entidades do usuário.
 */
export function collectAllExistingNumericIds(data?: Partial<UserFirestoreData> | null): Set<number> {
  const set = new Set<number>();
  if (!data) return set;
  (data.accounts || []).forEach((a) => set.add(Number(a.id)));
  (data.categories || []).forEach((c) => set.add(Number(c.id)));
  (data.subcategories || []).forEach((s) => set.add(Number(s.id)));
  (data.transactions || []).forEach((t) => set.add(Number(t.id)));
  (data.installment_plans || []).forEach((p) => set.add(Number(p.id)));
  (data.recurrence_rules || []).forEach((r) => set.add(Number(r.id)));
  (data.goals || []).forEach((g) => set.add(Number(g.id)));
  (data.budget_allocations || []).forEach((b) => set.add(Number(b.id)));
  (data.allocation_movements || []).forEach((m) => set.add(Number(m.id)));
  return set;
}

/**
 * Gera plano de parcelamento e suas N transações idênticas ao Android:
 * - Valores em centavos inteiros (as N-1 primeiras parcelas levam baseCents, a última leva a sobra)
 * - Datas: o dia de TODAS as parcelas é o dia de HOJE (dia de created_at)
 * - Mês 1 é first_installment_month, os seguintes somam 1 mês
 * - Dia limitado ao último dia de cada mês: Math.min(diaDeHoje, últimoDiaDoMês)
 * - IDs numéricos únicos
 */
export function generateInstallmentTransactions(params: {
  planId?: number;
  accountId: number;
  categoryId: number | null;
  subcategoryId: number | null;
  description: string;
  totalValue: number;
  installmentsCount: number;
  firstInstallmentMonth: string; // "YYYY-MM"
  createdAtMs?: number;
  usedIds: Set<number>;
}): { plan: InstallmentPlan; transactions: Transaction[] } {
  const {
    accountId,
    categoryId,
    subcategoryId,
    description,
    totalValue,
    installmentsCount,
    firstInstallmentMonth,
    createdAtMs = Date.now(),
    usedIds,
  } = params;

  const planId = params.planId ?? generateUniqueNumericId(usedIds);

  const plan: InstallmentPlan = {
    id: planId,
    account_id: Number(accountId),
    category_id: categoryId != null ? Number(categoryId) : null,
    subcategory_id: subcategoryId != null ? Number(subcategoryId) : null,
    description: description.trim(),
    total_value: Number(totalValue),
    installments_count: installmentsCount,
    first_installment_month: firstInstallmentMonth,
    created_at: createdAtMs,
  };

  const totalCents = Math.round(totalValue * 100);
  const baseCents = Math.floor(totalCents / installmentsCount);
  const lastCents = totalCents - baseCents * (installmentsCount - 1);

  // O dia de HOJE (dia de created_at)
  const createdDate = new Date(createdAtMs);
  const diaDeHoje = createdDate.getDate();

  const [baseYearStr, baseMonthStr] = firstInstallmentMonth.split('-');
  const baseYear = parseInt(baseYearStr, 10);
  const baseMonth = parseInt(baseMonthStr, 10); // 1-12

  const transactions: Transaction[] = [];

  for (let i = 1; i <= installmentsCount; i++) {
    const valCents = i === installmentsCount ? lastCents : baseCents;
    const monthOffset = i - 1;
    const totalMonthIndex = baseMonth - 1 + monthOffset;
    const instYear = baseYear + Math.floor(totalMonthIndex / 12);
    const instMonth = (totalMonthIndex % 12) + 1; // 1-12

    // Último dia do mês alvo
    const lastDayOfMonth = new Date(instYear, instMonth, 0).getDate();
    const instDay = Math.min(diaDeHoje, lastDayOfMonth);

    const dateStr = `${instYear}-${String(instMonth).padStart(2, '0')}-${String(instDay).padStart(2, '0')}`;
    const txId = generateUniqueNumericId(usedIds);

    const descTrim = description.trim();
    const txDescription = descTrim ? `${descTrim} (${i}/${installmentsCount})` : `(${i}/${installmentsCount})`;

    transactions.push({
      id: txId,
      account_id: Number(accountId),
      to_account_id: null,
      category_id: categoryId != null ? Number(categoryId) : null,
      subcategory_id: subcategoryId != null ? Number(subcategoryId) : null,
      type: 'DESPESA',
      value: valCents / 100,
      description: txDescription,
      date: dateStr,
      installment_plan_id: planId,
      installment_number: i,
      recurrence_rule_id: null,
      is_recurrence_override: false,
    });
  }

  return { plan, transactions };
}

/**
 * Gera regra de recorrência e materializa transações na janela de 39 meses (-2 até +36 meses do atual):
 * - Respeita start_date, end_month, frequency (MENSAL / ANUAL) e frequency_interval
 * - Dia baseado em start_date limitado ao último dia de cada mês
 * - IDs numéricos únicos
 */
export function generateRecurrenceTransactions(params: {
  ruleId?: number;
  accountId: number;
  categoryId: number | null;
  subcategoryId: number | null;
  description: string;
  value: number;
  type: 'DESPESA' | 'RECEITA';
  frequency: 'MENSAL' | 'ANUAL';
  frequency_interval: number;
  startDate: string; // "YYYY-MM-DD"
  endMonth: string | null; // "YYYY-MM" ou null
  nowDate?: Date;
  usedIds: Set<number>;
}): { rule: RecurrenceRule; transactions: Transaction[] } {
  const {
    accountId,
    categoryId,
    subcategoryId,
    description,
    value,
    type,
    frequency,
    frequency_interval,
    startDate,
    endMonth,
    nowDate = new Date(),
    usedIds,
  } = params;

  const ruleId = params.ruleId ?? generateUniqueNumericId(usedIds);

  const rule: RecurrenceRule = {
    id: ruleId,
    account_id: Number(accountId),
    category_id: categoryId != null ? Number(categoryId) : null,
    subcategory_id: subcategoryId != null ? Number(subcategoryId) : null,
    description: description.trim(),
    value: Number(value),
    type,
    frequency,
    frequency_interval: Number(frequency_interval),
    start_date: startDate,
    end_month: endMonth || null,
    active: true,
  };

  const currentYear = nowDate.getFullYear();
  const currentMonth = nowDate.getMonth(); // 0 a 11

  const [startYearStr, startMonthStr, startDayStr] = startDate.split('-');
  const startYear = parseInt(startYearStr, 10);
  const startMonth = parseInt(startMonthStr, 10); // 1 a 12
  const startDay = parseInt(startDayStr, 10);
  const startMonthKey = `${startYearStr}-${startMonthStr}`;

  const transactions: Transaction[] = [];

  // Janela: mês atual - 2 até mês atual + 36 (39 meses no total)
  for (let offset = -2; offset <= 36; offset++) {
    const targetTotalMonth = currentMonth + offset;
    const targetYear = currentYear + Math.floor(targetTotalMonth / 12);
    const targetMonth = (((targetTotalMonth % 12) + 12) % 12) + 1; // 1 a 12
    const targetMonthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

    // - pule se mês < mês de start_date
    if (targetMonthKey < startMonthKey) {
      continue;
    }

    // - pule se end_month existe e mês > end_month
    if (rule.end_month && targetMonthKey > rule.end_month) {
      continue;
    }

    // - diff = (anoDoMês - anoInício) * 12 + (mêsDoMês - mêsInício)
    const diff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
    if (diff < 0) {
      continue;
    }

    // - MENSAL: só gera se diff % frequency_interval === 0
    // - ANUAL:  só gera se diff % (frequency_interval * 12) === 0
    if (rule.frequency === 'MENSAL') {
      if (diff % rule.frequency_interval !== 0) {
        continue;
      }
    } else if (rule.frequency === 'ANUAL') {
      if (diff % (rule.frequency_interval * 12) !== 0) {
        continue;
      }
    }

    // - dia = dia de start_date, limitado ao último dia daquele mês
    const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();
    const day = Math.min(startDay, lastDayOfMonth);
    const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const txId = generateUniqueNumericId(usedIds);
    transactions.push({
      id: txId,
      account_id: Number(rule.account_id),
      to_account_id: null,
      category_id: rule.category_id != null ? Number(rule.category_id) : null,
      subcategory_id: rule.subcategory_id != null ? Number(rule.subcategory_id) : null,
      type: rule.type,
      value: Number(rule.value),
      description: rule.description,
      date: dateStr,
      installment_plan_id: null,
      installment_number: null,
      recurrence_rule_id: rule.id,
      is_recurrence_override: false,
    });
  }

  return { rule, transactions };
}

/**
 * Remove o sufixo de parcela (ex: " (1/4)" ou " (3/10)") do fim da descrição para manter o texto-base.
 */
export function removeInstallmentSuffix(desc: string): string {
  if (!desc) return '';
  return desc.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
}

/**
 * Lógica para "Esta e as futuras" em transações RECORRENTES (Fase 4e):
 * a) Atualiza a regra mantendo id e start_date;
 * b) fromMonth = mês da data do formulário;
 * c) Remove do array transactions com recurrence_rule_id = regra, mês >= fromMonth e is_recurrence_override !== true;
 * d) Rematerializa na janela (-2 até +36 meses), pulando qualquer mês que já tenha transação dessa regra após o passo c.
 */
export function updateRecurringSeriesLogic(params: {
  ruleId: number;
  existingRule: RecurrenceRule;
  fromMonth: string; // YYYY-MM
  formData: {
    account_id: number;
    category_id: number | null;
    subcategory_id: number | null;
    description: string;
    value: number;
    type: 'DESPESA' | 'RECEITA';
    frequency: 'MENSAL' | 'ANUAL';
    frequency_interval: number;
    end_month: string | null;
  };
  currentTransactions: Transaction[];
  currentRules: RecurrenceRule[];
  usedIds: Set<number>;
  nowDate?: Date;
}): { updatedRules: RecurrenceRule[]; updatedTransactions: Transaction[] } {
  const {
    ruleId,
    existingRule,
    fromMonth,
    formData,
    currentTransactions,
    currentRules,
    usedIds,
    nowDate = new Date(),
  } = params;

  // a) Atualize a regra, mantendo id e start_date
  const updatedRule: RecurrenceRule = {
    ...existingRule,
    id: ruleId,
    start_date: existingRule.start_date,
    account_id: Number(formData.account_id),
    category_id: formData.category_id != null ? Number(formData.category_id) : null,
    subcategory_id: formData.subcategory_id != null ? Number(formData.subcategory_id) : null,
    description: formData.description.trim(),
    value: Number(formData.value),
    type: formData.type,
    frequency: formData.frequency,
    frequency_interval: Number(formData.frequency_interval),
    end_month: formData.end_month || null,
  };

  // c) Remova do array transactions toda transação com recurrence_rule_id = esta regra,
  //    mês (date.slice(0,7)) >= fromMonth e is_recurrence_override !== true.
  const keptTransactions: Transaction[] = [];
  for (const tx of currentTransactions) {
    if (Number(tx.recurrence_rule_id) === ruleId) {
      const txMonth = String(tx.date || '').slice(0, 7);
      if (txMonth >= fromMonth && tx.is_recurrence_override !== true) {
        continue; // descartar
      }
    }
    keptTransactions.push(tx);
  }

  // d) Rematerialize com a MESMA função da criação (janela mês atual -2 até +36,
  //    regras de intervalo/fim, dia de start_date limitado ao fim do mês), mas
  //    PULANDO qualquer mês que já tenha uma transação dessa regra após o passo (c).
  const monthsAlreadyPresent = new Set<string>();
  for (const tx of keptTransactions) {
    if (Number(tx.recurrence_rule_id) === ruleId) {
      monthsAlreadyPresent.add(String(tx.date || '').slice(0, 7));
    }
  }

  const currentYear = nowDate.getFullYear();
  const currentMonth = nowDate.getMonth(); // 0 a 11

  const [startYearStr, startMonthStr, startDayStr] = updatedRule.start_date.split('-');
  const startYear = parseInt(startYearStr, 10);
  const startMonth = parseInt(startMonthStr, 10); // 1 a 12
  const startDay = parseInt(startDayStr, 10);
  const startMonthKey = `${startYearStr}-${startMonthStr}`;

  const newTransactions: Transaction[] = [];

  for (let offset = -2; offset <= 36; offset++) {
    const targetTotalMonth = currentMonth + offset;
    const targetYear = currentYear + Math.floor(targetTotalMonth / 12);
    const targetMonth = (((targetTotalMonth % 12) + 12) % 12) + 1; // 1 a 12
    const targetMonthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

    if (targetMonthKey < startMonthKey) {
      continue;
    }

    if (updatedRule.end_month && targetMonthKey > updatedRule.end_month) {
      continue;
    }

    const diff = (targetYear - startYear) * 12 + (targetMonth - startMonth);
    if (diff < 0) {
      continue;
    }

    if (updatedRule.frequency === 'MENSAL') {
      if (diff % updatedRule.frequency_interval !== 0) {
        continue;
      }
    } else if (updatedRule.frequency === 'ANUAL') {
      if (diff % (updatedRule.frequency_interval * 12) !== 0) {
        continue;
      }
    }

    // Pular se já tem transação desta regra nesse mês
    if (monthsAlreadyPresent.has(targetMonthKey)) {
      continue;
    }

    const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();
    const day = Math.min(startDay, lastDayOfMonth);
    const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const txId = generateUniqueNumericId(usedIds);
    newTransactions.push({
      id: txId,
      account_id: Number(updatedRule.account_id),
      to_account_id: null,
      category_id: updatedRule.category_id != null ? Number(updatedRule.category_id) : null,
      subcategory_id: updatedRule.subcategory_id != null ? Number(updatedRule.subcategory_id) : null,
      type: updatedRule.type,
      value: Number(updatedRule.value),
      description: updatedRule.description,
      date: dateStr,
      installment_plan_id: null,
      installment_number: null,
      recurrence_rule_id: updatedRule.id,
      is_recurrence_override: false,
    });
  }

  const updatedTransactions = [...newTransactions, ...keptTransactions];
  const updatedRules = currentRules.map((r) =>
    Number(r.id) === ruleId ? updatedRule : r
  );

  return { updatedRules, updatedTransactions };
}

/**
 * Lógica para "Esta e as futuras" em transações PARCELADAS (Fase 4e):
 * a) Atualiza o plano com finalCount;
 * b) Apaga parcelas com installment_number > finalCount;
 * c) Para fromNumber <= installment_number <= finalCount, atualiza valor, conta, categorias e descrição mantendo a data;
 * d) Se finalCount != currentCount, nas parcelas < fromNumber troca só o sufixo para (${n}/${finalCount});
 * e) Se finalCount > currentCount, cria parcelas (currentCount+1) até finalCount no dia 10 (YYYY-MM-10).
 */
export function updateInstallmentSeriesLogic(params: {
  planId: number;
  existingPlan: InstallmentPlan;
  fromNumber: number;
  formData: {
    account_id: number;
    category_id: number | null;
    subcategory_id: number | null;
    description: string;
    value: number;
    finalCount: number;
  };
  currentTransactions: Transaction[];
  currentPlans: InstallmentPlan[];
  usedIds: Set<number>;
}): { updatedPlans: InstallmentPlan[]; updatedTransactions: Transaction[] } {
  const {
    planId,
    existingPlan,
    fromNumber,
    formData,
    currentTransactions,
    currentPlans,
    usedIds,
  } = params;

  const currentCount = existingPlan.installments_count;
  const finalCount = Math.max(2, formData.finalCount);
  const baseDesc = removeInstallmentSuffix(formData.description.trim());

  // a) Atualize o plano (mantendo id, first_installment_month, created_at e total_value)
  const updatedPlan: InstallmentPlan = {
    ...existingPlan,
    id: planId,
    first_installment_month: existingPlan.first_installment_month,
    created_at: existingPlan.created_at,
    total_value: existingPlan.total_value,
    category_id: formData.category_id != null ? Number(formData.category_id) : null,
    subcategory_id: formData.subcategory_id != null ? Number(formData.subcategory_id) : null,
    description: baseDesc,
    account_id: Number(formData.account_id),
    installments_count: finalCount,
  };

  const updatedExistingTransactions: Transaction[] = [];

  for (const tx of currentTransactions) {
    if (Number(tx.installment_plan_id) === planId) {
      const n = Number(tx.installment_number);

      // b) Apague as parcelas do plano com installment_number > finalCount
      if (n > finalCount) {
        continue;
      }

      // c) Para as parcelas com fromNumber <= installment_number <= finalCount:
      if (n >= fromNumber && n <= finalCount) {
        const newDesc = baseDesc ? `${baseDesc} (${n}/${finalCount})` : `(${n}/${finalCount})`;
        updatedExistingTransactions.push({
          ...tx,
          value: Number(formData.value),
          category_id: formData.category_id != null ? Number(formData.category_id) : null,
          subcategory_id: formData.subcategory_id != null ? Number(formData.subcategory_id) : null,
          account_id: Number(formData.account_id),
          description: newDesc,
          // A data de cada parcela NÃO muda!
        });
        continue;
      }

      // d) Se finalCount != currentCount, nas parcelas ANTERIORES a fromNumber troque só o sufixo
      if (n < fromNumber) {
        if (finalCount !== currentCount) {
          const prevBase = removeInstallmentSuffix(tx.description || '');
          const newDesc = prevBase ? `${prevBase} (${n}/${finalCount})` : `(${n}/${finalCount})`;
          updatedExistingTransactions.push({
            ...tx,
            description: newDesc,
          });
        } else {
          updatedExistingTransactions.push(tx);
        }
        continue;
      }
    } else {
      updatedExistingTransactions.push(tx);
    }
  }

  // e) Se finalCount > currentCount, crie as parcelas (currentCount+1) até finalCount
  const createdTransactions: Transaction[] = [];
  if (finalCount > currentCount) {
    const [firstYearStr, firstMonthStr] = existingPlan.first_installment_month.split('-');
    const firstYear = parseInt(firstYearStr, 10);
    const firstMonth = parseInt(firstMonthStr, 10);

    for (let n = currentCount + 1; n <= finalCount; n++) {
      const monthOffset = n - 1;
      const totalMonths = (firstMonth - 1) + monthOffset;
      const targetYear = firstYear + Math.floor(totalMonths / 12);
      const targetMonth = ((totalMonths % 12) + 12) % 12 + 1;
      const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-10`; // no DIA 10

      const txId = generateUniqueNumericId(usedIds);
      const newDesc = baseDesc ? `${baseDesc} (${n}/${finalCount})` : `(${n}/${finalCount})`;

      createdTransactions.push({
        id: txId,
        account_id: Number(formData.account_id),
        to_account_id: null,
        category_id: formData.category_id != null ? Number(formData.category_id) : null,
        subcategory_id: formData.subcategory_id != null ? Number(formData.subcategory_id) : null,
        type: 'DESPESA',
        value: Number(formData.value),
        description: newDesc,
        date: dateStr,
        installment_plan_id: planId,
        installment_number: n,
        recurrence_rule_id: null,
        is_recurrence_override: false,
      });
    }
  }

  const finalTransactions = [...createdTransactions, ...updatedExistingTransactions];
  const updatedPlans = currentPlans.map((p) =>
    Number(p.id) === planId ? updatedPlan : p
  );

  return { updatedPlans, updatedTransactions: finalTransactions };
}

/**
 * Exclusão em série de transações RECORRENTES ("Esta e as futuras"):
 * Marque a regra com active = false e remova as transações dessa regra com mês >= mês da transação e is_recurrence_override !== true.
 */
export function deleteRecurringSeriesLogic(params: {
  ruleId: number;
  fromMonth: string; // YYYY-MM
  currentTransactions: Transaction[];
  currentRules: RecurrenceRule[];
}): { updatedRules: RecurrenceRule[]; updatedTransactions: Transaction[] } {
  const { ruleId, fromMonth, currentTransactions, currentRules } = params;

  const updatedRules = currentRules.map((r) =>
    Number(r.id) === ruleId ? { ...r, active: false } : r
  );

  const updatedTransactions = currentTransactions.filter((tx) => {
    if (Number(tx.recurrence_rule_id) === ruleId) {
      const txMonth = String(tx.date || '').slice(0, 7);
      if (txMonth >= fromMonth && tx.is_recurrence_override !== true) {
        return false;
      }
    }
    return true;
  });

  return { updatedRules, updatedTransactions };
}

/**
 * Exclusão em série de transações PARCELADAS ("Esta e as futuras"):
 * Remova as transações do plano com installment_number >= o da transação.
 */
export function deleteInstallmentSeriesLogic(params: {
  planId: number;
  fromNumber: number;
  currentTransactions: Transaction[];
}): { updatedTransactions: Transaction[] } {
  const { planId, fromNumber, currentTransactions } = params;

  const updatedTransactions = currentTransactions.filter((tx) => {
    if (Number(tx.installment_plan_id) === planId) {
      const n = Number(tx.installment_number);
      if (n >= fromNumber) {
        return false;
      }
    }
    return true;
  });

  return { updatedTransactions };
}

/**
 * 1. Saldo de conta:
 * Saldo de conta = initial_balance + créditos (RECEITA, TRANSFERENCIA recebida) - débitos (DESPESA, TRANSFERENCIA enviada)
 */
export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[]
): number {
  const initialBalance = Number(account.initial_balance) || 0;

  const credits = transactions.reduce((acc, tx) => {
    // RECEITA creditada na conta
    if (tx.type === 'RECEITA' && tx.account_id === account.id) {
      return acc + (Number(tx.value) || 0);
    }
    // TRANSFERÊNCIA recebida (to_account_id)
    if (tx.type === 'TRANSFERENCIA' && tx.to_account_id === account.id) {
      return acc + (Number(tx.value) || 0);
    }
    return acc;
  }, 0);

  const debits = transactions.reduce((acc, tx) => {
    // DESPESA debitada da conta
    if (tx.type === 'DESPESA' && tx.account_id === account.id) {
      return acc + (Number(tx.value) || 0);
    }
    // TRANSFERÊNCIA enviada da conta (account_id)
    if (tx.type === 'TRANSFERENCIA' && tx.account_id === account.id) {
      return acc + (Number(tx.value) || 0);
    }
    return acc;
  }, 0);

  return initialBalance + credits - debits;
}

/**
 * Calcula o saldo total somado de todas as contas ativas (não arquivadas).
 */
export function calculateTotalAccountsBalance(
  accounts: Account[],
  transactions: Transaction[]
): number {
  return accounts.reduce((total, acc) => {
    if (acc.archived) return total;
    return total + calculateAccountBalance(acc, transactions);
  }, 0);
}

/**
 * Calcula o Alocado de uma BudgetAllocation específica através da soma de AllocationMovement:
 * Alocado = Σ(dest_budget_allocation_id === id) - Σ(source_budget_allocation_id === id)
 */
export function calculateBudgetAllocationAllocated(
  budgetAllocationId: number,
  allocationMovements: AllocationMovement[]
): number {
  return allocationMovements.reduce((sum, movement) => {
    let delta = 0;
    if (movement.dest_budget_allocation_id === budgetAllocationId) {
      delta += Number(movement.amount) || 0;
    }
    if (movement.source_budget_allocation_id === budgetAllocationId) {
      delta -= Number(movement.amount) || 0;
    }
    return sum + delta;
  }, 0);
}

/**
 * 2. Alocado de uma categoria (ou categoria + subcategoria) para um determinado mês:
 * O mês e a categoria vivem em BudgetAllocation.
 * Somam-se os movimentos onde dest_budget_allocation_id é o ID da BudgetAllocation
 * menos onde source_budget_allocation_id é essa mesma BudgetAllocation.
 */
export function calculateCategoryAllocated(
  categoryId: number,
  month: string, // YYYY-MM
  budgetAllocations: BudgetAllocation[],
  allocationMovements: AllocationMovement[],
  subcategoryId?: number | null
): number {
  // Filtra as alocações da categoria para o mês solicitado
  const matchingAllocations = budgetAllocations.filter((b) => {
    if (b.category_id !== categoryId || b.month !== month) return false;
    if (subcategoryId !== undefined && subcategoryId !== null) {
      return b.subcategory_id === subcategoryId;
    }
    return true;
  });

  return matchingAllocations.reduce((sum, b) => {
    return sum + calculateBudgetAllocationAllocated(b.id, allocationMovements);
  }, 0);
}

/**
 * 3. Gasto de uma categoria/mês:
 * Gasto de uma categoria/mês = soma de Transaction tipo DESPESA daquela categoria/subcategoria, no mês
 */
export function calculateCategorySpent(
  categoryId: number,
  month: string, // YYYY-MM
  transactions: Transaction[],
  subcategoryId?: number | null
): number {
  return transactions.reduce((sum, tx) => {
    if (tx.type !== 'DESPESA') return sum;

    // Normaliza data 'YYYY-MM-DD' para 'YYYY-MM'
    const txMonth = typeof tx.date === 'string' ? tx.date.substring(0, 7) : '';
    if (txMonth !== month) return sum;

    if (subcategoryId !== undefined && subcategoryId !== null) {
      if (tx.subcategory_id === subcategoryId) {
        return sum + (Number(tx.value) || 0);
      }
      return sum;
    }

    if (tx.category_id === categoryId) {
      return sum + (Number(tx.value) || 0);
    }

    return sum;
  }, 0);
}

/**
 * Calcula o Gasto correspondente a uma BudgetAllocation específica:
 * Considera o mês da alocação, a categoria e a subcategoria correspondente.
 */
export function calculateBudgetAllocationSpent(
  allocation: BudgetAllocation,
  transactions: Transaction[]
): number {
  return transactions.reduce((sum, tx) => {
    if (tx.type !== 'DESPESA') return sum;

    const txMonth = typeof tx.date === 'string' ? tx.date.substring(0, 7) : '';
    if (txMonth !== allocation.month) return sum;

    if (allocation.subcategory_id) {
      if (tx.subcategory_id === allocation.subcategory_id) {
        return sum + (Number(tx.value) || 0);
      }
      return sum;
    }

    // Alocação em nível de categoria (sem subcategoria específica)
    if (tx.category_id === allocation.category_id) {
      if (!tx.subcategory_id) {
        return sum + (Number(tx.value) || 0);
      }
    }

    return sum;
  }, 0);
}

/**
 * 4. Disponível:
 * Disponível = Alocado - Gasto
 */
export function calculateCategoryAvailable(
  allocated: number,
  spent: number
): number {
  return allocated - spent;
}

/**
 * 5. current_value de uma meta:
 * current_value de uma meta = soma de AllocationMovement onde dest_goal_id é a meta
 *                            - onde source_goal_id é a meta (nunca reseta)
 */
export function calculateGoalCurrentValue(
  goalId: number,
  allocationMovements: AllocationMovement[]
): number {
  return allocationMovements.reduce((sum, movement) => {
    let delta = 0;
    // Onde a meta é destino (+)
    if (movement.dest_goal_id === goalId) {
      delta += Number(movement.amount) || 0;
    }
    // Onde a meta é origem (-)
    if (movement.source_goal_id === goalId) {
      delta -= Number(movement.amount) || 0;
    }
    return sum + delta;
  }, 0);
}

/**
 * Retorna o mês anterior no formato "YYYY-MM".
 */
export function getPreviousMonthStr(m: string): string {
  const [yearStr, monthStr] = m.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);
  month -= 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Retorna "YYYY-MM" em horário local a partir de um timestamp em milissegundos.
 */
export function monthFromTimestamp(ms: number): string {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Retorna a lista inclusiva de meses no formato "YYYY-MM" entre start e end.
 */
export function getMonthsInRange(start: string, end: string): string[] {
  if (start > end) return [];
  const result: string[] = [];
  let current = start;
  while (current <= end) {
    result.push(current);
    const [yStr, mStr] = current.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    current = `${y}-${String(m).padStart(2, '0')}`;
  }
  return result;
}

/**
 * Calcula o mapa de sobras acumuladas até o mês upToMonth.
 * Chave: `${category_id}:${subcategory_id ?? "null"}`.
 */
export function getCumulativeLeftoversMap(
  allocs: BudgetAllocation[],
  movements: AllocationMovement[],
  txs: Transaction[],
  categories: Category[],
  subcategories: Subcategory[],
  upToMonth: string
): Map<string, number> {
  // months = conjunto com todo allocation.month, todo date.slice(0,7) das transações (se date tiver >= 7 chars) e upToMonth;
  // manter só os <= upToMonth; ordenar crescente.
  const monthsSet = new Set<string>();
  for (const alloc of allocs) {
    if (alloc.month) monthsSet.add(alloc.month);
  }
  for (const tx of txs) {
    if (typeof tx.date === 'string' && tx.date.length >= 7) {
      monthsSet.add(tx.date.slice(0, 7));
    }
  }
  if (upToMonth) {
    monthsSet.add(upToMonth);
  }

  const months = Array.from(monthsSet)
    .filter((m) => m <= upToMonth)
    .sort();

  // Inicialize em 0: (cat,null) para cada categoria e (cat,sub) para cada subcategoria.
  const map = new Map<string, number>();
  for (const cat of categories) {
    map.set(`${cat.id}:null`, 0);
  }
  for (const sub of subcategories) {
    map.set(`${sub.category_id}:${sub.id}`, 0);
  }

  // Para cada mês m, na ordem:
  for (const m of months) {
    const allocsInMonth = allocs.filter((a) => a.month === m);
    const despesas = txs.filter(
      (tx) => tx.type === 'DESPESA' && typeof tx.date === 'string' && tx.date.startsWith(m)
    );

    // subSpent[(cat,sub)] = soma das despesas com subcategory_id != null
    const subSpent = new Map<string, number>();
    for (const tx of despesas) {
      if (tx.subcategory_id != null && tx.category_id != null) {
        const key = `${tx.category_id}:${tx.subcategory_id}`;
        subSpent.set(key, (subSpent.get(key) || 0) + (Number(tx.value) || 0));
      }
    }

    // catSpent[(cat,null)] = soma de TODAS as despesas agrupadas por category_id (com ou sem subcategoria)
    const catSpent = new Map<number, number>();
    for (const tx of despesas) {
      if (tx.category_id != null) {
        const catId = Number(tx.category_id);
        catSpent.set(catId, (catSpent.get(catId) || 0) + (Number(tx.value) || 0));
      }
    }

    // Para cada subcategoria: alloc = alocação de m com esse category_id e subcategory_id;
    // allocated = soma(dest_budget_allocation_id = alloc.id) - soma(source_budget_allocation_id = alloc.id), ou 0 se não houver alloc;
    // map[(cat,sub)] += allocated - subSpent
    for (const sub of subcategories) {
      const key = `${sub.category_id}:${sub.id}`;
      const alloc = allocsInMonth.find(
        (a) => Number(a.category_id) === Number(sub.category_id) && Number(a.subcategory_id) === Number(sub.id)
      );
      const allocated = alloc ? calculateBudgetAllocationAllocated(alloc.id, movements) : 0;
      const spent = subSpent.get(key) || 0;
      map.set(key, (map.get(key) || 0) + (allocated - spent));
    }

    // Para cada categoria SEM nenhuma subcategoria (considere também as arquivadas):
    // alloc com subcategory_id nulo; map[(cat,null)] += allocated - catSpent[(cat,null)]
    for (const cat of categories) {
      const hasAnySubcategory = subcategories.some(
        (s) => Number(s.category_id) === Number(cat.id)
      );
      if (!hasAnySubcategory) {
        const key = `${cat.id}:null`;
        const alloc = allocsInMonth.find(
          (a) => Number(a.category_id) === Number(cat.id) && a.subcategory_id == null
        );
        const allocated = alloc ? calculateBudgetAllocationAllocated(alloc.id, movements) : 0;
        const spent = catSpent.get(Number(cat.id)) || 0;
        map.set(key, (map.get(key) || 0) + (allocated - spent));
      }
    }
  }

  return map;
}

export interface MonthMapsResult {
  allocationInfo: Map<string, { planned: number; allocated: number }>;
  spentInfo: Map<string, number>;
}

/**
 * Constrói os mapas do mês:
 * - allocationInfo: Map<chave, {planned, allocated}> das alocações do mês
 * - spentInfo: Map<chave, number>: despesas do mês por (cat,sub) para as que têm subcategoria,
 *   MAIS por (cat,null) com TODAS as despesas da categoria.
 */
export function buildMonthMaps(
  month: string,
  allocs: BudgetAllocation[],
  movements: AllocationMovement[],
  txs: Transaction[]
): MonthMapsResult {
  const allocationInfo = new Map<string, { planned: number; allocated: number }>();
  const spentInfo = new Map<string, number>();

  for (const alloc of allocs) {
    if (alloc.month === month) {
      const key = `${alloc.category_id}:${alloc.subcategory_id ?? 'null'}`;
      const planned = Number(alloc.planned_value) || 0;
      const allocated = calculateBudgetAllocationAllocated(alloc.id, movements);
      allocationInfo.set(key, { planned, allocated });
    }
  }

  const despesas = txs.filter(
    (tx) => tx.type === 'DESPESA' && typeof tx.date === 'string' && tx.date.startsWith(month)
  );

  for (const tx of despesas) {
    const val = Number(tx.value) || 0;
    if (tx.category_id != null) {
      // (cat,null) com TODAS as despesas da categoria (com ou sem subcategoria)
      const catKey = `${tx.category_id}:null`;
      spentInfo.set(catKey, (spentInfo.get(catKey) || 0) + val);

      // (cat,sub) para as que têm subcategoria
      if (tx.subcategory_id != null) {
        const subKey = `${tx.category_id}:${tx.subcategory_id}`;
        spentInfo.set(subKey, (spentInfo.get(subKey) || 0) + val);
      }
    }
  }

  return { allocationInfo, spentInfo };
}

/**
 * Gera meses a partir de startMonth somando `interval` (mín. 1) meses ou anos.
 * Limite: com "NUNCA", startMonth + 2 anos; com "ATE", até o fim do mês endMonth, inclusive. No máximo 100 itens.
 */
export function getCustomRecurrenceMonths(
  startMonth: string,
  interval: number,
  unit: 'MESES' | 'ANOS',
  endMode: 'NUNCA' | 'ATE',
  endMonth?: string
): string[] {
  const safeInterval = Math.max(1, Math.floor(interval) || 1);
  const monthsToAdd = unit === 'ANOS' ? safeInterval * 12 : safeInterval;

  const [startYStr, startMStr] = startMonth.split('-');
  const startY = parseInt(startYStr, 10);
  const startM = parseInt(startMStr, 10);

  let limitMonth: string;
  if (endMode === 'NUNCA') {
    // startMonth + 2 anos (24 meses depois)
    limitMonth = `${startY + 2}-${String(startM).padStart(2, '0')}`;
  } else {
    limitMonth = endMonth || startMonth;
  }

  const results: string[] = [];
  let currentY = startY;
  let currentM = startM;
  let currentStr = `${currentY}-${String(currentM).padStart(2, '0')}`;

  while (currentStr <= limitMonth && results.length < 100) {
    results.push(currentStr);

    const totalMonths = currentY * 12 + (currentM - 1) + monthsToAdd;
    currentY = Math.floor(totalMonths / 12);
    currentM = (totalMonths % 12) + 1;
    currentStr = `${currentY}-${String(currentM).padStart(2, '0')}`;
  }

  return results;
}

/**
 * 6. Pronto para Atribuir (Fórmula alinhada com o Android - Fase 5-0):
 * Para o mês selecionado M ("YYYY-MM"):
 * a) Saldo das contas: para CADA conta (INCLUINDO as arquivadas, igual ao Android): initial_balance
 *      + soma das transações com date.slice(0,7) <= M que sejam RECEITA da conta ou TRANSFERENCIA cuja to_account_id é a conta
 *      - soma das transações com date.slice(0,7) <= M que sejam DESPESA da conta ou TRANSFERENCIA cuja account_id é a conta.
 *    Some o resultado de todas as contas.
 * b) Disponível acumulado: sem mudança (todas as BudgetAllocation com month <= M; alocado - gasto de cada uma).
 * c) Metas: para cada meta (sem filtrar arquivadas), soma dos movimentos em que dest_goal_id = meta menos os em que source_goal_id = meta,
 *    contando SÓ movimentos cujo mês de moved_at (horário local, "YYYY-MM") seja <= M.
 * d) Pronto = (a) - (b) - (c).
 */
export function calculateReadyToAssign(
  selectedMonth: string, // formato 'YYYY-MM'
  accounts: Account[],
  budgetAllocations: BudgetAllocation[],
  transactions: Transaction[],
  allocationMovements: AllocationMovement[],
  goals: Goal[]
): ReadyToAssignCalculation {
  // a) Saldo de todas as contas (incluindo arquivadas) considerando apenas transações até selectedMonth
  const totalAccountsBalance = accounts.reduce((total, account) => {
    const initialBalance = Number(account.initial_balance) || 0;
    let credits = 0;
    let debits = 0;

    for (const tx of transactions) {
      const txMonth = typeof tx.date === 'string' && tx.date.length >= 7 ? tx.date.slice(0, 7) : '';
      if (!txMonth || txMonth > selectedMonth) continue;

      const val = Number(tx.value) || 0;
      if (tx.type === 'RECEITA' && tx.account_id === account.id) {
        credits += val;
      } else if (tx.type === 'TRANSFERENCIA' && tx.to_account_id === account.id) {
        credits += val;
      }

      if (tx.type === 'DESPESA' && tx.account_id === account.id) {
        debits += val;
      } else if (tx.type === 'TRANSFERENCIA' && tx.account_id === account.id) {
        debits += val;
      }
    }

    return total + (initialBalance + credits - debits);
  }, 0);

  // b) Disponível acumulado: todas as BudgetAllocation com month <= selectedMonth
  const relevantAllocations = budgetAllocations.filter((b) => b.month <= selectedMonth);
  let totalAvailableAccumulated = 0;
  for (const allocation of relevantAllocations) {
    const allocated = calculateBudgetAllocationAllocated(allocation.id, allocationMovements);
    const spent = calculateBudgetAllocationSpent(allocation, transactions);
    const available = calculateCategoryAvailable(allocated, spent);
    totalAvailableAccumulated += available;
  }

  // c) Metas: soma dos movimentos onde dest_goal_id = meta menos onde source_goal_id = meta,
  // contando SÓ movimentos cujo mês de moved_at (horário local, "YYYY-MM") seja <= selectedMonth
  const totalGoalsCurrentValue = goals.reduce((sum, goal) => {
    let goalTotal = 0;
    for (const movement of allocationMovements) {
      const moveMonth = monthFromTimestamp(Number(movement.moved_at) || 0);
      if (moveMonth > selectedMonth) continue;

      const amt = Number(movement.amount) || 0;
      if (movement.dest_goal_id === goal.id) {
        goalTotal += amt;
      }
      if (movement.source_goal_id === goal.id) {
        goalTotal -= amt;
      }
    }
    return sum + goalTotal;
  }, 0);

  // d) Pronto = (a) - (b) - (c)
  const readyToAssign = totalAccountsBalance - totalAvailableAccumulated - totalGoalsCurrentValue;

  return {
    month: selectedMonth,
    totalAccountsBalance,
    totalAvailableAccumulated,
    totalGoalsCurrentValue,
    readyToAssign,
  };
}

/**
 * Retorna os cálculos completos de uma categoria para um mês determinado,
 * incluindo o Planejado (planned_value em BudgetAllocation).
 */
export function getCategoryMonthCalculation(
  categoryId: number,
  month: string,
  budgetAllocations: BudgetAllocation[],
  allocationMovements: AllocationMovement[],
  transactions: Transaction[],
  subcategoryId?: number | null
): CategoryMonthCalculation {
  const matchingAllocations = budgetAllocations.filter((b) => {
    if (b.category_id !== categoryId || b.month !== month) return false;
    if (subcategoryId !== undefined && subcategoryId !== null) {
      return b.subcategory_id === subcategoryId;
    }
    return true;
  });

  const planned = matchingAllocations.reduce((sum, b) => sum + (Number(b.planned_value) || 0), 0);
  const allocated = calculateCategoryAllocated(categoryId, month, budgetAllocations, allocationMovements, subcategoryId);
  const spent = calculateCategorySpent(categoryId, month, transactions, subcategoryId);
  const available = calculateCategoryAvailable(allocated, spent);

  return {
    categoryId,
    subcategoryId,
    month,
    planned,
    allocated,
    spent,
    available,
  };
}

/**
 * Formatador monetário para Real Brasileiro (BRL)
 */
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Retorna classe de cor baseada no status financeiro:
 * - Verde se positivo
 * - Cinza neutro se zero
 * - Vermelho se negativo
 * Regra estrita: NUNCA usar azul/roxo para estado financeiro.
 */
export function getFinancialStatusColorClass(
  value: number,
  mode: 'light' | 'dark' = 'light'
): string {
  if (value > 0.001) {
    return mode === 'dark' ? 'text-[#39D47A]' : 'text-[#22A45D]';
  }
  if (value < -0.001) {
    return mode === 'dark' ? 'text-[#FF4D55]' : 'text-[#EF4444]';
  }
  return mode === 'dark' ? 'text-[#A9B1B1]' : 'text-[#6B7280]';
}

// =========================================================================
// FASE 5b: AÇÕES DO PLANEJAMENTO (moveMoney, Planejar, Alocar, Ajustar)
// =========================================================================

export interface MoveMoneyParams {
  sourceCat?: number | null;
  sourceSub?: number | null;
  destCat?: number | null;
  destSub?: number | null;
  sourceGoalId?: number | null;
  destGoalId?: number | null;
  month: string; // "YYYY-MM"
  destMonth?: string; // default = month
  amount: number;
  note?: string | null;
}

export interface MoveMoneyResult {
  updatedAllocations: BudgetAllocation[];
  updatedMovements: AllocationMovement[];
  movement: AllocationMovement;
}

/**
 * Função central de movimentação de dinheiro (Fase 5b):
 * - Origem ou destino envelope: localiza BudgetAllocation (cat, sub, mês); se não existir, cria com planned_value: 0
 * - Origem/destino null: Pronto para Atribuir
 * - Cria AllocationMovement com moved_at no dia 2 do mês às 12:00
 * - Retorna arrays atualizados preservando os objetos originais ({ ...original })
 */
export function executeMoveMoneyLogic(
  params: MoveMoneyParams,
  currentAllocations: BudgetAllocation[],
  currentMovements: AllocationMovement[],
  usedIds: Set<number>
): MoveMoneyResult {
  const updatedAllocations = [...currentAllocations];
  const targetDestMonth = params.destMonth || params.month;
  let sourceAllocId: number | null = null;
  let destAllocId: number | null = null;

  // 1. Origem: envelope
  if (params.sourceCat != null) {
    const existingSource = updatedAllocations.find(
      (b) =>
        Number(b.category_id) === Number(params.sourceCat) &&
        (params.sourceSub != null
          ? Number(b.subcategory_id) === Number(params.sourceSub)
          : b.subcategory_id == null) &&
        b.month === params.month
    );

    if (existingSource) {
      sourceAllocId = Number(existingSource.id);
    } else {
      const newAlloc: BudgetAllocation = {
        id: generateUniqueNumericId(usedIds),
        category_id: Number(params.sourceCat),
        subcategory_id: params.sourceSub != null ? Number(params.sourceSub) : null,
        month: params.month,
        planned_value: 0,
      };
      updatedAllocations.push(newAlloc);
      sourceAllocId = newAlloc.id;
    }
  }

  // 2. Destino: envelope
  if (params.destCat != null) {
    const existingDest = updatedAllocations.find(
      (b) =>
        Number(b.category_id) === Number(params.destCat) &&
        (params.destSub != null
          ? Number(b.subcategory_id) === Number(params.destSub)
          : b.subcategory_id == null) &&
        b.month === targetDestMonth
    );

    if (existingDest) {
      destAllocId = Number(existingDest.id);
    } else {
      const newAlloc: BudgetAllocation = {
        id: generateUniqueNumericId(usedIds),
        category_id: Number(params.destCat),
        subcategory_id: params.destSub != null ? Number(params.destSub) : null,
        month: targetDestMonth,
        planned_value: 0,
      };
      updatedAllocations.push(newAlloc);
      destAllocId = newAlloc.id;
    }
  }

  // 3. Timestamp do dia 2 do mês às 12:00 local
  const [yStr, mStr] = params.month.split('-');
  const ano = parseInt(yStr, 10);
  const mes = parseInt(mStr, 10);
  const movedAt = new Date(ano, mes - 1, 2, 12, 0, 0).getTime();

  // 4. Criação do movimento
  const movement: AllocationMovement = {
    id: generateUniqueNumericId(usedIds),
    source_budget_allocation_id: sourceAllocId,
    source_goal_id: params.sourceGoalId != null ? Number(params.sourceGoalId) : null,
    dest_budget_allocation_id: destAllocId,
    dest_goal_id: params.destGoalId != null ? Number(params.destGoalId) : null,
    amount: Math.abs(params.amount),
    note: params.note ? String(params.note).trim() : null,
    moved_at: movedAt,
  };

  const updatedMovements = [...currentMovements, movement];

  return {
    updatedAllocations,
    updatedMovements,
    movement,
  };
}

export interface PlanBudgetParams {
  categoryId: number;
  subcategoryId?: number | null;
  month: string;
  newPlannedValue: number;
  repeat?: {
    interval: number;
    unit: 'MESES' | 'ANOS';
    endMode: 'NUNCA' | 'ATE';
    endMonth?: string;
  };
}

/**
 * Lógica pura para Planejar (Fase 5b):
 * Define planned_value da BudgetAllocation do mês (cria se não existir).
 * Se houver repetição, aplica em cada mês gerado por getCustomRecurrenceMonths.
 */
export function planBudgetLogic(
  params: PlanBudgetParams,
  currentAllocations: BudgetAllocation[],
  usedIds: Set<number>
): { updatedAllocations: BudgetAllocation[] } {
  let monthsList = [params.month];
  if (params.repeat) {
    monthsList = getCustomRecurrenceMonths(
      params.month,
      params.repeat.interval,
      params.repeat.unit,
      params.repeat.endMode,
      params.repeat.endMonth
    );
  }

  let updatedAllocations = [...currentAllocations];

  for (const m of monthsList) {
    const existingIndex = updatedAllocations.findIndex(
      (b) =>
        Number(b.category_id) === Number(params.categoryId) &&
        (params.subcategoryId != null
          ? Number(b.subcategory_id) === Number(params.subcategoryId)
          : b.subcategory_id == null) &&
        b.month === m
    );

    if (existingIndex >= 0) {
      const orig = updatedAllocations[existingIndex];
      updatedAllocations[existingIndex] = {
        ...orig,
        planned_value: Math.max(0, params.newPlannedValue),
      };
    } else {
      const newAlloc: BudgetAllocation = {
        id: generateUniqueNumericId(usedIds),
        category_id: Number(params.categoryId),
        subcategory_id: params.subcategoryId != null ? Number(params.subcategoryId) : null,
        month: m,
        planned_value: Math.max(0, params.newPlannedValue),
      };
      updatedAllocations.push(newAlloc);
    }
  }

  return { updatedAllocations };
}

export interface AllocateBudgetParams {
  categoryId: number;
  subcategoryId?: number | null;
  month: string;
  newAllocatedTotal: number;
  currentAllocatedInMonth: number;
  repeat?: {
    interval: number;
    unit: 'MESES' | 'ANOS';
    endMode: 'NUNCA' | 'ATE';
    endMonth?: string;
  };
}

/**
 * Lógica pura para Alocar Dinheiro em Envelopes (Fase 5b):
 * diff = novo - alocado do mês (sem sobra anterior).
 * Se diff > 0, Pronto -> envelope.
 * Se diff < 0, envelope -> Pronto.
 * Se houver repetição, calcula diff em cada mês subsequente e gera movimentos correspondentes.
 */
export function allocateBudgetLogic(
  params: AllocateBudgetParams,
  currentAllocations: BudgetAllocation[],
  currentMovements: AllocationMovement[],
  usedIds: Set<number>
): {
  updatedAllocations: BudgetAllocation[];
  updatedMovements: AllocationMovement[];
} {
  let updatedAllocations = [...currentAllocations];
  let updatedMovements = [...currentMovements];

  // Envelope (categoria / subcategoria)
  if (params.categoryId != null) {
    let monthsList = [params.month];
    if (params.repeat) {
      monthsList = getCustomRecurrenceMonths(
        params.month,
        params.repeat.interval,
        params.repeat.unit,
        params.repeat.endMode,
        params.repeat.endMonth
      );
    }

    const isRecurring = monthsList.length > 1;

    for (const m of monthsList) {
      // Localiza alocação existente no mês m
      const existingAlloc = updatedAllocations.find(
        (b) =>
          Number(b.category_id) === Number(params.categoryId) &&
          (params.subcategoryId != null
            ? Number(b.subcategory_id) === Number(params.subcategoryId)
            : b.subcategory_id == null) &&
          b.month === m
      );

      const alocadoInM = existingAlloc
        ? calculateBudgetAllocationAllocated(existingAlloc.id, updatedMovements)
        : 0;

      const diff = params.newAllocatedTotal - alocadoInM;
      if (Math.abs(diff) < 0.0001) continue;

      const note = isRecurring ? 'Alocação recorrente' : 'Alocação manual direta';

      const res = executeMoveMoneyLogic(
        {
          sourceCat: diff < 0 ? Number(params.categoryId) : null,
          sourceSub: diff < 0 ? (params.subcategoryId != null ? Number(params.subcategoryId) : null) : null,
          destCat: diff > 0 ? Number(params.categoryId) : null,
          destSub: diff > 0 ? (params.subcategoryId != null ? Number(params.subcategoryId) : null) : null,
          sourceGoalId: null,
          destGoalId: null,
          month: m,
          amount: Math.abs(diff),
          note,
        },
        updatedAllocations,
        updatedMovements,
        usedIds
      );

      updatedAllocations = res.updatedAllocations;
      updatedMovements = res.updatedMovements;
    }
  }

  return {
    updatedAllocations,
    updatedMovements,
  };
}

export { parseBRLInput } from './parseBRLInput';
