/**
 * Exportação da Dashboard (PROPOSTA_DASHBOARD_MODERNA - Exportação)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface DadosExportacao {
  totalAnimais: number;
  totalVivos: number;
  totalMortos: number;
  variacaoMes: number;
  gmdMedio: number;
  iepMedio: number;
  taxaDesmama: number;
  taxaMortalidade: number;
  distribuicaoPorFazenda: Array<{
    nome: string;
    total: number;
    vivos: number;
    mortos: number;
    vacas: number;
    bezerros: number;
    novilhas: number;
    outros: number;
    percentual: number;
  }>;
  benchmarkingFazendas: Array<{
    nome: string;
    total: number;
    nascimentos12m: number;
    mortes12m: number;
    gmdMedio: number;
    taxaDesmama: number;
  }>;
}

const MARGIN = 14;
const PAGE_WIDTH = 210; // A4 portrait
const PAGE_HEIGHT = 297;
const FOOTER_HEIGHT = 20;
const HEADER_COLOR: [number, number, number] = [59, 130, 246]; // blue-500
const HEADER_DARK: [number, number, number] = [37, 99, 235]; // blue-600
const BODY_BG: [number, number, number] = [248, 250, 252]; // slate-50
const BORDER_COLOR: [number, number, number] = [226, 232, 240]; // slate-200
const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // slate-400

/** Adiciona footer em todas as páginas do documento (duas linhas para evitar sobreposição) */
function addFooters(doc: jsPDF, dataExportacao: string): void {
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const y = PAGE_HEIGHT - FOOTER_HEIGHT;

    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y - 2, PAGE_WIDTH - MARGIN, y - 2);

    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Gestor Fazenda — Sistema de Gestão de Rebanhos', MARGIN, y + 4, { maxWidth: 85 });
    doc.text(`Página ${i} de ${pageCount}`, PAGE_WIDTH - MARGIN, y + 4, { align: 'right' });
    doc.text(`Relatório gerado em ${dataExportacao}`, PAGE_WIDTH - MARGIN, y + 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
}

/** Gera PDF com layout profissional: Header, Body e Footer */
export function exportarDashboardPDF(dados: DadosExportacao): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const dataExportacao = new Date().toLocaleString('pt-BR');

  // ==================== HEADER ====================
  doc.setFillColor(...HEADER_COLOR);
  doc.rect(0, 0, PAGE_WIDTH, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Dashboard', PAGE_WIDTH / 2, 14, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Gestor Fazenda — Visão Geral do Rebanho', PAGE_WIDTH / 2, 22, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Exportado em ${dataExportacao}`, PAGE_WIDTH / 2, 28, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  let y = 42;

  // ==================== BODY ====================
  // --- Resumo do Rebanho (card) - altura 44mm para margem interna adequada ---
  const cardHeight = 44;
  doc.setFillColor(...BODY_BG);
  doc.roundedRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, cardHeight, 2, 2, 'FD');
  doc.setDrawColor(...BORDER_COLOR);
  doc.roundedRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, cardHeight, 2, 2, 'S');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo do Rebanho', MARGIN + 5, y + 10);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total de animais: ${dados.totalAnimais}`, MARGIN + 5, y + 18);
  doc.text(`Vivos: ${dados.totalVivos}  |  Mortos: ${dados.totalMortos}`, MARGIN + 5, y + 24);
  doc.text(`Variação este mês: ${dados.variacaoMes >= 0 ? '+' : ''}${dados.variacaoMes}`, MARGIN + 5, y + 30);
  doc.text(`GMD médio: ${dados.gmdMedio.toFixed(2)} kg/dia  |  IEP médio: ${Math.round(dados.iepMedio)} dias`, MARGIN + 5, y + 36);
  doc.text(`Taxa de desmama: ${dados.taxaDesmama.toFixed(1)}%  |  Mortalidade: ${dados.taxaMortalidade.toFixed(1)}%`, MARGIN + 5, y + 42);

  y += cardHeight + 10;

  // --- Distribuição por Fazenda (tabela) ---
  if (dados.distribuicaoPorFazenda.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Distribuição por Fazenda', MARGIN, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Fazenda', 'Total', 'Vivos', 'Mortos', 'Vacas', 'Bezerros', 'Novilhas', 'Outros', '%']],
      body: dados.distribuicaoPorFazenda.slice(0, 12).map((f) => [
        f.nome,
        String(f.total),
        String(f.vivos),
        String(f.mortos),
        String(f.vacas),
        String(f.bezerros),
        String(f.novilhas),
        String(f.outros),
        `${f.percentual.toFixed(1)}%`
      ]),
      margin: { left: MARGIN, right: MARGIN },
      headStyles: {
        fillColor: HEADER_DARK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 3
      },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: BORDER_COLOR,
      tableLineWidth: 0.2
    });

    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // --- Benchmarking (tabela) ---
  if (dados.benchmarkingFazendas.length > 0) {
    if (y > PAGE_HEIGHT - 60) {
      doc.addPage();
      y = MARGIN;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Benchmarking (12 meses)', MARGIN, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Fazenda', 'Total', 'Nasc. 12m', 'Mortes 12m', 'GMD', 'Taxa Desm.']],
      body: dados.benchmarkingFazendas.slice(0, 10).map((f) => [
        f.nome,
        String(f.total),
        String(f.nascimentos12m),
        String(f.mortes12m),
        f.gmdMedio > 0 ? f.gmdMedio.toFixed(2) : '-',
        f.taxaDesmama > 0 ? `${f.taxaDesmama.toFixed(1)}%` : '-'
      ]),
      margin: { left: MARGIN, right: MARGIN },
      headStyles: {
        fillColor: HEADER_DARK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 3
      },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: BORDER_COLOR,
      tableLineWidth: 0.2
    });
  }

  // ==================== FOOTER ====================
  addFooters(doc, dataExportacao);

  doc.save(`dashboard-gestor-fazenda-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Gera Excel com dados detalhados */
export function exportarDashboardExcel(dados: DadosExportacao): void {
  const wb = XLSX.utils.book_new();

  const resumo = [
    ['Métrica', 'Valor'],
    ['Total de animais', dados.totalAnimais],
    ['Vivos', dados.totalVivos],
    ['Mortos', dados.totalMortos],
    ['Variação este mês', dados.variacaoMes],
    ['GMD médio (kg/dia)', dados.gmdMedio.toFixed(2)],
    ['IEP médio (dias)', Math.round(dados.iepMedio)],
    ['Taxa de desmama (%)', dados.taxaDesmama.toFixed(1)],
    ['Taxa de mortalidade (%)', dados.taxaMortalidade.toFixed(1)],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  if (dados.distribuicaoPorFazenda.length > 0) {
    const rows = [
      ['Fazenda', 'Total', 'Vivos', 'Mortos', 'Vacas', 'Bezerros', 'Novilhas', 'Outros', '%'],
      ...dados.distribuicaoPorFazenda.map((f) => [
        f.nome, f.total, f.vivos, f.mortos, f.vacas, f.bezerros, f.novilhas, f.outros, `${f.percentual.toFixed(1)}%`
      ]),
    ];
    const wsDist = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, wsDist, 'Por Fazenda');
  }

  if (dados.benchmarkingFazendas.length > 0) {
    const rows = [
      ['Fazenda', 'Total', 'Nasc. 12m', 'Mortes 12m', 'GMD (kg/dia)', 'Taxa Desmama (%)'],
      ...dados.benchmarkingFazendas.map((f) => [
        f.nome, f.total, f.nascimentos12m, f.mortes12m,
        f.gmdMedio > 0 ? f.gmdMedio.toFixed(2) : '-',
        f.taxaDesmama > 0 ? f.taxaDesmama.toFixed(1) : '-'
      ]),
    ];
    const wsBench = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, wsBench, 'Benchmarking');
  }

  XLSX.writeFile(wb, `dashboard-gestor-fazenda-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
