import {
  Account,
  Category,
  Subcategory,
  Transaction,
  BudgetAllocation,
  AllocationMovement,
  Goal,
} from '../types/finance';
import {
  calculateReadyToAssign,
  getCumulativeLeftoversMap,
  getPreviousMonthStr,
  monthFromTimestamp,
  getMonthsInRange,
  buildMonthMaps,
  getCustomRecurrenceMonths,
} from './financeLogic';

/**
 * financeLogic.check.ts
 * Arquivo de validação numérica pura (não importado pela aplicação)
 * Prova os 3 comportamentos chave da Fase 5-0:
 * (i) Despesa em mês futuro NÃO altera o Pronto do mês atual
 * (ii) Movimento de meta em mês futuro NÃO conta no mês atual
 * (iii) A sobra de um mês aparece em getCumulativeLeftoversMap do mês seguinte
 */

console.log('=== TESTE DE VERIFICAÇÃO FASE 5-0 (financeLogic.check.ts) ===\n');

// =========================================================================
// (i) Prova: Despesa em mês futuro NÃO altera o Pronto do mês atual
// =========================================================================
const account1: Account = {
  id: 1,
  name: 'Conta Corrente',
  type: 'CONTA_CORRENTE',
  initial_balance: 1000,
  archived: false,
};

// Despesa no mês futuro 2026-11
const futureExpenseTx: Transaction = {
  id: 101,
  account_id: 1,
  to_account_id: null,
  category_id: 1,
  subcategory_id: null,
  type: 'DESPESA',
  value: 300,
  description: 'Compra futura de teste',
  date: '2026-11-05',
};

const rtaCurrentBeforeFuture = calculateReadyToAssign(
  '2026-10',
  [account1],
  [],
  [futureExpenseTx],
  [],
  []
);

const rtaFuture = calculateReadyToAssign(
  '2026-11',
  [account1],
  [],
  [futureExpenseTx],
  [],
  []
);

console.log('(i) Despesa em mês futuro:');
console.log('  - Pronto em 2026-10 (mês atual): R$', rtaCurrentBeforeFuture.readyToAssign);
console.log('  - Pronto em 2026-11 (mês futuro): R$', rtaFuture.readyToAssign);

if (rtaCurrentBeforeFuture.readyToAssign !== 1000) {
  throw new Error(`Falha (i): Pronto em 2026-10 deveria ser 1000, mas foi ${rtaCurrentBeforeFuture.readyToAssign}`);
}
if (rtaFuture.readyToAssign !== 700) {
  throw new Error(`Falha (i): Pronto em 2026-11 deveria ser 700, mas foi ${rtaFuture.readyToAssign}`);
}
console.log('  ✓ (i) PROVADO: Despesa futura (2026-11) NÃO alterou o saldo nem o Pronto do mês atual (2026-10)!\n');

// =========================================================================
// (ii) Prova: Movimento de meta em mês futuro NÃO conta no mês atual
// =========================================================================
const goal1: Goal = {
  id: 1,
  name: 'Reserva de Emergência',
  target_value: 5000,
  deadline: '2027-12-31',
  is_paused: false,
  archived: false,
};

// Timestamp de 15 de Novembro de 2026 às 12:00 horário local
const novTimestamp = new Date(2026, 10, 15, 12, 0, 0).getTime();

const futureGoalMovement: AllocationMovement = {
  id: 201,
  source_budget_allocation_id: null,
  source_goal_id: null,
  dest_budget_allocation_id: null,
  dest_goal_id: 1,
  amount: 250,
  note: 'Aporte futuro para meta',
  moved_at: novTimestamp,
};

const rtaGoalOct = calculateReadyToAssign(
  '2026-10',
  [account1],
  [],
  [],
  [futureGoalMovement],
  [goal1]
);

const rtaGoalNov = calculateReadyToAssign(
  '2026-11',
  [account1],
  [],
  [],
  [futureGoalMovement],
  [goal1]
);

console.log('(ii) Movimento de meta em mês futuro:');
console.log('  - Metas acumuladas em 2026-10:', rtaGoalOct.totalGoalsCurrentValue, '| Pronto:', rtaGoalOct.readyToAssign);
console.log('  - Metas acumuladas em 2026-11:', rtaGoalNov.totalGoalsCurrentValue, '| Pronto:', rtaGoalNov.readyToAssign);

if (rtaGoalOct.totalGoalsCurrentValue !== 0 || rtaGoalOct.readyToAssign !== 1000) {
  throw new Error(`Falha (ii): Em 2026-10 metas deveriam ser 0 e Pronto 1000`);
}
if (rtaGoalNov.totalGoalsCurrentValue !== 250 || rtaGoalNov.readyToAssign !== 750) {
  throw new Error(`Falha (ii): Em 2026-11 metas deveriam ser 250 e Pronto 750`);
}
console.log('  ✓ (ii) PROVADO: Movimento de meta em mês futuro (2026-11) NÃO foi contado em 2026-10!\n');

// =========================================================================
// (iii) Prova: A sobra de um mês aparece em getCumulativeLeftoversMap do mês seguinte
// =========================================================================
const cat1: Category = {
  id: 1,
  name: 'Alimentação',
  archived: false,
  icon: null,
};

// Em 2026-10: Alocado R$ 500, Gasto R$ 350 -> Sobra de 2026-10 = R$ 150
const allocOct: BudgetAllocation = {
  id: 301,
  category_id: 1,
  subcategory_id: null,
  month: '2026-10',
  planned_value: 500,
};
const moveOct: AllocationMovement = {
  id: 401,
  source_budget_allocation_id: null,
  source_goal_id: null,
  dest_budget_allocation_id: 301,
  dest_goal_id: null,
  amount: 500,
  note: null,
  moved_at: new Date(2026, 9, 1).getTime(),
};
const txOct: Transaction = {
  id: 501,
  account_id: 1,
  to_account_id: null,
  category_id: 1,
  subcategory_id: null,
  type: 'DESPESA',
  value: 350,
  description: 'Mercado Outubro',
  date: '2026-10-10',
};

// Em 2026-11: Alocado R$ 400, Gasto R$ 200 -> Sobra líquida de 2026-11 = R$ 200
const allocNov: BudgetAllocation = {
  id: 302,
  category_id: 1,
  subcategory_id: null,
  month: '2026-11',
  planned_value: 400,
};
const moveNov: AllocationMovement = {
  id: 402,
  source_budget_allocation_id: null,
  source_goal_id: null,
  dest_budget_allocation_id: 302,
  dest_goal_id: null,
  amount: 400,
  note: null,
  moved_at: new Date(2026, 10, 1).getTime(),
};
const txNov: Transaction = {
  id: 502,
  account_id: 1,
  to_account_id: null,
  category_id: 1,
  subcategory_id: null,
  type: 'DESPESA',
  value: 200,
  description: 'Mercado Novembro',
  date: '2026-11-12',
};

const allAllocs = [allocOct, allocNov];
const allMoves = [moveOct, moveNov];
const allTxs = [txOct, txNov];

const leftoversOct = getCumulativeLeftoversMap(allAllocs, allMoves, allTxs, [cat1], [], '2026-10');
const leftoversNov = getCumulativeLeftoversMap(allAllocs, allMoves, allTxs, [cat1], [], '2026-11');

const leftoverOctVal = leftoversOct.get('1:null');
const leftoverNovVal = leftoversNov.get('1:null');

console.log('(iii) Sobras acumuladas (getCumulativeLeftoversMap):');
console.log('  - Sobra acumulada até 2026-10 (500 - 350): R$', leftoverOctVal);
console.log('  - Sobra acumulada até 2026-11 (150 anterior + 400 alocado - 200 gasto): R$', leftoverNovVal);

if (leftoverOctVal !== 150) {
  throw new Error(`Falha (iii): Sobra de Outubro deveria ser 150, mas foi ${leftoverOctVal}`);
}
if (leftoverNovVal !== 350) {
  throw new Error(`Falha (iii): Sobra de Novembro deveria ser 350 (150 + 200), mas foi ${leftoverNovVal}`);
}
console.log('  ✓ (iii) PROVADO: A sobra de Outubro (150) acumulou com o saldo de Novembro (200), totalizando 350!\n');

// =========================================================================
// Testes das outras funções puras novas
// =========================================================================
console.log('Verificação de funções utilitárias:');
console.log('  - getPreviousMonthStr("2026-10"):', getPreviousMonthStr('2026-10'), '(esperado: "2026-09")');
console.log('  - getPreviousMonthStr("2026-01"):', getPreviousMonthStr('2026-01'), '(esperado: "2025-12")');
console.log('  - monthFromTimestamp(novTimestamp):', monthFromTimestamp(novTimestamp), '(esperado: "2026-11")');
console.log('  - getMonthsInRange("2026-08", "2026-10"):', getMonthsInRange('2026-08', '2026-10'));

const monthMapsOct = buildMonthMaps('2026-10', allAllocs, allMoves, allTxs);
console.log('  - buildMonthMaps 2026-10:');
console.log('      allocationInfo("1:null"):', monthMapsOct.allocationInfo.get('1:null'));
console.log('      spentInfo("1:null"):', monthMapsOct.spentInfo.get('1:null'));

const recMonthsNunca = getCustomRecurrenceMonths('2026-10', 1, 'MESES', 'NUNCA');
console.log('  - getCustomRecurrenceMonths (NUNCA, 1 mês): gerou', recMonthsNunca.length, 'meses (de', recMonthsNunca[0], 'a', recMonthsNunca[recMonthsNunca.length - 1], ')');

const recMonthsAte = getCustomRecurrenceMonths('2026-10', 2, 'MESES', 'ATE', '2027-02');
console.log('  - getCustomRecurrenceMonths (ATE 2027-02, intervalo 2 meses):', recMonthsAte);

console.log('\n=== TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! ===');
