/**
 * Exportação do Relatório de Confinamento (PDF e Excel)
 * Usa o mesmo header e footer padrão do Dashboard (relatorioHeaderFooter.ts).
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  addRelatorioHeader,
  addRelatorioFooters,
  RELATORIO_MARGIN,
  RELATORIO_PAGE_WIDTH,
  RELATORIO_PAGE_HEIGHT,
  RELATORIO_HEADER_DARK,
  RELATORIO_BODY_BG,
} from "./relatorioHeaderFooter";
import { formatDateBR, parseDateOnlyLocal } from "./date";

const BORDER_COLOR: [number, number, number] = [226, 232, 240];

/** Cores para evolução de peso na tabela detalhada */
const EVOLUCAO_PESO_ENTRADA: [number, number, number] = [230, 242, 255]; // azul claro
/*
const EVOLUCAO_GANHO: [number, number, number] = [220, 252, 231]; // verde claro
const EVOLUCAO_PERDA: [number, number, number] = [254, 226, 226]; // vermelho claro
*/
const EVOLUCAO_NEUTRO: [number, number, number] = [248, 250, 252]; // cinza claro (igual)

/** Cores para o texto da evolução (fonte menor): ganho, perda, igual. */
const EVOLUCAO_TEXTO_GANHO: [number, number, number] = [22, 163, 74];
const EVOLUCAO_TEXTO_PERDA: [number, number, number] = [220, 38, 38];
const EVOLUCAO_TEXTO_IGUAL: [number, number, number] = [100, 116, 139];

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

/** Gera PDF do relatório de confinamento com header/footer padrão e faz download do arquivo. */
export function exportarConfinamentoPDF(
  dados: DadosConfinamentoExportacao,
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dataExportacao = new Date().toLocaleString("pt-BR");

  addRelatorioHeader(
    doc,
    "Relatório de Confinamento",
    "Gestor Fazenda — GMD, custo e indicadores por confinamento",
    dataExportacao,
  );

  let y = 42;
  const r = dados.resumo;

  // --- Resumo (card) ---
  const cardHeight = 40;
  doc.setFillColor(...RELATORIO_BODY_BG);
  doc.roundedRect(
    RELATORIO_MARGIN,
    y,
    RELATORIO_PAGE_WIDTH - RELATORIO_MARGIN * 2,
    cardHeight,
    2,
    2,
    "FD",
  );
  doc.setDrawColor(...BORDER_COLOR);
  doc.roundedRect(
    RELATORIO_MARGIN,
    y,
    RELATORIO_PAGE_WIDTH - RELATORIO_MARGIN * 2,
    cardHeight,
    2,
    2,
    "S",
  );

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo Geral", RELATORIO_MARGIN + 5, y + 10);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Confinamentos: ${r.totalConfinamentos} (${r.ativos} ativos)  |  Animais: ${r.totalAnimais}`,
    RELATORIO_MARGIN + 5,
    y + 18,
  );
  doc.text(
    `GMD médio: ${r.gmdMedioGeral.toFixed(3)} kg/dia  |  Mortalidade: ${r.mortalidade}`,
    RELATORIO_MARGIN + 5,
    y + 25,
  );
  doc.text(
    `Custo total alimentação: R$ ${r.custoTotalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}  |  Produção: ${r.arrobasProducao.toFixed(1)} @`,
    RELATORIO_MARGIN + 5,
    y + 32,
  );
  doc.text(
    r.custoPorArroba != null
      ? `Custo por arroba: R$ ${r.custoPorArroba.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : "Custo por arroba: —",
    RELATORIO_MARGIN + 5,
    y + 38,
  );

  y += cardHeight + 10;

  // --- Tabela por confinamento ---
  if (dados.porConfinamento.length > 0) {
    if (y > RELATORIO_PAGE_HEIGHT - 50) {
      doc.addPage();
      y = RELATORIO_MARGIN;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Por confinamento", RELATORIO_MARGIN, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [
        [
          "Confinamento",
          "Fazenda",
          "Status",
          "Animais",
          "Peso méd. ent. (kg)",
          "GMD (kg/dia)",
          "Custo (R$)",
          "@",
          "R$/@",
          "Mortes",
          "Dias méd.",
        ],
      ],
      body: dados.porConfinamento.map((c) => [
        c.nome.length > 20 ? c.nome.slice(0, 18) + ".." : c.nome,
        c.fazenda.length > 12 ? c.fazenda.slice(0, 10) + ".." : c.fazenda,
        c.status,
        String(c.totalAnimais),
        c.pesoMedioEntrada > 0 ? c.pesoMedioEntrada.toFixed(1) : "-",
        c.gmdMedio > 0 ? c.gmdMedio.toFixed(3) : "-",
        c.custoTotal > 0 ? c.custoTotal.toFixed(2) : "-",
        c.arrobas > 0 ? c.arrobas.toFixed(1) : "-",
        c.custoPorArroba != null ? c.custoPorArroba.toFixed(2) : "-",
        String(c.mortes),
        c.diasMedio > 0 ? c.diasMedio.toFixed(0) : "-",
      ]),
      margin: { left: RELATORIO_MARGIN, right: RELATORIO_MARGIN },
      headStyles: {
        fillColor: RELATORIO_HEADER_DARK,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
        cellPadding: 2,
      },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: BORDER_COLOR,
      tableLineWidth: 0.2,
    });
  }

  addRelatorioFooters(doc, dataExportacao);
  doc.save(
    `relatorio-confinamento-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

/** Gera Excel do relatório de confinamento */
export function exportarConfinamentoExcel(
  dados: DadosConfinamentoExportacao,
): void {
  const wb = XLSX.utils.book_new();
  const r = dados.resumo;

  const resumo = [
    ["Resumo - Confinamento", ""],
    ["Total de confinamentos", r.totalConfinamentos],
    ["Confinamentos ativos", r.ativos],
    ["Total de animais", r.totalAnimais],
    ["GMD médio geral (kg/dia)", r.gmdMedioGeral.toFixed(3)],
    ["Custo total alimentação (R$)", r.custoTotalGeral.toFixed(2)],
    ["Mortalidade", r.mortalidade],
    ["Produção (arrobas)", r.arrobasProducao.toFixed(1)],
    [
      "Custo por arroba (R$)",
      r.custoPorArroba != null ? r.custoPorArroba.toFixed(2) : "-",
    ],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  if (dados.porConfinamento.length > 0) {
    const rows = [
      [
        "Confinamento",
        "Fazenda",
        "Status",
        "Animais",
        "Peso méd. entrada (kg)",
        "GMD (kg/dia)",
        "Custo (R$)",
        "Arrobas",
        "R$/arroba",
        "Mortes",
        "Dias médio",
      ],
      ...dados.porConfinamento.map((c) => [
        c.nome,
        c.fazenda,
        c.status,
        c.totalAnimais,
        c.pesoMedioEntrada > 0 ? c.pesoMedioEntrada.toFixed(1) : "-",
        c.gmdMedio > 0 ? c.gmdMedio.toFixed(3) : "-",
        c.custoTotal > 0 ? c.custoTotal.toFixed(2) : "-",
        c.arrobas > 0 ? c.arrobas.toFixed(1) : "-",
        c.custoPorArroba != null ? c.custoPorArroba.toFixed(2) : "-",
        c.mortes,
        c.diasMedio > 0 ? c.diasMedio.toFixed(0) : "-",
      ]),
    ];
    const wsDetalhe = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, wsDetalhe, "Por confinamento");
  }

  XLSX.writeFile(
    wb,
    `relatorio-confinamento-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

// ---------------------------------------------------------------------------
// Relatório detalhado: um confinamento, animais com brinco, datas de pesagem e evolução
// ---------------------------------------------------------------------------

export interface IndicadoresConfinamentoPDF {
  totalAnimais: number;
  animaisAtivos: number;
  pesoMedioEntrada: number;
  pesoMedioSaida: number;
  gmdMedio: number;
  diasMedio: number;
  diasConfinamento: number;
  custoTotal: number;
  custoPorDia: number | null;
  custoPorAnimalDia: number | null;
  custoPorKgGanho: number | null;
  margemEstimada: number | null;
}

export interface DadosConfinamentoDetalhePDF {
  nomeConfinamento: string;
  fazenda: string;
  dataInicio: string;
  dataFim?: string | null;
  indicadores?: IndicadoresConfinamentoPDF | null;
  animais: Array<{
    brinco: string;
    dataEntrada: string;
    pesoEntrada: number;
    pesagens: Array<{ data: string; peso: number }>;
    dataSaida?: string | null;
    pesoSaida?: number | null;
    dias: number;
    gmd: number | null;
  }>;
}

/** Formata data para o relatório (DD/MM/YYYY). Usa data local para YYYY-MM-DD, igual ao Supabase. */
function formatarDataRelatorio(data: string): string {
  if (!data) return "";
  return formatDateBR(data) || data;
}

const A4_LANDSCAPE = { pageWidth: 297, pageHeight: 210 };

/** Normaliza string de data para YYYY-MM-DD para ordenação. YYYY-MM-DD fica como está (evita UTC). */
function normalizarDataKey(data: string): string {
  if (!data) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(data.trim())) return data.trim();
  const d = parseDateOnlyLocal(data);
  if (!d) return data;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MARGEM_MINIMA = 5;

/** Gera PDF detalhado: colunas de pesagem = data no cabeçalho, célula = peso (kg) na linha. Margens mínimas. */
export function exportarConfinamentoDetalhePDF(
  dados: DadosConfinamentoDetalhePDF,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const dataExportacao = new Date().toLocaleString("pt-BR");
  const m = MARGEM_MINIMA;

  addRelatorioHeader(
    doc,
    `Confinamento: ${dados.nomeConfinamento}`,
    `${dados.fazenda} — Início: ${formatarDataRelatorio(dados.dataInicio)}${dados.dataFim ? ` • Fim: ${formatarDataRelatorio(dados.dataFim)}` : ""}`,
    dataExportacao,
    A4_LANDSCAPE,
  );

  // Coletar todas as datas de pesagem únicas (entre todos os animais) e ordenar
  const setDatas = new Set<string>();
  for (const a of dados.animais) {
    for (const p of a.pesagens) {
      if (p.data) setDatas.add(normalizarDataKey(p.data));
    }
  }
  const datasOrdenadas = Array.from(setDatas).sort();

  // Cabeçalho: Brinco | Data ent. | Peso ent. (kg) | [data1] | [data2] | ... | Dias | GMD | Peso saída
  const headers = [
    "Brinco",
    "Data ent.",
    "Peso ent. (kg)",
    ...datasOrdenadas.map((d) => formatarDataRelatorio(d)),
    "Dias",
    "GMD (kg/dia)",
    "Peso saída (kg)",
  ];

  type EvolucaoInfo = {
    pesoStr: string;
    evolStr: string;
    textColor: [number, number, number];
    fillColor: [number, number, number];
  };
  const evolucaoPreCompute = new Map<string, EvolucaoInfo>();

  const colPrimeiraData = 3;
  const body = dados.animais.map((a, rowIdx) => {
    const pesoPorData = new Map<string, number>();
    for (const p of a.pesagens) {
      if (p.data) pesoPorData.set(normalizarDataKey(p.data), p.peso);
    }
    const pesosNumericos = datasOrdenadas.map(
      (dataKey) => pesoPorData.get(dataKey) ?? null,
    );
    const pesoEntradaNum = a.pesoEntrada > 0 ? a.pesoEntrada : null;

    const pesosNasDatas = datasOrdenadas.map((_dataKey, i) => {
      const atual = pesosNumericos[i];
      if (atual == null) return "";
      // Último peso antes desta coluna (ignora colunas vazias no meio)
      let anterior: number | null = null;
      if (i === 0) {
        anterior = pesoEntradaNum;
      } else {
        for (let j = i - 1; j >= 0; j--) {
          if (pesosNumericos[j] != null) {
            anterior = pesosNumericos[j];
            break;
          }
        }
        if (anterior == null) anterior = pesoEntradaNum;
      }
      const pesoStr = atual.toFixed(1);
      if (anterior == null) return pesoStr;
      const diff = atual - anterior;
      const pct = Math.round((diff / anterior) * 100);
      let evolStr = "";
      let textColor: [number, number, number] = EVOLUCAO_TEXTO_IGUAL;
      let fillColor: [number, number, number] = EVOLUCAO_NEUTRO;
      if (diff > 0) {
        evolStr = ` (+${diff}kg ${pct}%)`;
        textColor = EVOLUCAO_TEXTO_GANHO;
        /*fillColor = EVOLUCAO_GANHO;*/
      } else if (diff < 0) {
        evolStr = ` (${diff}kg ${pct}%)`;
        textColor = EVOLUCAO_TEXTO_PERDA;
        /*fillColor = EVOLUCAO_PERDA;*/
      } else {
        evolStr = "";
        /*fillColor = EVOLUCAO_NEUTRO;*/
      }
      const col = colPrimeiraData + i;
      evolucaoPreCompute.set(`${rowIdx}-${col}`, {
        pesoStr,
        evolStr,
        textColor,
        fillColor,
      });
      return pesoStr;
    });
    return [
      a.brinco || "—",
      formatarDataRelatorio(a.dataEntrada),
      a.pesoEntrada > 0 ? a.pesoEntrada.toFixed(1) : "—",
      ...pesosNasDatas,
      a.dias > 0 ? String(a.dias) : "—",
      a.gmd != null ? a.gmd.toFixed(3) : "—",
      a.dataSaida && a.pesoSaida != null && a.pesoSaida > 0
        ? a.pesoSaida.toFixed(1)
        : "—",
    ];
  });

  const headerHeight = 32;
  let y = headerHeight + 2;
  const tableBottomMargin = 15;
  const contentW = A4_LANDSCAPE.pageWidth - m * 2;

  if (dados.indicadores) {
    const ind = dados.indicadores;
    doc.setFillColor(...RELATORIO_BODY_BG);
    doc.roundedRect(m, y, contentW, headerHeight, 1, 1, "FD");
    doc.setDrawColor(...BORDER_COLOR);
    doc.roundedRect(m, y, contentW, headerHeight, 1, 1, "S");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Indicadores", m + 4, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `Animais: ${ind.totalAnimais} (${ind.animaisAtivos} ativos)  |  Peso méd. entrada: ${ind.pesoMedioEntrada.toFixed(1)} kg  |  Peso méd. saída: ${ind.pesoMedioSaida > 0 ? ind.pesoMedioSaida.toFixed(1) : "—"} kg  |  GMD médio: ${ind.gmdMedio.toFixed(3)} kg/dia`,
      m + 4,
      y + 15,
    );
    doc.text(
      `Dias confinamento: ${ind.diasConfinamento}  |  Custo total: R$ ${ind.custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}  |  Custo/dia: R$ ${ind.custoPorDia != null ? ind.custoPorDia.toFixed(2) : "—"}`,
      m + 4,
      y + 22,
    );
    doc.text(
      `Custo/animal/dia: R$ ${ind.custoPorAnimalDia != null ? ind.custoPorAnimalDia.toFixed(2) : "—"}  |  Custo/kg ganho: R$ ${ind.custoPorKgGanho != null ? ind.custoPorKgGanho.toFixed(2) : "—"}  |  Margem estimada: ${ind.margemEstimada != null ? `R$ ${ind.margemEstimada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}`,
      m + 4,
      y + 29,
    );
    y += 42;
  }

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Animais e evolução de pesagem", m, y);
  y += 6;

  const numDateCols = datasOrdenadas.length;
  const colPesoEntrada = 2;
  const colUltimaData = 2 + numDateCols;

  const cellPadding = 1;
  const fontSizePeso = 8;
  const fontSizeEvol = 6;

  autoTable(doc, {
    startY: y,
    head: [headers],
    body,
    margin: { left: m, right: m, bottom: tableBottomMargin, top: m },
    headStyles: {
      fillColor: RELATORIO_HEADER_DARK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 1,
    },
    bodyStyles: { fontSize: fontSizePeso, cellPadding: 1 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    tableLineColor: BORDER_COLOR,
    tableLineWidth: 0.2,
    didParseCell(data) {
      if (data.section !== "body") return;
      const col = data.column.index;
      if (col === colPesoEntrada) {
        data.cell.styles.fillColor = EVOLUCAO_PESO_ENTRADA;
        return;
      }
      if (col >= colPrimeiraData && col < colUltimaData) {
        const info = evolucaoPreCompute.get(`${data.row.index}-${col}`);
        if (info) {
          data.cell.styles.fillColor = info.fillColor;
          (
            data.cell as unknown as { evolucaoInfo?: EvolucaoInfo }
          ).evolucaoInfo = info;
        }
      }
    },
    didDrawCell(data) {
      if (data.section !== "body") return;
      let info = (data.cell as unknown as { evolucaoInfo?: EvolucaoInfo })
        .evolucaoInfo;
      if (!info)
        info = evolucaoPreCompute.get(`${data.row.index}-${data.column.index}`);
      if (!info) return;
      const { cell } = data;
      doc.setFontSize(fontSizePeso);
      const wPeso = doc.getTextWidth(info.pesoStr);
      const baseY = cell.y + cell.height / 2 + (fontSizePeso * 0.35) / 2;
      doc.setFontSize(fontSizeEvol);
      doc.setTextColor(...info.textColor);
      doc.text(info.evolStr, cell.x + cellPadding + wPeso + 0.5, baseY);
      doc.setTextColor(0, 0, 0);
    },
  });

  // Legenda no final do relatório — layout em cards por indicador (mesma margem mínima)
  doc.addPage("a4", "landscape");
  const footerZone = 22;
  const legendaContentW = A4_LANDSCAPE.pageWidth - m * 2;
  let legendaY = m + 8;

  doc.setFillColor(...RELATORIO_HEADER_DARK);
  doc.roundedRect(m, legendaY, legendaContentW, 12, 1, 1, "FD");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Legenda — Como são calculados os indicadores", m + 6, legendaY + 8);
  doc.setTextColor(0, 0, 0);
  legendaY += 18;

  const legendaItens: { label: string; desc: string }[] = [
    {
      label: "Evolução de peso (tabela)",
      desc: "Azul claro = peso de entrada. Nas colunas de data: peso atual e, entre parênteses, variação em kg e em %. Verde = ganho, vermelho = perda em relação à pesagem anterior.",
    },
    {
      label: "Animais / ativos",
      desc: "Total de vínculos no confinamento e quantos ainda estão ativos (sem data de saída).",
    },
    {
      label: "Peso méd. entrada",
      desc: "Média dos pesos de entrada informados nos vínculos animal–confinamento.",
    },
    {
      label: "Peso méd. saída",
      desc: "Média dos pesos de saída apenas dos animais que já saíram (com data de saída).",
    },
    {
      label: "GMD médio",
      desc: "Ganho Médio Diário: média dos GMD individuais. Fórmula: (peso final menos peso entrada) dividido pelos dias entre entrada e última pesagem ou saída.",
    },
    {
      label: "Dias confinamento",
      desc: "Dias entre a data de início do confinamento e a data de fim (ou hoje, se ainda ativo).",
    },
    {
      label: "Custo total",
      desc: "Soma dos custos dos registros de alimentação do confinamento.",
    },
    {
      label: "Custo/dia",
      desc: "Custo total dividido pelos dias do confinamento.",
    },
    {
      label: "Custo/animal/dia",
      desc: "Custo total dividido pela soma dos dias por animal (cada animal conta da entrada até saída ou última pesagem).",
    },
    {
      label: "Custo/kg ganho",
      desc: "Custo total dividido pelo total de kg ganho no período.",
    },
    {
      label: "Margem estimada",
      desc: "(Total de kg ganho x preço venda/kg) menos custo total. Usa o preço venda/kg cadastrado no confinamento.",
    },
    {
      label: "Dias (tabela)",
      desc: "Para cada animal, dias da data de entrada até a data de saída ou até a última pesagem (ou hoje se ativo).",
    },
    {
      label: "Peso saída (tabela)",
      desc: "Preenchido apenas quando o animal tem data de saída no vínculo; caso contrário exibe traço.",
    },
  ];

  const descWidth = legendaContentW - 50;
  const labelX = m + 4;
  const descX = m + 46;

  for (let i = 0; i < legendaItens.length; i++) {
    if (legendaY > A4_LANDSCAPE.pageHeight - footerZone - 14) break;
    const item = legendaItens[i];
    const isOdd = i % 2 === 0;
    if (isOdd) {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(m, legendaY - 2, legendaContentW, 1, 0, 0, "FD");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(`${i + 1}. ${item.label}`, labelX, legendaY + 3);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);
    const parts = doc.splitTextToSize(item.desc, descWidth);
    let descY = legendaY;
    for (const part of parts) {
      if (descY > A4_LANDSCAPE.pageHeight - footerZone - 4) break;
      doc.text(part, descX, descY + 3);
      descY += 4;
    }
    legendaY = descY + 5;
    doc.setTextColor(0, 0, 0);
  }

  addRelatorioFooters(doc, dataExportacao, A4_LANDSCAPE, m);
  doc.save(
    `confinamento-detalhe-${dados.nomeConfinamento.replace(/\s+/g, "-").slice(0, 30)}-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}
