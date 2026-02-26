/**
 * Header e Footer padrão para relatórios PDF (Dashboard, Confinamento, etc.)
 * Mesmo visual: faixa azul no topo, rodapé com marca + paginação + data.
 */

import type { jsPDF } from "jspdf";

export const RELATORIO_MARGIN = 14;
export const RELATORIO_PAGE_WIDTH = 210; // A4 portrait
export const RELATORIO_PAGE_HEIGHT = 297;
const RELATORIO_FOOTER_HEIGHT = 10;
const HEADER_COLOR: [number, number, number] = [59, 130, 246]; // blue-500
const BORDER_COLOR: [number, number, number] = [226, 232, 240]; // slate-200
const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // slate-400

export type RelatorioPageDims = { pageWidth: number; pageHeight: number };

/**
 * Desenha o header padrão do relatório (faixa azul, título, subtítulo, data de exportação).
 * Para PDF em landscape (ex.: relatório detalhado), passe dims: { pageWidth: 297, pageHeight: 210 }.
 */
export function addRelatorioHeader(
  doc: jsPDF,
  titulo: string,
  subtitulo: string,
  dataExportacao: string,
  dims?: RelatorioPageDims,
): void {
  const w = dims?.pageWidth ?? RELATORIO_PAGE_WIDTH;
  doc.setFillColor(...HEADER_COLOR);
  doc.rect(0, 0, w, 32, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, w / 2, 14, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(subtitulo, w / 2, 22, { align: "center" });
  doc.setFontSize(9);
  doc.text(`Exportado em ${dataExportacao}`, w / 2, 28, { align: "center" });
  doc.setTextColor(0, 0, 0);
}

/**
 * Adiciona o footer padrão em todas as páginas do documento.
 * Para PDF em landscape, passe dims: { pageWidth: 297, pageHeight: 210 }.
 * Opcional: margin (mm) para reduzir margem lateral do rodapé (ex.: 5 para margem mínima).
 */
export function addRelatorioFooters(
  doc: jsPDF,
  dataExportacao: string,
  dims?: RelatorioPageDims,
  margin?: number,
): void {
  const pageCount = doc.getNumberOfPages();
  const w = dims?.pageWidth ?? RELATORIO_PAGE_WIDTH;
  const h = dims?.pageHeight ?? RELATORIO_PAGE_HEIGHT;
  const m = margin ?? RELATORIO_MARGIN;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const y = h - RELATORIO_FOOTER_HEIGHT;

    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    /*doc.line(m, y - 2, w - m, y - 2);*/

    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Gestor Fazenda — Sistema de Gestão de Rebanhos", m, y + 3, {
      maxWidth: 85,
    });
    doc.text(`Página ${i} de ${pageCount}`, w - m, y + 3, { align: "right" });
    doc.text(`Relatório gerado em ${dataExportacao}`, w - m, y + 6, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);
  }
}

export const RELATORIO_HEADER_DARK: [number, number, number] = [37, 99, 235]; // blue-600
export const RELATORIO_BODY_BG: [number, number, number] = [248, 250, 252]; // slate-50
