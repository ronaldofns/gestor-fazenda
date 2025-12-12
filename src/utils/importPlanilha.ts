import * as XLSX from 'xlsx';
import { db } from '../db/dexieDB';
import { uuid } from './uuid';
import { Nascimento } from '../db/models';

export interface MapeamentoColunas {
  matrizId?: string;
  fazenda?: string;
  mes?: string;
  ano?: string;
  novilha?: string;
  vaca?: string;
  brincoNumero?: string;
  dataNascimento?: string;
  sexo?: string;
  raca?: string;
  obs?: string;
}

export interface LinhaImportacao {
  dados: Record<string, any>;
  linha: number;
  erros: string[];
}

export interface InfoPlanilha {
  dados: any[];
  fazenda?: string;
  mes?: number;
  ano?: number;
  primeiraLinha?: number; // Linha onde começam os dados (após cabeçalho)
}

/**
 * Lê um arquivo Excel ou CSV e retorna os dados com informações do cabeçalho
 */
export function lerPlanilha(file: File): Promise<InfoPlanilha> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Pegar a primeira planilha
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Tentar extrair informações do cabeçalho (primeiras linhas)
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:Z100');
        let fazenda: string | undefined;
        let mes: number | undefined;
        let ano: number | undefined;
        let primeiraLinhaDados = 0;
        
        // Procurar nas primeiras 10 linhas por informações
        for (let row = 0; row < Math.min(10, range.e.r); row++) {
          const rowData: any = {};
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            if (cell && cell.v) {
              const colLetter = XLSX.utils.encode_col(col);
              rowData[colLetter] = cell.v;
              
              const valor = String(cell.v).toLowerCase();
              
              // Procurar por "fazenda"
              if (valor.includes('fazenda') && !fazenda) {
                // Extrair nome da fazenda (pode estar na mesma célula ou próxima)
                const textoCompleto = String(cell.v);
                // Padrão: "FAZENDA CAPANEMA: IV" ou "Fazenda: Nome"
                const matchFazenda = textoCompleto.match(/fazenda\s*:?\s*([^:]+(?::\s*[^:]+)?)/i);
                if (matchFazenda) {
                  fazenda = matchFazenda[1].trim();
                } else {
                  // Verificar próxima célula
                  const nextCell = worksheet[XLSX.utils.encode_cell({ r: row, c: col + 1 })];
                  if (nextCell && nextCell.v) {
                    fazenda = String(nextCell.v).trim();
                  }
                }
              }
              
              // Procurar por "mês" ou "mes"
              if ((valor.includes('mês') || valor.includes('mes')) && !mes) {
                const textoCompleto = String(cell.v);
                const matchMes = textoCompleto.match(/m[êe]s\s*:?\s*(\d+)/i);
                if (matchMes) {
                  mes = Number(matchMes[1]);
                } else {
                  // Verificar próxima célula
                  const nextCell = worksheet[XLSX.utils.encode_cell({ r: row, c: col + 1 })];
                  if (nextCell && nextCell.v) {
                    const mesValor = Number(nextCell.v);
                    if (mesValor >= 1 && mesValor <= 12) {
                      mes = mesValor;
                    }
                  }
                }
              }
              
              // Procurar por "ano"
              if (valor.includes('ano') && !ano) {
                const textoCompleto = String(cell.v);
                const matchAno = textoCompleto.match(/ano\s*:?\s*(\d{4})/i);
                if (matchAno) {
                  ano = Number(matchAno[1]);
                } else {
                  // Verificar próxima célula
                  const nextCell = worksheet[XLSX.utils.encode_cell({ r: row, c: col + 1 })];
                  if (nextCell && nextCell.v) {
                    const anoValor = Number(nextCell.v);
                    if (anoValor >= 2000 && anoValor <= 2100) {
                      ano = anoValor;
                    }
                  }
                }
              }
              
              // Procurar linha de cabeçalho (MATRIZ, NOVILHA, VACA, etc)
              const palavrasChave = ['matriz', 'novilha', 'vaca', 'sexo', 'raça', 'raza', 'brinco', 'peso', 'data', 'obs', 'observação'];
              if (palavrasChave.some(palavra => valor.includes(palavra)) && primeiraLinhaDados === 0) {
                primeiraLinhaDados = row + 1; // Próxima linha será a primeira com dados
              }
            }
          }
        }
        
        // Converter para JSON (começando da linha de cabeçalho ou primeira linha)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          raw: false,
          defval: '',
          header: primeiraLinhaDados > 0 ? primeiraLinhaDados - 1 : 0 // Usar linha anterior como header
        });
        
        resolve({
          dados: jsonData,
          fazenda,
          mes,
          ano,
          primeiraLinha: primeiraLinhaDados || 1
        });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
    
    // Ler como binário para Excel, texto para CSV
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsBinaryString(file);
    }
  });
}

/**
 * Normaliza o nome de uma coluna (remove acentos, espaços, etc)
 */
function normalizarNomeColuna(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Detecta automaticamente o mapeamento de colunas baseado nos nomes
 */
export function detectarMapeamento(colunas: string[]): MapeamentoColunas {
  const mapeamento: MapeamentoColunas = {};
  
  const padroes: Record<string, string[]> = {
    matrizId: ['matriz', 'matriz_id', 'numero_matriz', 'matrizid', 'id_matriz', 'matrizes'],
    fazenda: ['fazenda', 'fazenda_nome', 'nome_fazenda', 'propriedade'],
    mes: ['mes', 'mês', 'month'],
    ano: ['ano', 'year', 'anho'],
    novilha: ['novilha', 'novilhas', 'novilha_x'],
    vaca: ['vaca', 'vacas', 'cow', 'vaca_x'],
    brincoNumero: ['brinco', 'numero_brinco', 'brinco_numero', 'numero_brinco', 'brinco_num', 'num_brinco', 'número_brinco', 'número brinco'],
    dataNascimento: ['data_nascimento', 'data_nasc', 'nascimento', 'data', 'dt_nascimento', 'dt_nasc', 'data nascimento'],
    sexo: ['sexo', 'gender', 'genero'],
    raca: ['raca', 'raça', 'breed', 'raza', 'raças'],
    obs: ['obs', 'observacao', 'observação', 'observacoes', 'observações', 'notas', 'notes', 'comentarios', 'comentários', 'obs:', 'observações:']
  };
  
  colunas.forEach(coluna => {
    const normalizada = normalizarNomeColuna(coluna);
    
    for (const [campo, variantes] of Object.entries(padroes)) {
      if (variantes.some(v => normalizada.includes(v) || normalizada === v)) {
        mapeamento[campo as keyof MapeamentoColunas] = coluna;
        break;
      }
    }
  });
  
  return mapeamento;
}

/**
 * Valida e processa uma linha da planilha
 */
function processarLinha(
  linha: any, 
  linhaNum: number, 
  mapeamento: MapeamentoColunas,
  fazendas: Array<{ id: string; nome: string }>,
  fazendaPadraoId?: string
): { dados: Partial<Nascimento>; erros: string[] } {
  const erros: string[] = [];
  const dados: Partial<Nascimento> = {};
  
  // Matriz (obrigatório)
  const matrizValor = mapeamento.matrizId ? linha[mapeamento.matrizId] : '';
  if (!matrizValor || String(matrizValor).trim() === '') {
    erros.push('Matriz não informada');
  } else {
    dados.matrizId = String(matrizValor).trim();
  }
  
  // Fazenda
  if (mapeamento.fazenda) {
    const fazendaNome = String(linha[mapeamento.fazenda] || '').trim();
    if (fazendaNome) {
      const fazenda = fazendas.find(f => 
        f.nome.toLowerCase() === fazendaNome.toLowerCase()
      );
      if (fazenda) {
        dados.fazendaId = fazenda.id;
      } else {
        erros.push(`Fazenda "${fazendaNome}" não encontrada`);
        if (fazendaPadraoId) {
          dados.fazendaId = fazendaPadraoId;
        }
      }
    } else if (fazendaPadraoId) {
      dados.fazendaId = fazendaPadraoId;
    } else {
      erros.push('Fazenda não informada');
    }
  } else if (fazendaPadraoId) {
    dados.fazendaId = fazendaPadraoId;
  } else {
    erros.push('Fazenda não informada');
  }
  
  // Mês
  if (mapeamento.mes) {
    const mesValor = linha[mapeamento.mes];
    if (mesValor) {
      const mes = Number(mesValor);
      if (mes >= 1 && mes <= 12) {
        dados.mes = mes;
      } else {
        erros.push(`Mês inválido: ${mesValor}`);
      }
    }
  }
  
  // Ano
  if (mapeamento.ano) {
    const anoValor = linha[mapeamento.ano];
    if (anoValor) {
      const ano = Number(anoValor);
      if (ano >= 2000 && ano <= 2100) {
        dados.ano = ano;
      } else {
        erros.push(`Ano inválido: ${anoValor}`);
      }
    }
  }
  
  // Tipo (Novilha/Vaca)
  if (mapeamento.novilha) {
    const novilhaValor = String(linha[mapeamento.novilha] || '').toLowerCase().trim();
    dados.novilha = novilhaValor === 'x' || novilhaValor === 'sim' || novilhaValor === 's' || novilhaValor === 'true' || novilhaValor === '1';
  }
  
  if (mapeamento.vaca) {
    const vacaValor = String(linha[mapeamento.vaca] || '').toLowerCase().trim();
    dados.vaca = vacaValor === 'x' || vacaValor === 'sim' || vacaValor === 's' || vacaValor === 'true' || vacaValor === '1';
  }
  
  // Se não tem tipo definido, marcar como erro
  if (!dados.novilha && !dados.vaca) {
    erros.push('Tipo não informado (Novilha ou Vaca)');
  }
  
  // Brinco
  if (mapeamento.brincoNumero) {
    const brinco = String(linha[mapeamento.brincoNumero] || '').trim();
    if (brinco) {
      dados.brincoNumero = brinco;
    }
  }
  
  // Data de Nascimento
  if (mapeamento.dataNascimento) {
    const dataValor = linha[mapeamento.dataNascimento];
    if (dataValor) {
      try {
        // Tentar parsear a data em vários formatos
        let data: Date | null = null;
        if (dataValor instanceof Date) {
          data = dataValor;
        } else if (typeof dataValor === 'number') {
          // Excel serial date
          try {
            const excelDate = XLSX.SSF.parse_date_code(dataValor);
            if (excelDate) {
              data = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
            }
          } catch (e) {
            // Se não conseguir parsear como Excel date, tentar como timestamp
            data = new Date((dataValor - 25569) * 86400 * 1000); // Excel epoch
          }
        } else {
          const dataStr = String(dataValor).trim();
          if (dataStr) {
            // Tentar formatos comuns: DD/MM/YYYY, YYYY-MM-DD, etc
            if (dataStr.includes('/')) {
              const partes = dataStr.split('/');
              if (partes.length === 3) {
                const [dia, mes, ano] = partes;
                data = new Date(Number(ano), Number(mes) - 1, Number(dia));
              }
            } else if (dataStr.includes('-')) {
              data = new Date(dataStr);
            } else {
              data = new Date(dataValor);
            }
          }
        }
        
        if (data && !isNaN(data.getTime())) {
          dados.dataNascimento = data.toISOString().split('T')[0];
        }
      } catch (e) {
        // Ignorar erro de parse de data
      }
    }
  }
  
  // Sexo
  if (mapeamento.sexo) {
    const sexoValor = String(linha[mapeamento.sexo] || '').toUpperCase().trim();
    if (sexoValor === 'M' || sexoValor === 'MACHO' || sexoValor === 'MALE') {
      dados.sexo = 'M';
    } else if (sexoValor === 'F' || sexoValor === 'FÊMEA' || sexoValor === 'FEMEA' || sexoValor === 'FEMALE') {
      dados.sexo = 'F';
    }
  }
  
  // Raça
  if (mapeamento.raca) {
    const raca = String(linha[mapeamento.raca] || '').trim();
    if (raca) {
      dados.raca = raca.toUpperCase();
    }
  }
  
  // Observações
  if (mapeamento.obs) {
    const obs = String(linha[mapeamento.obs] || '').trim();
    if (obs) {
      dados.obs = obs;
    }
  }
  
  return { dados, erros };
}

/**
 * Importa os dados da planilha para o banco
 */
export async function importarNascimentos(
  dados: any[],
  mapeamento: MapeamentoColunas,
  fazendaPadraoId?: string,
  mesPadrao?: number,
  anoPadrao?: number
): Promise<{ sucesso: number; erros: LinhaImportacao[] }> {
  const fazendas = await db.fazendas.toArray();
  const sucesso: number[] = [];
  const erros: LinhaImportacao[] = [];
  
  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];
    const linhaNum = i + 2; // +2 porque linha 1 é cabeçalho e arrays começam em 0
    
    const { dados: dadosProcessados, erros: errosLinha } = processarLinha(
      linha,
      linhaNum,
      mapeamento,
      fazendas,
      fazendaPadraoId
    );
    
    // Se tem erros críticos (matriz, fazenda, tipo), não importa
    const errosCriticos = errosLinha.filter(e => 
      e.includes('Matriz') || e.includes('Fazenda') || e.includes('Tipo')
    );
    
    if (errosCriticos.length > 0) {
      erros.push({
        dados: linha,
        linha: linhaNum,
        erros: errosLinha
      });
      continue;
    }
    
    // Se não tem mês/ano, usar valores padrão (do cabeçalho ou atual)
    if (!dadosProcessados.mes) {
      dadosProcessados.mes = mesPadrao || new Date().getMonth() + 1;
    }
    if (!dadosProcessados.ano) {
      dadosProcessados.ano = anoPadrao || new Date().getFullYear();
    }
    
    try {
      const id = uuid();
      const now = new Date().toISOString();
      
      await db.nascimentos.add({
        ...dadosProcessados,
        id,
        createdAt: now,
        updatedAt: now,
        synced: false,
        novilha: dadosProcessados.novilha || false,
        vaca: dadosProcessados.vaca || false
      } as Nascimento);
      
      sucesso.push(linhaNum);
    } catch (error: any) {
      erros.push({
        dados: linha,
        linha: linhaNum,
        erros: [...errosLinha, `Erro ao salvar: ${error.message || error}`]
      });
    }
  }
  
  return {
    sucesso: sucesso.length,
    erros
  };
}

