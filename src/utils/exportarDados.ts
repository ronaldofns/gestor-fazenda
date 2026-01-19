import * as XLSX from 'xlsx';
import { Nascimento } from '../db/models';
import { Desmama } from '../db/models';
import { formatDateBR } from './date';

interface DadosExportacao {
  nascimentos: Nascimento[];
  desmamas: Map<string, Desmama>;
  fazendaNome?: string;
  mes?: number;
  ano?: number;
  matrizMap?: Map<string, string>; // ID -> identificador
}

/**
 * Exporta dados para Excel (.xlsx)
 */
export function exportarParaExcel(dados: DadosExportacao) {
  try {
    // Preparar dados da planilha
    const dadosPlanilha = dados.nascimentos.map((n) => {
      const desmama = dados.desmamas.get(n.id);
      const matrizIdentificador = dados.matrizMap?.get(n.matrizId) || n.matrizId || '';
      return {
        'Matriz': matrizIdentificador,
        'Novilha': n.novilha ? 'X' : '',
        'Vaca': n.vaca ? 'X' : '',
        'Sexo': n.sexo || '',
        'Raça': n.raca || '',
        'Brinco': n.brincoNumero || '',
        'Data Nascimento': n.dataNascimento ? formatDateBR(n.dataNascimento) : '',
        'Morto': n.morto ? 'X' : '',
        'Peso Desmama (kg)': desmama?.pesoDesmama || '',
        'Data Desmama': desmama?.dataDesmama ? formatDateBR(desmama.dataDesmama) : '',
        'Observações': n.obs || ''
      };
    });

    // Criar workbook
    const wb = XLSX.utils.book_new();
    
    // Criar worksheet com dados
    const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
    
    // Ajustar largura das colunas
    const colWidths = [
      { wch: 15 }, // Matriz
      { wch: 8 },  // Novilha
      { wch: 8 },  // Vaca
      { wch: 8 },  // Sexo
      { wch: 15 }, // Raça
      { wch: 12 }, // Brinco
      { wch: 15 }, // Data Nascimento
      { wch: 8 },  // Morto
      { wch: 15 }, // Peso Desmama
      { wch: 15 }, // Data Desmama
      { wch: 30 }  // Observações
    ];
    ws['!cols'] = colWidths;
    
    // Adicionar worksheet ao workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Nascimentos');
    
    // Criar worksheet de totalizadores
    const totalizadores = [
      { 'Métrica': 'Total de Nascimentos', 'Valor': dados.nascimentos.length },
      { 'Métrica': 'Vacas', 'Valor': dados.nascimentos.filter(n => n.vaca).length },
      { 'Métrica': 'Novilhas', 'Valor': dados.nascimentos.filter(n => n.novilha).length },
      { 'Métrica': 'Fêmeas', 'Valor': dados.nascimentos.filter(n => n.sexo === 'F').length },
      { 'Métrica': 'Machos', 'Valor': dados.nascimentos.filter(n => n.sexo === 'M').length },
      { 'Métrica': 'Mortos', 'Valor': dados.nascimentos.filter(n => n.morto).length },
      { 'Métrica': 'Vivos', 'Valor': dados.nascimentos.filter(n => !n.morto).length },
      { 'Métrica': 'Com Desmama', 'Valor': Array.from(dados.desmamas.values()).length }
    ];
    
    const wsTotais = XLSX.utils.json_to_sheet(totalizadores);
    wsTotais['!cols'] = [{ wch: 20 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsTotais, 'Totalizadores');
    
    // Gerar nome do arquivo
    let nomeArquivo = 'Planilha_Nascimentos';
    if (dados.fazendaNome) {
      nomeArquivo += `_${dados.fazendaNome.replace(/\s+/g, '_')}`;
    }
    if (dados.mes && dados.ano) {
      nomeArquivo += `_${dados.mes}_${dados.ano}`;
    }
    nomeArquivo += '.xlsx';
    
    // Salvar arquivo
    XLSX.writeFile(wb, nomeArquivo);
  } catch (error) {
    console.error('Erro ao exportar para Excel:', error);
    throw new Error('Erro ao exportar para Excel. Tente novamente.');
  }
}

/**
 * Exporta dados para CSV
 */
export function exportarParaCSV(dados: DadosExportacao) {
  try {
    // Preparar cabeçalhos
    const headers = [
      'Matriz',
      'Novilha',
      'Vaca',
      'Sexo',
      'Raça',
      'Brinco',
      'Data Nascimento',
      'Morto',
      'Peso Desmama (kg)',
      'Data Desmama',
      'Observações'
    ];
    
    // Preparar dados
    const linhas = dados.nascimentos.map((n) => {
      const desmama = dados.desmamas.get(n.id);
      const matrizIdentificador = dados.matrizMap?.get(n.matrizId) || n.matrizId || '';
      return [
        matrizIdentificador,
        n.novilha ? 'X' : '',
        n.vaca ? 'X' : '',
        n.sexo || '',
        n.raca || '',
        n.brincoNumero || '',
        n.dataNascimento ? formatDateBR(n.dataNascimento) : '',
        n.morto ? 'X' : '',
        desmama?.pesoDesmama?.toString() || '',
        desmama?.dataDesmama ? formatDateBR(desmama.dataDesmama) : '',
        (n.obs || '').replace(/"/g, '""') // Escapar aspas duplas
      ];
    });
    
    // Criar conteúdo CSV
    const csvContent = [
      headers.join(','),
      ...linhas.map(linha => linha.map(campo => `"${campo}"`).join(','))
    ].join('\n');
    
    // Adicionar BOM para UTF-8 (garante acentuação correta no Excel)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Criar link de download
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Gerar nome do arquivo
    let nomeArquivo = 'Planilha_Nascimentos';
    if (dados.fazendaNome) {
      nomeArquivo += `_${dados.fazendaNome.replace(/\s+/g, '_')}`;
    }
    if (dados.mes && dados.ano) {
      nomeArquivo += `_${dados.mes}_${dados.ano}`;
    }
    nomeArquivo += '.csv';
    
    link.setAttribute('href', url);
    link.setAttribute('download', nomeArquivo);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao exportar para CSV:', error);
    throw new Error('Erro ao exportar para CSV. Tente novamente.');
  }
}

/**
 * Exporta backup completo de todos os dados locais
 */
export async function exportarBackupCompleto() {
  try {
    const { db } = await import('../db/dexieDB');
    
    // Buscar todos os dados
    const [fazendas, racas, nascimentos, desmamas, usuarios] = await Promise.all([
      db.fazendas.toArray(),
      db.racas.toArray(),
      db.nascimentos.toArray(),
      db.desmamas.toArray(),
      db.usuarios.toArray()
    ]);
    
    // Criar objeto de backup
    const backup = {
      versao: '1.0',
      dataBackup: new Date().toISOString(),
      dados: {
        fazendas,
        racas,
        nascimentos,
        desmamas,
        usuarios
      },
      metadados: {
        totalFazendas: fazendas.length,
        totalRacas: racas.length,
        totalNascimentos: nascimentos.length,
        totalDesmamas: desmamas.length,
        totalUsuarios: usuarios.length
      }
    };
    
    // Converter para JSON
    const jsonContent = JSON.stringify(backup, null, 2);
    
    // Criar blob
    const blob = new Blob([jsonContent], { type: 'application/json' });
    
    // Criar link de download
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const dataBackup = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const nomeArquivo = `backup_gestor_fazenda_${dataBackup}.json`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', nomeArquivo);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return {
      sucesso: true,
      nomeArquivo,
      totalRegistros: backup.metadados
    };
  } catch (error) {
    console.error('Erro ao exportar backup:', error);
    throw new Error('Erro ao exportar backup. Tente novamente.');
  }
}

