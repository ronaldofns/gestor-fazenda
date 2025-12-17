import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Nascimento } from '../db/models';
import { Desmama } from '../db/models';

interface DadosRelatorio {
  nascimentos: Nascimento[];
  desmamas: Map<string, Desmama>;
  fazendaNome: string;
  mes: number;
  ano: number;
  totais: {
    vacas: number;
    novilhas: number;
    femeas: number;
    machos: number;
    totalGeral: number;
    totalMortos: number;
  };
}

export interface DadosRelatorioProdutividadePorFazenda {
  fazenda: string;
  totalNascimentos: number;
  mortos: number;
  vivos: number;
  taxaMortandade: string;
  taxaDesmama: string;
  desmamas: number;
  periodo: string;
}

export interface DadosRelatorioProdutividade {
  periodo: string;
  fazendas: DadosRelatorioProdutividadePorFazenda[];
}

export function gerarRelatorioPDF(dados: DadosRelatorio) {
  const doc = new jsPDF({
    orientation: 'portrait', // Retrato para melhor uso da área de impressão
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8; // Margem reduzida para maximizar área útil
  const contentWidth = pageWidth - (margin * 2);

  // Cabeçalho
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PLANILHA NASCIMENTO/DESMAMA', margin, 12);

  // Informações da fazenda e período
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const nomeMes = new Date(2000, dados.mes - 1).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
  const fazendaText = `FAZENDA ${dados.fazendaNome.toUpperCase()}: MÊS ${dados.mes} (${nomeMes}) ANO ${dados.ano}`;
  
  // Quebrar texto se necessário para caber na largura
  const maxWidth = contentWidth;
  const fazendaLines = doc.splitTextToSize(fazendaText, maxWidth);
  doc.text(fazendaLines, margin, 18);
  
  // Ajustar startY baseado no número de linhas do cabeçalho
  const headerHeight = 18 + (fazendaLines.length * 5);

  // Preparar dados da tabela
  const tableData = dados.nascimentos.map((n) => {
    const desmama = dados.desmamas.get(n.id);
    const dataDesmama = desmama?.dataDesmama 
      ? new Date(desmama.dataDesmama).toLocaleDateString('pt-BR')
      : '';
    
    // Truncar observações muito longas para evitar quebra de layout
    const obs = (n.obs || '').substring(0, 50);
    
    return [
      n.matrizId || '',
      n.novilha ? 'X' : '',
      n.vaca ? 'X' : '',
      n.sexo || '',
      (n.raca || '').toUpperCase(),
      n.brincoNumero || '',
      n.morto ? 'X' : '',
      desmama?.pesoDesmama ? `${desmama.pesoDesmama} kg` : '',
      dataDesmama,
      obs
    ];
  });

  // Calcular larguras das colunas para ocupar 100% da largura disponível
  // Distribuir proporcionalmente baseado no conteúdo esperado
  // MATRIZ (4-5 dígitos), NOVILHA (1 char), VACA (1 char), SEXO (1 char), RAÇA (até 15 chars), BRINCO (até 10 chars), MORTO (1 char), PESO (até 10 chars), DATA (10 chars), OBS (variável)
  
  // Proporções relativas baseadas no tamanho esperado do conteúdo
  const proportions = [6, 6, 6, 6, 8, 8, 6, 8, 8, 38]; // Soma = 100
  const totalProportion = proportions.reduce((a, b) => a + b, 0);
  
  // Calcular larguras absolutas ocupando 100% da largura disponível
  const colWidths: number[] = proportions.map(prop => 
    (contentWidth * prop) / totalProportion
  );

  // Criar tabela
  autoTable(doc, {
    head: [[
      'Matriz',
      'Novilha',
      'Vaca',
      'Sexo',
      'Raça',
      'Número\nBrinco',
      'Morto',
      'Peso\nDesmama',
      'Data\nDesmama',
      'Observações'
    ]],
    body: tableData,
    startY: headerHeight,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth, // Forçar largura total
    styles: {
      fontSize: 7,
      cellPadding: 1,
      overflow: 'linebreak',
      cellWidth: 'wrap',
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.1
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: colWidths[0] }, // MATRIZ
      1: { halign: 'center', cellWidth: colWidths[1] }, // NOVILHA
      2: { halign: 'center', cellWidth: colWidths[2] }, // VACA
      3: { halign: 'center', cellWidth: colWidths[3] }, // SEXO
      4: { halign: 'left', cellWidth: colWidths[4] }, // RAÇA
      5: { halign: 'left', cellWidth: colWidths[5] }, // BRINCO
      6: { halign: 'center', cellWidth: colWidths[6] }, // MORTO
      7: { halign: 'left', cellWidth: colWidths[7] }, // PESO DESMAMA
      8: { halign: 'left', cellWidth: colWidths[8] }, // DATA DESMAMA
      9: { halign: 'left', cellWidth: colWidths[9] } // OBS
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    didParseCell: (data: any) => {
      // Destacar linhas de animais mortos
      if (data.row.index > 0 && data.column.index === 6 && data.cell.text[0] === 'X') {
        data.row.styles.fillColor = [255, 240, 240];
      }
    }
  });

  // Adicionar totalizadores no final
  const finalY = (doc as any).lastAutoTable.finalY || pageHeight - 40;
  let currentY = finalY + 8;

  // Verificar se precisa de nova página para os totalizadores
  if (currentY > pageHeight - 35) {
    doc.addPage();
    currentY = margin + 10;
  }

  // Linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // Título dos totalizadores
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTALIZADORES', margin, currentY);
  currentY += 6;

  // Totalizadores em formato compacto - duas colunas
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  const totalizadores = [
    { label: 'Total de Nascimentos', valor: dados.totais.totalGeral },
    { label: 'Vacas', valor: dados.totais.vacas },
    { label: 'Novilhas', valor: dados.totais.novilhas },
    { label: 'Fêmeas', valor: dados.totais.femeas },
    { label: 'Machos', valor: dados.totais.machos },
    { label: 'Mortos', valor: dados.totais.totalMortos },
    { label: 'Vivos', valor: dados.totais.totalGeral - dados.totais.totalMortos }
  ];

  // Organizar em duas colunas para economizar espaço
  const colWidth = (contentWidth - 10) / 2; // Duas colunas com espaçamento
  const rowHeight = 3;
  const startX = margin + 3;
  
  totalizadores.forEach((totalizador, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = startX + (col * colWidth);
    const y = currentY + (row * rowHeight);

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`${totalizador.label}:`, x, y);
    
    // Valor (em negrito)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const labelWidth = doc.getTextWidth(`${totalizador.label}:`);
    doc.text(totalizador.valor.toString(), x + labelWidth + 3, y);
  });

  // Rodapé com data de geração
  const dataGeracao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Relatório gerado em: ${dataGeracao}`,
    pageWidth - margin,
    pageHeight - 10,
    { align: 'right' }
  );

  // Salvar PDF
  const nomeArquivo = `Relatorio_${dados.fazendaNome.replace(/\s+/g, '_')}_${dados.mes}_${dados.ano}.pdf`;
  doc.save(nomeArquivo);
}

// Relatório de produtividade por fazenda (compacto)
export function gerarRelatorioProdutividadePDF(dados: DadosRelatorioProdutividade) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RELATÓRIO DE PRODUTIVIDADE POR FAZENDA', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Período: ${dados.periodo}`, margin, 18);

  const tabela = dados.fazendas.map((f) => [
    f.fazenda,
    f.totalNascimentos,
    f.vivos,
    f.mortos,
    `${f.taxaMortandade}%`,
    f.desmamas,
    `${f.taxaDesmama}%`,
  ]);

  autoTable(doc, {
    head: [[
      'Fazenda',
      'Nasc.',
      'Vivos',
      'Mortos',
      'Tx. Mort.',
      'Desmamas',
      'Tx. Desm.'
    ]],
    body: tabela,
    startY: 26,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      fontSize: 9,
      cellPadding: 2,
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [52, 116, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.28, halign: 'left' },
      1: { cellWidth: contentWidth * 0.1, halign: 'center' },
      2: { cellWidth: contentWidth * 0.1, halign: 'center' },
      3: { cellWidth: contentWidth * 0.1, halign: 'center' },
      4: { cellWidth: contentWidth * 0.12, halign: 'center' },
      5: { cellWidth: contentWidth * 0.14, halign: 'center' },
      6: { cellWidth: contentWidth * 0.16, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  const dataGeracao = new Date().toLocaleString('pt-BR');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text(`Gerado em: ${dataGeracao}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });

  const nomeArquivo = `Produtividade_${dados.periodo.replace(/\s+/g, '_')}.pdf`;
  doc.save(nomeArquivo);
}

export interface DadosRelatorioMortalidade {
  periodo: string;
  linhas: Array<{
    raca: string;
    totalNascimentos: number;
    vivos: number;
    mortos: number;
    taxaMortandade: string;
  }>;
}

export function gerarRelatorioMortalidadePDF(dados: DadosRelatorioMortalidade) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RELATÓRIO DE MORTALIDADE POR RAÇA', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Período: ${dados.periodo}`, margin, 18);

  const tabela = dados.linhas.map((l) => [
    l.raca,
    l.totalNascimentos,
    l.vivos,
    l.mortos,
    `${l.taxaMortandade}%`
  ]);

  autoTable(doc, {
    head: [[
      'Raça',
      'Nascimentos',
      'Vivos',
      'Mortos',
      'Tx. Mortalidade'
    ]],
    body: tabela,
    startY: 26,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      fontSize: 9,
      cellPadding: 2,
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [239, 68, 68],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.35, halign: 'left' },
      1: { cellWidth: contentWidth * 0.18, halign: 'center' },
      2: { cellWidth: contentWidth * 0.15, halign: 'center' },
      3: { cellWidth: contentWidth * 0.15, halign: 'center' },
      4: { cellWidth: contentWidth * 0.17, halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  const dataGeracao = new Date().toLocaleString('pt-BR');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text(`Gerado em: ${dataGeracao}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });

  const nomeArquivo = `Mortalidade_${dados.periodo.replace(/\s+/g, '_')}.pdf`;
  doc.save(nomeArquivo);
}

export interface DadosRelatorioDesmama {
  periodo: string;
  desmamas: Array<{
    matrizId: string;
    brinco?: string;
    fazenda: string;
    raca?: string;
    sexo?: string;
    dataNascimento?: string;
    dataDesmama?: string;
    pesoDesmama?: number;
  }>;
}

export function gerarRelatorioDesmamaPDF(dados: DadosRelatorioDesmama) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;

  // Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('RELATÓRIO DE DESMAMA COM MÉDIAS DE PESO', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Período: ${dados.periodo}`, margin, 18);

  // Calcular médias
  const desmamasComPeso = dados.desmamas.filter(d => d.pesoDesmama && d.pesoDesmama > 0);
  const totalDesmamas = dados.desmamas.length;
  const mediaGeral = desmamasComPeso.length > 0
    ? desmamasComPeso.reduce((sum, d) => sum + (d.pesoDesmama || 0), 0) / desmamasComPeso.length
    : 0;

  // Médias por fazenda
  const porFazenda = new Map<string, { total: number; somaPeso: number; comPeso: number }>();
  dados.desmamas.forEach(d => {
    const entry = porFazenda.get(d.fazenda) || { total: 0, somaPeso: 0, comPeso: 0 };
    entry.total += 1;
    if (d.pesoDesmama && d.pesoDesmama > 0) {
      entry.somaPeso += d.pesoDesmama;
      entry.comPeso += 1;
    }
    porFazenda.set(d.fazenda, entry);
  });

  // Médias por raça
  const porRaca = new Map<string, { total: number; somaPeso: number; comPeso: number }>();
  dados.desmamas.forEach(d => {
    const raca = d.raca || 'Sem raça';
    const entry = porRaca.get(raca) || { total: 0, somaPeso: 0, comPeso: 0 };
    entry.total += 1;
    if (d.pesoDesmama && d.pesoDesmama > 0) {
      entry.somaPeso += d.pesoDesmama;
      entry.comPeso += 1;
    }
    porRaca.set(raca, entry);
  });

  // Médias por sexo
  const porSexo = new Map<string, { total: number; somaPeso: number; comPeso: number }>();
  dados.desmamas.forEach(d => {
    const sexo = d.sexo || 'Sem sexo';
    const entry = porSexo.get(sexo) || { total: 0, somaPeso: 0, comPeso: 0 };
    entry.total += 1;
    if (d.pesoDesmama && d.pesoDesmama > 0) {
      entry.somaPeso += d.pesoDesmama;
      entry.comPeso += 1;
    }
    porSexo.set(sexo, entry);
  });

  let startY = 26;

  // Resumo geral
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RESUMO GERAL', margin, startY);
  startY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Total de desmamas: ${totalDesmamas}`, margin, startY);
  startY += 5;
  doc.text(`Desmamas com peso registrado: ${desmamasComPeso.length}`, margin, startY);
  startY += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(`Média geral de peso: ${mediaGeral.toFixed(2)} kg`, margin, startY);
  startY += 8;

  // Tabela de desmamas
  if (dados.desmamas.length > 0) {
    const tableData = dados.desmamas.map(d => [
      d.matrizId || '',
      d.brinco || '-',
      d.fazenda,
      d.raca || '-',
      d.sexo || '-',
      d.dataDesmama ? new Date(d.dataDesmama).toLocaleDateString('pt-BR') : '-',
      d.pesoDesmama ? `${d.pesoDesmama.toFixed(2)} kg` : '-'
    ]);

    autoTable(doc, {
      head: [['Matriz', 'Brinco', 'Fazenda', 'Raça', 'Sexo', 'Data Desmama', 'Peso (kg)']],
      body: tableData,
      startY: startY,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [52, 116, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.12, halign: 'left' },
        1: { cellWidth: contentWidth * 0.1, halign: 'left' },
        2: { cellWidth: contentWidth * 0.18, halign: 'left' },
        3: { cellWidth: contentWidth * 0.15, halign: 'left' },
        4: { cellWidth: contentWidth * 0.1, halign: 'center' },
        5: { cellWidth: contentWidth * 0.15, halign: 'left' },
        6: { cellWidth: contentWidth * 0.2, halign: 'right' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    startY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Verificar se precisa de nova página
  if (startY > pageHeight - 50) {
    doc.addPage();
    startY = margin + 10;
  }

  // Médias por fazenda
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MÉDIAS POR FAZENDA', margin, startY);
  startY += 6;

  const fazendaData = Array.from(porFazenda.entries())
    .map(([fazenda, dados]) => [
      fazenda,
      dados.total,
      dados.comPeso,
      dados.comPeso > 0 ? `${(dados.somaPeso / dados.comPeso).toFixed(2)} kg` : '-'
    ])
    .sort((a, b) => (a[0] as string).localeCompare(b[0] as string));

  autoTable(doc, {
    head: [['Fazenda', 'Total', 'Com Peso', 'Média Peso']],
    body: fazendaData,
    startY: startY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [34, 197, 94],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.4, halign: 'left' },
      1: { cellWidth: contentWidth * 0.2, halign: 'center' },
      2: { cellWidth: contentWidth * 0.2, halign: 'center' },
      3: { cellWidth: contentWidth * 0.2, halign: 'right' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  startY = (doc as any).lastAutoTable.finalY + 8;

  // Verificar se precisa de nova página
  if (startY > pageHeight - 50) {
    doc.addPage();
    startY = margin + 10;
  }

  // Médias por raça
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MÉDIAS POR RAÇA', margin, startY);
  startY += 6;

  const racaData = Array.from(porRaca.entries())
    .map(([raca, dados]) => [
      raca,
      dados.total,
      dados.comPeso,
      dados.comPeso > 0 ? `${(dados.somaPeso / dados.comPeso).toFixed(2)} kg` : '-'
    ])
    .sort((a, b) => (b[1] as number) - (a[1] as number));

  autoTable(doc, {
    head: [['Raça', 'Total', 'Com Peso', 'Média Peso']],
    body: racaData,
    startY: startY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [168, 85, 247],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.4, halign: 'left' },
      1: { cellWidth: contentWidth * 0.2, halign: 'center' },
      2: { cellWidth: contentWidth * 0.2, halign: 'center' },
      3: { cellWidth: contentWidth * 0.2, halign: 'right' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  startY = (doc as any).lastAutoTable.finalY + 8;

  // Verificar se precisa de nova página
  if (startY > pageHeight - 50) {
    doc.addPage();
    startY = margin + 10;
  }

  // Médias por sexo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MÉDIAS POR SEXO', margin, startY);
  startY += 6;

  const sexoData = Array.from(porSexo.entries())
    .map(([sexo, dados]) => [
      sexo === 'M' ? 'Macho' : sexo === 'F' ? 'Fêmea' : sexo,
      dados.total,
      dados.comPeso,
      dados.comPeso > 0 ? `${(dados.somaPeso / dados.comPeso).toFixed(2)} kg` : '-'
    ])
    .sort((a, b) => (b[1] as number) - (a[1] as number));

  autoTable(doc, {
    head: [['Sexo', 'Total', 'Com Peso', 'Média Peso']],
    body: sexoData,
    startY: startY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [236, 72, 153],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.4, halign: 'left' },
      1: { cellWidth: contentWidth * 0.2, halign: 'center' },
      2: { cellWidth: contentWidth * 0.2, halign: 'center' },
      3: { cellWidth: contentWidth * 0.2, halign: 'right' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Rodapé
  const dataGeracao = new Date().toLocaleString('pt-BR');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text(`Gerado em: ${dataGeracao}`, pageWidth - margin, pageHeight - 8, { align: 'right' });

  const nomeArquivo = `Desmama_Medias_${dados.periodo.replace(/\s+/g, '_')}.pdf`;
  doc.save(nomeArquivo);
}

