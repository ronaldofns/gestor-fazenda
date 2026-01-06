import * as XLSX from 'xlsx';
import { db } from '../db/dexieDB';
import { uuid } from './uuid';
import { Nascimento } from '../db/models';
import { criarMatrizSeNaoExistir } from './criarMatrizAutomatica';

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
  dataDesmama?: string;
  pesoDesmama?: string;
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
              const palavrasChave = ['matriz', 'novilha', 'vaca', 'sexo', 'raça', 'raza', 'brinco', 'peso', 'data', 'obs', 'observação', 'desmama'];
              if (palavrasChave.some(palavra => valor.includes(palavra)) && primeiraLinhaDados === 0) {
                primeiraLinhaDados = row + 1; // Próxima linha será a primeira com dados
              }
            }
          }
        }
        
        // Converter para JSON (começando da linha de cabeçalho ou primeira linha)
        // raw: true para manter números e datas como estão (será convertido depois)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          raw: true,
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
  
  // IMPORTANTE: Ordem importa! Campos mais específicos primeiro para evitar conflitos
  const padroes: Record<string, string[]> = {
    // Campos de desmama primeiro (mais específicos)
    // Incluir variações com e sem underscore, e garantir que "desmama" esteja presente
    dataDesmama: ['data_desmama', 'data_desm', 'dt_desmama', 'dt_desm', 'data desmama', 'data desm', 'desmama_data', 'desmama data', 'desmama'],
    pesoDesmama: ['peso_desmama', 'peso_desm', 'peso desmama', 'peso desm', 'peso_em_kg_desmama', 'peso_em_kg_desm'],
    // Depois campos de nascimento (mais específicos)
    dataNascimento: ['data_nascimento', 'data_nasc', 'dt_nascimento', 'dt_nasc', 'data nascimento', 'nascimento_data', 'nascimento data'],
    // Campos gerais
    matrizId: ['matriz', 'matriz_id', 'numero_matriz', 'matrizid', 'id_matriz', 'matrizes'],
    fazenda: ['fazenda', 'fazenda_nome', 'nome_fazenda', 'propriedade'],
    mes: ['mes', 'mês', 'month', 'mes_', 'mes '],
    ano: ['ano', 'year', 'anho', 'ano_', 'ano '],
    novilha: ['novilha', 'novilhas', 'novilha_x'],
    vaca: ['vaca', 'vacas', 'cow', 'vaca_x'],
    brincoNumero: ['brinco', 'numero_brinco', 'brinco_numero', 'numero_brinco', 'brinco_num', 'num_brinco', 'número_brinco', 'número brinco'],
    sexo: ['sexo', 'gender', 'genero'],
    raca: ['raca', 'raça', 'breed', 'raza', 'raças'],
    obs: ['obs', 'observacao', 'observação', 'observacoes', 'observações', 'notas', 'notes', 'comentarios', 'comentários', 'obs:', 'observações:']
  };
  
  colunas.forEach(coluna => {
    const normalizada = normalizarNomeColuna(coluna);
    
    // Verificar cada padrão na ordem definida (mais específicos primeiro)
    for (const [campo, variantes] of Object.entries(padroes)) {
      // Verificar se já foi mapeado (evitar sobrescrever com padrão menos específico)
      if (mapeamento[campo as keyof MapeamentoColunas]) {
        continue;
      }
      
      // Verificar se alguma variante corresponde
      const corresponde = variantes.some(v => {
        const vNormalizado = normalizarNomeColuna(v);
        // Match exato
        if (normalizada === vNormalizado) {
          return true;
        }
        
        // Match parcial com validações específicas para evitar conflitos
        // Para campos de desmama, garantir que não seja confundido com nascimento
        if (campo === 'dataDesmama') {
          // Deve conter "desmama" ou "desm" E não deve conter "peso" (para não confundir com pesoDesmama)
          if ((normalizada.includes('desmama') || normalizada.includes('desm')) && !normalizada.includes('peso')) {
            if (!normalizada.includes('nascimento') && !normalizada.includes('nasc')) {
              return normalizada.includes(vNormalizado);
            }
          }
          return false;
        }
        
        // Para peso de desmama, garantir que contenha "peso" E "desmama"
        if (campo === 'pesoDesmama') {
          // Deve conter "peso" E ("desmama" ou "desm")
          if (normalizada.includes('peso') && (normalizada.includes('desmama') || normalizada.includes('desm'))) {
            return normalizada.includes(vNormalizado);
          }
          return false;
        }
        
        // Para data de nascimento, garantir que não seja confundido com desmama
        if (campo === 'dataNascimento') {
          // Deve conter "nascimento" ou "nasc" E não deve conter "desmama" ou "desm"
          if (normalizada.includes('nascimento') || normalizada.includes('nasc')) {
            if (!normalizada.includes('desmama') && !normalizada.includes('desm')) {
              return normalizada.includes(vNormalizado);
            }
          }
          return false;
        }
        
        // Para campos simples (mes, ano), verificar se a coluna começa com a variante
        if (campo === 'mes' || campo === 'ano') {
          // Verificar se a coluna normalizada começa com a variante normalizada
          if (normalizada.startsWith(vNormalizado)) {
            return true;
          }
          // Também verificar match parcial se a variante tiver pelo menos 3 caracteres
          if (vNormalizado.length >= 3 && normalizada.includes(vNormalizado)) {
            return true;
          }
          return false;
        }
        
        // Para outros campos, match parcial simples (sem restrições)
        if (vNormalizado.length >= 2 && normalizada.includes(vNormalizado)) {
          return true;
        }
        
        return false;
      });
      
      if (corresponde) {
        mapeamento[campo as keyof MapeamentoColunas] = coluna;
        break; // Uma vez mapeado, não verificar outros padrões para esta coluna
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
): { dados: Partial<Nascimento>; desmama?: { dataDesmama?: string; pesoDesmama?: number }; erros: string[] } {
  const erros: string[] = [];
  const dados: Partial<Nascimento> = {};
  const desmama: { dataDesmama?: string; pesoDesmama?: number } = {};
  
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
            // Tentar formatos comuns: DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD, etc
            if (dataStr.includes('/')) {
              const partes = dataStr.split('/');
              if (partes.length === 3) {
                let [dia, mes, ano] = partes.map(p => p.trim());
                // Se o ano tem 2 dígitos, assumir 2000-2099
                if (ano.length === 2) {
                  const anoNum = Number(ano);
                  // Se for menor que 50, assumir 20XX, senão 19XX (mas isso é raro para datas recentes)
                  ano = anoNum < 50 ? `20${ano}` : `19${ano}`;
                }
                // Validar valores
                const diaNum = Number(dia);
                const mesNum = Number(mes);
                const anoNum = Number(ano);
                if (diaNum >= 1 && diaNum <= 31 && mesNum >= 1 && mesNum <= 12 && anoNum >= 2000 && anoNum <= 2100) {
                  data = new Date(anoNum, mesNum - 1, diaNum);
                  // Validar se a data é válida (ex: não 31/02)
                  if (data.getDate() !== diaNum || data.getMonth() !== mesNum - 1 || data.getFullYear() !== anoNum) {
                    data = null;
                  }
                }
              }
            } else if (dataStr.includes('-')) {
              // Formato YYYY-MM-DD ou DD-MM-YYYY
              const partes = dataStr.split('-');
              if (partes.length === 3) {
                // Se a primeira parte tem 4 dígitos, é YYYY-MM-DD
                if (partes[0].length === 4) {
                  data = new Date(dataStr);
                } else {
                  // DD-MM-YYYY
                  const [dia, mes, ano] = partes.map(p => p.trim());
                  const anoNum = Number(ano);
                  if (anoNum >= 2000 && anoNum <= 2100) {
                    data = new Date(anoNum, Number(mes) - 1, Number(dia));
                  }
                }
              } else {
                data = new Date(dataStr);
              }
            } else {
              // Tentar parsear como número (pode ser serial date do Excel)
              const numValor = Number(dataStr);
              if (!isNaN(numValor) && numValor > 0) {
                // Se for um número pequeno (provavelmente serial date do Excel)
                if (numValor < 100000) {
                  try {
                    const excelDate = XLSX.SSF.parse_date_code(numValor);
                    if (excelDate) {
                      data = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
                    }
                  } catch (e) {
                    // Se não conseguir, tentar como timestamp
                    data = new Date((numValor - 25569) * 86400 * 1000);
                  }
                } else {
                  data = new Date(dataValor);
                }
              } else {
                data = new Date(dataValor);
              }
            }
          }
        }
        
        if (data && !isNaN(data.getTime())) {
          // Validar se a data é razoável (entre 2000 e 2100)
          const ano = data.getFullYear();
          if (ano >= 2000 && ano <= 2100) {
            // Formatar como DD/MM/YYYY (formato usado no sistema)
            const dia = String(data.getDate()).padStart(2, '0');
            const mes = String(data.getMonth() + 1).padStart(2, '0');
            dados.dataNascimento = `${dia}/${mes}/${ano}`;
          }
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
  
  // Data de Desmama
  if (mapeamento.dataDesmama) {
    const dataValor = linha[mapeamento.dataDesmama];
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
            // Tentar formatos comuns: DD/MM/YYYY, DD/MM/YY, YYYY-MM-DD, etc
            if (dataStr.includes('/')) {
              const partes = dataStr.split('/');
              if (partes.length === 3) {
                let [dia, mes, ano] = partes.map(p => p.trim());
                // Se o ano tem 2 dígitos, assumir 2000-2099
                if (ano.length === 2) {
                  const anoNum = Number(ano);
                  // Se for menor que 50, assumir 20XX, senão 19XX (mas isso é raro para datas recentes)
                  ano = anoNum < 50 ? `20${ano}` : `19${ano}`;
                }
                // Validar valores
                const diaNum = Number(dia);
                const mesNum = Number(mes);
                const anoNum = Number(ano);
                if (diaNum >= 1 && diaNum <= 31 && mesNum >= 1 && mesNum <= 12 && anoNum >= 2000 && anoNum <= 2100) {
                  data = new Date(anoNum, mesNum - 1, diaNum);
                  // Validar se a data é válida (ex: não 31/02)
                  if (data.getDate() !== diaNum || data.getMonth() !== mesNum - 1 || data.getFullYear() !== anoNum) {
                    data = null;
                  }
                }
              }
            } else if (dataStr.includes('-')) {
              // Formato YYYY-MM-DD ou DD-MM-YYYY
              const partes = dataStr.split('-');
              if (partes.length === 3) {
                // Se a primeira parte tem 4 dígitos, é YYYY-MM-DD
                if (partes[0].length === 4) {
                  data = new Date(dataStr);
                } else {
                  // DD-MM-YYYY
                  const [dia, mes, ano] = partes.map(p => p.trim());
                  const anoNum = Number(ano);
                  if (anoNum >= 2000 && anoNum <= 2100) {
                    data = new Date(anoNum, Number(mes) - 1, Number(dia));
                  }
                }
              } else {
                data = new Date(dataStr);
              }
            } else {
              // Tentar parsear como número (pode ser serial date do Excel)
              const numValor = Number(dataStr);
              if (!isNaN(numValor) && numValor > 0) {
                // Se for um número pequeno (provavelmente serial date do Excel)
                if (numValor < 100000) {
                  try {
                    const excelDate = XLSX.SSF.parse_date_code(numValor);
                    if (excelDate) {
                      data = new Date(excelDate.y, excelDate.m - 1, excelDate.d);
                    }
                  } catch (e) {
                    // Se não conseguir, tentar como timestamp
                    data = new Date((numValor - 25569) * 86400 * 1000);
                  }
                } else {
                  data = new Date(dataValor);
                }
              } else {
                data = new Date(dataValor);
              }
            }
          }
        }
        
        if (data && !isNaN(data.getTime())) {
          // Validar se a data é razoável (entre 2000 e 2100)
          const ano = data.getFullYear();
          if (ano >= 2000 && ano <= 2100) {
            // Formatar como DD/MM/YYYY (formato usado no sistema)
            const dia = String(data.getDate()).padStart(2, '0');
            const mes = String(data.getMonth() + 1).padStart(2, '0');
            desmama.dataDesmama = `${dia}/${mes}/${ano}`;
          }
        }
      } catch (e) {
        // Ignorar erro de parse de data
      }
    }
  }
  
  // Peso de Desmama
  if (mapeamento.pesoDesmama) {
    const pesoValor = linha[mapeamento.pesoDesmama];
    if (pesoValor) {
      try {
        // Remover caracteres não numéricos (exceto vírgula/ponto para decimal)
        const pesoStr = String(pesoValor).replace(/[^\d,.-]/g, '').replace(',', '.');
        const peso = parseFloat(pesoStr);
        if (!isNaN(peso) && peso > 0) {
          desmama.pesoDesmama = peso;
        }
      } catch (e) {
        // Ignorar erro de parse de peso
      }
    }
  }
  
  return { dados, desmama: (desmama.dataDesmama || desmama.pesoDesmama) ? desmama : undefined, erros };
}

function normalizarBrinco(valor?: string) {
  return (valor || '').trim().toLowerCase();
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
  const jaExistentes = new Set<string>();
  const jaNoArquivo = new Set<string>();

  // Mapear brincos já existentes por fazenda (case-insensitive)
  const nascimentosExistentes = await db.nascimentos.toArray();
  nascimentosExistentes.forEach((n) => {
    const brinco = normalizarBrinco(n.brincoNumero);
    if (brinco && n.fazendaId) {
      jaExistentes.add(`${n.fazendaId}::${brinco}`);
    }
  });
  
  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i];
    const linhaNum = i + 2; // +2 porque linha 1 é cabeçalho e arrays começam em 0
    
    const { dados: dadosProcessados, desmama: dadosDesmama, erros: errosLinha } = processarLinha(
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

    // Se não tem data de nascimento, criar automaticamente como primeiro dia do mês/ano
    if (!dadosProcessados.dataNascimento && dadosProcessados.mes && dadosProcessados.ano) {
      const dia = '01';
      const mes = String(dadosProcessados.mes).padStart(2, '0');
      const ano = String(dadosProcessados.ano);
      dadosProcessados.dataNascimento = `${dia}/${mes}/${ano}`;
    }
    
    // Validar brinco duplicado por fazenda (já existente ou repetido na própria planilha)
    const brincoNormalizado = normalizarBrinco(dadosProcessados.brincoNumero);
    if (brincoNormalizado && dadosProcessados.fazendaId) {
      const chave = `${dadosProcessados.fazendaId}::${brincoNormalizado}`;
      if (jaExistentes.has(chave)) {
        erros.push({
          dados: linha,
          linha: linhaNum,
          erros: [...errosLinha, 'Brinco já cadastrado para esta fazenda.']
        });
        continue;
      }
      if (jaNoArquivo.has(chave)) {
        erros.push({
          dados: linha,
          linha: linhaNum,
          erros: [...errosLinha, 'Brinco duplicado na própria planilha para esta fazenda.']
        });
        continue;
      }
      jaNoArquivo.add(chave);
    }

    try {
      // Criar matriz automaticamente se não existir
      let matrizId = dadosProcessados.matrizId;
      if (matrizId && dadosProcessados.fazendaId) {
        try {
          const tipo = dadosProcessados.novilha ? 'novilha' : 'vaca';
          matrizId = await criarMatrizSeNaoExistir(
            matrizId,
            dadosProcessados.fazendaId,
            tipo,
            dadosProcessados.raca
          );
        } catch (error) {
          console.error('Erro ao criar matriz automaticamente:', error);
          // Continuar mesmo se der erro na criação da matriz
        }
      }

      const id = uuid();
      const now = new Date().toISOString();
      
      await db.nascimentos.add({
        ...dadosProcessados,
        matrizId, // Usar o ID da matriz (pode ser UUID se foi criada)
        id,
        createdAt: now,
        updatedAt: now,
        synced: false,
        novilha: dadosProcessados.novilha || false,
        vaca: dadosProcessados.vaca || false
      } as Nascimento);
      
      // Se há dados de desmama, criar registro de desmama
      if (dadosDesmama && (dadosDesmama.dataDesmama || dadosDesmama.pesoDesmama)) {
        try {
          await db.desmamas.add({
            id: uuid(),
            nascimentoId: id,
            dataDesmama: dadosDesmama.dataDesmama,
            pesoDesmama: dadosDesmama.pesoDesmama,
            createdAt: now,
            updatedAt: now,
            synced: false,
            remoteId: null
          });
        } catch (error) {
          console.error('Erro ao criar desmama:', error);
          // Continuar mesmo se der erro na criação da desmama
        }
      }
      
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

