/**
 * Exportação do Relatório de Confinamento (PDF e Excel)
 * Usa o mesmo header e footer padrão do Dashboard (relatorioHeaderFooter.ts).
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

const BORDER_COLOR: [number, number, number] = [226, 232, 240];

export interface DadosConfinamentoExportacao {
  resumo: {
    totalConfinamentos: number;
    ativos: number;
    totalAnimais: number;
    gmdMedioGeral: number;
    custoTotalGeral: number;
    mortalidade: number;
    arrobasProducao: number;
    custoPorArroba: number | null;
  };
  porConfinamento: Array<{
    nome: string;
    fazenda: string;
    status: string;
    totalAnimais: number;
    pesoMedioEntrada: number;
    gmdMedio: number;
    custoTotal: number;
    arrobas: number;
    custoPorArroba: number | null;
    mortes: number;
    diasMedio: number;
  }>;
}

/** Gera PDF do relatório de confinamento com header/footer padrão */
export function exportarConfinamentoPDF(dados: DadosConfinamentoExportacao): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const dataExportacao = new Date().toLocaleString('pt-BR');

  addRelatorioHeader(
    doc,
    'Relatório de Confinamento',
    'Gestor Fazenda — GMD, custo e indicadores por confinamento',
    dataExportacao
  );

  let y = 42;
  const r = dados.resumo;

  // --- Resumo (card) ---
  const cardHeight = 40;
  doc.setFillColor(...RELATORIO_BODY_BG);
  doc.roundedRect(RELATORIO_MARGIN, y, RELATORIO_PAGE_WIDTH - RELATORIO_MARGIN * 2, cardHeight, 2, 2, 'FD');
  doc.setDrawColor(...BORDER_COLOR);
  doc.roundedRect(RELATORIO_MARGIN, y, RELATORIO_PAGE_WIDTH - RELATORIO_MARGIN * 2, cardHeight, 2, 2, 'S');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo Geral', RELATORIO_MARGIN + 5, y + 10);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Confinamentos: ${r.totalConfinamentos} (${r.ativos} ativos)  |  Animais: ${r.totalAnimais}`,
    RELATORIO_MARGIN + 5,
    y + 18
  );
  doc.text(
    `GMD médio: ${r.gmdMedioGeral.toFixed(3)} kg/dia  |  Mortalidade: ${r.mortalidade}`,
    RELATORIO_MARGIN + 5,
    y + 25
  );
  doc.text(
    `Custo total alimentação: R$ ${r.custoTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}  |  Produção: ${r.arrobasProducao.toFixed(1)} @`,
    RELATORIO_MARGIN + 5,
    y + 32
  );
  doc.text(
    r.custoPorArroba != null
      ? `Custo por arroba: R$ ${r.custoPorArroba.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : 'Custo por arroba: —',
    RELATORIO_MARGIN + 5,
    y + 38
  );

  y += cardHeight + 10;

  // --- Tabela por confinamento ---
  if (dados.porConfinamento.length > 0) {
    if (y > RELATORIO_PAGE_HEIGHT - 50) {
      doc.addPage();
      y = RELATORIO_MARGIN;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Por confinamento', RELATORIO_MARGIN, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [
        [
          'Confinamento',
          'Fazenda',
          'Status',
          'Animais',
          'Peso méd. ent. (kg)',
          'GMD (kg/dia)',
          'Custo (R$)',
          '@',
          'R$/@',
          'Mortes',
          'Dias méd.'
        ]
      ],
      body: dados.porConfinamento.map((c) => [
        c.nome.length > 20 ? c.nome.slice(0, 18) + '..' : c.nome,
        c.fazenda.length > 12 ? c.fazenda.slice(0, 10) + '..' : c.fazenda,
        c.status,
        String(c.totalAnimais),
        c.pesoMedioEntrada > 0 ? c.pesoMedioEntrada.toFixed(1) : '-',
        c.gmdMedio > 0 ? c.gmdMedio.toFixed(3) : '-',
        c.custoTotal > 0 ? c.custoTotal.toFixed(2) : '-',
        c.arrobas > 0 ? c.arrobas.toFixed(1) : '-',
        c.custoPorArroba != null ? c.custoPorArroba.toFixed(2) : '-',
        String(c.mortes),
        c.diasMedio > 0 ? c.diasMedio.toFixed(0) : '-'
      ]),
      margin: { left: RELATORIO_MARGIN, right: RELATORIO_MARGIN },
      headStyles: {
        fillColor: RELATORIO_HEADER_DARK,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 2
      },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: BORDER_COLOR,
      tableLineWidth: 0.2
    });
  }

  addRelatorioFooters(doc, dataExportacao);
  doc.save(`relatorio-confinamento-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Gera Excel do relatório de confinamento */
export function exportarConfinamentoExcel(dados: DadosConfinamentoExportacao): void {
  const wb = XLSX.utils.book_new();
  const r = dados.resumo;

  const resumo = [
    ['Resumo - Confinamento', ''],
    ['Total de confinamentos', r.totalConfinamentos],
    ['Confinamentos ativos', r.ativos],
    ['Total de animais', r.totalAnimais],
    ['GMD médio geral (kg/dia)', r.gmdMedioGeral.toFixed(3)],
    ['Custo total alimentação (R$)', r.custoTotalGeral.toFixed(2)],
    ['Mortalidade', r.mortalidade],
    ['Produção (arrobas)', r.arrobasProducao.toFixed(1)],
    ['Custo por arroba (R$)', r.custoPorArroba != null ? r.custoPorArroba.toFixed(2) : '-']
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  if (dados.porConfinamento.length > 0) {
    const rows = [
      [
        'Confinamento',
        'Fazenda',
        'Status',
        'Animais',
        'Peso méd. entrada (kg)',
        'GMD (kg/dia)',
        'Custo (R$)',
        'Arrobas',
        'R$/arroba',
        'Mortes',
        'Dias médio'
      ],
      ...dados.porConfinamento.map((c) => [
        c.nome,
        c.fazenda,
        c.status,
        c.totalAnimais,
        c.pesoMedioEntrada > 0 ? c.pesoMedioEntrada.toFixed(1) : '-',
        c.gmdMedio > 0 ? c.gmdMedio.toFixed(3) : '-',
        c.custoTotal > 0 ? c.custoTotal.toFixed(2) : '-',
        c.arrobas > 0 ? c.arrobas.toFixed(1) : '-',
        c.custoPorArroba != null ? c.custoPorArroba.toFixed(2) : '-',
        c.mortes,
        c.diasMedio > 0 ? c.diasMedio.toFixed(0) : '-'
      ])
    ];
    const wsDetalhe = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, wsDetalhe, 'Por confinamento');
  }

  XLSX.writeFile(wb, `relatorio-confinamento-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
