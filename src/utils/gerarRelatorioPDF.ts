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

