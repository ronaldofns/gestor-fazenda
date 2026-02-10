/**
 * Exportação da Dashboard (PROPOSTA_DASHBOARD_MODERNA - Exportação)
 * Usa header/footer padrão de relatorioHeaderFooter.ts
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  addRelatorioHeader,
  addRelatorioFooters,
  RELATORIO_MARGIN,
  RELATORIO_PAGE_WIDTH,
  RELATORIO_PAGE_HEIGHT,
  RELATORIO_HEADER_DARK,
  RELATORIO_BODY_BG
} from './relatorioHeaderFooter';

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

const BORDER_COLOR: [number, number, number] = [226, 232, 240]; // slate-200

/** Gera PDF com layout profissional: Header, Body e Footer */
export function exportarDashboardPDF(dados: DadosExportacao): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const dataExportacao = new Date().toLocaleString('pt-BR');

  addRelatorioHeader(doc, 'Dashboard', 'Gestor Fazenda — Visão Geral do Rebanho', dataExportacao);

  let y = 42;

  // ==================== BODY ====================
  // --- Resumo do Rebanho (card) - altura 44mm para margem interna adequada ---
  const cardHeight = 44;
  doc.setFillColor(...RELATORIO_BODY_BG);
  doc.roundedRect(RELATORIO_MARGIN, y, RELATORIO_PAGE_WIDTH - RELATORIO_MARGIN * 2, cardHeight, 2, 2, 'FD');
  doc.setDrawColor(...BORDER_COLOR);
  doc.roundedRect(RELATORIO_MARGIN, y, RELATORIO_PAGE_WIDTH - RELATORIO_MARGIN * 2, cardHeight, 2, 2, 'S');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo do Rebanho', RELATORIO_MARGIN + 5, y + 10);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total de animais: ${dados.totalAnimais}`, RELATORIO_MARGIN + 5, y + 18);
  doc.text(`Vivos: ${dados.totalVivos}  |  Mortos: ${dados.totalMortos}`, RELATORIO_MARGIN + 5, y + 24);
  doc.text(`Variação este mês: ${dados.variacaoMes >= 0 ? '+' : ''}${dados.variacaoMes}`, RELATORIO_MARGIN + 5, y + 30);
  doc.text(`GMD médio: ${dados.gmdMedio.toFixed(2)} kg/dia  |  IEP médio: ${Math.round(dados.iepMedio)} dias`, RELATORIO_MARGIN + 5, y + 36);
  doc.text(`Taxa de desmama: ${dados.taxaDesmama.toFixed(1)}%  |  Mortalidade: ${dados.taxaMortalidade.toFixed(1)}%`, RELATORIO_MARGIN + 5, y + 42);

  y += cardHeight + 10;

  // --- Distribuição por Fazenda (tabela) ---
  if (dados.distribuicaoPorFazenda.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Distribuição por Fazenda', RELATORIO_MARGIN, y);
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
      margin: { left: RELATORIO_MARGIN, right: RELATORIO_MARGIN },
      headStyles: {
        fillColor: RELATORIO_HEADER_DARK,
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
    if (y > RELATORIO_PAGE_HEIGHT - 60) {
      doc.addPage();
      y = RELATORIO_MARGIN;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Benchmarking (12 meses)', RELATORIO_MARGIN, y);
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
      margin: { left: RELATORIO_MARGIN, right: RELATORIO_MARGIN },
      headStyles: {
        fillColor: RELATORIO_HEADER_DARK,
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

  addRelatorioFooters(doc, dataExportacao);

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
