import { useMemo, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db/dexieDB';
import { ArrowUpDown, ChevronRight, Plus, ChevronLeft, FileSpreadsheet, FilePenLine } from 'lucide-react';

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

  const [busca, setBusca] = useState('');
  const [sortField, setSortField] = useState<SortField>('matriz');
  const [sortAsc, setSortAsc] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(1);

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
      const chave = n.matrizId;
      const fazendaNome = fazendaMap.get(n.fazendaId) || 'Sem fazenda';
      const existente = porMatriz.get(chave) || {
        matrizId: chave,
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
  }, [nascimentosRaw, fazendaMap, desmamaMap]);

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

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold">Matrizes</h2>
          <p className="text-xs sm:text-sm text-gray-600">
            Visão geral de performance por matriz (partos, mortalidade e peso de desmama).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/planilha')}
            className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-white border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <span>Ir para planilha</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <Link
            to="/matrizes/nova"
            className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nova matriz</span>
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <div className="max-w-sm">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Buscar por matriz ou fazenda
          </label>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex: 123, Fazenda Boa Vista..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        {matrizesFiltradas.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Nenhuma matriz encontrada. Cadastre nascimentos na planilha para ver esta visão.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => toggleSort('matriz')}
                      className="inline-flex items-center gap-1"
                    >
                      Matriz
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => toggleSort('fazenda')}
                      className="inline-flex items-center gap-1"
                    >
                      Fazenda
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => toggleSort('partos')}
                      className="inline-flex items-center gap-1"
                    >
                      Partos
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => toggleSort('vivos')}
                      className="inline-flex items-center gap-1"
                    >
                      Vivos
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => toggleSort('mortos')}
                      className="inline-flex items-center gap-1"
                    >
                      Mortos
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => toggleSort('ultimoParto')}
                      className="inline-flex items-center gap-1"
                    >
                      Último parto
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => toggleSort('mediaPeso')}
                      className="inline-flex items-center gap-1"
                    >
                      Média peso desmama (kg)
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {matrizesPagina.map((m) => (
                  <tr key={m.matrizId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                      {m.matrizId}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">
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
                        className="inline-flex items-center justify-center p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded-md"
                        title="Ver na planilha"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>
                      <Link
                        to={`/matrizes/nova?identificador=${encodeURIComponent(
                          m.matrizId
                        )}&fazenda=${encodeURIComponent(m.fazendaId)}`}
                        className="inline-flex items-center justify-center p-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md"
                        title="Abrir cadastro da matriz"
                      >
                        <FilePenLine className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {matrizesFiltradas.length > ITENS_POR_PAGINA && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50 text-xs sm:text-sm">
                <p className="text-gray-600">
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
                    className="inline-flex items-center px-2 py-1 border border-gray-300 bg-white text-gray-600 rounded-l-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
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
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
                    className="inline-flex items-center px-2 py-1 border border-gray-300 bg-white text-gray-600 rounded-r-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


