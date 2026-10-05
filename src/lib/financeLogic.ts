import {
  Account,
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
 * 6. Pronto para Atribuir:
 * Pronto para Atribuir = saldo total das contas 
 *                      - soma do Disponível de TODAS as alocações com month <= selectedMonth
 *                      - soma do current_value de todas as metas
 */
export function calculateReadyToAssign(
  selectedMonth: string, // formato 'YYYY-MM'
  accounts: Account[],
  budgetAllocations: BudgetAllocation[],
  transactions: Transaction[],
  allocationMovements: AllocationMovement[],
  goals: Goal[]
): ReadyToAssignCalculation {
  // 1. Saldo total de todas as contas ativas
  const totalAccountsBalance = calculateTotalAccountsBalance(accounts, transactions);

  // 2. Filtrar BudgetAllocation por month <= selectedMonth
  const relevantAllocations = budgetAllocations.filter((b) => b.month <= selectedMonth);

  // Soma do Disponível (Alocado - Gasto) de todas as alocações elegíveis
  let totalAvailableAccumulated = 0;
  for (const allocation of relevantAllocations) {
    const allocated = calculateBudgetAllocationAllocated(allocation.id, allocationMovements);
    const spent = calculateBudgetAllocationSpent(allocation, transactions);
    const available = calculateCategoryAvailable(allocated, spent);
    totalAvailableAccumulated += available;
  }

  // 3. Soma do current_value de todas as metas ativas
  const totalGoalsCurrentValue = goals.reduce((sum, goal) => {
    return sum + calculateGoalCurrentValue(goal.id, allocationMovements);
  }, 0);

  // 4. Pronto para Atribuir
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
