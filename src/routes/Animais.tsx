import { useState, useMemo, useEffect, useTransition, useRef, lazy, Suspense, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { List } from 'react-window';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { Animal } from '../db/models';
import { Icons } from '../utils/iconMapping';
import { showToast } from '../utils/toast';
import { useAppSettings } from '../hooks/useAppSettings';
import { useFazendaContext } from '../hooks/useFazendaContext';
import { usePermissions } from '../hooks/usePermissions';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getTitleTextClass, getPrimaryActionButtonLightClass, getPrimaryCardClass } from '../utils/themeHelpers';
import { useAllEntityTags } from '../hooks/useAllEntityTags';
import AnimalTags from '../components/AnimalTags';
import SearchInputDebounced from '../components/SearchInputDebounced';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import Combobox from '../components/Combobox';
import TagFilter, { TagFilterMode } from '../components/TagFilter';
import { exportarParaExcel, exportarParaCSV } from '../utils/exportarDados';

// Lazy load de modais pesados (item 13 - otimizações de performance)
const AnimalModal = lazy(() => import('../components/AnimalModal'));
const HistoricoAlteracoes = lazy(() => import('../components/HistoricoAlteracoes'));
const ArvoreGenealogica = lazy(() => import('../components/ArvoreGenealogica'));
const TimelineAnimal = lazy(() => import('../components/TimelineAnimal'));

const OPCOES_ITENS_POR_PAGINA = [10, 20, 50, 100, 200, 500];
const ITENS_POR_PAGINA_PADRAO = 20;
const VIRTUAL_THRESHOLD = 100; // Acima disso, usa lista virtualizada
const ROW_HEIGHT = 52;
const VIRTUAL_LIST_HEIGHT = 400;

type SortField = 'brinco' | 'nome' | 'tipo' | 'status' | 'sexo' | 'raca' | 'fazenda' | 'dataNascimento' | 'createdAt';

type ColumnId = 'brinco' | 'nome' | 'tipo' | 'status' | 'matriz' | 'tipoMatriz' | 'sexo' | 'raca' | 'fazenda' | 'tags' | 'acoes';
const COLUNAS_TABELA: { id: ColumnId; label: string }[] = [
  { id: 'brinco', label: 'Brinco' },
  { id: 'nome', label: 'Nome' },
  { id: 'tipo', label: 'Tipo' },
  { id: 'status', label: 'Status' },
  { id: 'matriz', label: 'Matriz' },
  { id: 'tipoMatriz', label: 'Tipo Matriz' },
  { id: 'sexo', label: 'Sexo' },
  { id: 'raca', label: 'Raça' },
  { id: 'fazenda', label: 'Fazenda' },
  { id: 'tags', label: 'Tags' },
  { id: 'acoes', label: 'Ações' },
];
const VISIBLE_COLUMNS_DEFAULT: Record<ColumnId, boolean> = {
  brinco: true, nome: true, tipo: true, status: true, matriz: true, tipoMatriz: true, sexo: true, raca: true, fazenda: true, tags: true, acoes: true
};

export default function Animais() {
  const [searchParams, setSearchParams] = useSearchParams();
  const animalIdFromUrl = searchParams.get('animalId');
  // Remover useSync daqui - já está sendo chamado em outros lugares (Sidebar, etc.)
  // useSync(); // Comentado para evitar múltiplas sincronizações simultâneas
  const { fazendaAtivaId } = useFazendaContext();
  const { appSettings } = useAppSettings();
  const { hasPermission } = usePermissions();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const podeCadastrarAnimal = hasPermission('cadastrar_animal');
  const podeEditarAnimal = hasPermission('editar_animal');
  const podeExcluirAnimal = hasPermission('excluir_animal');
  const podeExportarDados = hasPermission('exportar_dados');

  // Estados — buscaParaFiltro: valor debounced (vem do SearchInputDebounced), evita re-render do componente inteiro a cada tecla
  const [buscaParaFiltro, setBuscaParaFiltro] = useState('');
  const [filtroSexo, setFiltroSexo] = useState<'' | 'M' | 'F'>('');
  const [filtroTipoId, setFiltroTipoId] = useState('');
  const [filtroStatusId, setFiltroStatusId] = useState('');
  const [filtroRacaId, setFiltroRacaId] = useState('');
  const [filtroMesesNascimento, setFiltroMesesNascimento] = useState<number[]>([]); // Múltipla seleção de meses
  const [menuMesesAberto, setMenuMesesAberto] = useState(false); // Controle do dropdown de meses
  const [filtroAno, setFiltroAno] = useState(''); // Ano de nascimento
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<TagFilterMode>('any');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(ITENS_POR_PAGINA_PADRAO);

  // Modais de detalhes
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoEntityId, setHistoricoEntityId] = useState<string | null>(null);
  const [arvoreOpen, setArvoreOpen] = useState(false);
  const [arvoreAnimalId, setArvoreAnimalId] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineAnimalId, setTimelineAnimalId] = useState<string | null>(null);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [animalEditando, setAnimalEditando] = useState<Animal | null>(null);

  // Confirm Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    onConfirm: () => { }
  });

  // Ref para dropdown de meses
  const menuMesesRef = useRef<HTMLDivElement>(null);
  // Colunas visíveis na tabela
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnId, boolean>>(VISIBLE_COLUMNS_DEFAULT);
  const [colunasPopoverOpen, setColunasPopoverOpen] = useState(false);
  const colunasPopoverRef = useRef<HTMLDivElement>(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  const [filtroSomenteBezerros, setFiltroSomenteBezerros] = useState(false);

  const [isPending, startTransition] = useTransition();

  const handleBuscaChange = useCallback((value: string) => {
    setBuscaParaFiltro(value);
    setPaginaAtual(1); // Ir para a primeira página para ver os resultados mais relevantes
  }, []);

  const handleFiltroSexoChange = useCallback((value: '' | 'M' | 'F') => {
    startTransition(() => {
      setFiltroSexo(value);
      setPaginaAtual(1);
    });
  }, []);

  const handleFiltroTipoChange = useCallback((value: string) => {
    startTransition(() => {
      setFiltroTipoId(value);
      setPaginaAtual(1);
    });
  }, []);

  const handleFiltroStatusChange = useCallback((value: string) => {
    startTransition(() => {
      setFiltroStatusId(value);
      setPaginaAtual(1);
    });
  }, []);

  const handleFiltroRacaChange = useCallback((value: string) => {
    startTransition(() => {
      setFiltroRacaId(value);
      setPaginaAtual(1);
    });
  }, []);

  const handleFiltroAnoChange = useCallback((value: string) => {
    startTransition(() => {
      setFiltroAno(value);
      setPaginaAtual(1);
    });
  }, []);

  const handleFiltroMesesChange = useCallback((meses: number[]) => {
    startTransition(() => {
      setFiltroMesesNascimento(meses);
      setPaginaAtual(1);
    });
  }, []);

  const handleSelectedTagsChange = useCallback((tags: string[]) => {
    startTransition(() => {
      setSelectedTags(tags);
      setPaginaAtual(1);
    });
  }, []);

  const handleTagFilterModeChange = useCallback((mode: TagFilterMode) => {
    startTransition(() => {
      setTagFilterMode(mode);
      setPaginaAtual(1);
    });
  }, []);

  const handleFiltroSomenteBezerrosChange = useCallback((value: boolean) => {
    startTransition(() => {
      setFiltroSomenteBezerros(value);
      setPaginaAtual(1);
    });
  }, []);

  // Função para obter nome do mês
  const nomeMes = (mes: number) => {
    return new Date(2000, mes - 1).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
  };

  /** Converte data de nascimento (dd/mm/yyyy ou yyyy-mm-dd) para Date em horário local. Evita erro de timezone (UTC) que fazia janeiro/2026 não aparecer nos filtros. */
  const parseDataNascimentoLocal = (val: string | null | undefined): Date | null => {
    if (!val || typeof val !== 'string' || !val.trim()) return null;
    const s = val.trim();
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, y = parseInt(parts[2], 10);
        if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
        const date = new Date(y, m, d);
        return isNaN(date.getTime()) ? null : date;
      }
    }
    if (s.includes('-')) {
      const parts = s.split('-');
      if (parts.length >= 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10); // "15" ou "15T00:00:00.000Z" -> 15
        if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
        const date = new Date(y, m, d);
        return isNaN(date.getTime()) ? null : date;
      }
    }
    return null;
  };

  // 🚀 OTIMIZAÇÃO: Carregar todos os animais (paginação é feita na interface)
  // Usar query simples para melhor detecção de mudanças pelo useLiveQuery
  const animaisRawQuery = useLiveQuery(async () => {
    try {
      const todos = await db.animais.toArray();
      return todos || [];
    } catch (error) {
      console.error('Erro ao carregar animais:', error);
      return [];
    }
  }, []);
  const isLoading = animaisRawQuery === undefined;
  const animaisRaw = animaisRawQuery || [];

  // Dados para a linha do tempo do animal (quando timeline está aberta)
  const timelineDataQuery = useLiveQuery(
    async () => {
      if (!timelineAnimalId) return null;
      try {
        const animal = await db.animais.get(timelineAnimalId);
        if (!animal) return null;
        const [desmama, pesagens, vacinacoes, vinculos, ocorrencias, raca] = await Promise.all([
          db.desmamas.where('animalId').equals(timelineAnimalId).first(),
          db.pesagens.where('animalId').equals(timelineAnimalId).toArray(),
          db.vacinacoes.where('animalId').equals(timelineAnimalId).toArray(),
          db.confinamentoAnimais.where('animalId').equals(timelineAnimalId).toArray(),
          db.ocorrenciaAnimais.where('animalId').equals(timelineAnimalId).toArray(),
          animal.racaId ? db.racas.get(animal.racaId) : Promise.resolve(undefined)
        ]);
        const confinamentoVinculos = await Promise.all(
          (vinculos || []).map(async (v) => {
            const conf = await db.confinamentos.get(v.confinamentoId);
            return { vinculo: v, confinamentoNome: conf?.nome ?? 'Confinamento' };
          })
        );
        return {
          animal: {
            id: animal.id,
            brinco: animal.brinco,
            dataNascimento: animal.dataNascimento,
            sexo: animal.sexo,
            raca: raca?.nome ?? undefined
          },
          desmama: desmama ?? undefined,
          pesagens: pesagens ?? [],
          vacinacoes: vacinacoes ?? [],
          confinamentoVinculos,
          ocorrencias: (ocorrencias ?? []).filter((o: { deletedAt?: string | null }) => !o.deletedAt)
        };
      } catch (e) {
        console.error('Erro ao carregar dados da timeline:', e);
        return null;
      }
    },
    [timelineAnimalId]
  );
  const timelineData = timelineDataQuery ?? null;

  // Abrir animal a partir da URL (ex.: /animais?animalId=xxx — vindo de Pendências do Curral)
  useEffect(() => {
    if (!animalIdFromUrl || isLoading || animaisRaw.length === 0) return;
    const animal = animaisRaw.find((a: Animal) => a.id === animalIdFromUrl);
    if (animal) {
      setAnimalEditando(animal);
      setModalMode('edit');
      setModalOpen(true);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('animalId');
        return next;
      }, { replace: true });
    }
  }, [animalIdFromUrl, isLoading, animaisRaw, setSearchParams]);

  // Fechar dropdown de meses ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuMesesRef.current && !menuMesesRef.current.contains(event.target as Node)) {
        setMenuMesesAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fechar popover de colunas ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colunasPopoverRef.current && !colunasPopoverRef.current.contains(event.target as Node)) {
        setColunasPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const fazendas = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const tipos = useLiveQuery(() => db.tiposAnimal.filter(t => !t.deletedAt).toArray(), []) || [];
  const status = useLiveQuery(() => db.statusAnimal.filter(s => !s.deletedAt).toArray(), []) || [];
  const racas = useLiveQuery(() => db.racas.toArray(), []) || [];

  // 🚀 OTIMIZAÇÃO: Tags centralizadas
  const animalTagsMap = useAllEntityTags('animal');

  // Carregar genealogias para obter tipoMatrizId
  const genealogias = useLiveQuery(() => db.genealogias.filter(g => !g.deletedAt).toArray(), []) || [];
  const genealogiaMap = useMemo(() => {
    const map = new Map<string, typeof genealogias[0]>();
    genealogias.forEach(g => {
      if (g.animalId) {
        map.set(g.animalId, g);
      }
    });
    return map;
  }, [genealogias]);

  // 🚀 OTIMIZAÇÃO: Cache de datas de nascimento parseadas
  const dataNascimentoCache = useMemo(() => {
    const cache = new Map<string, Date | null>();
    animaisRaw.forEach(animal => {
      if (animal.dataNascimento && !cache.has(animal.id)) {
        cache.set(animal.id, parseDataNascimentoLocal(animal.dataNascimento));
      }
    });
    return cache;
  }, [animaisRaw]);

  // 🚀 OTIMIZAÇÃO: Memoizar anos disponíveis
  const anosDisponiveis = useMemo(() => {
    const anos = new Set<number>();
    animaisRaw.filter((a) => !a.deletedAt && a.dataNascimento).forEach((a) => {
      const data = dataNascimentoCache.get(a.id);
      if (data) anos.add(data.getFullYear());
    });
    return Array.from(anos).sort((a, b) => b - a).map((ano) => ({ label: ano.toString(), value: ano.toString() }));
  }, [animaisRaw, dataNascimentoCache]);

  // Maps para lookup rápido
  const fazendaMap = useMemo(() => {
    const map = new Map<string, string>();
    fazendas.forEach(f => map.set(f.id, f.nome));
    return map;
  }, [fazendas]);

  const tipoMap = useMemo(() => {
    const map = new Map<string, string>();
    tipos.forEach(t => map.set(t.id, t.nome));
    return map;
  }, [tipos]);

  // IDs de tipos "Bezerro(a)" (ou nome contendo bezerro/bezerra) para o card Bezerros
  const tipoBezerroIds = useMemo(() => {
    return new Set(
      tipos
        .filter(t => /bezerro|bezerra/i.test((t.nome || '').trim()))
        .map(t => t.id)
    );
  }, [tipos]);

  // IDs de tipos "Vaca" e "Novilho(a)" para o card Matrizes
  const tipoMatrizIds = useMemo(() => {
    return new Set(
      tipos
        .filter(t => {
          const n = (t.nome || '').trim().toLowerCase();
          return n === 'vaca' || n === 'novilho(a)';
        })
        .map(t => t.id)
    );
  }, [tipos]);

  const racaMap = useMemo(() => {
    const map = new Map<string, string>();
    racas.forEach(r => map.set(r.id, r.nome));
    return map;
  }, [racas]);

  // Mapa de animais por ID para buscar dados da matriz
  const animaisMap = useMemo(() => {
    const map = new Map<string, Animal>();
    animaisRaw.forEach(a => {
      if (!a.deletedAt) {
        map.set(a.id, a);
      }
    });
    return map;
  }, [animaisRaw]);

  const statusMap = useMemo(() => {
    const map = new Map<string, string>();
    status.forEach(s => map.set(s.id, s.nome));
    return map;
  }, [status]);

  // Conjunto de IDs de animais que são matrizes (têm pelo menos um filho) — sem filtro de data,
  // para que o card "Matrizes" totalize corretamente quando a lista filtrada mostra as próprias matrizes.
  const animaisMatrizes = useMemo(() => {
    const matrizesSet = new Set<string>();
    animaisRaw.filter(a => !a.deletedAt).forEach(animal => {
      const genealogia = genealogiaMap.get(animal.id);
      const matrizId = genealogia?.matrizId || animal.matrizId;
      if (matrizId) matrizesSet.add(matrizId);
    });
    return matrizesSet;
  }, [animaisRaw, genealogiaMap]);

  // Função para calcular idade em dias
  const calcularIdade = (dataNascimento: string): number | null => {
    if (!dataNascimento) return null;
    try {
      const partes = dataNascimento.split('/');
      if (partes.length === 3) {
        const data = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
        const hoje = new Date();
        const diffTime = Math.abs(hoje.getTime() - data.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Função para formatar idade
  const formatarIdade = (dias: number | null): string => {
    if (dias === null) return '-';
    if (dias < 30) return `${dias}d`;
    if (dias < 365) return `${Math.floor(dias / 30)}m`;
    const anos = Math.floor(dias / 365);
    const meses = Math.floor((dias % 365) / 30);
    return meses > 0 ? `${anos}a ${meses}m` : `${anos}a`;
  };

  // 🚀 OTIMIZAÇÃO: Filtros e ordenação combinados em um único loop
  const animaisFiltrados = useMemo(() => {
    if (!animaisRaw || animaisRaw.length === 0) return [];

    const termoBusca = buscaParaFiltro.trim().toLowerCase();
    const temBusca = termoBusca.length > 0;
    const temFiltroMeses = filtroMesesNascimento.length > 0;
    const temFiltroAno = filtroAno && filtroAno.trim() !== '';
    const temFiltroTags = selectedTags.length > 0;
    const mesesSet = temFiltroMeses ? new Set(filtroMesesNascimento) : null;

    // Pré-computar valores para busca (se necessário)
    let buscaPreparada: {
      fazendaMap: Map<string, string>;
      tipoMap: Map<string, string>;
      statusMap: Map<string, string>;
      racaMap: Map<string, string>;
    } | null = null;

    if (temBusca) {
      buscaPreparada = {
        fazendaMap: new Map(Array.from(fazendaMap.entries()).map(([k, v]) => [k, v?.toLowerCase() || ''])),
        tipoMap: new Map(Array.from(tipoMap.entries()).map(([k, v]) => [k, v?.toLowerCase() || ''])),
        statusMap: new Map(Array.from(statusMap.entries()).map(([k, v]) => [k, v?.toLowerCase() || ''])),
        racaMap: new Map(Array.from(racaMap.entries()).map(([k, v]) => [k, v?.toLowerCase() || ''])),
      };
    }

    // Pré-computar tags (se necessário)
    const animalTagIdsMap = temFiltroTags ? new Map<string, string[]>() : null;
    if (temFiltroTags) {
      animaisRaw.forEach(a => {
        if (!a.deletedAt) {
          const animalTags = animalTagsMap.get(a.id) || [];
          animalTagIdsMap!.set(a.id, animalTags.map(t => t.id));
        }
      });
    }

    // Loop único para todos os filtros
    const filtrados: Animal[] = [];
    for (const animal of animaisRaw) {
      if (animal.deletedAt) continue;

      // Filtro por fazenda ativa
      if (fazendaAtivaId && animal.fazendaId !== fazendaAtivaId) continue;

      // Filtro por sexo
      if (filtroSexo && filtroSexo.trim() !== '' && animal.sexo !== filtroSexo) continue;

      // Filtro por tipo
      if (filtroTipoId && filtroTipoId.trim() !== '' && animal.tipoId !== filtroTipoId) continue;

      // Filtro por status
      if (filtroStatusId && filtroStatusId.trim() !== '' && animal.statusId !== filtroStatusId) continue;

      // Filtro por raça
      if (filtroRacaId && filtroRacaId.trim() !== '' && animal.racaId !== filtroRacaId) continue;

      // Filtro somente bezerros
      if (filtroSomenteBezerros) {
        const genealogia = genealogiaMap.get(animal.id);
        const matrizId = genealogia?.matrizId || animal.matrizId;
        if (!matrizId) continue;
      }

      // Filtro por mês de nascimento (usar cache)
      if (temFiltroMeses) {
        const data = dataNascimentoCache.get(animal.id);
        if (!data) continue;
        const mes = data.getMonth() + 1;
        if (!mesesSet!.has(mes)) continue;
      }

      // Filtro por ano de nascimento (usar cache)
      if (temFiltroAno) {
        const data = dataNascimentoCache.get(animal.id);
        if (!data || data.getFullYear().toString() !== filtroAno) continue;
      }

      // Filtro por tags
      if (temFiltroTags) {
        const animalTagIds = animalTagIdsMap!.get(animal.id) || [];
        if (tagFilterMode === 'any') {
          if (!selectedTags.some(tagId => animalTagIds.includes(tagId))) continue;
        } else {
          if (!selectedTags.every(tagId => animalTagIds.includes(tagId))) continue;
        }
      }

      // Busca global (otimizada)
      if (temBusca) {
        const genealogia = genealogiaMap.get(animal.id);
        const matrizId = genealogia?.matrizId || animal.matrizId;
        const matrizAnimal = matrizId ? animaisMap.get(matrizId) : undefined;
        const matrizIdentificador = matrizAnimal?.brinco?.toLowerCase() || '';
        const matrizNome = matrizAnimal?.nome?.toLowerCase() || '';

        const match =
          (animal.brinco?.toLowerCase() || '').includes(termoBusca) ||
          (animal.nome?.toLowerCase() || '').includes(termoBusca) ||
          (animal.lote?.toLowerCase() || '').includes(termoBusca) ||
          (animal.obs?.toLowerCase() || '').includes(termoBusca) ||
          (buscaPreparada!.fazendaMap.get(animal.fazendaId) || '').includes(termoBusca) ||
          (buscaPreparada!.tipoMap.get(animal.tipoId) || '').includes(termoBusca) ||
          (buscaPreparada!.statusMap.get(animal.statusId) || '').includes(termoBusca) ||
          (buscaPreparada!.racaMap.get(animal.racaId) || '').includes(termoBusca) ||
          matrizIdentificador.includes(termoBusca) ||
          matrizNome.includes(termoBusca);

        if (!match) continue;
      }

      filtrados.push(animal);
    }

    // Quando há busca, ordenar por relevância (melhores matches primeiro)
    if (temBusca && termoBusca.length > 0) {
      const score = (animal: Animal): number => {
        const brinco = (animal.brinco || '').toLowerCase();
        const nome = (animal.nome || '').toLowerCase();
        const lote = (animal.lote || '').toLowerCase();
        const obs = (animal.obs || '').toLowerCase();
        const fazenda = (buscaPreparada!.fazendaMap.get(animal.fazendaId) || '');
        const tipo = (buscaPreparada!.tipoMap.get(animal.tipoId) || '');
        const status = (buscaPreparada!.statusMap.get(animal.statusId) || '');
        const raca = (buscaPreparada!.racaMap.get(animal.racaId) || '');
        const genealogia = genealogiaMap.get(animal.id);
        const matrizId = genealogia?.matrizId || animal.matrizId;
        const matrizAnimal = matrizId ? animaisMap.get(matrizId) : undefined;
        const matrizBrinco = (matrizAnimal?.brinco || '').toLowerCase();
        const matrizNome = (matrizAnimal?.nome || '').toLowerCase();

        if (brinco === termoBusca) return 1000;
        if (matrizBrinco === termoBusca) return 900;
        if (brinco.startsWith(termoBusca)) return 800;
        if (matrizBrinco.startsWith(termoBusca)) return 700;
        if (nome === termoBusca) return 600;
        if (nome.startsWith(termoBusca)) return 500;
        if (brinco.includes(termoBusca)) return 400;
        if (matrizBrinco.includes(termoBusca) || matrizNome.includes(termoBusca)) return 300;
        if (nome.includes(termoBusca)) return 200;
        if (lote.includes(termoBusca) || obs.includes(termoBusca) || fazenda.includes(termoBusca) || tipo.includes(termoBusca) || status.includes(termoBusca) || raca.includes(termoBusca)) return 100;
        return 0;
      };
      filtrados.sort((a, b) => {
        const scoreA = score(a);
        const scoreB = score(b);
        if (scoreB !== scoreA) return scoreB - scoreA; // maior relevância primeiro
        // Desempate pela ordenação atual
        let comp = 0;
        switch (sortField) {
          case 'brinco':
            comp = (a.brinco || '').localeCompare(b.brinco || '');
            break;
          case 'nome':
            comp = (a.nome || '').localeCompare(b.nome || '');
            break;
          case 'tipo':
            comp = (tipoMap.get(a.tipoId) || '').localeCompare(tipoMap.get(b.tipoId) || '');
            break;
          case 'status':
            comp = (statusMap.get(a.statusId) || '').localeCompare(statusMap.get(b.statusId) || '');
            break;
          case 'sexo':
            comp = (a.sexo || '').localeCompare(b.sexo || '');
            break;
          case 'raca':
            comp = (racaMap.get(a.racaId) || '').localeCompare(racaMap.get(b.racaId) || '');
            break;
          case 'fazenda':
            comp = (fazendaMap.get(a.fazendaId) || '').localeCompare(fazendaMap.get(b.fazendaId) || '');
            break;
          case 'dataNascimento': {
            const dataA = dataNascimentoCache.get(a.id)?.getTime() ?? 0;
            const dataB = dataNascimentoCache.get(b.id)?.getTime() ?? 0;
            comp = dataA - dataB;
            break;
          }
          case 'createdAt':
          default: {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            comp = dateB - dateA;
            break;
          }
        }
        return sortAsc ? comp : -comp;
      });
    } else {
      // Ordenação normal (sem busca)
      filtrados.sort((a, b) => {
        let comp = 0;
        switch (sortField) {
          case 'brinco':
            comp = (a.brinco || '').localeCompare(b.brinco || '');
            break;
          case 'nome':
            comp = (a.nome || '').localeCompare(b.nome || '');
            break;
          case 'tipo':
            comp = (tipoMap.get(a.tipoId) || '').localeCompare(tipoMap.get(b.tipoId) || '');
            break;
          case 'status':
            comp = (statusMap.get(a.statusId) || '').localeCompare(statusMap.get(b.statusId) || '');
            break;
          case 'sexo':
            comp = (a.sexo || '').localeCompare(b.sexo || '');
            break;
          case 'raca':
            comp = (racaMap.get(a.racaId) || '').localeCompare(racaMap.get(b.racaId) || '');
            break;
          case 'fazenda':
            comp = (fazendaMap.get(a.fazendaId) || '').localeCompare(fazendaMap.get(b.fazendaId) || '');
            break;
          case 'dataNascimento': {
            const dataA = dataNascimentoCache.get(a.id)?.getTime() ?? 0;
            const dataB = dataNascimentoCache.get(b.id)?.getTime() ?? 0;
            comp = dataA - dataB;
            break;
          }
          case 'createdAt':
          default: {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            comp = dateB - dateA;
            break;
          }
        }
        return sortAsc ? comp : -comp;
      });
    }

    return filtrados;
  }, [animaisRaw, fazendaAtivaId, filtroSexo, filtroTipoId, filtroStatusId, filtroRacaId, filtroSomenteBezerros, filtroMesesNascimento, filtroAno, selectedTags, tagFilterMode, buscaParaFiltro, sortField, sortAsc, fazendaMap, tipoMap, statusMap, racaMap, genealogiaMap, animaisMap, animalTagsMap, dataNascimentoCache]);

  // Estatísticas de matrizes:
  // - Se a lista filtrada tem animais com mãe (matrizId): mostrar as matrizes distintas desses filhos, por tipo (Vaca/Novilho(a)).
  // - Senão: mostrar quantos dos filtrados são do tipo Vaca ou Novilho(a) (por ID de tipo).
  const matrizesStats = useMemo(() => {
    const matrizesPorTipo = new Map<string, number>();
    const matrizesCount = new Map<string, number>();

    animaisFiltrados.forEach(animal => {
      const genealogia = genealogiaMap.get(animal.id);
      const matrizId = genealogia?.matrizId || animal.matrizId;

      if (matrizId) {
        const animalMatriz = animaisMap.get(matrizId);
        if (animalMatriz && filtroSexo && filtroSexo.trim() !== '' && animalMatriz.sexo !== filtroSexo) return;
        matrizesCount.set(matrizId, (matrizesCount.get(matrizId) || 0) + 1);
      }
    });

    if (matrizesCount.size > 0) {
      // Lista tem filhos: mostrar as mães (matrizes) distintas, agrupadas por tipo (só Vaca/Novilho(a) por ID)
      matrizesCount.forEach((_count, matrizId) => {
        const animalMatriz = animaisMap.get(matrizId);
        if (!animalMatriz?.tipoId || !tipoMatrizIds.has(animalMatriz.tipoId)) return;
        const tipoNome = tipoMap.get(animalMatriz.tipoId) || 'Sem tipo';
        matrizesPorTipo.set(tipoNome, (matrizesPorTipo.get(tipoNome) || 0) + 1);
      });
    } else {
      // Lista não tem filhos: contar filtrados cujo tipo é Vaca ou Novilho(a)
      animaisFiltrados.forEach(animal => {
        if (!animal.tipoId || !tipoMatrizIds.has(animal.tipoId)) return;
        if (filtroSexo && filtroSexo.trim() !== '' && animal.sexo !== filtroSexo) return;
        const tipoNome = tipoMap.get(animal.tipoId) || 'Sem tipo';
        matrizesPorTipo.set(tipoNome, (matrizesPorTipo.get(tipoNome) || 0) + 1);
      });
    }

    return matrizesPorTipo;
  }, [animaisFiltrados, tipoMatrizIds, tipoMap, filtroSexo, genealogiaMap, animaisMap]);

  // Estatísticas de bezerros: animais filtrados cujo tipo é Bezerro(a) (por ID de tipo)
  const bezerrosStats = useMemo(() => {
    const bezerros = animaisFiltrados.filter(animal => animal.tipoId && tipoBezerroIds.has(animal.tipoId));
    const machos = bezerros.filter(b => b.sexo === 'M').length;
    const femeas = bezerros.filter(b => b.sexo === 'F').length;
    const total = bezerros.length;
    return { total, machos, femeas };
  }, [animaisFiltrados, tipoBezerroIds]);

  // Estatísticas de raças
  const racasStats = useMemo(() => {
    const racasCounts = new Map<string, { nome: string; total: number; machos: number; femeas: number }>();

    animaisFiltrados.forEach(animal => {
      const racaNome = animal.racaId ? (racaMap.get(animal.racaId) || 'Sem raça') : 'Sem raça';
      const current = racasCounts.get(racaNome) || { nome: racaNome, total: 0, machos: 0, femeas: 0 };

      current.total += 1;
      if (animal.sexo === 'M') current.machos += 1;
      if (animal.sexo === 'F') current.femeas += 1;

      racasCounts.set(racaNome, current);
    });

    return Array.from(racasCounts.values())
      .sort((a, b) => b.total - a.total); // Ordenar por total decrescente
  }, [animaisFiltrados, racaMap]);

  // Paginação
  const totalPaginas = useMemo(() => {
    if (animaisFiltrados.length === 0) return 1;
    return Math.max(1, Math.ceil(animaisFiltrados.length / itensPorPagina));
  }, [animaisFiltrados.length, itensPorPagina]);

  const animaisPagina = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return animaisFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [animaisFiltrados, paginaAtual, itensPorPagina]);

  const numVisibleCols = useMemo(() =>
    COLUNAS_TABELA.filter((c) => visibleColumns[c.id as ColumnId]).length,
    [visibleColumns]
  );
  const useVirtual = animaisPagina.length >= VIRTUAL_THRESHOLD;
  const gridCols = useMemo(() => {
    const n = numVisibleCols;
    if (visibleColumns.acoes && n > 0) {
      return `repeat(${n - 1}, minmax(80px, 1fr)) minmax(150px, 0fr)`;
    }
    return `repeat(${n}, minmax(80px, 1fr))`;
  }, [numVisibleCols, visibleColumns.acoes]);

  // Ajustar página atual se necessário
  useEffect(() => {
    if (paginaAtual > totalPaginas && totalPaginas > 0) {
      setPaginaAtual(totalPaginas);
    }
  }, [paginaAtual, totalPaginas]);

  // Handlers
  const handleNovoAnimal = () => {
    setAnimalEditando(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEditarAnimal = (animal: Animal) => {
    setAnimalEditando(animal);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleExcluirAnimal = (animal: Animal) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir animal',
      message: `Deseja realmente excluir o animal ${animal.brinco}${animal.nome ? ` (${animal.nome})` : ''}?`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        try {
          const { uuid } = await import('../utils/uuid');
          const deletedId = uuid();

          // Registrar exclusão na tabela deletedRecords
          if (db.deletedRecords) {
            await db.deletedRecords.add({
              id: deletedId,
              uuid: animal.id,
              remoteId: animal.remoteId || null,
              deletedAt: new Date().toISOString(),
              synced: false
            });
          }

          // Marcar animal como deletado
          await db.animais.update(animal.id, {
            deletedAt: new Date().toISOString(),
            synced: false
          });

          showToast({ type: 'success', title: 'Animal excluído', message: animal.brinco });
          // Forçar atualização da lista
          // setRefreshKey(prev => prev + 1); // Removido - useLiveQuery atualiza automaticamente
        } catch (error) {
          console.error('Erro ao excluir:', error);
          showToast({ type: 'error', title: 'Erro ao excluir', message: 'Tente novamente' });
        }
      }
    });
  };

  const handleLimparFiltros = () => {
    startTransition(() => {
      setBuscaParaFiltro('');
      setFiltroSexo('');
      setFiltroTipoId('');
      setFiltroStatusId('');
      setFiltroRacaId('');
      setFiltroSomenteBezerros(false);
      setFiltroMesesNascimento([]);
      setFiltroAno('');
      setSelectedTags([]);
      setPaginaAtual(1);
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setPaginaAtual(1);
  };

  const handleExportarExcel = async () => {
    if (!podeExportarDados) {
      showToast({ type: 'error', title: 'Sem permissão', message: 'Você não tem permissão para exportar dados.' });
      return;
    }
    try {
      const dados = animaisFiltrados.map(a => {
        const genealogia = genealogiaMap.get(a.id);
        const matrizId = genealogia?.matrizId || a.matrizId;
        // Buscar matriz na tabela de Animais
        const matrizAnimal = matrizId ? animaisMap.get(matrizId) : undefined;
        const tipoMatrizId = genealogia?.tipoMatrizId || matrizAnimal?.tipoId;

        return {
          'Brinco': a.brinco || '',
          'Nome': a.nome || '',
          'Tipo': tipoMap.get(a.tipoId) || '',
          'Status': statusMap.get(a.statusId) || '',
          'Sexo': a.sexo === 'M' ? 'Macho' : 'Fêmea',
          'Raça': racaMap.get(a.racaId) || '',
          'Matriz': matrizAnimal?.brinco || '',
          'Nome Matriz': matrizAnimal?.nome || '',
          'Tipo Matriz': tipoMatrizId ? tipoMap.get(tipoMatrizId) : '',
          'Data Nascimento': a.dataNascimento || '',
          'Idade': formatarIdade(calcularIdade(a.dataNascimento || '')),
          'Fazenda': fazendaMap.get(a.fazendaId) || '',
          'Lote': a.lote || '',
          'Peso Atual': a.pesoAtual || '',
          'Observações': a.obs || ''
        };
      });

      await exportarParaExcel({
        dados,
        nomeArquivo: `animais_${new Date().toISOString().split('T')[0]}`,
        nomePlanilha: 'Animais'
      });

      showToast({
        type: 'success',
        title: 'Exportação concluída',
        message: 'Dados exportados para Excel com sucesso!'
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      showToast({
        type: 'error',
        title: 'Erro na exportação',
        message: 'Não foi possível exportar os dados.'
      });
    }
  };

  const handleExportarCSV = async () => {
    if (!podeExportarDados) {
      showToast({ type: 'error', title: 'Sem permissão', message: 'Você não tem permissão para exportar dados.' });
      return;
    }
    try {
      const dados = animaisFiltrados.map(a => {
        const genealogia = genealogiaMap.get(a.id);
        const matrizId = genealogia?.matrizId || a.matrizId;
        // Buscar matriz na tabela de Animais
        const matrizAnimal = matrizId ? animaisMap.get(matrizId) : undefined;
        const tipoMatrizId = genealogia?.tipoMatrizId || matrizAnimal?.tipoId;

        return {
          'Brinco': a.brinco || '',
          'Nome': a.nome || '',
          'Tipo': tipoMap.get(a.tipoId) || '',
          'Status': statusMap.get(a.statusId) || '',
          'Sexo': a.sexo === 'M' ? 'Macho' : 'Fêmea',
          'Raça': racaMap.get(a.racaId) || '',
          'Matriz': matrizAnimal?.brinco || '',
          'Nome Matriz': matrizAnimal?.nome || '',
          'Tipo Matriz': tipoMatrizId ? tipoMap.get(tipoMatrizId) : '',
          'Data Nascimento': a.dataNascimento || '',
          'Idade': formatarIdade(calcularIdade(a.dataNascimento || '')),
          'Fazenda': fazendaMap.get(a.fazendaId) || '',
          'Lote': a.lote || '',
          'Peso Atual': a.pesoAtual || '',
          'Observações': a.obs || ''
        };
      });

      await exportarParaCSV({
        dados,
        nomeArquivo: `animais_${new Date().toISOString().split('T')[0]}`
      });

      showToast({
        type: 'success',
        title: 'Exportação concluída',
        message: 'Dados exportados para CSV com sucesso!'
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      showToast({
        type: 'error',
        title: 'Erro na exportação',
        message: 'Não foi possível exportar os dados.'
      });
    }
  };



  return (
    <div className="p-2 sm:p-3 md:p-4 text-gray-900 dark:text-slate-100 relative min-w-0 max-w-full overflow-x-hidden">
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 px-6 py-8 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
            <Icons.Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
            <p className="text-sm font-medium text-gray-700 dark:text-slate-200">Carregando animais...</p>
          </div>
        </div>
      )}
      <div className={`${getPrimaryCardClass(primaryColor)} rounded-xl shadow-sm mb-4 sm:mb-6 p-3 sm:p-4 md:p-6 min-w-0 max-w-full overflow-hidden`}>
        {/* HEADER */}
        <div className="flex flex-row items-start justify-between gap-2 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className={`text-2xl font-bold ${getTitleTextClass(primaryColor)}`}>
              Gestão de Animais
            </h1>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Controle completo do rebanho
            </p>
          </div>
          {podeCadastrarAnimal && (
            <button
              onClick={handleNovoAnimal}
              className={`${getPrimaryButtonClass(primaryColor)} text-white w-10 h-10 md:w-auto md:px-4 md:py-2 rounded-full md:rounded-lg flex items-center justify-center gap-2 flex-shrink-0 shadow-lg hover:shadow-xl transition-all`}
              title="Novo Animal"
              aria-label="Novo Animal"
            >
              <Icons.Plus className="w-5 h-5 flex-shrink-0" />
              <span className="hidden md:inline font-medium">Novo Animal</span>
            </button>
          )}
        </div>

        {/* Painel de Filtros */}
        <div className="mb-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">

          {/* Cabeçalho */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">
              Filtros
            </h3>

            <button
              type="button"
              onClick={() => setFiltrosAbertos(v => !v)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl
                 bg-amber-500 hover:bg-amber-600 text-white
                 text-sm font-semibold shadow-sm transition"
            >
              <Icons.Filter className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{filtrosAbertos ? 'Ocultar filtros' : 'Mostrar filtros'}</span>
              <Icons.ChevronDown
                className={`w-4 h-4 transition-transform ${filtrosAbertos ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {filtrosAbertos && (
            <div className="px-4 py-4 space-y-4">

              {/* ================= FILTROS PRINCIPAIS ================= */}
              <h4 className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Filtros principais
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-6 lg:grid-cols-12 gap-3">

                {/* Busca — SearchInputDebounced: estado local, só notifica pai após debounce = digitação fluida */}
                <div className="sm:col-span-6 lg:col-span-4">
                  <SearchInputDebounced
                    label="Busca"
                    placeholder="Buscar por brinco, nome, lote..."
                    onSearchChange={handleBuscaChange}
                    defaultValue={buscaParaFiltro}
                    delay={300}
                  />
                </div>

                {/* Sexo */}
                <div className="sm:col-span-3 lg:col-span-2">
                  <Combobox
                    label="Sexo"
                    value={filtroSexo}
                    options={[
                      { label: 'Todos os sexos', value: '' },
                      { label: 'Macho', value: 'M' },
                      { label: 'Fêmea', value: 'F' }
                    ]}
                    onChange={(v) => handleFiltroSexoChange(v as any)}
                  />
                </div>

                {/* Tipo */}
                <div className="sm:col-span-3 lg:col-span-3">
                  <Combobox
                    label="Tipo"
                    value={filtroTipoId}
                    options={[
                      { label: 'Todos os tipos', value: '' },
                      ...tipos.map(t => ({ label: t.nome, value: t.id }))
                    ]}
                    onChange={(v) => handleFiltroTipoChange(v as string)}
                  />
                </div>

                {/* Status */}
                <div className="sm:col-span-3 lg:col-span-3">
                  <Combobox
                    label="Status"
                    value={filtroStatusId}
                    options={[
                      { label: 'Todos os status', value: '' },
                      ...status.map(s => ({ label: s.nome, value: s.id }))
                    ]}
                    onChange={(v) => handleFiltroStatusChange(v as string)}
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-200 dark:bg-slate-700" />

              {/* ================= CLASSIFICAÇÃO / DATAS ================= */}
              <h4 className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Classificação / Datas
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-6 lg:grid-cols-12 gap-3">

                {/* Raça */}
                <div className="sm:col-span-6 lg:col-span-6">
                  <Combobox
                    label="Raça"
                    value={filtroRacaId}
                    options={[
                      { label: 'Todas as raças', value: '' },
                      ...racas.map(r => ({ label: r.nome, value: r.id }))
                    ]}
                    onChange={(v) => handleFiltroRacaChange(v as string)}
                  />
                </div>

                {/* Ano */}
                <div className="sm:col-span-3 lg:col-span-3">
                  <Combobox
                    label="Ano"
                    value={filtroAno}
                    onChange={(value) => {
                      const valorFinal = (typeof value === 'string') ? value : (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') ? value.value : '';
                      setFiltroAno(valorFinal);
                    }}
                    options={[
                      { label: 'Todos os anos', value: '' },
                      ...(() => {
                        const anos = new Set<number>();
                        animaisRaw.filter((a) => !a.deletedAt && a.dataNascimento).forEach((a) => {
                          const data = parseDataNascimentoLocal(a.dataNascimento!);
                          if (data) anos.add(data.getFullYear());
                        });
                        return Array.from(anos).sort((a, b) => b - a).map((ano) => ({ label: ano.toString(), value: ano.toString() }));
                      })()
                    ]}
                    placeholder="Todos os anos (ex.: 2025)"
                    allowCustomValue={true}
                  />
                </div>

                {/* Mês de nascimento */}
                <div className="sm:col-span-3 lg:col-span-3" ref={menuMesesRef}>
                  <fieldset className="relative rounded-md border px-3 pt-2 pb-2 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 min-w-0">
                    <legend className="absolute -top-2 left-3 px-1 text-[11px] font-medium bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">
                      Mês de Nascimento
                    </legend>
                    <button
                      type="button"
                      onClick={() => setMenuMesesAberto(!menuMesesAberto)}
                      className="w-full px-0 py-0.5 text-sm leading-tight bg-transparent text-slate-800 dark:text-slate-100 focus:outline-none flex items-center justify-between"
                    >
                      <span className="truncate">
                        {filtroMesesNascimento.length === 0 ? 'Todos os meses' : filtroMesesNascimento.length === 1 ? nomeMes(filtroMesesNascimento[0]) : `${filtroMesesNascimento.length} meses`}
                      </span>
                      <Icons.ChevronDown className={`w-4 h-4 transition-transform ${menuMesesAberto ? 'rotate-180' : ''}`} />
                    </button>
                    {menuMesesAberto && (
                      <div className="absolute z-[100] w-full left-0 mt-1 bg-white dark:bg-slate-900 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 max-h-64 overflow-y-auto">
                        {/* "Limpar (Todos)" — mesmo estilo azul do Combobox "Todos os anos" */}
                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => { setFiltroMesesNascimento([]); setMenuMesesAberto(false); }}
                            className="w-full text-left px-3 py-2 text-sm font-medium transition-colors bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:opacity-90"
                          >
                            Limpar (Todos)
                          </button>
                          {Array.from({ length: 12 }, (_, i) => {
                            const mes = i + 1;
                            const isSelected = filtroMesesNascimento.includes(mes);
                            return (
                              <label
                                key={mes}
                                className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-medium'
                                    : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded accent-blue-600 border-gray-300 dark:border-slate-600"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) setFiltroMesesNascimento([...filtroMesesNascimento, mes].sort((a, b) => a - b));
                                    else setFiltroMesesNascimento(filtroMesesNascimento.filter((m) => m !== mes));
                                  }}
                                />
                                <span>{nomeMes(mes)}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </fieldset>
                </div>
              </div>

              {/* ================= TAGS + LIMPAR ================= */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">

                <div className="flex flex-wrap gap-2">
                  {buscaParaFiltro.trim() && (
                    <span className="px-2 py-1 text-xs rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Busca: {buscaParaFiltro.trim()}
                    </span>
                  )}
                  {filtroSexo && (
                    <span className="px-2 py-1 text-xs rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Sexo: {filtroSexo === 'F' ? 'Fêmea' : 'Macho'}
                    </span>
                  )}
                  {filtroTipoId && (
                    <span className="px-2 py-1 text-xs rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Tipo: {tipoMap.get(filtroTipoId) || '—'}
                    </span>
                  )}
                  {filtroStatusId && (
                    <span className="px-2 py-1 text-xs rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Status: {statusMap.get(filtroStatusId) || '—'}
                    </span>
                  )}
                  {filtroRacaId && (
                    <span className="px-2 py-1 text-xs rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Raça: {racaMap.get(filtroRacaId) || '—'}
                    </span>
                  )}
                  {filtroMesesNascimento.length > 0 && (
                    <span className="px-2 py-1 text-xs rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Meses: {filtroMesesNascimento.map(m => nomeMes(m)).join(', ')}
                    </span>
                  )}
                  {filtroAno && (
                    <span className="px-2 py-1 text-xs rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Ano: {filtroAno}
                    </span>
                  )}
                  {selectedTags.length > 0 && (
                    <span className="px-2 py-1 text-xs rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Tags: {selectedTags.length} {selectedTags.length === 1 ? 'selecionada' : 'selecionadas'}
                    </span>
                  )}
                </div>

                {(buscaParaFiltro.trim() || filtroSexo || filtroTipoId || filtroStatusId || filtroRacaId || filtroMesesNascimento.length > 0 || filtroAno || selectedTags.length > 0) && (
                  <button
                    onClick={handleLimparFiltros}
                    title="Limpar filtros"
                    className="flex items-center gap-1 px-3 py-1.5
                       rounded-md border border-amber-300
                       text-amber-700 text-sm
                       hover:bg-amber-50 transition"
                  >
                    <Icons.X className="w-4 h-4" />
                    <span className="hidden sm:inline">Limpar filtros</span>
                  </button>
                )}
              </div>

            </div>
          )}
        </div>





        {/* Total da lista filtrada (mesma fonte da tabela e dos cards) — para conferência visual */}
        <div className="flex items-center gap-2 mb-2 text-sm text-gray-600 dark:text-slate-400">
          <span>Total da lista filtrada:</span>
          <span className="font-semibold text-gray-800 dark:text-slate-200">{animaisFiltrados.length}</span>
          <span>{animaisFiltrados.length === 1 ? 'animal' : 'animais'}</span>
          {(filtroMesesNascimento.length > 0 || (filtroAno && filtroAno.trim() !== '')) && (
            <span className="text-gray-500 dark:text-slate-500">
              (Mês: {filtroMesesNascimento.length > 0 ? filtroMesesNascimento.map(m => nomeMes(m)).join(', ') : 'todos'}
              {filtroAno && filtroAno.trim() !== '' ? ` · Ano: ${filtroAno}` : ''})
            </span>
          )}
        </div>

        {/* KPIs */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 ${filtrosAbertos ? 'mb-6' : 'mb-2'}`}>
          {/* Matrizes */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Matrizes</h3>
              </div>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {Array.from(matrizesStats.values()).reduce((sum, count) => sum + count, 0)}
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-200 dark:border-slate-700">
              {Array.from(matrizesStats.entries()).length > 0 ? (
                Array.from(matrizesStats.entries()).map(([tipoNome, count]) => {
                  const tipoObj = tipos.find(t => t.nome === tipoNome);
                  return (
                    <button
                      key={tipoNome}
                      type="button"
                      onClick={() => {
                        if (tipoObj) {
                          startTransition(() => {
                            setFiltroTipoId(tipoObj.id);
                            setPaginaAtual(1);
                          });
                          setFiltrosAbertos(true);
                        }
                      }}
                      title="Clique para filtrar por este tipo"
                      className="flex items-center justify-between w-full text-left rounded px-1 py-0.5 -mx-1 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                    >
                      <span className="text-sm text-gray-600 dark:text-slate-400">{tipoNome}</span>
                      <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded">
                        {count}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="text-sm text-gray-400 dark:text-slate-500 italic">Nenhuma matriz encontrada</div>
              )}
            </div>
          </div>

          {/* Bezerros */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700 shadow-sm">
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  setFiltroSomenteBezerros(true);
                  setPaginaAtual(1);
                });
                setFiltrosAbertos(true);
              }}
              title="Clique para filtrar somente bezerros"
              className="flex items-center justify-between w-full mb-2 text-left rounded hover:opacity-90 transition-opacity cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Bezerros</h3>
              </div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {bezerrosStats.total}
              </div>
            </button>
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setFiltroSomenteBezerros(true);
                    setFiltroSexo('M');
                    setPaginaAtual(1);
                  });
                  setFiltrosAbertos(true);
                }}
                title="Clique para filtrar bezerros machos"
                className="flex items-center justify-between w-full text-left rounded px-1 py-0.5 -mx-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
              >
                <span className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Machos
                </span>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                  {bezerrosStats.machos}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setFiltroSomenteBezerros(true);
                    setFiltroSexo('F');
                    setPaginaAtual(1);
                  });
                  setFiltrosAbertos(true);
                }}
                title="Clique para filtrar bezerros fêmeas"
                className="flex items-center justify-between w-full text-left rounded px-1 py-0.5 -mx-1 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-colors cursor-pointer"
              >
                <span className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                  Fêmeas
                </span>
                <span className="text-sm font-semibold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20 px-2 py-0.5 rounded">
                  {bezerrosStats.femeas}
                </span>
              </button>
            </div>
          </div>

          {/* Raças — total = mesma lista da tabela (animaisFiltrados) */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Raças</h3>
              </div>
              <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {animaisFiltrados.length}
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-200 dark:border-slate-700 max-h-[160px] overflow-y-auto">
              {racasStats.length > 0 ? (
                racasStats.map((raca) => {
                  const racaObj = racas.find(r => r.nome === raca.nome);
                  return (
                    <button
                      key={raca.nome}
                      type="button"
                      onClick={() => {
                        if (racaObj) {
                          startTransition(() => {
                            setFiltroRacaId(racaObj.id);
                            setPaginaAtual(1);
                          });
                          setFiltrosAbertos(true);
                        }
                      }}
                      title="Clique para filtrar por esta raça"
                      className="flex items-center justify-between gap-2 w-full text-left rounded px-1 py-0.5 -mx-1 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors cursor-pointer"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm text-gray-700 dark:text-slate-300 font-medium">{raca.nome}</span>
                        <div className="text-xs text-gray-500 dark:text-slate-400">
                          • {raca.machos} Machos • {raca.femeas} Fêmeas
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-slate-100 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded shrink-0">
                        {raca.total} Animais
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="text-sm text-gray-400 dark:text-slate-500 italic">Nenhuma raça encontrada</div>
              )}
            </div>
          </div>
        </div>



        {/* Loading ao aplicar filtros */}
        {isPending && (
          <div className="flex items-center gap-2 px-4 py-2 mb-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200">
            <Icons.Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="text-sm font-medium">Aplicando filtros...</span>
          </div>
        )}

        {/* Tabela + toolbar */}
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm overflow-hidden min-w-0">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
            <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
              Animais cadastrados
            </span>
            
            <div className="flex items-center gap-2">
{/*               {podeExportarDados && (
                <>
                  <button
                    onClick={handleExportarExcel}
                    disabled={animaisFiltrados.length === 0}
                    className="flex items-center justify-center gap-2 w-9 h-9 md:w-auto md:px-2.5 md:py-1.5 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Exportar para Excel"
                  >
                    <Icons.FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden md:inline text-sm font-medium">Excel</span>
                  </button>
                  <button
                    onClick={handleExportarCSV}
                    disabled={animaisFiltrados.length === 0}
                    className="flex items-center justify-center gap-2 w-9 h-9 md:w-auto md:px-2.5 md:py-1.5 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Exportar para CSV"
                  >
                    <Icons.FileText className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden md:inline text-sm font-medium">CSV</span>
                  </button>
                </>
              )} */}
              <div className="relative" ref={colunasPopoverRef}>
                <button
                  type="button"
                  onClick={() => setColunasPopoverOpen(!colunasPopoverOpen)}
                  className="flex items-center justify-center gap-2 w-9 h-9 md:w-auto md:px-2.5 md:py-1.5 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                  title="Selecionar colunas visíveis"
                >
                  <Icons.SlidersHorizontal className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden md:inline text-sm font-medium">Colunas</span>
                  <Icons.ChevronDown className={`hidden md:block w-4 h-4 transition-transform flex-shrink-0 ${colunasPopoverOpen ? 'rotate-180' : ''}`} />
                </button>
                {colunasPopoverOpen && (
                  <div className="absolute right-0 top-full mt-1 z-[100] w-56 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg">
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-600">
                      <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Colunas visíveis</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto py-1">
                      {COLUNAS_TABELA.map((col) => (
                        <label
                          key={col.id}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                            checked={visibleColumns[col.id]}
                            onChange={(e) => setVisibleColumns((prev) => ({ ...prev, [col.id]: e.target.checked }))}
                          />
                          <span>{col.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="px-3 py-2 border-t border-gray-200 dark:border-slate-600">
                      <button
                        type="button"
                        onClick={() => setVisibleColumns({ ...VISIBLE_COLUMNS_DEFAULT })}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Restaurar todas
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
          {/* Versão Mobile - Cards */}
          <div className="md:hidden space-y-3 mb-4">
            {animaisPagina.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500 dark:text-slate-400">
                Nenhum animal cadastrado ainda.
              </div>
            ) : (
              animaisPagina.map((animal) => {
                const genealogia = genealogiaMap.get(animal.id);
                const matrizId = genealogia?.matrizId || animal.matrizId;
                const matrizAnimal = matrizId ? animaisMap.get(matrizId) : undefined;
                const matrizIdentificador = matrizAnimal?.brinco || '';
                const matrizNome = matrizAnimal?.nome || '';
                const tipoMatrizId = genealogia?.tipoMatrizId || matrizAnimal?.tipoId;
                const tipoMatrizNome = tipoMatrizId ? tipoMap.get(tipoMatrizId) : null;
                const isMatriz = animaisMatrizes.has(animal.id);
                const isBezerro = !!matrizId;
                return (
                  <div
                    key={animal.id}
                    className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                            {animal.brinco}
                          </span>
                          {isMatriz && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 shrink-0">
                              Matriz
                            </span>
                          )}
                          {isBezerro && !isMatriz && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 shrink-0">
                              Bezerro
                            </span>
                          )}
                        </div>
                        {animal.nome && (
                          <p className="text-sm text-gray-700 dark:text-slate-300 truncate">
                            {animal.nome}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <button
                          onClick={() => { setHistoricoEntityId(animal.id); setHistoricoOpen(true); }}
                          className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                          title="Ver histórico"
                        >
                          <Icons.History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setTimelineAnimalId(animal.id); setTimelineOpen(true); }}
                          className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                          title="Linha do tempo"
                        >
                          <Icons.Calendar className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (matrizId) {
                              setArvoreAnimalId(matrizAnimal?.id || matrizId);
                              setArvoreOpen(true);
                            }
                          }}
                          disabled={!matrizId}
                          className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                          title="Ver árvore genealógica"
                        >
                          <Icons.GitBranch className="w-4 h-4" />
                        </button>
                        {podeEditarAnimal && (
                          <button
                            onClick={() => handleEditarAnimal(animal)}
                            className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                            title="Editar animal"
                          >
                            <Icons.Edit className="w-4 h-4" />
                          </button>
                        )}
                        {podeExcluirAnimal && (
                          <button
                            onClick={() => handleExcluirAnimal(animal)}
                            className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                            title="Excluir animal"
                          >
                            <Icons.Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {visibleColumns.tipo && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Tipo:</span>
                          <span className="ml-1 text-gray-900 dark:text-slate-100">
                            {animal.tipoId ? tipoMap.get(animal.tipoId) : '-'}
                          </span>
                        </div>
                      )}
                      {visibleColumns.status && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Status:</span>
                          <span className="ml-1 text-gray-900 dark:text-slate-100">
                            {animal.statusId ? statusMap.get(animal.statusId) : '-'}
                          </span>
                        </div>
                      )}
                      {visibleColumns.sexo && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Sexo:</span>
                          <span className={`ml-1 font-medium ${animal.sexo === 'M' ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'}`}>
                            {animal.sexo === 'M' ? 'Macho' : 'Fêmea'}
                          </span>
                        </div>
                      )}
                      {visibleColumns.raca && (
                        <div>
                          <span className="text-gray-500 dark:text-slate-400">Raça:</span>
                          <span className="ml-1 text-gray-900 dark:text-slate-100">
                            {animal.racaId ? racaMap.get(animal.racaId) : '-'}
                          </span>
                        </div>
                      )}
                      {visibleColumns.fazenda && (
                        <div className="col-span-2">
                          <span className="text-gray-500 dark:text-slate-400">Fazenda:</span>
                          <span className="ml-1 text-gray-900 dark:text-slate-100 truncate">
                            {fazendaMap.get(animal.fazendaId) || '-'}
                          </span>
                        </div>
                      )}
                      {visibleColumns.matriz && matrizIdentificador && (
                        <div className="col-span-2">
                          <span className="text-gray-500 dark:text-slate-400">Matriz:</span>
                          <span className="ml-1 text-gray-900 dark:text-slate-100 font-medium">
                            {matrizIdentificador}
                          </span>
                          {matrizNome && (
                            <span className="ml-1 text-xs text-gray-500 dark:text-slate-400">
                              ({matrizNome})
                            </span>
                          )}
                        </div>
                      )}
                      {visibleColumns.tipoMatriz && tipoMatrizNome && (
                        <div className="col-span-2">
                          <span className="text-gray-500 dark:text-slate-400">Tipo Matriz:</span>
                          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                            {tipoMatrizNome}
                          </span>
                        </div>
                      )}
                      {visibleColumns.tags && (
                        <div className="col-span-2">
                          <span className="text-gray-500 dark:text-slate-400">Tags:</span>
                          <span className="ml-1">
                            <AnimalTags tags={animalTagsMap.get(animal.id)} />
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Versão Desktop - Tabela */}
          <div className="hidden md:block overflow-x-auto min-w-0 -mx-2 sm:mx-0 max-w-full">
            {useVirtual ? (
              <>
                <div
                  className="sticky top-0 z-10 bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 min-w-full"
                  style={{ display: 'grid', gridTemplateColumns: gridCols }}
                  role="row"
                >
                  {visibleColumns.brinco && <div className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 whitespace-nowrap" onClick={() => handleSort('brinco')}><div className="flex items-center gap-2">Brinco{sortField === 'brinco' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div></div>}
                  {visibleColumns.nome && <div className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 whitespace-nowrap" onClick={() => handleSort('nome')}><div className="flex items-center gap-2">Nome{sortField === 'nome' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div></div>}
                  {visibleColumns.tipo && <div className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 whitespace-nowrap" onClick={() => handleSort('tipo')}><div className="flex items-center gap-2">Tipo{sortField === 'tipo' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div></div>}
                  {visibleColumns.status && <div className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 whitespace-nowrap" onClick={() => handleSort('status')}><div className="flex items-center gap-2">Status{sortField === 'status' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div></div>}
                  {visibleColumns.matriz && <div className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase whitespace-nowrap">Matriz</div>}
                  {visibleColumns.tipoMatriz && <div className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase whitespace-nowrap">Tipo Matriz</div>}
                  {visibleColumns.sexo && <div className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 whitespace-nowrap" onClick={() => handleSort('sexo')}><div className="flex items-center gap-2">Sexo{sortField === 'sexo' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div></div>}
                  {visibleColumns.raca && <div className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 whitespace-nowrap" onClick={() => handleSort('raca')}><div className="flex items-center gap-1">Raça{sortField === 'raca' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div></div>}
                  {visibleColumns.fazenda && <div className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 whitespace-nowrap" onClick={() => handleSort('fazenda')}><div className="flex items-center gap-2">Fazenda{sortField === 'fazenda' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div></div>}
                  {visibleColumns.tags && <div className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase whitespace-nowrap">Tags</div>}
                  {visibleColumns.acoes && <div className="px-2 sm:px-3 py-1.5 text-center text-xs font-medium text-gray-500 dark:text-slate-300 uppercase whitespace-nowrap min-w-[150px]">Ações</div>}
                </div>
                <List
                  rowCount={animaisPagina.length}
                  rowHeight={ROW_HEIGHT}
                  rowComponent={({ index, style }) => {
                    const animal = animaisPagina[index];
                    const genealogia = genealogiaMap.get(animal.id);
                    const matrizId = genealogia?.matrizId || animal.matrizId;
                    const matrizAnimal = matrizId ? animaisMap.get(matrizId) : undefined;
                    const matrizIdentificador = matrizAnimal?.brinco || '';
                    const matrizNome = matrizAnimal?.nome || '';
                    const tipoMatrizId = genealogia?.tipoMatrizId || matrizAnimal?.tipoId;
                    const tipoMatrizNome = tipoMatrizId ? tipoMap.get(tipoMatrizId) : null;
                    const isMatriz = animaisMatrizes.has(animal.id);
                    const isBezerro = !!matrizId;
                    return (
                      <div
                        style={{ ...style, display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center' }}
                        className={`border-b border-gray-200 dark:border-slate-800 ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-gray-50 dark:bg-slate-800'} hover:bg-gray-100 dark:hover:bg-slate-700`}
                      >
                        {visibleColumns.brinco && <div className="px-2 sm:px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-slate-100 min-w-0"><div className="flex items-center gap-2 min-w-0"><span className="truncate">{animal.brinco}</span>{isMatriz && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 shrink-0" title="Matriz">Matriz</span>}{isBezerro && !isMatriz && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 shrink-0" title="Bezerro">Bezerro</span>}</div></div>}
                        {visibleColumns.nome && <div className="px-2 sm:px-3 py-1.5 text-sm text-gray-700 dark:text-slate-200 truncate" title={animal.nome || undefined}>{animal.nome || '-'}</div>}
                        {visibleColumns.tipo && <div className="px-2 sm:px-3 py-1.5 text-sm text-gray-700 dark:text-slate-200 whitespace-nowrap">{animal.tipoId ? tipoMap.get(animal.tipoId) : '-'}</div>}
                        {visibleColumns.status && <div className="px-2 sm:px-3 py-1.5 text-sm text-gray-700 dark:text-slate-200 whitespace-nowrap">{animal.statusId ? statusMap.get(animal.statusId) : '-'}</div>}
                        {visibleColumns.matriz && <div className="px-2 sm:px-3 py-1.5 text-sm text-gray-700 dark:text-slate-200">{matrizIdentificador ? <div className="min-w-0"><div className="font-medium truncate">{matrizIdentificador}</div>{matrizNome?.trim() && <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{matrizNome}</div>}</div> : '-'}</div>}
                        {visibleColumns.tipoMatriz && <div className="px-2 sm:px-3 py-1.5 text-sm whitespace-nowrap">{tipoMatrizNome ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">{tipoMatrizNome}</span> : <span className="text-gray-400 dark:text-slate-500">-</span>}</div>}
                        {visibleColumns.sexo && <div className="px-2 sm:px-3 py-1.5 text-sm"><span className={animal.sexo === 'M' ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'}>{animal.sexo === 'M' ? 'M' : 'F'}</span></div>}
                        {visibleColumns.raca && <div className="px-2 sm:px-3 py-1.5 text-sm text-gray-700 dark:text-slate-200 whitespace-nowrap">{animal.racaId ? racaMap.get(animal.racaId) : '-'}</div>}
                        {visibleColumns.fazenda && <div className="px-2 sm:px-3 py-1.5 text-sm text-gray-700 dark:text-slate-200 truncate" title={fazendaMap.get(animal.fazendaId)}>{fazendaMap.get(animal.fazendaId) || '-'}</div>}
                        {visibleColumns.tags && <div className="px-2 sm:px-3 py-1.5 text-sm min-w-0"><AnimalTags tags={animalTagsMap.get(animal.id)} /></div>}
                        {visibleColumns.acoes && <div className="px-2 sm:px-3 py-1.5 text-center min-w-[150px]"><div className="flex items-center justify-center gap-2 flex-nowrap shrink-0">
                          <button type="button" onClick={() => { setHistoricoEntityId(animal.id); setHistoricoOpen(true); }} className={`p-1 shrink-0 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`} title="Ver histórico"><Icons.History className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                          <button type="button" onClick={() => { setTimelineAnimalId(animal.id); setTimelineOpen(true); }} className={`p-1 shrink-0 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`} title="Linha do tempo"><Icons.Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                          <button type="button" onClick={() => { if (matrizId) { setArvoreAnimalId(matrizAnimal?.id || matrizId); setArvoreOpen(true); } }} disabled={!matrizId} className={`p-1 shrink-0 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed`} title="Ver árvore genealógica"><Icons.GitBranch className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                          {podeEditarAnimal && <button type="button" onClick={() => handleEditarAnimal(animal)} className={`p-1 shrink-0 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`} title="Editar animal"><Icons.Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>}
                          {podeExcluirAnimal && <button type="button" onClick={() => handleExcluirAnimal(animal)} className={`p-1 shrink-0 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`} title="Excluir animal"><Icons.Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>}
                        </div></div>}
                      </div>
                    );
                  }}
                  rowProps={{}}
                  style={{ height: VIRTUAL_LIST_HEIGHT, width: '100%' }}
                  className="min-w-full"
                />
              </>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-slate-800">
                  <tr>
                    {visibleColumns.brinco && (
                      <th
                        className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                        onClick={() => handleSort('brinco')}
                      >
                        <div className="flex items-center gap-2">Brinco{sortField === 'brinco' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div>
                      </th>
                    )}
                    {visibleColumns.nome && (
                      <th
                        className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                        onClick={() => handleSort('nome')}
                      >
                        <div className="flex items-center gap-2">Nome{sortField === 'nome' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div>
                      </th>
                    )}
                    {visibleColumns.tipo && (
                      <th
                        className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                        onClick={() => handleSort('tipo')}
                      >
                        <div className="flex items-center gap-2">Tipo{sortField === 'tipo' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div>
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th
                        className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-2">Status{sortField === 'status' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div>
                      </th>
                    )}
                    {visibleColumns.matriz && (
                      <th className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase whitespace-nowrap">Matriz</th>
                    )}
                    {visibleColumns.tipoMatriz && (
                      <th className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase whitespace-nowrap">Tipo Matriz</th>
                    )}
                    {visibleColumns.sexo && (
                      <th
                        className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                        onClick={() => handleSort('sexo')}
                      >
                        <div className="flex items-center gap-2">Sexo{sortField === 'sexo' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div>
                      </th>
                    )}
                    {visibleColumns.raca && (
                      <th
                        className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                        onClick={() => handleSort('raca')}
                      >
                        <div className="flex items-center gap-1">Raça{sortField === 'raca' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div>
                      </th>
                    )}
                    {visibleColumns.fazenda && (
                      <th
                        className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                        onClick={() => handleSort('fazenda')}
                      >
                        <div className="flex items-center gap-2">Fazenda{sortField === 'fazenda' && (sortAsc ? <Icons.ArrowUp className="w-3 h-3" /> : <Icons.ArrowDown className="w-3 h-3" />)}</div>
                      </th>
                    )}
                    {visibleColumns.tags && (
                      <th className="px-2 sm:px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase whitespace-nowrap">Tags</th>
                    )}
                    {visibleColumns.acoes && (
                      <th className="sticky right-0 z-10 px-2 sm:px-3 py-1.5 text-center text-xs font-medium text-gray-500 min-w-[150px] w-[150px]
                     dark:text-slate-300 uppercase whitespace-nowrap bg-gray-100 dark:bg-slate-800 border-l border-gray-200 
                     dark:border-slate-700">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800">
                  {animaisPagina.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, COLUNAS_TABELA.filter((c) => visibleColumns[c.id]).length)}
                        className="px-4 py-6 text-center text-sm text-gray-500 dark:text-slate-400"
                      >
                        Nenhum animal cadastrado ainda.
                      </td>
                    </tr>
                  ) : (
                    animaisPagina.map((animal) => {
                      const genealogia = genealogiaMap.get(animal.id);
                      const matrizId = genealogia?.matrizId || animal.matrizId;
                      const matrizAnimal = matrizId ? animaisMap.get(matrizId) : undefined;
                      const matrizIdentificador = matrizAnimal?.brinco || '';
                      const matrizNome = matrizAnimal?.nome || '';
                      const tipoMatrizId = genealogia?.tipoMatrizId || matrizAnimal?.tipoId;
                      const tipoMatrizNome = tipoMatrizId ? tipoMap.get(tipoMatrizId) : null;
                      const isMatriz = animaisMatrizes.has(animal.id);
                      const isBezerro = !!matrizId;
                      return (
                        <tr key={animal.id} className="odd:bg-white even:bg-gray-50 dark:odd:bg-slate-900 dark:even:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700">
                          {visibleColumns.brinco && (
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{animal.brinco}</span>
                                {isMatriz && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 shrink-0" title="Matriz (tem filhos)">Matriz</span>
                                )}
                                {isBezerro && !isMatriz && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 shrink-0" title="Bezerro (tem mãe)">Bezerro</span>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.nome && (
                            <td className="px-2 sm:px-3 py-1.5 text-sm text-gray-700 dark:text-slate-200 sm:max-w-none truncate" title={animal.nome || undefined}>{animal.nome || '-'}</td>
                          )}
                          {visibleColumns.tipo && (
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-sm text-gray-700 dark:text-slate-200">{animal.tipoId ? tipoMap.get(animal.tipoId) : '-'}</td>
                          )}
                          {visibleColumns.status && (
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-sm text-gray-700 dark:text-slate-200">{animal.statusId ? statusMap.get(animal.statusId) : '-'}</td>
                          )}
                          {visibleColumns.matriz && (
                            <td className="px-2 sm:px-3 py-1.5 text-sm text-gray-700 dark:text-slate-200">
                              {matrizIdentificador ? (
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{matrizIdentificador}</div>
                                  {matrizNome?.trim() && <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{matrizNome}</div>}
                                </div>
                              ) : '-'}
                            </td>
                          )}
                          {visibleColumns.tipoMatriz && (
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-sm">
                              {tipoMatrizNome ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">{tipoMatrizNome}</span>
                              ) : (
                                <span className="text-gray-400 dark:text-slate-500">-</span>
                              )}
                            </td>
                          )}
                          {visibleColumns.sexo && (
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-sm">
                              <span className={animal.sexo === 'M' ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400'}>{animal.sexo === 'M' ? 'M' : 'F'}</span>
                            </td>
                          )}
                          {visibleColumns.raca && (
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-sm text-gray-700 dark:text-slate-200">{animal.racaId ? racaMap.get(animal.racaId) : '-'}</td>
                          )}
                          {visibleColumns.fazenda && (
                            <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap text-sm text-gray-700 dark:text-slate-200 sm:max-w-none truncate" title={fazendaMap.get(animal.fazendaId)}>{fazendaMap.get(animal.fazendaId) || '-'}</td>
                          )}
                          {visibleColumns.tags && (
                            <td className="px-2 sm:px-3 py-1.5 text-sm min-w-0 align-middle"><AnimalTags tags={animalTagsMap.get(animal.id)} /></td>
                          )}
                          {visibleColumns.acoes && (
                            <td className="sticky right-0 z-10 px-2 sm:px-3 py-1.5 whitespace-nowrap text-center align-middle bg-white dark:bg-slate-900 odd:bg-white even:bg-gray-50 dark:odd:bg-slate-900 dark:even:bg-slate-800 border-l border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 min-w-[150px] w-[150px]">
                              <div className="flex items-center justify-center gap-2 flex-nowrap">
                                <button
                                  onClick={() => { setHistoricoEntityId(animal.id); setHistoricoOpen(true); }}
                                  className={`p-1 shrink-0 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                                  title="Ver histórico"
                                >
                                  <Icons.History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                                <button
                                  onClick={() => { setTimelineAnimalId(animal.id); setTimelineOpen(true); }}
                                  className={`p-1 shrink-0 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                                  title="Linha do tempo"
                                >
                                  <Icons.Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (matrizId) {
                                      setArvoreAnimalId(matrizAnimal?.id || matrizId);
                                      setArvoreOpen(true);
                                    }
                                  }}
                                  disabled={!matrizId}
                                  className={`p-1 shrink-0 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                                  title="Ver árvore genealógica"
                                >
                                  <Icons.GitBranch className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                                {podeEditarAnimal && (
                                  <button
                                    onClick={() => handleEditarAnimal(animal)}
                                    className={`p-1 shrink-0 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                                    title="Editar animal"
                                  >
                                    <Icons.Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </button>
                                )}
                                {podeExcluirAnimal && (
                                  <button
                                    onClick={() => handleExcluirAnimal(animal)}
                                    className={`p-1 shrink-0 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                                    title="Excluir animal"
                                  >
                                    <Icons.Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginação */}
          {(totalPaginas > 1 || animaisFiltrados.length > 0) && (
            <div className="bg-gray-50 dark:bg-slate-800 px-3 sm:px-4 py-3 border-t border-gray-200 dark:border-slate-700 min-w-0">
              {/* Seletor de Itens por Página */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-2 min-w-0">
                  <label className="text-sm text-gray-700 dark:text-slate-300 shrink-0">Itens por página:</label>
                  <select
                    value={itensPorPagina}
                    onChange={(e) => {
                      const novoValor = Number(e.target.value);
                      if (OPCOES_ITENS_POR_PAGINA.includes(novoValor)) {
                        setItensPorPagina(novoValor);
                        setPaginaAtual(1); // Resetar para primeira página ao mudar itens por página
                      }
                    }}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
                  >
                    {OPCOES_ITENS_POR_PAGINA.map(opcao => (
                      <option key={opcao} value={opcao}>{opcao}</option>
                    ))}
                  </select>
                </div>
                <div className="text-sm text-gray-700 dark:text-slate-300 min-w-0 truncate">
                  Total: <span className="font-medium">{animaisFiltrados.length}</span> {animaisFiltrados.length === 1 ? 'animal' : 'animais'}
                  {animaisRaw.length !== animaisFiltrados.length && (
                    <span className="text-gray-500 dark:text-slate-400 ml-1">(de {animaisRaw.filter(a => !a.deletedAt).length} total)</span>
                  )}
                </div>
              </div>

              {/* Navegação de Páginas */}
              {totalPaginas > 1 && (
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2">
                  <div className="text-sm text-gray-700 dark:text-slate-300 min-w-0">
                    Página {paginaAtual} de {totalPaginas}
                    {animaisPagina.length > 0 && (
                      <span className="text-gray-500 dark:text-slate-400 ml-1">
                        (mostrando {((paginaAtual - 1) * itensPorPagina) + 1} - {Math.min(paginaAtual * itensPorPagina, animaisFiltrados.length)})
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
                    <button
                      onClick={() => setPaginaAtual(1)}
                      disabled={paginaAtual === 1}
                      className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      title="Primeira página"
                    >
                      <Icons.ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                      disabled={paginaAtual === 1}
                      className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaAtual === totalPaginas}
                      className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Próxima
                    </button>
                    <button
                      onClick={() => setPaginaAtual(totalPaginas)}
                      disabled={paginaAtual === totalPaginas}
                      className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      title="Última página"
                    >
                      <Icons.ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Animal (lazy) */}
      {modalOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"><div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" /></div>}>
          <AnimalModal
            open={modalOpen}
            mode={modalMode}
            initialData={animalEditando}
            onClose={() => {
              setModalOpen(false);
              setAnimalEditando(null);
            }}
            onSaved={() => { }}
          />
        </Suspense>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />

      {/* Histórico de Alterações (lazy) */}
      {historicoOpen && historicoEntityId && (
        <Suspense fallback={null}>
          <HistoricoAlteracoes
            open={historicoOpen}
            entity="animal"
            entityId={historicoEntityId}
            entityNome={animaisFiltrados.find(a => a.id === historicoEntityId)?.brinco}
            onClose={() => {
              setHistoricoOpen(false);
              setHistoricoEntityId(null);
            }}
          />
        </Suspense>
      )}

      {/* Árvore Genealógica (lazy) */}
      {arvoreAnimalId && arvoreOpen && (
        <Suspense fallback={null}>
          <ArvoreGenealogica
            open={arvoreOpen}
            matrizId={arvoreAnimalId}
            onClose={() => {
              setArvoreOpen(false);
              setArvoreAnimalId(null);
            }}
          />
        </Suspense>
      )}

      {/* Linha do tempo do animal (lazy) */}
      {timelineOpen && timelineAnimalId && (
        <Modal
          open={timelineOpen}
          onClose={() => {
            setTimelineOpen(false);
            setTimelineAnimalId(null);
          }}
          ariaLabel="Linha do tempo do animal"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 flex flex-col w-full sm:w-[min(32rem,90vw)] max-h-[85vh] sm:max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 shrink-0 bg-gray-50 dark:bg-slate-800/50">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Linha do tempo</h2>
                {timelineData?.animal?.brinco && (
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Brinco {timelineData.animal.brinco}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setTimelineOpen(false); setTimelineAnimalId(null); }}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 transition-colors"
                aria-label="Fechar"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {timelineData ? (
                <Suspense fallback={<div className="py-8 text-center text-gray-500 dark:text-slate-400">Carregando...</div>}>
                  <TimelineAnimal
                    animal={timelineData.animal}
                    desmama={timelineData.desmama}
                    pesagens={timelineData.pesagens}
                    vacinacoes={timelineData.vacinacoes}
                    confinamentoVinculos={timelineData.confinamentoVinculos}
                    ocorrencias={timelineData.ocorrencias}
                  />
                </Suspense>
              ) : (
                <div className="py-8 text-center text-gray-500 dark:text-slate-400">Carregando dados...</div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
