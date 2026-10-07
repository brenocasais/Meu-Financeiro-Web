import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Transaction,
  Category,
  Subcategory,
  Account,
  UserFirestoreData,
} from '../types/finance';

export interface ExportFilterParams {
  allPeriod: boolean;
  startMonth?: string; // "YYYY-MM"
  endMonth?: string; // "YYYY-MM"
  categoryId?: number | null;
  subcategoryId?: number | null;
}

export function filterTransactionsForExport(
  transactions: Transaction[],
  params: ExportFilterParams
): Transaction[] {
  let list = [...transactions];

  // Filtro de período
  if (!params.allPeriod && params.startMonth && params.endMonth) {
    let s = params.startMonth;
    let e = params.endMonth;
    if (s > e) {
      const temp = s;
      s = e;
      e = temp;
    }
    list = list.filter((t) => {
      if (!t.date || t.date.length < 7) return false;
      const m = t.date.slice(0, 7);
      return m >= s && m <= e;
    });
  }

  // Filtro de categoria
  if (params.categoryId != null) {
    list = list.filter((t) => Number(t.category_id) === Number(params.categoryId));
  }

  // Filtro de subcategoria
  if (params.subcategoryId != null) {
    list = list.filter((t) => Number(t.subcategory_id) === Number(params.subcategoryId));
  }

  // Ordenar por data decrescente
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return list;
}

export function exportToCSV(
  transactions: Transaction[],
  categories: Category[],
  subcategories: Subcategory[],
  accounts: Account[]
): void {
  const catMap = new Map<number, string>();
  categories.forEach((c) => catMap.set(Number(c.id), c.name));

  const subMap = new Map<number, string>();
  subcategories.forEach((s) => subMap.set(Number(s.id), s.name));

  const accMap = new Map<number, string>();
  accounts.forEach((a) => accMap.set(Number(a.id), a.name));

  const headers = [
    'Data',
    'Descrição',
    'Tipo',
    'Categoria',
    'Subcategoria',
    'Conta',
    'Conta Destino',
    'Valor',
  ];

  const rows = transactions.map((t) => {
    const dataStr = t.date || '';
    const desc = (t.description || '').replace(/"/g, '""');
    let tipo = t.type === 'RECEITA' ? 'Receita' : 'Despesa';
    if (t.type === 'TRANSFERENCIA') tipo = 'Transferência';

    const catName = (t.category_id != null ? catMap.get(Number(t.category_id)) : '') || '';
    const subName = (t.subcategory_id != null ? subMap.get(Number(t.subcategory_id)) : '') || '';
    const accName = (t.account_id != null ? accMap.get(Number(t.account_id)) : '') || '';
    const toAccName = (t.to_account_id != null ? accMap.get(Number(t.to_account_id)) : '') || '';

    const valNum = Number(t.value) || 0;
    const valorFormatted = valNum.toFixed(2).replace('.', ',');

    return [
      `"${dataStr}"`,
      `"${desc}"`,
      `"${tipo}"`,
      `"${catName}"`,
      `"${subName}"`,
      `"${accName}"`,
      `"${toAccName}"`,
      valorFormatted,
    ].join(';');
  });

  // UTF-8 BOM para Excel brasileiro
  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'meu-financeiro-transacoes.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToJSON(data: UserFirestoreData): void {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const filename = `meu-financeiro-backup-${dateStr}.json`;

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToPDF(
  transactions: Transaction[],
  categories: Category[],
  subcategories: Subcategory[],
  accounts: Account[],
  periodLabel: string,
  filterLabel: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const catMap = new Map<number, string>();
  categories.forEach((c) => catMap.set(Number(c.id), c.name));

  const subMap = new Map<number, string>();
  subcategories.forEach((s) => subMap.set(Number(s.id), s.name));

  const accMap = new Map<number, string>();
  accounts.forEach((a) => accMap.set(Number(a.id), a.name));

  // Cabeçalho
  doc.setFontSize(18);
  doc.setTextColor(34, 164, 93); // #22A45D
  doc.text('Meu Financeiro — Extrato', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Período: ${periodLabel} | Filtros: ${filterLabel}`, 14, 25);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

  let totalReceitas = 0;
  let totalDespesas = 0;

  const tableRows = transactions.map((t) => {
    const val = Number(t.value) || 0;
    let tipo = t.type === 'RECEITA' ? 'Receita' : 'Despesa';
    if (t.type === 'TRANSFERENCIA') {
      tipo = 'Transferência';
    } else if (t.type === 'RECEITA') {
      totalReceitas += val;
    } else {
      totalDespesas += val;
    }

    const catName = (t.category_id != null ? catMap.get(Number(t.category_id)) : '') || '-';
    const accName = (t.account_id != null ? accMap.get(Number(t.account_id)) : '') || '-';
    const valStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return [
      t.date || '',
      t.description || '',
      catName,
      accName,
      tipo,
      valStr,
    ];
  });

  autoTable(doc, {
    startY: 35,
    head: [['Data', 'Descrição', 'Categoria', 'Conta', 'Tipo', 'Valor']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [34, 164, 93],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 30, 30],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 248],
    },
    columnStyles: {
      5: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Totais no final
  const finalY = (doc as any).lastAutoTable?.finalY || 40;
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);

  const saldoLiquido = totalReceitas - totalDespesas;
  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  doc.text(`Total de Receitas: ${formatBRL(totalReceitas)}`, 14, finalY + 10);
  doc.text(`Total de Despesas: ${formatBRL(totalDespesas)}`, 14, finalY + 16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Saldo Líquido: ${formatBRL(saldoLiquido)}`, 14, finalY + 22);

  doc.save('meu-financeiro-extrato.pdf');
}
