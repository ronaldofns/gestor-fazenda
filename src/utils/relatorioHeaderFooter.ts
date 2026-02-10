/**
 * Header e Footer padrão para relatórios PDF (Dashboard, Confinamento, etc.)
 * Mesmo visual: faixa azul no topo, rodapé com marca + paginação + data.
 */

import type { jsPDF } from 'jspdf';

export const RELATORIO_MARGIN = 14;
export const RELATORIO_PAGE_WIDTH = 210; // A4 portrait
export const RELATORIO_PAGE_HEIGHT = 297;
const RELATORIO_FOOTER_HEIGHT = 20;
const HEADER_COLOR: [number, number, number] = [59, 130, 246]; // blue-500
const BORDER_COLOR: [number, number, number] = [226, 232, 240]; // slate-200
const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // slate-400

/**
 * Desenha o header padrão do relatório (faixa azul, título, subtítulo, data de exportação).
 */
export function addRelatorioHeader(
  doc: jsPDF,
  titulo: string,
  subtitulo: string,
  dataExportacao: string
): void {
  doc.setFillColor(...HEADER_COLOR);
  doc.rect(0, 0, RELATORIO_PAGE_WIDTH, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, RELATORIO_PAGE_WIDTH / 2, 14, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitulo, RELATORIO_PAGE_WIDTH / 2, 22, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Exportado em ${dataExportacao}`, RELATORIO_PAGE_WIDTH / 2, 28, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

/**
 * Adiciona o footer padrão em todas as páginas do documento.
 */
export function addRelatorioFooters(doc: jsPDF, dataExportacao: string): void {
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const y = RELATORIO_PAGE_HEIGHT - RELATORIO_FOOTER_HEIGHT;

    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    doc.line(RELATORIO_MARGIN, y - 2, RELATORIO_PAGE_WIDTH - RELATORIO_MARGIN, y - 2);

    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text('Gestor Fazenda — Sistema de Gestão de Rebanhos', RELATORIO_MARGIN, y + 4, { maxWidth: 85 });
    doc.text(`Página ${i} de ${pageCount}`, RELATORIO_PAGE_WIDTH - RELATORIO_MARGIN, y + 4, { align: 'right' });
    doc.text(`Relatório gerado em ${dataExportacao}`, RELATORIO_PAGE_WIDTH - RELATORIO_MARGIN, y + 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
}

export const RELATORIO_HEADER_DARK: [number, number, number] = [37, 99, 235]; // blue-600
export const RELATORIO_BODY_BG: [number, number, number] = [248, 250, 252]; // slate-50
