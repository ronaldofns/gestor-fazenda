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
 * Exporta backup completo de todos os dados locais (inclui animais, confinamentos, etc.)
 */
export async function exportarBackupCompleto() {
  try {
    const { db } = await import('../db/dexieDB');
    
    const [
      fazendas,
      racas,
      categorias,
      matrizes,
      nascimentos,
      desmamas,
      pesagens,
      vacinacoes,
      usuarios,
      rolePermissions,
      alertSettings,
      appSettings,
      tiposAnimal,
      statusAnimal,
      origens,
      animais,
      genealogias,
      confinamentos,
      confinamentoAnimais,
      confinamentoPesagens,
      confinamentoAlimentacao
    ] = await Promise.all([
      db.fazendas.toArray(),
      db.racas.toArray(),
      db.categorias.toArray(),
      db.matrizes.toArray(),
      db.nascimentos.toArray(),
      db.desmamas.toArray(),
      db.pesagens.toArray(),
      db.vacinacoes.toArray(),
      db.usuarios.toArray(),
      db.rolePermissions.toArray(),
      db.alertSettings.toArray(),
      db.appSettings.toArray(),
      db.tiposAnimal.toArray(),
      db.statusAnimal.toArray(),
      db.origens.toArray(),
      db.animais.toArray(),
      db.genealogias.toArray(),
      db.confinamentos.toArray(),
      db.confinamentoAnimais.toArray(),
      db.confinamentoPesagens.toArray(),
      db.confinamentoAlimentacao.toArray()
    ]);
    
    const backup = {
      versao: '3.0',
      dataBackup: new Date().toISOString(),
      dados: {
        fazendas,
        racas,
        categorias,
        matrizes,
        nascimentos,
        desmamas,
        pesagens,
        vacinacoes,
        usuarios,
        rolePermissions,
        alertSettings,
        appSettings,
        tiposAnimal,
        statusAnimal,
        origens,
        animais,
        genealogias,
        confinamentos,
        confinamentoAnimais,
        confinamentoPesagens,
        confinamentoAlimentacao
      },
      metadados: {
        totalFazendas: fazendas.length,
        totalRacas: racas.length,
        totalCategorias: categorias.length,
        totalMatrizes: matrizes.length,
        totalNascimentos: nascimentos.length,
        totalDesmamas: desmamas.length,
        totalPesagens: pesagens.length,
        totalVacinacoes: vacinacoes.length,
        totalUsuarios: usuarios.length,
        totalRolePermissions: rolePermissions.length,
        totalAlertSettings: alertSettings.length,
        totalAppSettings: appSettings.length,
        totalTiposAnimal: tiposAnimal.length,
        totalStatusAnimal: statusAnimal.length,
        totalOrigens: origens.length,
        totalAnimais: animais.length,
        totalGenealogias: genealogias.length,
        totalConfinamentos: confinamentos.length,
        totalConfinamentoAnimais: confinamentoAnimais.length,
        totalConfinamentoPesagens: confinamentoPesagens.length,
        totalConfinamentoAlimentacao: confinamentoAlimentacao.length
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
    throw new Error('Erro ao exportar backup completo. Tente novamente.');
  }
}

/**
 * Importa backup completo e restaura dados locais
 */
export async function importarBackup(arquivo: File): Promise<{ sucesso: boolean; mensagem: string; totais?: any }> {
  try {
    // Ler conteúdo do arquivo
    const conteudo = await arquivo.text();
    const backup = JSON.parse(conteudo);

    if (!backup.versao || !backup.dados) {
      throw new Error('Arquivo de backup inválido ou corrompido');
    }

    const { db } = await import('../db/dexieDB');
    const { dados } = backup;
    const existentesAntes = {
      fazendas: await db.fazendas.count(),
      racas: await db.racas.count(),
      animais: await db.animais.count(),
      confinamentos: await db.confinamentos.count()
    };
    let importados = {
      fazendas: 0,
      racas: 0,
      categorias: 0,
      matrizes: 0,
      nascimentos: 0,
      desmamas: 0,
      pesagens: 0,
      vacinacoes: 0,
      usuarios: 0,
      rolePermissions: 0,
      alertSettings: 0,
      appSettings: 0,
      tiposAnimal: 0,
      statusAnimal: 0,
      origens: 0,
      animais: 0,
      genealogias: 0,
      confinamentos: 0,
      confinamentoAnimais: 0,
      confinamentoPesagens: 0,
      confinamentoAlimentacao: 0
    };

    // Importar fazendas
    if (Array.isArray(dados.fazendas)) {
      for (const fazenda of dados.fazendas) {
        const existe = await db.fazendas.get(fazenda.id);
        if (!existe) {
          await db.fazendas.put(fazenda);
          importados.fazendas++;
        }
      }
    }

    // Importar raças
    if (Array.isArray(dados.racas)) {
      for (const raca of dados.racas) {
        const existe = await db.racas.get(raca.id);
        if (!existe) {
          await db.racas.put(raca);
          importados.racas++;
        }
      }
    }

    // Importar categorias
    if (Array.isArray(dados.categorias)) {
      for (const categoria of dados.categorias) {
        const existe = await db.categorias.get(categoria.id);
        if (!existe) {
          await db.categorias.put(categoria);
          importados.categorias++;
        }
      }
    }

    // Importar matrizes
    if (Array.isArray(dados.matrizes)) {
      for (const matriz of dados.matrizes) {
        const existe = await db.matrizes.get(matriz.id);
        if (!existe) {
          await db.matrizes.put(matriz);
          importados.matrizes++;
        }
      }
    }

    // Importar nascimentos
    if (Array.isArray(dados.nascimentos)) {
      for (const nascimento of dados.nascimentos) {
        const existe = await db.nascimentos.get(nascimento.id);
        if (!existe) {
          await db.nascimentos.put(nascimento);
          importados.nascimentos++;
        }
      }
    }

    // Importar desmamas
    if (Array.isArray(dados.desmamas)) {
      for (const desmama of dados.desmamas) {
        const existe = await db.desmamas.get(desmama.id);
        if (!existe) {
          await db.desmamas.put(desmama);
          importados.desmamas++;
        }
      }
    }

    // Importar pesagens
    if (Array.isArray(dados.pesagens)) {
      for (const pesagem of dados.pesagens) {
        const existe = await db.pesagens.get(pesagem.id);
        if (!existe) {
          await db.pesagens.put(pesagem);
          importados.pesagens++;
        }
      }
    }

    // Importar vacinações
    if (Array.isArray(dados.vacinacoes)) {
      for (const vacinacao of dados.vacinacoes) {
        const existe = await db.vacinacoes.get(vacinacao.id);
        if (!existe) {
          await db.vacinacoes.put(vacinacao);
          importados.vacinacoes++;
        }
      }
    }

    // Importar usuários (com cuidado - não sobrescrever admin atual)
    if (Array.isArray(dados.usuarios)) {
      for (const usuario of dados.usuarios) {
        const existe = await db.usuarios.get(usuario.id);
        if (!existe) {
          await db.usuarios.put(usuario);
          importados.usuarios++;
        }
      }
    }

    // Importar rolePermissions
    if (Array.isArray(dados.rolePermissions)) {
      for (const perm of dados.rolePermissions) {
        const existe = await db.rolePermissions.get(perm.id);
        if (!existe) {
          await db.rolePermissions.put(perm);
          importados.rolePermissions++;
        }
      }
    }

    // Importar alertSettings
    if (Array.isArray(dados.alertSettings)) {
      for (const setting of dados.alertSettings) {
        const existe = await db.alertSettings.get(setting.id);
        if (!existe) {
          await db.alertSettings.put(setting);
          importados.alertSettings++;
        }
      }
    }

    if (Array.isArray(dados.appSettings)) {
      for (const setting of dados.appSettings) {
        await db.appSettings.put(setting);
        importados.appSettings++;
      }
    }

    // Tabelas do sistema de animais (backup v3.0 ou compatível)
    if (Array.isArray(dados.tiposAnimal)) {
      for (const item of dados.tiposAnimal) {
        const existe = await db.tiposAnimal.get(item.id);
        if (!existe) {
          await db.tiposAnimal.put(item);
          importados.tiposAnimal++;
        }
      }
    }
    if (Array.isArray(dados.statusAnimal)) {
      for (const item of dados.statusAnimal) {
        const existe = await db.statusAnimal.get(item.id);
        if (!existe) {
          await db.statusAnimal.put(item);
          importados.statusAnimal++;
        }
      }
    }
    if (Array.isArray(dados.origens)) {
      for (const item of dados.origens) {
        const existe = await db.origens.get(item.id);
        if (!existe) {
          await db.origens.put(item);
          importados.origens++;
        }
      }
    }
    if (Array.isArray(dados.animais)) {
      for (const item of dados.animais) {
        const existe = await db.animais.get(item.id);
        if (!existe) {
          await db.animais.put(item);
          importados.animais++;
        }
      }
    }
    if (Array.isArray(dados.genealogias)) {
      for (const item of dados.genealogias) {
        const existe = await db.genealogias.get(item.id);
        if (!existe) {
          await db.genealogias.put(item);
          importados.genealogias++;
        }
      }
    }
    if (Array.isArray(dados.confinamentos)) {
      for (const item of dados.confinamentos) {
        const existe = await db.confinamentos.get(item.id);
        if (!existe) {
          await db.confinamentos.put(item);
          importados.confinamentos++;
        }
      }
    }
    if (Array.isArray(dados.confinamentoAnimais)) {
      for (const item of dados.confinamentoAnimais) {
        const existe = await db.confinamentoAnimais.get(item.id);
        if (!existe) {
          await db.confinamentoAnimais.put(item);
          importados.confinamentoAnimais++;
        }
      }
    }
    if (Array.isArray(dados.confinamentoPesagens)) {
      for (const item of dados.confinamentoPesagens) {
        const existe = await db.confinamentoPesagens.get(item.id);
        if (!existe) {
          await db.confinamentoPesagens.put(item);
          importados.confinamentoPesagens++;
        }
      }
    }
    if (Array.isArray(dados.confinamentoAlimentacao)) {
      for (const item of dados.confinamentoAlimentacao) {
        const existe = await db.confinamentoAlimentacao.get(item.id);
        if (!existe) {
          await db.confinamentoAlimentacao.put(item);
          importados.confinamentoAlimentacao++;
        }
      }
    }

    const totalImportado = Object.values(importados).reduce((acc, val) => acc + val, 0);
    
    if (totalImportado === 0) {
      return {
        sucesso: true,
        mensagem: 'Backup válido, mas todos os dados já existem no sistema',
        totais: { existentesAntes, importados }
      };
    }

    return {
      sucesso: true,
      mensagem: `Backup importado com sucesso! ${totalImportado} registros adicionados`,
      totais: { existentesAntes, importados }
    };
  } catch (error) {
    console.error('Erro ao importar backup:', error);
    if (error instanceof SyntaxError) {
      return {
        sucesso: false,
        mensagem: 'Erro: Arquivo JSON inválido'
      };
    }
    return {
      sucesso: false,
      mensagem: error instanceof Error ? error.message : 'Erro desconhecido ao importar backup'
    };
  }
}

