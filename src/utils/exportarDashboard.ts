/**
 * Exportação da Dashboard (PROPOSTA_DASHBOARD_MODERNA - Exportação)
 */

import { jsPDF } from 'jspdf';
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

/** Gera PDF com resumo da dashboard */
export function exportarDashboardPDF(dados: DadosExportacao): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.getPageWidth();
  let y = 20;

  doc.setFontSize(18);
  doc.text('Dashboard - Gestor Fazenda', pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setFontSize(10);
  doc.text(`Exportado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.setFontSize(12);
  doc.text('Resumo do Rebanho', 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.text(`Total de animais: ${dados.totalAnimais}`, 14, y); y += 6;
  doc.text(`Vivos: ${dados.totalVivos} | Mortos: ${dados.totalMortos}`, 14, y); y += 6;
  doc.text(`Variação este mês: ${dados.variacaoMes >= 0 ? '+' : ''}${dados.variacaoMes}`, 14, y); y += 6;
  doc.text(`GMD médio: ${dados.gmdMedio.toFixed(2)} kg/dia | IEP médio: ${Math.round(dados.iepMedio)} dias`, 14, y); y += 6;
  doc.text(`Taxa de desmama: ${dados.taxaDesmama.toFixed(1)}% | Mortalidade: ${dados.taxaMortalidade.toFixed(1)}%`, 14, y);
  y += 12;

  if (dados.distribuicaoPorFazenda.length > 0) {
    doc.setFontSize(12);
    doc.text('Distribuição por Fazenda', 14, y);
    y += 8;
    doc.setFontSize(9);
    dados.distribuicaoPorFazenda.slice(0, 10).forEach((f) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${f.nome}: ${f.total} (${f.percentual.toFixed(1)}%)`, 14, y);
      y += 5;
    });
    y += 5;
  }

  if (dados.benchmarkingFazendas.length > 0 && y < 250) {
    doc.setFontSize(12);
    doc.text('Benchmarking (12 meses)', 14, y);
    y += 8;
    doc.setFontSize(9);
    dados.benchmarkingFazendas.slice(0, 8).forEach((f) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`${f.nome}: ${f.total} anim. | Nasc. ${f.nascimentos12m} | GMD ${f.gmdMedio > 0 ? f.gmdMedio.toFixed(2) : '-'}`, 14, y);
      y += 5;
    });
  }

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
