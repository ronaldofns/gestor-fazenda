import { useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/dexieDB';
import { Icons } from '../utils/iconMapping';
import MatrizModal from '../components/MatrizModal';
import HistoricoAlteracoes from '../components/HistoricoAlteracoes';
import ArvoreGenealogica from '../components/ArvoreGenealogica';
import { Matriz } from '../db/models';
import { ComboboxOption } from '../components/Combobox';

type SortField = 'matriz' | 'fazenda' | 'partos' | 'vivos' | 'mortos' | 'ultimoParto' | 'mediaPeso';

const ITENS_POR_PAGINA = 20;

interface MatrizResumo {
  matrizId: string;
  fazendaId: string;
  fazenda: string;
  totalPartos: number;
  vivos: number;
  mortos: number;
  ultimoParto?: string;
  mediaPesoDesmama: number;
}

export default function Matrizes() {
  const navigate = useNavigate();
  const nascimentosRaw = useLiveQuery(() => db.nascimentos.toArray(), []) || [];
  const desmamas = useLiveQuery(() => db.desmamas.toArray(), []) || [];
  const fazendas = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const matrizesCadastradas = useLiveQuery(() => db.matrizes.toArray(), []) || [];

  const [busca, setBusca] = useState('');
  const [sortField, setSortField] = useState<SortField>('matriz');
  const [sortAsc, setSortAsc] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(1);
  
  // Estados do modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [matrizEditando, setMatrizEditando] = useState<Matriz | null>(null);
  const [defaultIdentificador, setDefaultIdentificador] = useState<string>('');
  const [defaultFazendaId, setDefaultFazendaId] = useState<string>('');
  
  // Estados do histórico
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoEntityId, setHistoricoEntityId] = useState<string | null>(null);
  
  // Estados da árvore genealógica
  const [arvoreOpen, setArvoreOpen] = useState(false);
  const [arvoreMatrizId, setArvoreMatrizId] = useState<string | null>(null);

  const fazendaMap = useMemo(() => {
    const map = new Map<string, string>();
    fazendas.forEach((f) => {
      if (f.id) map.set(f.id, f.nome || '');
    });
    return map;
  }, [fazendas]);

  const desmamaMap = useMemo(() => {
    const map = new Map<string, { nascimentoId: string; pesoDesmama?: number }>();
    desmamas.forEach((d) => {
      if (d.nascimentoId) {
        map.set(d.nascimentoId, { nascimentoId: d.nascimentoId, pesoDesmama: d.pesoDesmama });
      }
    });
    return map;
  }, [desmamas]);

  // Mapa de matrizes: por ID (UUID) e por identificador
  const matrizMap = useMemo(() => {
    const mapById = new Map<string, Matriz>();
    const mapByIdentificador = new Map<string, Matriz>();
    // Mapa adicional: por identificador apenas (para busca mais ampla)
    const mapByIdentificadorApenas = new Map<string, Matriz[]>();
    
    matrizesCadastradas.forEach((m) => {
      if (m.id) {
        mapById.set(m.id, m);
      }
      if (m.identificador && m.fazendaId) {
        // Chave composta: identificador + fazendaId
        mapByIdentificador.set(`${m.identificador}|${m.fazendaId}`, m);
      }
      if (m.identificador) {
        // Mapa por identificador apenas (pode ter múltiplas matrizes com mesmo identificador em fazendas diferentes)
        if (!mapByIdentificadorApenas.has(m.identificador)) {
          mapByIdentificadorApenas.set(m.identificador, []);
        }
        mapByIdentificadorApenas.get(m.identificador)!.push(m);
      }
    });
    
    return { byId: mapById, byIdentificador: mapByIdentificador, byIdentificadorApenas: mapByIdentificadorApenas };
  }, [matrizesCadastradas]);

  const parseDate = (value?: string) => {
    if (!value) return null;
    if (value.includes('/')) {
      const [dia, mes, ano] = value.split('/');
      if (dia && mes && ano) {
        const iso = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        const dParsed = new Date(iso);
        if (!isNaN(dParsed.getTime())) return dParsed;
      }
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  };

  const matrizes = useMemo<MatrizResumo[]>(() => {
    if (!Array.isArray(nascimentosRaw) || nascimentosRaw.length === 0) return [];

    const porMatriz = new Map<string, MatrizResumo & { somaPeso: number; countPeso: number; ultimoDate?: Date }>();

    for (const n of nascimentosRaw) {
      if (!n.matrizId) continue;
      
      // Buscar matriz cadastrada: primeiro por ID (UUID), depois por identificador
      let matrizCadastrada = matrizMap.byId.get(n.matrizId);
      if (!matrizCadastrada && n.fazendaId) {
        // Tentar buscar por identificador + fazendaId (caso o matrizId seja o identificador)
        matrizCadastrada = matrizMap.byIdentificador.get(`${n.matrizId}|${n.fazendaId}`);
      }
      
      // Se não encontrou, tentar buscar todas as matrizes que podem corresponder
      // (pode ser que o matrizId seja UUID mas a matriz ainda não esteja no mapa)
      if (!matrizCadastrada) {
        // Buscar por identificador igual ao matrizId (caso o matrizId seja o identificador)
        const encontradas = matrizesCadastradas.filter(
          (m) => m.identificador === n.matrizId && m.fazendaId === n.fazendaId
        );
        if (encontradas.length > 0) {
          matrizCadastrada = encontradas[0];
        }
      }
      
      // Se ainda não encontrou e o matrizId parece ser um UUID, buscar todas as matrizes
      // que podem ter esse UUID como ID (pode ser que o mapa não tenha sido atualizado ainda)
      if (!matrizCadastrada) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(n.matrizId);
        if (isUUID) {
          // Buscar diretamente no array por ID
          const encontradaPorId = matrizesCadastradas.find((m) => m.id === n.matrizId);
          if (encontradaPorId) {
            matrizCadastrada = encontradaPorId;
          }
        } else {
          // Se não é UUID, pode ser que seja o identificador
          // Buscar no mapa por identificador apenas (sem fazenda)
          const matrizesComIdentificador = matrizMap.byIdentificadorApenas.get(n.matrizId);
          if (matrizesComIdentificador && matrizesComIdentificador.length > 0) {
            // Se há múltiplas, usar a que corresponde à fazenda do nascimento
            if (n.fazendaId) {
              const encontradaPorFazenda = matrizesComIdentificador.find((m) => m.fazendaId === n.fazendaId);
              if (encontradaPorFazenda) {
                matrizCadastrada = encontradaPorFazenda;
              } else if (matrizesComIdentificador.length === 1) {
                // Se há apenas uma matriz com esse identificador, usar ela
                matrizCadastrada = matrizesComIdentificador[0];
              }
            } else if (matrizesComIdentificador.length === 1) {
              // Se há apenas uma matriz com esse identificador, usar ela
              matrizCadastrada = matrizesComIdentificador[0];
            }
          }
        }
      }
      
      // Usar identificador da matriz cadastrada, ou o matrizId do nascimento como fallback
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(n.matrizId);
      let identificadorMatriz: string;
      
      if (matrizCadastrada) {
        // Matriz encontrada: usar o identificador dela
        identificadorMatriz = matrizCadastrada.identificador || n.matrizId;
      } else if (isUUID) {
        // É UUID mas não encontramos a matriz cadastrada
        // Usar o próprio UUID como identificador único para não agrupar incorretamente
        // Isso permite que cada matriz tenha sua própria entrada até que seja encontrada
        identificadorMatriz = n.matrizId;
      } else {
        // Não é UUID, usar diretamente como identificador
        identificadorMatriz = n.matrizId;
      }
      
      // Chave única: identificador + fazendaId (para diferenciar matrizes com mesmo identificador em fazendas diferentes)
      // IMPORTANTE: Se o identificadorMatriz for um UUID, cada UUID será uma chave única
      const chave = `${identificadorMatriz}|${n.fazendaId}`;
      const fazendaNome = fazendaMap.get(n.fazendaId) || 'Sem fazenda';
      const existente = porMatriz.get(chave) || {
        matrizId: identificadorMatriz,
        fazendaId: n.fazendaId,
        fazenda: fazendaNome,
        totalPartos: 0,
        vivos: 0,
        mortos: 0,
        ultimoParto: undefined,
        mediaPesoDesmama: 0,
        somaPeso: 0,
        countPeso: 0,
        ultimoDate: undefined,
      };

      existente.totalPartos += 1;
      if (n.morto) {
        existente.mortos += 1;
      } else {
        existente.vivos += 1;
      }

      const dataNasc = parseDate(n.dataNascimento) || parseDate(n.createdAt);
      if (dataNasc) {
        if (!existente.ultimoDate || dataNasc > existente.ultimoDate) {
          existente.ultimoDate = dataNasc;
          existente.ultimoParto = dataNasc.toLocaleDateString('pt-BR');
          existente.fazenda = fazendaNome;
          existente.fazendaId = n.fazendaId;
        }
      }

      const desmama = desmamaMap.get(n.id);
      if (desmama?.pesoDesmama && desmama.pesoDesmama > 0) {
        existente.somaPeso += desmama.pesoDesmama;
        existente.countPeso += 1;
      }

      porMatriz.set(chave, existente);
    }

    return Array.from(porMatriz.values()).map((m) => ({
      matrizId: m.matrizId,
      fazendaId: m.fazendaId,
      fazenda: m.fazenda,
      totalPartos: m.totalPartos,
      vivos: m.vivos,
      mortos: m.mortos,
      ultimoParto: m.ultimoParto,
      mediaPesoDesmama: m.countPeso > 0 ? m.somaPeso / m.countPeso : 0,
    }));
  }, [nascimentosRaw, fazendaMap, desmamaMap, matrizMap]);

  const matrizesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let lista = matrizes;

    if (termo) {
      lista = lista.filter((m) => {
        const mId = m.matrizId.toLowerCase();
        const faz = m.fazenda.toLowerCase();
        return mId.includes(termo) || faz.includes(termo);
      });
    }

    const sorted = [...lista].sort((a, b) => {
      let comp = 0;
      switch (sortField) {
        case 'matriz':
          comp = a.matrizId.localeCompare(b.matrizId);
          break;
        case 'fazenda':
          comp = a.fazenda.localeCompare(b.fazenda);
          break;
        case 'partos':
          comp = a.totalPartos - b.totalPartos;
          break;
        case 'vivos':
          comp = a.vivos - b.vivos;
          break;
        case 'mortos':
          comp = a.mortos - b.mortos;
          break;
        case 'mediaPeso':
          comp = a.mediaPesoDesmama - b.mediaPesoDesmama;
          break;
        case 'ultimoParto':
          if (!a.ultimoParto && !b.ultimoParto) comp = 0;
          else if (!a.ultimoParto) comp = -1;
          else if (!b.ultimoParto) comp = 1;
          else comp = a.ultimoParto.localeCompare(b.ultimoParto);
          break;
        default:
          comp = 0;
      }
      return sortAsc ? comp : -comp;
    });

    return sorted;
  }, [matrizes, busca, sortField, sortAsc]);

  const totalPaginas = useMemo(() => {
    if (matrizesFiltradas.length === 0) return 1;
    return Math.max(1, Math.ceil(matrizesFiltradas.length / ITENS_POR_PAGINA));
  }, [matrizesFiltradas.length]);

  const inicio = useMemo(() => {
    return (paginaAtual - 1) * ITENS_POR_PAGINA;
  }, [paginaAtual]);

  const fim = useMemo(() => inicio + ITENS_POR_PAGINA, [inicio]);

  const matrizesPagina = useMemo(() => {
    return matrizesFiltradas.slice(inicio, fim);
  }, [matrizesFiltradas, inicio, fim]);

  useEffect(() => {
    if (paginaAtual > totalPaginas) {
      setPaginaAtual(totalPaginas);
    }
  }, [paginaAtual, totalPaginas]);

  const toggleSort = (field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortAsc((asc) => !asc);
        return prev;
      }
      setSortAsc(field === 'matriz' || field === 'fazenda'); // texto asc por padrão, numérico desc
      return field;
    });
  };

  // Preparar opções de fazenda para o Combobox
  const fazendaOptions: ComboboxOption[] = useMemo(() => {
    return fazendas
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
      .map((f) => ({
        label: f.nome || '',
        value: f.id || ''
      }));
  }, [fazendas]);

  // Funções para abrir o modal
  const handleNovaMatriz = (identificador?: string, fazendaId?: string) => {
    setDefaultIdentificador(identificador || '');
    setDefaultFazendaId(fazendaId || '');
    setMatrizEditando(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEditarMatriz = async (matrizId: string) => {
    const matriz = matrizesCadastradas.find((m) => m.id === matrizId);
    if (matriz) {
      setMatrizEditando(matriz);
      setDefaultIdentificador('');
      setDefaultFazendaId('');
      setModalMode('edit');
      setModalOpen(true);
    } else {
      // Se não encontrou na lista de cadastradas, buscar no banco
      const matrizFromDb = await db.matrizes.get(matrizId);
      if (matrizFromDb) {
        setMatrizEditando(matrizFromDb);
        setDefaultIdentificador('');
        setDefaultFazendaId('');
        setModalMode('edit');
        setModalOpen(true);
      }
    }
  };

  const handleFecharModal = () => {
    setModalOpen(false);
    setMatrizEditando(null);
    setDefaultIdentificador('');
    setDefaultFazendaId('');
  };

  return (
    <div className="p-4 sm:p-6 text-gray-900 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold">Matrizes</h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-400">
            Visão geral de performance por matriz (partos, mortalidade e peso de desmama).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/planilha')}
            className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-200 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <span>Ir para planilha</span>
            <Icons.ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleNovaMatriz()}
            className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Icons.Plus className="w-4 h-4" />
            <span>Nova matriz</span>
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="max-w-sm">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Buscar por matriz ou fazenda
          </label>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex: 123, Fazenda Boa Vista..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-md shadow-sm text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 shadow-sm rounded-lg overflow-hidden">
        {matrizesFiltradas.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Nenhuma matriz encontrado. Cadastre nascimentos na planilha para ver esta visão.
          </div>
        ) : (
          <>
            {/* Tabela Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800 text-xs sm:text-sm">
                <thead className="bg-gray-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort('matriz')}
                        className="inline-flex items-center gap-1"
                      >
                        Matriz
                        <Icons.ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort('fazenda')}
                        className="inline-flex items-center gap-1"
                      >
                        Fazenda
                        <Icons.ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-2 py-2 text-center font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort('partos')}
                        className="inline-flex items-center gap-1"
                      >
                        Partos
                        <Icons.ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-2 py-2 text-center font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort('vivos')}
                        className="inline-flex items-center gap-1"
                      >
                        Vivos
                        <Icons.ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-2 py-2 text-center font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort('mortos')}
                        className="inline-flex items-center gap-1"
                      >
                        Mortos
                        <Icons.ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort('ultimoParto')}
                        className="inline-flex items-center gap-1"
                      >
                        Último parto
                        <Icons.ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      <button
                        type="button"
                        onClick={() => toggleSort('mediaPeso')}
                        className="inline-flex items-center gap-1"
                      >
                        Média peso desmama (kg)
                        <Icons.ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                  {matrizesPagina.map((m) => (
                    <tr key={m.matrizId} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900 dark:text-slate-100">
                        {m.matrizId}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-slate-200">
                        {m.fazenda}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {m.totalPartos}
                      </td>
                      <td className="px-2 py-2 text-center text-green-700">
                        {m.vivos}
                      </td>
                      <td className="px-2 py-2 text-center text-red-700">
                        {m.mortos}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {m.ultimoParto || '-'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {m.mediaPesoDesmama > 0 ? m.mediaPesoDesmama.toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/planilha?fazenda=${encodeURIComponent(
                                m.fazendaId
                              )}&matrizBrinco=${encodeURIComponent(m.matrizId)}`
                            )
                          }
                          className="inline-flex items-center justify-center p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md"
                          title="Ver na planilha"
                        >
                          <Icons.FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // Buscar matriz cadastrada pelo identificador + fazendaId
                            const matrizCadastrada = matrizMap.byIdentificador.get(`${m.matrizId}|${m.fazendaId}`);
                            if (matrizCadastrada) {
                              handleEditarMatriz(matrizCadastrada.id);
                            } else {
                              // Se não encontrou, abre modal de criação com dados pré-preenchidos
                              handleNovaMatriz(m.matrizId, m.fazendaId);
                            }
                          }}
                          className="inline-flex items-center justify-center p-1.5 text-gray-700 dark:text-slate-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md"
                          title="Abrir cadastro da matriz"
                        >
                          <Icons.FilePenLine className="w-4 h-4" />
                        </button>
                        {matrizMap.byIdentificador.has(`${m.matrizId}|${m.fazendaId}`) && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const matrizCadastrada = matrizMap.byIdentificador.get(`${m.matrizId}|${m.fazendaId}`);
                                if (matrizCadastrada) {
                                  setArvoreMatrizId(matrizCadastrada.id);
                                  setArvoreOpen(true);
                                }
                              }}
                              className="inline-flex items-center justify-center p-1.5 text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md ml-1"
                              title="Ver árvore genealógica"
                            >
                              <Icons.ListTree className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const matrizCadastrada = matrizMap.byIdentificador.get(`${m.matrizId}|${m.fazendaId}`);
                                if (matrizCadastrada) {
                                  setHistoricoEntityId(matrizCadastrada.id);
                                  setHistoricoOpen(true);
                                }
                              }}
                              className="inline-flex items-center justify-center p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md ml-1"
                              title="Ver histórico de alterações"
                            >
                              <Icons.History className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lista em cards para mobile */}
            <div className="md:hidden space-y-3">
              {matrizesPagina.map((m) => (
                <div
                  key={m.matrizId}
                  className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                        Matriz {m.matrizId}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {m.fazenda}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/planilha?fazenda=${encodeURIComponent(
                              m.fazendaId
                            )}&matrizBrinco=${encodeURIComponent(m.matrizId)}`
                          )
                        }
                        className="inline-flex items-center justify-center p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md"
                        title="Ver na planilha"
                      >
                        <Icons.FileSpreadsheet className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Buscar matriz cadastrada pelo identificador + fazendaId
                          const matrizCadastrada = matrizMap.byIdentificador.get(`${m.matrizId}|${m.fazendaId}`);
                          if (matrizCadastrada) {
                            handleEditarMatriz(matrizCadastrada.id);
                          } else {
                            // Se não encontrou, abre modal de criação com dados pré-preenchidos
                            handleNovaMatriz(m.matrizId, m.fazendaId);
                          }
                        }}
                        className="inline-flex items-center justify-center p-1.5 text-gray-700 dark:text-slate-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md"
                        title="Abrir cadastro da matriz"
                      >
                        <Icons.FilePenLine className="w-4 h-4" />
                      </button>
                      {matrizMap.byIdentificador.has(`${m.matrizId}|${m.fazendaId}`) ? (
                        <button
                          type="button"
                          onClick={() => {
                            const matrizCadastrada = matrizMap.byIdentificador.get(`${m.matrizId}|${m.fazendaId}`);
                            if (matrizCadastrada) {
                              setArvoreMatrizId(matrizCadastrada.id);
                              setArvoreOpen(true);
                            }
                          }}
                          className="inline-flex items-center justify-center p-1.5 text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md ml-1"
                          title="Ver árvore genealógica"
                        >
                          <Icons.ListTree className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center p-1.5 text-green-600 dark:text-green-400 opacity-50 cursor-not-allowed rounded-md ml-1"
                          title="Cadastre a matriz primeiro para ver a árvore genealógica"
                          disabled
                        >
                          <Icons.ListTree className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-300 mt-1">
                    <div>
                      <span className="font-semibold">Partos: </span>
                      {m.totalPartos}
                    </div>
                    <div>
                      <span className="font-semibold text-green-700 dark:text-green-400">Vivos: </span>
                      {m.vivos}
                    </div>
                    <div>
                      <span className="font-semibold text-red-700 dark:text-red-400">Mortos: </span>
                      {m.mortos}
                    </div>
                    <div>
                      <span className="font-semibold">Últ. parto: </span>
                      {m.ultimoParto || '-'}
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold">Média peso desmama: </span>
                      {m.mediaPesoDesmama > 0 ? `${m.mediaPesoDesmama.toFixed(2)} kg` : '-'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {matrizesFiltradas.length > ITENS_POR_PAGINA && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 text-xs sm:text-sm">
                <p className="text-gray-600 dark:text-slate-300">
                  Mostrando{' '}
                  <span className="font-semibold">
                    {matrizesFiltradas.length === 0 ? 0 : inicio + 1}
                  </span>{' '}
                  -{' '}
                  <span className="font-semibold">
                    {Math.min(fim, matrizesFiltradas.length)}
                  </span>{' '}
                  de{' '}
                  <span className="font-semibold">{matrizesFiltradas.length}</span> matrizes
                </p>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                    disabled={paginaAtual === 1}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-200 rounded-l-md hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icons.ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                    let paginaNumero;
                    if (totalPaginas <= 5) {
                      paginaNumero = i + 1;
                    } else if (paginaAtual <= 3) {
                      paginaNumero = i + 1;
                    } else if (paginaAtual >= totalPaginas - 2) {
                      paginaNumero = totalPaginas - 4 + i;
                    } else {
                      paginaNumero = paginaAtual - 2 + i;
                    }
                    return (
                      <button
                        key={paginaNumero}
                        type="button"
                        onClick={() => setPaginaAtual(paginaNumero)}
                        className={`inline-flex items-center px-2.5 py-1 border text-xs sm:text-sm ${
                          paginaAtual === paginaNumero
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 border-gray-300 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {paginaNumero}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                    disabled={paginaAtual === totalPaginas}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-200 rounded-r-md hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icons.ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <MatrizModal
        open={modalOpen}
        mode={modalMode}
        fazendaOptions={fazendaOptions}
        defaultIdentificador={defaultIdentificador}
        defaultFazendaId={defaultFazendaId}
        initialData={matrizEditando}
        onClose={handleFecharModal}
        onSaved={() => {
          // Recarregar dados se necessário
        }}
      />

      {/* Modal Histórico de Alterações */}
      {historicoEntityId && (
        <HistoricoAlteracoes
          open={historicoOpen}
          entity="matriz"
          entityId={historicoEntityId}
          entityNome={matrizesCadastradas.find(m => m.id === historicoEntityId)?.identificador}
          onClose={() => {
            setHistoricoOpen(false);
            setHistoricoEntityId(null);
          }}
          onRestored={() => {
            // Dados serão atualizados automaticamente pelo useLiveQuery
          }}
        />
      )}

      {/* Modal Árvore Genealógica */}
      {arvoreMatrizId && (
        <ArvoreGenealogica
          open={arvoreOpen}
          matrizId={arvoreMatrizId}
          onClose={() => {
            setArvoreOpen(false);
            setArvoreMatrizId(null);
          }}
          onMatrizSelecionada={(novaMatrizId) => {
            setArvoreMatrizId(novaMatrizId);
            setArvoreOpen(true);
          }}
        />
      )}
    </div>
  );
}


