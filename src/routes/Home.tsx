import { useMemo, useState, useEffect, useRef, useCallback, useDeferredValue } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '../db/dexieDB';
import useSync from '../hooks/useSync';
import Combobox from '../components/Combobox';
import ModalRaca from '../components/ModalRaca';
import NascimentoModal, { VerificarBrincoFn } from '../components/NascimentoModal';
import PesagemModal from '../components/PesagemModal';
import VacinaModal from '../components/VacinaModal';
import TimelineAnimal from '../components/TimelineAnimal';
import { Icons } from '../utils/iconMapping';
import ConfirmDialog from '../components/ConfirmDialog';
import { cleanDuplicateNascimentos } from '../utils/cleanDuplicates';
import { uuid } from '../utils/uuid';
import { gerarRelatorioPDF, gerarRelatorioProdutividadePDF, gerarRelatorioDesmamaPDF, gerarRelatorioMortalidadePDF } from '../utils/gerarRelatorioPDF';
import { exportarParaExcel, exportarParaCSV } from '../utils/exportarDados';
import { showToast } from '../utils/toast';
import { useAuth } from '../hooks/useAuth';
import { registrarAudit } from '../utils/audit';
import HistoricoAlteracoes from '../components/HistoricoAlteracoes';
import { useFavoritos } from '../hooks/useFavoritos';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getThemeClasses, getTitleTextClass, getPrimaryBadgeClass, getPrimaryCardClass, getPrimaryActionButtonLightClass, getPrimaryBgClass, getCheckboxClass } from '../utils/themeHelpers';

const OPCOES_ITENS_POR_PAGINA = [10, 20, 50, 70, 100];
const ITENS_POR_PAGINA_PADRAO = 10;

type ColunaChave =
  | 'matriz'
  | 'novilha'
  | 'vaca'
  | 'sexo'
  | 'raca'
  | 'brinco'
  | 'morto'
  | 'pesoDesmama'
  | 'dataDesmama'
  | 'obs';

type ColunasVisiveis = Record<ColunaChave, boolean>;

interface ColunaConfigItem {
  chave: ColunaChave;
  label: string;
}

const COLUNAS_DISPONIVEIS: ColunaConfigItem[] = [
  { chave: 'matriz', label: 'Matriz' },
  { chave: 'novilha', label: 'Novilha' },
  { chave: 'vaca', label: 'Vaca' },
  { chave: 'sexo', label: 'Sexo' },
  { chave: 'raca', label: 'Raça' },
  { chave: 'brinco', label: 'Número brinco' },
  { chave: 'morto', label: 'Morto' },
  { chave: 'pesoDesmama', label: 'Peso desmama' },
  { chave: 'dataDesmama', label: 'Data desmama' },
  { chave: 'obs', label: 'Observação' }
];

const COLUNAS_VISIVEIS_PADRAO: ColunasVisiveis = {
  matriz: true,
  novilha: true,
  vaca: true,
  sexo: true,
  raca: true,
  brinco: true,
  morto: true,
  pesoDesmama: true,
  dataDesmama: true,
  obs: true
};

const STORAGE_COLUNAS_KEY = 'gf-colunas-nascimento-desmama';

const schemaNascimento = z.object({
  fazendaId: z.string().min(1, 'Selecione a fazenda'),
  mes: z.number().min(1, 'Informe um mês válido').max(12, 'Informe um mês válido'),
  ano: z.number().min(2000, 'Informe um ano válido').max(2100, 'Informe um ano válido'),
  matrizId: z.string().min(1, 'Informe a matriz'),
  tipo: z.enum(['novilha', 'vaca'], { required_error: 'Selecione o tipo: Vaca ou Novilha' }),
  brincoNumero: z.string().optional(),
  dataNascimento: z.string().min(1, 'Informe a data de nascimento'),
  sexo: z.enum(['M', 'F'], { required_error: 'Selecione o sexo' }),
  raca: z.string().optional(),
  obs: z.string().optional(),
  morto: z.boolean().optional(),
  dataDesmama: z.string().optional(),
  pesoDesmama: z.string().optional()
});

type FormDataNascimento = z.infer<typeof schemaNascimento>;

export default function Home() {
  useSync();
  const { user: currentUser } = useAuth();
  const { favoritos, isFavorito, toggleFavorito } = useFavoritos();
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalNovoNascimentoOpen, setModalNovoNascimentoOpen] = useState(false);
  const [modalEditarNascimentoOpen, setModalEditarNascimentoOpen] = useState(false);
  const [modalPesagemOpen, setModalPesagemOpen] = useState(false);
  const [pesagemNascimentoId, setPesagemNascimentoId] = useState<string | null>(null);
  const [pesagemEditando, setPesagemEditando] = useState<any | null>(null);
  const [modalVacinaOpen, setModalVacinaOpen] = useState(false);
  const [vacinaNascimentoId, setVacinaNascimentoId] = useState<string | null>(null);
  const [vacinaEditando, setVacinaEditando] = useState<any | null>(null);
  const [nascimentoEditandoId, setNascimentoEditandoId] = useState<string | null>(null);
  const [abaAtivaEdicao, setAbaAtivaEdicao] = useState<'nascimento' | 'desmama'>('nascimento');
  const [modalRacaOpen, setModalRacaOpen] = useState(false);
  const [novaRacaSelecionada, setNovaRacaSelecionada] = useState<string | undefined>(undefined);
  const [matrizHistoricoOpen, setMatrizHistoricoOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoEntityId, setHistoricoEntityId] = useState<string | null>(null);
  const [historicoEntityNome, setHistoricoEntityNome] = useState<string>('');
  const [matrizHistoricoId, setMatrizHistoricoId] = useState<string | null>(null);
  const [abaHistoricoMatriz, setAbaHistoricoMatriz] = useState<'tabela' | 'timeline'>('tabela');
  const [timelineAnimalId, setTimelineAnimalId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingEdicao, setIsSubmittingEdicao] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [menuExportarAberto, setMenuExportarAberto] = useState(false);
  const menuExportarRef = useRef<HTMLDivElement>(null);
  const [menuColunasAberto, setMenuColunasAberto] = useState(false);
  const menuColunasRef = useRef<HTMLDivElement | null>(null);
  const matrizInputRef = useRef<HTMLInputElement>(null);
  const matrizInputRefEdicao = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    onConfirm: () => {}
  });
  
  // Garantir que o banco está aberto ao montar o componente
  useEffect(() => {
    const initDB = async () => {
      try {
        if (!db.isOpen()) {
          await db.open();
        }
      } catch (error) {
        console.error('Erro ao abrir banco de dados:', error);
        // Tentar novamente após um delay
        setTimeout(() => setForceRefresh(prev => prev + 1), 1000);
      }
    };
    initDB();
  }, []);
  
  // Limpar duplicados uma vez ao carregar a página
  useEffect(() => {
    cleanDuplicateNascimentos().catch(err => {
      console.error('Erro ao limpar duplicados:', err);
    });
  }, []);
  
  // Filtros - ler da URL ou usar valores padrão
  const filtroMesFromUrl = searchParams.get('mes');
  const filtroAnoFromUrl = searchParams.get('ano');
  const filtroFazendaFromUrl = searchParams.get('fazenda');
  const filtroMatrizBrincoFromUrl = searchParams.get('matrizBrinco');
  const filtroSexoFromUrl = searchParams.get('sexo');
  const filtroStatusFromUrl = searchParams.get('status');
  const filtroBuscaGlobalFromUrl = searchParams.get('busca');
  const paginaFromUrl = searchParams.get('pagina');
  const itensPorPaginaFromUrl = searchParams.get('itens');
  
  // Converter filtroMes para array de números
  const [filtroMes, setFiltroMes] = useState<number[]>(() => {
    if (filtroMesFromUrl) {
      // Se vier da URL, pode ser um único valor ou múltiplos separados por vírgula
      const meses = filtroMesFromUrl.split(',').map(m => Number(m.trim())).filter(m => !isNaN(m) && m >= 1 && m <= 12);
      return meses.length > 0 ? meses : [];
    }
    return [];
  });
  const [filtroAno, setFiltroAno] = useState<number | ''>(
    filtroAnoFromUrl ? Number(filtroAnoFromUrl) : ''
  );
  const [filtroFazenda, setFiltroFazenda] = useState<string>(filtroFazendaFromUrl || '');
  const [filtroMatrizBrinco, setFiltroMatrizBrinco] = useState<string>(filtroMatrizBrincoFromUrl || '');
  const [filtroSexo, setFiltroSexo] = useState<'' | 'M' | 'F'>(filtroSexoFromUrl === 'M' || filtroSexoFromUrl === 'F' ? (filtroSexoFromUrl as 'M' | 'F') : '');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'vivos' | 'mortos'>(filtroStatusFromUrl === 'vivos' || filtroStatusFromUrl === 'mortos' ? (filtroStatusFromUrl as 'vivos' | 'mortos') : 'todos');
  const [buscaGlobal, setBuscaGlobal] = useState<string>(filtroBuscaGlobalFromUrl || '');
  const [buscasRecentes, setBuscasRecentes] = useState<string[]>([]);
  const [paginaAtual, setPaginaAtual] = useState<number>(
    paginaFromUrl ? Number(paginaFromUrl) : 1
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => {
    const valor = itensPorPaginaFromUrl ? Number(itensPorPaginaFromUrl) : ITENS_POR_PAGINA_PADRAO;
    return OPCOES_ITENS_POR_PAGINA.includes(valor) ? valor : ITENS_POR_PAGINA_PADRAO;
  });

  const [colunasVisiveis, setColunasVisiveis] = useState<ColunasVisiveis>(() => {
    if (typeof window === 'undefined') return COLUNAS_VISIVEIS_PADRAO;
    try {
      const saved = localStorage.getItem(STORAGE_COLUNAS_KEY);
      if (!saved) return COLUNAS_VISIVEIS_PADRAO;
      const parsed = JSON.parse(saved) as Partial<ColunasVisiveis>;
      return { ...COLUNAS_VISIVEIS_PADRAO, ...parsed };
    } catch {
      return COLUNAS_VISIVEIS_PADRAO;
    }
  });

  // Persistir preferências de colunas da tabela
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_COLUNAS_KEY, JSON.stringify(colunasVisiveis));
    } catch (err) {
      console.warn('Não foi possível salvar preferências de colunas:', err);
    }
  }, [colunasVisiveis]);

  // Ref para controlar auto-seleção inicial de fazenda (não interferir quando usuário escolhe "Todas")
  const autoFazendaSelecionadaRef = useRef(false);

  const totalColunasTabela =
    (colunasVisiveis.matriz ? 1 : 0) +
    (colunasVisiveis.novilha ? 1 : 0) +
    (colunasVisiveis.vaca ? 1 : 0) +
    (colunasVisiveis.sexo ? 1 : 0) +
    (colunasVisiveis.raca ? 1 : 0) +
    (colunasVisiveis.brinco ? 1 : 0) +
    (colunasVisiveis.morto ? 1 : 0) +
    (colunasVisiveis.pesoDesmama ? 1 : 0) +
    (colunasVisiveis.dataDesmama ? 1 : 0) +
    (colunasVisiveis.obs ? 1 : 0) +
    1; // AÇÕES

  // Carregar fazendas antes de usar no useEffect
  const fazendasRaw = useLiveQuery(
    async () => {
      try {
        if (!db.isOpen()) {
          await db.open();
        }
        const result = await db.fazendas.toArray();
        return result || [];
      } catch (error) {
        console.error('Erro ao carregar fazendas:', error);
        return [];
      }
    },
    [forceRefresh]
  ) || [];
  
  const fazendas = useMemo(() => {
    if (!fazendasRaw || !Array.isArray(fazendasRaw) || fazendasRaw.length === 0) return [];
    return [...fazendasRaw].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [fazendasRaw]);

  // Selecionar primeira fazenda automaticamente APENAS na inicialização (se não vier na URL)
  useEffect(() => {
    if (autoFazendaSelecionadaRef.current) return;
    if (!filtroFazendaFromUrl && Array.isArray(fazendas) && fazendas.length > 0 && filtroFazenda === '') {
      const primeiraFazenda = fazendas[0];
      if (primeiraFazenda && primeiraFazenda.id) {
        setFiltroFazenda(primeiraFazenda.id);
      }
    }
    autoFazendaSelecionadaRef.current = true;
  }, [fazendas, filtroFazendaFromUrl]);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroMes, filtroAno, filtroFazenda, filtroMatrizBrinco, filtroSexo, filtroStatus, buscaGlobal]);
  
  // Estado para controlar o dropdown de meses
  const [menuMesesAberto, setMenuMesesAberto] = useState(false);
  const menuMesesRef = useRef<HTMLDivElement>(null);
  
  // Fechar menu de meses ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuMesesRef.current && !menuMesesRef.current.contains(event.target as Node)) {
        setMenuMesesAberto(false);
      }
    };

    if (menuMesesAberto) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuMesesAberto]);

  // Atualizar URL quando filtros, página ou itens por página mudarem
  useEffect(() => {
    const params = new URLSearchParams();
    if (filtroMes.length > 0) {
      params.set('mes', filtroMes.join(','));
    }
    if (filtroAno !== '') {
      params.set('ano', String(filtroAno));
    }
    if (filtroFazenda) {
      params.set('fazenda', filtroFazenda);
    }
    if (filtroMatrizBrinco) {
      params.set('matrizBrinco', filtroMatrizBrinco);
    }
    if (filtroSexo) {
      params.set('sexo', filtroSexo);
    }
    if (filtroStatus && filtroStatus !== 'todos') {
      params.set('status', filtroStatus);
    }
    if (buscaGlobal.trim()) {
      params.set('busca', buscaGlobal.trim());
    }
    if (paginaAtual > 1) {
      params.set('pagina', String(paginaAtual));
    }
    if (itensPorPagina !== ITENS_POR_PAGINA_PADRAO) {
      params.set('itens', String(itensPorPagina));
    }
    
    const newParams = params.toString();
    const currentParams = searchParams.toString();
    if (currentParams !== newParams) {
      setSearchParams(params, { replace: true });
    }
  }, [filtroMes, filtroAno, filtroFazenda, filtroMatrizBrinco, paginaAtual, itensPorPagina, searchParams, setSearchParams]);

  // Query otimizada: buscar todos os nascimentos (ordenação será feita em memória)
  const nascimentosTodosRaw = useLiveQuery(
    async () => {
      try {
        // Verificar se o banco está aberto
        if (!db.isOpen()) {
          await db.open();
        }
        const result = await db.nascimentos.toArray();
        return result || [];
      } catch (error) {
        console.error('Erro ao carregar nascimentos:', error);
        // Tentar novamente após um delay
        setTimeout(() => setForceRefresh(prev => prev + 1), 1000);
        return [];
      }
    },
    [forceRefresh]
  );
  
  // Remover duplicados e ordenar por createdAt (mais antigos primeiro, mais recentes por último)
  const nascimentosTodos = useMemo(() => {
    if (!nascimentosTodosRaw || !Array.isArray(nascimentosTodosRaw)) return [];
    if (nascimentosTodosRaw.length === 0) return [];
    
    // Remover duplicados baseado no ID (UUID) e remoteId
    const uniqueByUuid = new Map<string, typeof nascimentosTodosRaw[0]>();
    const uniqueByRemoteId = new Map<number, typeof nascimentosTodosRaw[0]>();
    
    for (const n of nascimentosTodosRaw) {
      // Processar por UUID
      if (!uniqueByUuid.has(n.id)) {
        uniqueByUuid.set(n.id, n);
      } else {
        // Se já existe com mesmo UUID, manter o melhor
        const existing = uniqueByUuid.get(n.id)!;
        const shouldReplace = 
          (n.remoteId && !existing.remoteId) || 
          (n.remoteId && existing.remoteId && n.remoteId === existing.remoteId && 
           n.updatedAt && existing.updatedAt && new Date(n.updatedAt) > new Date(existing.updatedAt)) ||
          (!n.remoteId && !existing.remoteId && 
           n.updatedAt && existing.updatedAt && new Date(n.updatedAt) > new Date(existing.updatedAt));
        
        if (shouldReplace) {
          uniqueByUuid.set(n.id, n);
        }
      }
      
      // Processar por remoteId (se tiver)
      if (n.remoteId) {
        if (!uniqueByRemoteId.has(n.remoteId)) {
          uniqueByRemoteId.set(n.remoteId, n);
        } else {
          // Se já existe com mesmo remoteId mas UUID diferente, manter o que tem UUID correto ou mais recente
          const existing = uniqueByRemoteId.get(n.remoteId)!;
          const shouldReplace = 
            (n.updatedAt && existing.updatedAt && new Date(n.updatedAt) > new Date(existing.updatedAt));
          
          if (shouldReplace) {
            // Remover o antigo do mapa por UUID também
            if (uniqueByUuid.has(existing.id)) {
              uniqueByUuid.delete(existing.id);
            }
            uniqueByRemoteId.set(n.remoteId, n);
            uniqueByUuid.set(n.id, n);
          }
        }
      }
    }
    
    // Converter para array e ordenar
    const uniqueArray = Array.from(uniqueByUuid.values());
    
    return uniqueArray.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    });
  }, [nascimentosTodosRaw]);
  
  // Uso de fazendas e raças (para ordenar por mais utilizadas)
  const usoFazenda = useMemo(() => {
    const map = new Map<string, number>();
    if (!Array.isArray(nascimentosTodos)) return map;
    for (const n of nascimentosTodos) {
      if (!n.fazendaId) continue;
      map.set(n.fazendaId, (map.get(n.fazendaId) || 0) + 1);
    }
    return map;
  }, [nascimentosTodos]);

  const usoRaca = useMemo(() => {
    const map = new Map<string, number>();
    if (!Array.isArray(nascimentosTodos)) return map;
    for (const n of nascimentosTodos) {
      const nomeRaca = (n.raca || '').trim();
      if (!nomeRaca) continue;
      map.set(nomeRaca, (map.get(nomeRaca) || 0) + 1);
    }
    return map;
  }, [nascimentosTodos]);
  
  const matrizes = useLiveQuery(() => db.matrizes.toArray(), []) || [];
  
  // Mapa de matrizes por ID (UUID) para buscar identificador
  const matrizMap = useMemo(() => {
    const map = new Map<string, string>(); // ID -> identificador
    matrizes.forEach((m) => {
      if (m.id && m.identificador) {
        map.set(m.id, m.identificador);
      }
    });
    return map;
  }, [matrizes]);

  // Carregar pesagens
  const pesagens = useLiveQuery(
    async () => {
      try {
        if (!db.isOpen()) {
          await db.open();
        }
        const result = await db.pesagens.toArray();
        return result || [];
      } catch (error) {
        console.error('Erro ao carregar pesagens:', error);
        return [];
      }
    },
    [forceRefresh]
  ) || [];

  // Carregar vacinações
  const vacinacoes = useLiveQuery(
    async () => {
      try {
        if (!db.isOpen()) {
          await db.open();
        }
        const result = await db.vacinacoes.toArray();
        return result || [];
      } catch (error) {
        console.error('Erro ao carregar vacinações:', error);
        return [];
      }
    },
    [forceRefresh]
  ) || [];

  const desmamas = useLiveQuery(
    async () => {
      try {
        if (!db.isOpen()) {
          await db.open();
        }
        const result = await db.desmamas.toArray();
        return result || [];
      } catch (error) {
        console.error('Erro ao carregar desmamas:', error);
        return [];
      }
    },
    [forceRefresh]
  ) || [];
  
  // fazendas já foi definido acima, antes do useEffect
  const racasRaw = useLiveQuery(
    async () => {
      try {
        if (!db.isOpen()) {
          await db.open();
        }
        const result = await db.racas.toArray();
        return result || [];
      } catch (error) {
        console.error('Erro ao carregar raças:', error);
        return [];
      }
    },
    [forceRefresh]
  ) || [];
  
  const racas = useMemo(() => {
    if (!racasRaw || !Array.isArray(racasRaw) || racasRaw.length === 0) return [];
    return [...racasRaw].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [racasRaw]);

  const fazendaOptions = useMemo(() => {
    if (!Array.isArray(fazendas) || fazendas.length === 0) {
      return [{ label: 'Todas', value: '' }];
    }
    const ordenadas = [...fazendas].sort((a, b) => {
      const usoA = usoFazenda.get(a.id) || 0;
      const usoB = usoFazenda.get(b.id) || 0;
      if (usoA !== usoB) return usoB - usoA; // mais usadas primeiro
      return (a.nome || '').localeCompare(b.nome || '');
    });
    return [{ label: 'Todas', value: '' }, ...ordenadas.map(f => ({ label: f.nome, value: f.id }))];
  }, [fazendas, usoFazenda]);

  const racasOptions = useMemo(() => {
    if (!Array.isArray(racas) || racas.length === 0) return [];
    const ordenadas = [...racas].sort((a, b) => {
      const nomeA = (a.nome || '').trim();
      const nomeB = (b.nome || '').trim();
      
      // Favoritos primeiro
      const favA = favoritos.racas.includes(nomeA);
      const favB = favoritos.racas.includes(nomeB);
      if (favA && !favB) return -1;
      if (!favA && favB) return 1;
      
      // Depois por uso
      const usoA = usoRaca.get(nomeA) || 0;
      const usoB = usoRaca.get(nomeB) || 0;
      if (usoA !== usoB) return usoB - usoA;
      
      // Por último, alfabeticamente
      return nomeA.localeCompare(nomeB);
    });
    return ordenadas.map(r => ({ label: r.nome, value: r.nome }));
  }, [racas, usoRaca, favoritos.racas]);
  
  // Versão string[] para compatibilidade com NascimentoModal (se ainda for usado)
  const racasOptionsStrings = useMemo(() => {
    return racasOptions.map(opt => opt.value);
  }, [racasOptions]);

  // Carregar buscas recentes do localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('gf-buscas-recentes');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setBuscasRecentes(parsed.slice(0, 5));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar buscas recentes:', error);
    }
  }, []);

  const salvarBuscaRecente = useCallback((termo: string) => {
    const t = termo.trim();
    if (!t) return;
    setBuscasRecentes((prev) => {
      const semDuplicata = prev.filter((item) => item.toLowerCase() !== t.toLowerCase());
      const atualizado = [t, ...semDuplicata].slice(0, 5);
      localStorage.setItem('gf-buscas-recentes', JSON.stringify(atualizado));
      return atualizado;
    });
  }, []);

  const normalizarBrinco = useCallback((valor?: string) => {
    return (valor || '').trim().toLowerCase();
  }, []);

  const verificarBrincoDuplicado = useCallback(
    async (brincoNumero?: string, fazendaId?: string, ignorarId?: string) => {
      if (!brincoNumero || !fazendaId) return false;
      const alvo = normalizarBrinco(brincoNumero);
      if (!alvo) return false;

      const todos = await db.nascimentos.toArray();
      return todos.some((n) => {
        const mesmoBrinco = normalizarBrinco(n.brincoNumero) === alvo;
        const mesmaFazenda = n.fazendaId === fazendaId;
        const naoEhMesmoRegistro = n.id !== ignorarId;
        return mesmoBrinco && mesmaFazenda && naoEhMesmoRegistro;
      });
    },
    [normalizarBrinco]
  );

  const normalizarDataInput = useCallback((valor: string) => {
    const digits = valor.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  }, []);

  const handleAbrirEdicao = (id: string) => {
    setNascimentoEditandoId(id);
    setModalEditarNascimentoOpen(true);
  };

  const handleFecharEdicao = () => {
    setModalEditarNascimentoOpen(false);
    setNascimentoEditandoId(null);
    setAbaAtivaEdicao('nascimento'); // Reset para a aba de nascimento ao fechar
  };

  const handleAbrirHistoricoMatriz = (matrizId: string) => {
    setMatrizHistoricoId(matrizId);
    setMatrizHistoricoOpen(true);
  };

  const handleFecharHistoricoMatriz = () => {
    setMatrizHistoricoOpen(false);
    setMatrizHistoricoId(null);
  };

  // Valores padrão para o formulário: mês e ano atual
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  const { register: registerNascimento, handleSubmit: handleSubmitNascimento, formState: { errors: errorsNascimento }, reset: resetNascimento, setValue: setValueNascimento, watch: watchNascimento, setError: setErrorNascimento, getValues: getValuesNascimento } = useForm<FormDataNascimento>({ 
    resolver: zodResolver(schemaNascimento),
    defaultValues: {
      mes: mesAtual,
      ano: anoAtual
    },
    shouldUnregister: false // Manter valores ao perder foco
  });

  // Observar campos que devem ser mantidos
  // Remover watch() desnecessários que causam re-renders a cada digitação
  // Usar getValues() apenas quando necessário (ex: no handleLimpar)
  // const fazendaIdForm = watchNascimento('fazendaId');
  // const mesForm = watchNascimento('mes');
  // const anoForm = watchNascimento('ano');
  // const dataNascimentoForm = watchNascimento('dataNascimento');

  const handleRacaCadastrada = (racaNome: string) => {
    setValueNascimento('raca', racaNome);
  };

  const handleRacaCadastradaEdicao = (racaNome: string) => {
    setValueEdicao('raca', racaNome);
  };

  async function onSubmitNascimento(values: FormDataNascimento) {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // Validação de brinco duplicado por fazenda (case-insensitive)
      if (values.brincoNumero && values.fazendaId) {
        const duplicado = await verificarBrincoDuplicado(values.brincoNumero, values.fazendaId);
        if (duplicado) {
          setErrorNascimento('brincoNumero', { type: 'manual', message: 'Brinco já cadastrado para esta fazenda.' });
          setIsSubmitting(false);
          return;
        }
      }

      // Criar matriz automaticamente se não existir
      const { criarMatrizSeNaoExistir } = await import('../utils/criarMatrizAutomatica');
      let matrizId = values.matrizId;
      try {
        matrizId = await criarMatrizSeNaoExistir(
          values.matrizId,
          values.fazendaId,
          values.tipo,
          values.raca
        );
      } catch (error) {
        console.error('Erro ao criar matriz automaticamente:', error);
        // Continuar com o matrizId original mesmo se der erro
      }

      const id = uuid();
      const now = new Date().toISOString();
      
      // Converter 'tipo' para novilha/vaca booleanos
      const novilha = values.tipo === 'novilha';
      const vaca = values.tipo === 'vaca';
      
      const novoNascimento = { 
        fazendaId: values.fazendaId,
        mes: Number(values.mes),
        ano: Number(values.ano),
        matrizId: matrizId,
        brincoNumero: values.brincoNumero || '',
        dataNascimento: values.dataNascimento || '',
        sexo: values.sexo,
        raca: values.raca || '',
        obs: values.obs || '',
        morto: values.morto || false,
        novilha,
        vaca,
        id, 
        createdAt: now, 
        updatedAt: now, 
        synced: false 
      } as const;
      
      await db.nascimentos.add(novoNascimento);

      // Auditoria: criação de nascimento
      await registrarAudit({
        entity: 'nascimento',
        entityId: id,
        action: 'create',
        before: null,
        after: novoNascimento,
        user: currentUser ? { id: currentUser.id, nome: currentUser.nome } : null,
        description: 'Cadastro de nascimento na planilha'
      });
      
      // Manter campos: Fazenda, Mês, Ano, Data de Nascimento, Raça, Tipo
      // Limpar apenas: Matriz, Brinco, Sexo, Obs
      const currentValues = getValuesNascimento();
      resetNascimento({
        fazendaId: currentValues.fazendaId,
        mes: currentValues.mes,
        ano: currentValues.ano,
        dataNascimento: currentValues.dataNascimento || '',
        matrizId: '',
        brincoNumero: '',
        sexo: undefined,
        raca: currentValues.raca || '',
        tipo: currentValues.tipo,
        obs: '',
        morto: false
      });

      // Focar no campo Matriz após salvar
      setTimeout(() => {
        matrizInputRef.current?.focus();
        matrizInputRef.current?.select();
      }, 200);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showToast({ type: 'error', title: 'Erro ao salvar', message: 'Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleLimparNascimento = () => {
    const currentValues = getValuesNascimento();
    resetNascimento({
      fazendaId: currentValues.fazendaId || '',
      mes: currentValues.mes || mesAtual,
      ano: currentValues.ano || anoAtual,
      dataNascimento: currentValues.dataNascimento || '',
      matrizId: '',
      brincoNumero: '',
      sexo: undefined,
      raca: '',
      tipo: undefined,
      obs: '',
      morto: false
    });
    setTimeout(() => {
      matrizInputRef.current?.focus();
    }, 100);
  };

  const nascimentoEditando = useLiveQuery(
    () => (nascimentoEditandoId ? db.nascimentos.get(nascimentoEditandoId) : undefined),
    [nascimentoEditandoId]
  );

  // Carregar desmama associada ao nascimento sendo editado
  const desmamaEditando = useLiveQuery(
    async () => {
      if (!nascimentoEditandoId) return undefined;
      const desmamas = await db.desmamas.where('nascimentoId').equals(nascimentoEditandoId).toArray();
      return desmamas.length > 0 ? desmamas[0] : undefined;
    },
    [nascimentoEditandoId]
  );

  const { register: registerEdicao, handleSubmit: handleSubmitEdicao, formState: { errors: errorsEdicao }, reset: resetEdicao, setValue: setValueEdicao, watch: watchEdicao, setError: setErrorEdicao, getValues: getValuesEdicao } = useForm<FormDataNascimento>({
    resolver: zodResolver(schemaNascimento),
    shouldUnregister: false,
    mode: 'onBlur', // Validar apenas ao perder foco, não durante digitação
    reValidateMode: 'onBlur' // Revalidar apenas ao perder foco
  });

  // Função para converter data de YYYY-MM-DD para DD/MM/YYYY se necessário
  const converterDataParaFormatoInput = useCallback((data?: string): string => {
    if (!data) return '';
    // Se já está no formato DD/MM/YYYY, retornar como está
    if (data.includes('/')) {
      return data;
    }
    // Se está no formato YYYY-MM-DD, converter para DD/MM/YYYY
    if (data.includes('-')) {
      const partes = data.split('-');
      if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
    }
    return data;
  }, []);

  // Carregar dados quando nascimento para edição for carregado
  useEffect(() => {
    if (nascimentoEditando && modalEditarNascimentoOpen) {
      const tipo = nascimentoEditando.vaca ? 'vaca' : nascimentoEditando.novilha ? 'novilha' : undefined;
      // Converter UUID da matriz para identificador para exibição
      const matrizIdentificador = matrizMap.get(nascimentoEditando.matrizId) || nascimentoEditando.matrizId;
      resetEdicao({
        fazendaId: nascimentoEditando.fazendaId,
        mes: nascimentoEditando.mes,
        ano: nascimentoEditando.ano,
        matrizId: matrizIdentificador,
        brincoNumero: nascimentoEditando.brincoNumero || '',
        dataNascimento: converterDataParaFormatoInput(nascimentoEditando.dataNascimento),
        sexo: nascimentoEditando.sexo,
        raca: nascimentoEditando.raca || '',
        tipo: tipo as 'novilha' | 'vaca' | undefined,
        obs: nascimentoEditando.obs || '',
        morto: nascimentoEditando.morto || false,
        dataDesmama: desmamaEditando?.dataDesmama ? converterDataParaFormatoInput(desmamaEditando.dataDesmama) : '',
        pesoDesmama: desmamaEditando?.pesoDesmama ? desmamaEditando.pesoDesmama.toString() : ''
      });
    }
  }, [nascimentoEditando, desmamaEditando, modalEditarNascimentoOpen, resetEdicao, converterDataParaFormatoInput, matrizMap]);

  async function onSubmitEdicao(values: FormDataNascimento) {
    if (isSubmittingEdicao || !nascimentoEditandoId) return;
    
    setIsSubmittingEdicao(true);
    try {
      // Validação de brinco duplicado por fazenda (case-insensitive)
      if (values.brincoNumero && values.fazendaId) {
        const duplicado = await verificarBrincoDuplicado(values.brincoNumero, values.fazendaId, nascimentoEditandoId);
        if (duplicado) {
          setErrorEdicao('brincoNumero', { type: 'manual', message: 'Brinco já cadastrado para esta fazenda.' });
          setIsSubmittingEdicao(false);
          return;
        }
      }

      const novilha = values.tipo === 'novilha';
      const vaca = values.tipo === 'vaca';
      
      const now = new Date().toISOString();

      const antes = nascimentoEditando || null;

      // Criar matriz automaticamente se não existir e converter identificador para UUID
      let matrizId = values.matrizId;
      if (matrizId && values.fazendaId) {
        try {
          const { criarMatrizSeNaoExistir } = await import('../utils/criarMatrizAutomatica');
          const tipo = values.tipo || (nascimentoEditando?.vaca ? 'vaca' : 'novilha');
          matrizId = await criarMatrizSeNaoExistir(
            matrizId,
            values.fazendaId,
            tipo,
            values.raca
          );
        } catch (error) {
          console.error('Erro ao criar matriz automaticamente:', error);
          // Continuar com o matrizId original mesmo se der erro
        }
      }

      const updates = {
        fazendaId: values.fazendaId,
        mes: Number(values.mes),
        ano: Number(values.ano),
        matrizId: matrizId,
        brincoNumero: values.brincoNumero || '',
        dataNascimento: values.dataNascimento || '',
        sexo: values.sexo,
        raca: values.raca || '',
        obs: values.obs || '',
        morto: values.morto || false,
        novilha,
        vaca,
        updatedAt: now,
        synced: false
      };

      await db.nascimentos.update(nascimentoEditandoId, updates);

      const depois = nascimentoEditando ? { ...nascimentoEditando, ...updates } : null;

      if (depois) {
        // Auditoria: edição de nascimento
        await registrarAudit({
          entity: 'nascimento',
          entityId: nascimentoEditandoId,
          action: 'update',
          before: antes,
          after: depois,
          user: currentUser ? { id: currentUser.id, nome: currentUser.nome } : null,
          description: 'Edição de nascimento na planilha'
        });
      }

      // Salvar ou atualizar dados de desmama
      if (values.dataDesmama || values.pesoDesmama) {
        const { uuid } = await import('../utils/uuid');
        const pesoDesmamaNum = values.pesoDesmama ? parseFloat(values.pesoDesmama) : undefined;
        
        if (desmamaEditando) {
          // Atualizar desmama existente
          const antesDesmama = { ...desmamaEditando };
          await db.desmamas.update(desmamaEditando.id, {
            dataDesmama: values.dataDesmama || desmamaEditando.dataDesmama || '',
            pesoDesmama: pesoDesmamaNum !== undefined ? pesoDesmamaNum : desmamaEditando.pesoDesmama,
            updatedAt: now,
            synced: false
          });
          
          // Auditoria: edição de desmama
          const depoisDesmama = await db.desmamas.get(desmamaEditando.id);
          if (depoisDesmama) {
            await registrarAudit({
              entity: 'desmama',
              entityId: desmamaEditando.id,
              action: 'update',
              before: antesDesmama,
              after: depoisDesmama,
              user: currentUser ? { id: currentUser.id, nome: currentUser.nome } : null,
              description: 'Edição de desmama na planilha'
            });
          }
        } else {
          // Criar nova desmama
          const novaDesmama = {
            id: uuid(),
            nascimentoId: nascimentoEditandoId,
            dataDesmama: values.dataDesmama || '',
            pesoDesmama: pesoDesmamaNum,
            createdAt: now,
            updatedAt: now,
            synced: false,
            remoteId: null
          };
          
          await db.desmamas.add(novaDesmama);
          
          // Auditoria: criação de desmama
          await registrarAudit({
            entity: 'desmama',
            entityId: novaDesmama.id,
            action: 'create',
            before: null,
            after: novaDesmama,
            user: currentUser ? { id: currentUser.id, nome: currentUser.nome } : null,
            description: 'Criação de desmama na planilha'
          });
        }
      } else if (desmamaEditando) {
        // Se não há dados de desmama mas existe registro, remover
        const antesDesmama = { ...desmamaEditando };
        await db.desmamas.delete(desmamaEditando.id);
        
        // Auditoria: exclusão de desmama
        await registrarAudit({
          entity: 'desmama',
          entityId: desmamaEditando.id,
          action: 'delete',
          before: antesDesmama,
          after: null,
          user: currentUser ? { id: currentUser.id, nome: currentUser.nome } : null,
          description: 'Exclusão de desmama na planilha'
        });
      }
      
      handleFecharEdicao();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showToast({ type: 'error', title: 'Erro ao salvar', message: 'Tente novamente.' });
    } finally {
      setIsSubmittingEdicao(false);
    }
  }


  // Aplicar filtros (mantendo a ordem de lançamento)
  const fazendaMap = useMemo(() => {
    const map = new Map<string, string>();
    fazendas.forEach((f) => {
      if (f.id) {
        map.set(f.id, f.nome || '');
      }
    });
    return map;
  }, [fazendas]);

  const nascimentosFiltrados = useMemo(() => {
    if (!nascimentosTodos || !Array.isArray(nascimentosTodos) || nascimentosTodos.length === 0) {
      return [];
    }
    
    let filtrados = nascimentosTodos;
    
    // Filtrar por mês (múltiplos meses)
    if (filtroMes.length > 0) {
      filtrados = filtrados.filter(n => filtroMes.includes(n.mes));
    }
    
    // Filtrar por ano
    if (filtroAno !== '' && filtroAno !== null && filtroAno !== undefined) {
      filtrados = filtrados.filter(n => n.ano === filtroAno);
    }
    
    // Filtrar por fazenda (só se houver uma fazenda selecionada)
    if (filtroFazenda && filtroFazenda !== '') {
      filtrados = filtrados.filter(n => n.fazendaId === filtroFazenda);
    }
    
    // Filtrar por matriz/brinco
    if (filtroMatrizBrinco && filtroMatrizBrinco.trim() !== '') {
      const busca = filtroMatrizBrinco.toLowerCase().trim();
      filtrados = filtrados.filter(n => {
        const matrizIdentificador = matrizMap.get(n.matrizId) || n.matrizId;
        const matrizMatch = matrizIdentificador?.toLowerCase().includes(busca);
        const brincoMatch = n.brincoNumero?.toLowerCase().includes(busca);
        return matrizMatch || brincoMatch;
      });
    }

    // Filtrar por sexo
    if (filtroSexo) {
      filtrados = filtrados.filter((n) => n.sexo === filtroSexo);
    }

    // Filtrar por status (vivos/mortos)
    if (filtroStatus === 'vivos') {
      filtrados = filtrados.filter((n) => !n.morto);
    } else if (filtroStatus === 'mortos') {
      filtrados = filtrados.filter((n) => n.morto);
    }

    // Busca global (matriz, brinco, raça, fazenda, obs)
    if (buscaGlobal.trim()) {
      const termo = buscaGlobal.trim().toLowerCase();
      filtrados = filtrados.filter((n) => {
        const matrizIdentificador = matrizMap.get(n.matrizId) || n.matrizId;
        const matriz = matrizIdentificador?.toLowerCase().includes(termo);
        const brinco = n.brincoNumero?.toLowerCase().includes(termo);
        const raca = n.raca?.toLowerCase().includes(termo);
        const obs = n.obs?.toLowerCase().includes(termo);
        const fazendaNome = fazendaMap.get(n.fazendaId)?.toLowerCase() || '';
        const fazendaMatch = fazendaNome.includes(termo);
        return matriz || brinco || raca || obs || fazendaMatch;
      });
    }
    
    return filtrados;
  }, [nascimentosTodos, filtroMes, filtroAno, filtroFazenda, filtroMatrizBrinco, filtroSexo, filtroStatus, buscaGlobal, fazendaMap]);

  // Paginação
  const totalPaginas = useMemo(() => {
    if (!nascimentosFiltrados || nascimentosFiltrados.length === 0) return 1;
    if (!itensPorPagina || itensPorPagina <= 0) return 1;
    return Math.ceil(nascimentosFiltrados.length / itensPorPagina);
  }, [nascimentosFiltrados, itensPorPagina]);
  
  const inicio = useMemo(() => {
    if (!itensPorPagina || itensPorPagina <= 0) return 0;
    return (paginaAtual - 1) * itensPorPagina;
  }, [paginaAtual, itensPorPagina]);
  
  const fim = useMemo(() => {
    if (!itensPorPagina || itensPorPagina <= 0) return 0;
    return inicio + itensPorPagina;
  }, [inicio, itensPorPagina]);
  const nascimentos = useMemo(() => {
    if (!nascimentosFiltrados || nascimentosFiltrados.length === 0) return [];
    if (inicio < 0 || fim < inicio) return [];
    return nascimentosFiltrados.slice(inicio, fim);
  }, [nascimentosFiltrados, inicio, fim]);

  // Adiar renderização de grandes listas para não travar inputs
  const nascimentosView = useDeferredValue(nascimentos);

  // Ajustar página atual quando itens por página mudar ou quando total de páginas mudar
  useEffect(() => {
    if (totalPaginas > 0 && paginaAtual > totalPaginas) {
      setPaginaAtual(totalPaginas);
    }
  }, [totalPaginas, paginaAtual]);

  // Criar mapa de desmamas por nascimento
  const desmamasMap = useMemo(() => {
    const map = new Map<string, typeof desmamas[0]>();
    if (desmamas) {
      desmamas.forEach(d => map.set(d.nascimentoId, d));
    }
    return map;
  }, [desmamas]);

  // Histórico da matriz selecionada
  const matrizHistorico = useMemo(() => {
    if (!matrizHistoricoId) return [];
    if (!Array.isArray(nascimentosTodos) || nascimentosTodos.length === 0) return [];

    const itens = nascimentosTodos.filter((n) => n.matrizId === matrizHistoricoId);
    if (itens.length === 0) return [];

    const lista = itens.map((n) => {
      const desmama = Array.isArray(desmamas) ? desmamas.find((d) => d && d.nascimentoId === n.id) : undefined;
      const pesagensNascimento = Array.isArray(pesagens) 
        ? pesagens.filter((p) => p && p.nascimentoId === n.id).sort((a, b) => {
            const dateA = a.dataPesagem ? new Date(a.dataPesagem).getTime() : 0;
            const dateB = b.dataPesagem ? new Date(b.dataPesagem).getTime() : 0;
            return dateA - dateB;
          })
        : [];
      const vacinacoesNascimento = Array.isArray(vacinacoes)
        ? vacinacoes.filter((v) => v && v.nascimentoId === n.id).sort((a, b) => {
            const dateA = a.dataAplicacao ? new Date(a.dataAplicacao).getTime() : 0;
            const dateB = b.dataAplicacao ? new Date(b.dataAplicacao).getTime() : 0;
            return dateA - dateB;
          })
        : [];
      const fazendaNome = fazendaMap.get(n.fazendaId) || 'Sem fazenda';
      return {
        id: n.id,
        ano: n.ano,
        mes: n.mes,
        periodo: n.mes && n.ano ? `${String(n.mes).padStart(2, '0')}/${n.ano}` : String(n.ano || ''),
        fazenda: fazendaNome,
        sexo: n.sexo || '',
        raca: n.raca || '',
        brinco: n.brincoNumero || '',
        morto: n.morto || false,
        dataNascimento: n.dataNascimento,
        dataDesmama: desmama?.dataDesmama,
        pesoDesmama: desmama?.pesoDesmama ?? null,
        pesagens: pesagensNascimento,
        vacinacoes: vacinacoesNascimento
      };
    });

    return lista.sort((a, b) => {
      const aKey = (a.ano || 0) * 100 + (a.mes || 0);
      const bKey = (b.ano || 0) * 100 + (b.mes || 0);
      return aKey - bKey;
    });
  }, [matrizHistoricoId, nascimentosTodos, desmamas, pesagens, vacinacoes, fazendaMap]);

  const matrizResumo = useMemo(() => {
    if (!matrizHistoricoId || matrizHistorico.length === 0) return null;
    const totalPartos = matrizHistorico.length;
    const mortos = matrizHistorico.filter((i) => i.morto).length;
    const vivos = totalPartos - mortos;
    const comPeso = matrizHistorico.filter((i) => i.pesoDesmama && i.pesoDesmama > 0).length;
    const somaPeso = matrizHistorico.reduce((sum, i) => sum + (i.pesoDesmama || 0), 0);
    const mediaPeso = comPeso > 0 ? somaPeso / comPeso : 0;
    return { totalPartos, vivos, mortos, comPeso, mediaPeso };
  }, [matrizHistoricoId, matrizHistorico]);

  // Calcular totais detalhados (usando dados filtrados, não paginados)
  const totais = useMemo(() => {
    const vacas = nascimentosFiltrados.filter(n => n.vaca).length;
    const novilhas = nascimentosFiltrados.filter(n => n.novilha).length;
    
    // Totais por raça
    const racasMap = new Map<string, number>();
    nascimentosFiltrados.forEach(n => {
      if (n.raca) {
        const raca = n.raca;
        racasMap.set(raca, (racasMap.get(raca) || 0) + 1);
      }
    });
    const totaisPorRaca = Array.from(racasMap.entries())
      .map(([raca, total]) => ({ raca, total }))
      .sort((a, b) => b.total - a.total);
    
    // Totais por sexo
    const femeas = nascimentosFiltrados.filter(n => n.sexo === 'F').length;
    const machos = nascimentosFiltrados.filter(n => n.sexo === 'M').length;
    
    // Total geral (soma de todas as categorias)
    const totalGeral = nascimentosFiltrados.length;
    
    return { 
      vacas, 
      novilhas, 
      femeas, 
      machos, 
      totaisPorRaca,
      totalGeral 
    };
  }, [nascimentosFiltrados]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    // Se já está em DD/MM/YYYY, manter sem conversão (evita timezone)
    if (dateStr.includes('/')) {
      const [dia, mes, ano] = dateStr.split('/');
      if (dia && mes && ano) {
        return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
      }
      return dateStr;
    }
    // Se está em YYYY-MM-DD, converter para DD/MM/YYYY sem Date()
    if (dateStr.includes('-')) {
      const [ano, mes, dia] = dateStr.split('-');
      if (ano && mes && dia) {
        return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
      }
    }
    return dateStr;
  };

  // Obter nome da fazenda selecionada
  const fazendaSelecionada = useMemo(() => {
    return fazendas.find(f => f.id === filtroFazenda);
  }, [fazendas, filtroFazenda]);

  const nomeMes = (mes: number) => {
    return new Date(2000, mes - 1).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
  };

  // Função para obter nome do mês
  const getMesNome = (mes: number) => {
    return new Date(2000, mes - 1).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
  };

  // Verificar se pode gerar relatório (Fazenda, pelo menos um Mês e Ano devem estar preenchidos)
  const podeGerarRelatorio = useMemo(() => {
    return filtroFazenda !== '' && filtroMes.length > 0 && filtroAno !== '';
  }, [filtroFazenda, filtroMes, filtroAno]);

  // Função para gerar relatório PDF
  const handleGerarRelatorio = () => {
    if (!podeGerarRelatorio || !fazendaSelecionada) {
      showToast({ type: 'warning', title: 'Filtros obrigatórios', message: 'Preencha Fazenda, Mês e Ano para gerar o relatório.' });
      return;
    }

    try {
      gerarRelatorioPDF({
        nascimentos: nascimentosFiltrados,
        desmamas: desmamasMap,
        fazendaNome: fazendaSelecionada.nome,
        mes: filtroMes.length > 0 ? filtroMes[0] : mesAtual,
        ano: filtroAno as number,
        totais: {
          vacas: totais.vacas,
          novilhas: totais.novilhas,
          femeas: totais.femeas,
          machos: totais.machos,
          totalGeral: totais.totalGeral,
          totalMortos: nascimentosFiltrados.filter(n => n.morto).length
        }
      }, matrizMap);
      setMenuExportarAberto(false);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      showToast({ type: 'error', title: 'Erro ao gerar PDF', message: 'Tente novamente.' });
    }
  };

  // Função para exportar para Excel
  const handleExportarExcel = () => {
    try {
      exportarParaExcel({
        nascimentos: nascimentosFiltrados,
        desmamas: desmamasMap,
        fazendaNome: fazendaSelecionada?.nome,
        mes: filtroMes.length > 0 ? filtroMes[0] : undefined,
        ano: filtroAno !== '' ? filtroAno as number : undefined,
        matrizMap
      });
      setMenuExportarAberto(false);
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      showToast({ type: 'error', title: 'Erro ao exportar Excel', message: 'Tente novamente.' });
    }
  };

  // Função para exportar para CSV
  const handleExportarCSV = () => {
    try {
      exportarParaCSV({
        nascimentos: nascimentosFiltrados,
        desmamas: desmamasMap,
        fazendaNome: fazendaSelecionada?.nome,
        mes: filtroMes.length > 0 ? filtroMes[0] : undefined,
        ano: filtroAno !== '' ? filtroAno as number : undefined,
        matrizMap
      });
      setMenuExportarAberto(false);
    } catch (error) {
      console.error('Erro ao exportar para CSV:', error);
      showToast({ type: 'error', title: 'Erro ao exportar CSV', message: 'Tente novamente.' });
    }
  };

  // Fechar menu de exportação ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuExportarRef.current && !menuExportarRef.current.contains(event.target as Node)) {
        setMenuExportarAberto(false);
      }
    };

    if (menuExportarAberto) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuExportarAberto]);

  // Fechar menu de colunas ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuColunasRef.current && !menuColunasRef.current.contains(event.target as Node)) {
        setMenuColunasAberto(false);
      }
    };

    if (menuColunasAberto) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuColunasAberto]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100">
      <div className="p-4 sm:p-4 text-gray-900 dark:text-slate-100">
        {(filtroMes.length > 0 && filtroAno !== '') || fazendaSelecionada ? (
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {filtroMes.length > 0 && filtroAno !== '' && (
                <>
                  MÊS{filtroMes.length > 1 ? 'ES' : ''}: {filtroMes.map(m => nomeMes(m)).join(', ')} - ANO {filtroAno}
                </>
              )}
              {fazendaSelecionada && ` ${filtroMes.length > 0 && filtroAno !== '' ? '•' : ''} ${fazendaSelecionada.nome}`}
            </p>
          </div>
        ) : null}

          {/* Filtros */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Fazenda</label>
              <Combobox
                value={filtroFazenda}
                onChange={setFiltroFazenda}
                  options={fazendaOptions}
                placeholder="Todas as fazendas"
                allowCustomValue={false}
                  favoritoTipo="fazenda"
                  isFavorito={(value) => isFavorito('fazenda', value)}
                  onToggleFavorito={(value) => toggleFavorito('fazenda', value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Mês</label>
              <div className="relative" ref={menuMesesRef}>
                <button
                  type="button"
                  onClick={() => setMenuMesesAberto(!menuMesesAberto)}
                  className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} flex items-center justify-between`}
                >
                  <span className="truncate">
                    {filtroMes.length === 0 
                      ? 'Todos os meses' 
                      : filtroMes.length === 1 
                        ? nomeMes(filtroMes[0])
                        : `${filtroMes.length} meses selecionados`
                    }
                  </span>
                  <Icons.ChevronDown className={`w-4 h-4 text-gray-400 dark:text-slate-400 transition-transform ${menuMesesAberto ? 'transform rotate-180' : ''}`} />
                </button>
                {menuMesesAberto && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 max-h-64 overflow-y-auto">
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          setFiltroMes([]);
                          setMenuMesesAberto(false);
                        }}
                        className={`w-full text-left text-sm ${getThemeClasses(primaryColor, 'text')} ${getThemeClasses(primaryColor, 'hover-text')} font-medium`}
                      >
                        Limpar seleção (Todos)
                      </button>
                    </div>
                    <div className="py-1">
                      {Array.from({ length: 12 }, (_, i) => {
                        const mes = i + 1;
                        const isSelected = filtroMes.includes(mes);
                        return (
                          <label
                            key={mes}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className={`h-4 w-4 ${getThemeClasses(primaryColor, 'text')} border-gray-300 rounded ${getThemeClasses(primaryColor, 'ring')}`}
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFiltroMes([...filtroMes, mes].sort((a, b) => a - b));
                                } else {
                                  setFiltroMes(filtroMes.filter(m => m !== mes));
                                }
                              }}
                            />
                            <span>{nomeMes(mes)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Ano</label>
              <input
                type="number"
                min="2000"
                max="2100"
                value={filtroAno}
                onChange={(e) => setFiltroAno(e.target.value === '' ? '' : Number(e.target.value))}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
                placeholder="Ano"
              />
            </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Matriz/Brinco</label>
                <input
                  type="text"
                  value={filtroMatrizBrinco}
                  onChange={(e) => setFiltroMatrizBrinco(e.target.value)}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
                  placeholder="Buscar por matriz ou brinco"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Sexo</label>
                <Combobox
                  value={filtroSexo}
                  onChange={(value) => setFiltroSexo(value as '' | 'M' | 'F')}
                  options={[
                    { label: 'Todos', value: '' },
                    { label: 'Macho', value: 'M' },
                    { label: 'Fêmea', value: 'F' }
                  ]}
                  placeholder="Todos"
                  allowCustomValue={false}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Status</label>
                <Combobox
                  value={filtroStatus}
                  onChange={(value) => setFiltroStatus(value as 'todos' | 'vivos' | 'mortos')}
                  options={[
                    { label: 'Todos', value: 'todos' },
                    { label: 'Vivos', value: 'vivos' },
                    { label: 'Mortos', value: 'mortos' }
                  ]}
                  placeholder="Todos"
                  allowCustomValue={false}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
              <div className="md:col-span-4">
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Busca global</label>
                <input
                  type="text"
                  value={buscaGlobal}
                  onChange={(e) => setBuscaGlobal(e.target.value)}
                  onBlur={(e) => {
                    const valor = e.target.value.trim();
                    if (valor) {
                      salvarBuscaRecente(valor);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const valor = buscaGlobal.trim();
                      if (valor) {
                        salvarBuscaRecente(valor);
                      }
                    }
                  }}
                    className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
                  placeholder="Brinco, matriz, fazenda, raça, obs"
                />
              </div>

              <div className="md:col-span-2 flex items-end gap-2">
              {/* Configuração de colunas */}
              <div className="relative" ref={menuColunasRef}>
                <button
                  type="button"
                  onClick={() => setMenuColunasAberto((prev) => !prev)}
                  className={`flex items-center justify-center gap-2 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-200 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} focus:ring-offset-2 transition-colors whitespace-nowrap`}
                  title="Escolher colunas da tabela"
                >
                  <Icons.SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">Colunas</span>
                  <span className="sm:hidden">Cols</span>
                </button>
                {menuColunasAberto && (
                  <div className="absolute right-0 md:right-0 left-0 md:left-auto mt-1 w-52 md:w-52 bg-white dark:bg-slate-900 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 z-50 max-h-64 overflow-y-auto">
                    <div className="px-3 py-2 text-xs text-gray-500 dark:text-slate-400">
                      Selecione as colunas que deseja visualizar na tabela.
                    </div>
                    <div className="py-1">
                      {COLUNAS_DISPONIVEIS.map((coluna) => (
                        <label
                          key={coluna.chave}
                          className="flex items-center gap-2 px-3 py-1 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className={`h-4 w-4 ${getThemeClasses(primaryColor, 'text')} border-gray-300 rounded ${getThemeClasses(primaryColor, 'ring')}`}
                            checked={colunasVisiveis[coluna.chave]}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setColunasVisiveis((prev) => ({
                                ...prev,
                                [coluna.chave]: checked
                              }));
                            }}
                          />
                          <span>{coluna.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Dropdown de Exportação */}
              <div className="relative flex-1" ref={menuExportarRef}>
                <button
                  onClick={() => setMenuExportarAberto(!menuExportarAberto)}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm ${getPrimaryButtonClass(primaryColor)} text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors`}
                  title="Exportar dados"
                >
                  <Icons.Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar</span>
                  <span className="sm:hidden">Exp</span>
                </button>
                {/* Menu Dropdown */}
                {menuExportarAberto && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <button
                        onClick={handleExportarExcel}
                        disabled={nascimentosFiltrados.length === 0}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={nascimentosFiltrados.length === 0 ? 'Nenhum nascimento encontrado nos dados filtrados' : 'Exportar dados para Excel'}
                      >
                        <Icons.FileSpreadsheet className={`w-4 h-4 ${getThemeClasses(primaryColor, 'text')}`} />
                        Exportar Excel (.xlsx)
                      </button>
                      <button
                        onClick={handleExportarCSV}
                        disabled={nascimentosFiltrados.length === 0}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={nascimentosFiltrados.length === 0 ? 'Nenhum nascimento encontrado nos dados filtrados' : 'Exportar dados para CSV'}
                      >
                        <Icons.FileSpreadsheet className={`w-4 h-4 ${getThemeClasses(primaryColor, 'text')}`} />
                        Exportar CSV (.csv)
                      </button>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={() => {
                          handleGerarRelatorio();
                          setMenuExportarAberto(false);
                        }}
                        disabled={!podeGerarRelatorio || nascimentosFiltrados.length === 0}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!podeGerarRelatorio ? 'Preencha Fazenda, Mês e Ano para gerar o relatório' : nascimentosFiltrados.length === 0 ? 'Nenhum nascimento encontrado nos dados filtrados' : 'Gerar relatório PDF'}
                      >
                        <Icons.FileText className="w-4 h-4 text-red-600" />
                        Gerar PDF
                      </button>
                      <button
                        onClick={() => {
                          try {
                            const desmamasComDados = nascimentosFiltrados
                              .filter(n => desmamasMap.has(n.id))
                              .map(n => {
                                const desmama = desmamasMap.get(n.id);
                                const fazenda = fazendas.find(f => f.id === n.fazendaId);
                                return {
                                  matrizId: n.matrizId,
                                  brinco: n.brincoNumero,
                                  fazenda: fazenda?.nome || 'Sem fazenda',
                                  raca: n.raca,
                                  sexo: n.sexo,
                                  dataNascimento: n.dataNascimento,
                                  dataDesmama: desmama?.dataDesmama,
                                  pesoDesmama: desmama?.pesoDesmama
                                };
                              });

                            const periodoLabel = filtroMes.length > 0 && filtroAno
                              ? filtroMes.length === 1
                                ? `${filtroMes[0].toString().padStart(2, '0')}/${filtroAno}`
                                : `Meses ${filtroMes.map(m => m.toString().padStart(2, '0')).join(', ')}/${filtroAno}`
                              : filtroAno
                              ? `Ano ${filtroAno}`
                              : 'Todos os períodos';

                            gerarRelatorioDesmamaPDF({
                              periodo: periodoLabel,
                              desmamas: desmamasComDados
                            }, matrizMap);
                            setMenuExportarAberto(false);
                            showToast({ type: 'success', title: 'Relatório gerado', message: 'PDF de desmama com médias de peso gerado com sucesso.' });
                          } catch (error) {
                            console.error('Erro ao gerar relatório de desmama:', error);
                            showToast({ type: 'error', title: 'Erro ao gerar PDF', message: 'Tente novamente.' });
                          }
                        }}
                        disabled={nascimentosFiltrados.filter(n => desmamasMap.has(n.id)).length === 0}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={nascimentosFiltrados.filter(n => desmamasMap.has(n.id)).length === 0 ? 'Nenhuma desmama encontrada nos dados filtrados' : 'Gerar relatório de desmama com médias de peso'}
                      >
                        <Icons.FileText className={`w-4 h-4 ${getThemeClasses(primaryColor, 'text')}`} />
                        PDF Desmama (Médias)
                      </button>
                      <button
                        onClick={() => {
                          const fazendasAgrupadas = nascimentosFiltrados.reduce((map, n) => {
                            const nome = fazendas.find((f) => f.id === n.fazendaId)?.nome || 'Sem fazenda';
                            const entry = map.get(nome) || { total: 0, mortos: 0, desmamas: 0 };
                            entry.total += 1;
                            if (n.morto) entry.mortos += 1;
                            if (desmamasMap.has(n.id)) entry.desmamas += 1;
                            map.set(nome, entry);
                            return map;
                          }, new Map<string, { total: number; mortos: number; desmamas: number }>());

                          // Formatar período: se mês específico selecionado, mostrar mês; se "Todos os meses", mostrar "Todos os períodos"
                          let periodoLabel: string;
                          if (filtroMes.length > 0) {
                            // Mês(es) específico(s) selecionado(s) - mostrar informação do(s) mês(es)
                            if (filtroMes.length === 1) {
                              const mesNum = filtroMes[0];
                              const nomeMes = new Date(2000, mesNum - 1).toLocaleDateString('pt-BR', { month: 'long' });
                              if (filtroAno !== '') {
                                const anoNum = typeof filtroAno === 'number' ? filtroAno : Number(filtroAno);
                                periodoLabel = `Mês ${mesNum.toString().padStart(2, '0')} (${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}) - Ano ${anoNum}`;
                              } else {
                                periodoLabel = `Mês ${mesNum.toString().padStart(2, '0')} (${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}) - Todos os anos`;
                              }
                            } else {
                              // Múltiplos meses
                              const mesesNomes = filtroMes.map(m => {
                                const nomeMes = new Date(2000, m - 1).toLocaleDateString('pt-BR', { month: 'long' });
                                return `${m.toString().padStart(2, '0')} (${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)})`;
                              }).join(', ');
                              if (filtroAno !== '') {
                                const anoNum = typeof filtroAno === 'number' ? filtroAno : Number(filtroAno);
                                periodoLabel = `Meses ${mesesNomes} - Ano ${anoNum}`;
                              } else {
                                periodoLabel = `Meses ${mesesNomes} - Todos os anos`;
                              }
                            }
                          } else {
                            // "Todos os meses" selecionado - mostrar "Todos os períodos"
                            periodoLabel = 'Todos os períodos';
                          }
                          const payload = Array.from(fazendasAgrupadas.entries()).map(([fazendaNome, dados]) => {
                            const vivos = dados.total - dados.mortos;
                            const taxaMortandade = dados.total > 0 ? ((dados.mortos / dados.total) * 100).toFixed(2) : '0.00';
                            const taxaDesmama = dados.total > 0 ? ((dados.desmamas / dados.total) * 100).toFixed(2) : '0.00';
                            return {
                              fazenda: fazendaNome,
                              totalNascimentos: dados.total,
                              mortos: dados.mortos,
                              vivos,
                              taxaMortandade,
                              desmamas: dados.desmamas,
                              taxaDesmama,
                              periodo: periodoLabel
                            };
                          });

                          gerarRelatorioProdutividadePDF({
                            periodo: periodoLabel,
                            fazendas: payload
                          });
                          setMenuExportarAberto(false);
                        }}
                        disabled={nascimentosFiltrados.length === 0}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={nascimentosFiltrados.length === 0 ? 'Nenhum nascimento encontrado nos dados filtrados' : 'Gerar relatório de produtividade por fazenda'}
                      >
                        <Icons.FileText className="w-4 h-4 text-indigo-600" />
                        PDF Produtividade
                      </button>
                      <button
                        onClick={() => {
                          const agrupadoPorRaca = nascimentosFiltrados.reduce((map, n) => {
                            const raca = (n.raca || 'Sem raça').toUpperCase();
                            const entry = map.get(raca) || { total: 0, mortos: 0 };
                            entry.total += 1;
                            if (n.morto) entry.mortos += 1;
                            map.set(raca, entry);
                            return map;
                          }, new Map<string, { total: number; mortos: number }>());

                          const periodoLabel = filtroMes && filtroAno
                            ? `${filtroMes.toString().padStart(2, '0')}/${filtroAno}`
                            : filtroAno
                            ? `Ano ${filtroAno}`
                            : 'Todos os períodos';

                          const linhas = Array.from(agrupadoPorRaca.entries())
                            .map(([raca, dados]) => {
                              const vivos = dados.total - dados.mortos;
                              const taxaMortandade = dados.total > 0
                                ? ((dados.mortos / dados.total) * 100).toFixed(2)
                                : '0.00';
                              return {
                                raca,
                                totalNascimentos: dados.total,
                                vivos,
                                mortos: dados.mortos,
                                taxaMortandade
                              };
                            })
                            .sort((a, b) => b.mortos - a.mortos);

                          gerarRelatorioMortalidadePDF({
                            periodo: periodoLabel,
                            linhas
                          });
                          setMenuExportarAberto(false);
                        }}
                        disabled={nascimentosFiltrados.length === 0}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={nascimentosFiltrados.length === 0 ? 'Nenhum nascimento encontrado nos dados filtrados' : 'Gerar relatório de mortalidade por raça'}
                      >
                        <Icons.FileText className="w-4 h-4 text-red-600" />
                        PDF Mortalidade (Raças)
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setFiltroMes([]);
                  setFiltroAno('');
                  setFiltroFazenda('');
                  setFiltroMatrizBrinco('');
                  setFiltroSexo('');
                  setFiltroStatus('todos');
                  setBuscaGlobal('');
                }}
                className="flex-1 px-3 py-2 text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Limpar
              </button>
            </div>
            </div>

            {/* Buscas recentes em linha separada */}
            {buscasRecentes.length > 0 && (
              <div className="w-full pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-400 whitespace-nowrap">Buscas recentes:</span>
                  {buscasRecentes.map((termo) => (
                    <button
                      key={termo}
                      type="button"
                      onClick={() => {
                        setBuscaGlobal(termo);
                        salvarBuscaRecente(termo);
                      }}
                      className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-full border border-gray-200 dark:border-slate-700 transition-colors whitespace-nowrap"
                      title={`Aplicar busca: ${termo}`}
                    >
                      {termo}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setBuscasRecentes([]);
                      localStorage.removeItem('gf-buscas-recentes');
                    }}
                    className="text-xs px-2 py-1 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 underline whitespace-nowrap"
                    title="Limpar histórico de buscas"
                  >
                    limpar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Versão Desktop - Tabela */}
        <div className="pl-4 pr-4 hidden md:block bg-white dark:bg-slate-900 shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-slate-600">
              <thead className="bg-gray-100 dark:bg-slate-600">
                <tr>
                  {colunasVisiveis.matriz && (
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300  tracking-wider border-r border-gray-300 dark:border-slate-600 w-24">
                      Matriz
                    </th>
                  )}
                  {colunasVisiveis.novilha && (
                    <th className="px-1 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-300  tracking-wider border-r border-gray-300 dark:border-slate-600 w-14">
                      Novilha
                    </th>
                  )}
                  {colunasVisiveis.vaca && (
                    <th className="px-1 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-300  tracking-wider border-r border-gray-300 dark:border-slate-600 w-14">
                      Vaca
                    </th>
                  )}
                  {colunasVisiveis.sexo && (
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-300  tracking-wider border-r border-gray-300 dark:border-slate-600 w-16">
                      Sexo
                    </th>
                  )}
                  {colunasVisiveis.raca && (
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300  tracking-wider border-r border-gray-300 dark:border-slate-600 w-28">
                      Raça
                    </th>
                  )}
                  {colunasVisiveis.brinco && (
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300  tracking-wider border-r border-gray-300 dark:border-slate-600 w-20">
                      Número
                      <br />
                      Brinco
                    </th>
                  )}
                  {colunasVisiveis.morto && (
                    <th className="px-1 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-300  tracking-wider border-r border-gray-300 dark:border-slate-600 w-16">
                      Morto
                    </th>
                  )}
                  {colunasVisiveis.pesoDesmama && (
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300  tracking-wider border-r border-gray-300 dark:border-slate-600 w-32">
                      Peso
                      <br />
                      Desmama
                    </th>
                  )}
                  {colunasVisiveis.dataDesmama && (
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300  tracking-wider border-r border-gray-300 dark:border-slate-600 w-28">
                      Data
                      <br />
                      Desmama
                    </th>
                  )}
                  {colunasVisiveis.obs && (
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300  tracking-wider border-r border-gray-300 dark:border-slate-600 max-w-[300px]">
                      Observação
                    </th>
                  )}
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-300  tracking-wider border-r border-gray-300 dark:border-slate-600 w-24 sticky right-0 z-10">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-600">
                {nascimentosView.length === 0 ? (
                  <tr>
                    <td colSpan={totalColunasTabela} className="px-4 py-8 text-center text-gray-500">
                      Nenhum nascimento cadastrado ainda.
                    </td>
                  </tr>
                ) : (
                  nascimentosView.map((n) => {
                    const desmama = desmamasMap.get(n.id);
                    const matrizIdentificador = matrizMap.get(n.matrizId) || n.matrizId;
                    return (
                      <tr
                        key={n.id}
                        className={`hover:bg-gray-50 dark:hover:bg-slate-800 ${n.morto ? 'bg-red-50 dark:bg-red-950/40' : ''}`}
                      >
                        {colunasVisiveis.matriz && (
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100 border-r border-gray-200 dark:border-slate-600">
                            <button
                              type="button"
                              onClick={() => handleAbrirHistoricoMatriz(n.matrizId)}
                              className={`text-left ${getTitleTextClass(primaryColor)} ${getThemeClasses(primaryColor, 'hover-text')} hover:underline`}
                              title="Ver histórico da matriz"
                            >
                          {matrizIdentificador}
                            </button>
                        </td>
                        )}
                        {colunasVisiveis.novilha && (
                          <td className="px-1 py-2 whitespace-nowrap text-center border-r border-gray-200 dark:border-slate-600">
                          {n.novilha ? <span className={`${getThemeClasses(primaryColor, 'text')} font-bold text-xs`}>X</span> : ''}
                        </td>
                        )}
                        {colunasVisiveis.vaca && (
                          <td className="px-1 py-2 whitespace-nowrap text-center border-r border-gray-200 dark:border-slate-600">
                          {n.vaca ? <span className={`${getThemeClasses(primaryColor, 'text')} font-bold text-xs`}>X</span> : ''}
                        </td>
                        )}
                        {colunasVisiveis.sexo && (
                          <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-slate-200 text-center border-r border-gray-200 dark:border-slate-600">
                          {n.sexo || ''}
                        </td>
                        )}
                        {colunasVisiveis.raca && (
                          <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-slate-200 border-r border-gray-200 dark:border-slate-600">
                          {n.raca || ''}
                        </td>
                        )}
                        {colunasVisiveis.brinco && (
                          <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-slate-200 border-r border-gray-200 dark:border-slate-600">
                          {n.brincoNumero || '-'}
                        </td>
                        )}
                        {colunasVisiveis.morto && (
                          <td className="px-1 py-2 whitespace-nowrap text-center border-r border-gray-200 dark:border-slate-600">
                          {n.morto ? <span className="text-red-600 dark:text-red-400 font-bold text-xs">X</span> : ''}
                        </td>
                        )}
                        {colunasVisiveis.pesoDesmama && (
                          <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-slate-200 border-r border-gray-200 dark:border-slate-600">
                          {desmama?.pesoDesmama ? (
                            <span>{desmama.pesoDesmama} kg</span>
                            ) : !desmama ? (
                              <Link 
                                to={`/desmama/${n.id}`}
                                className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium ${getPrimaryBadgeClass(primaryColor)} rounded transition-colors`}
                                title="Cadastrar desmama"
                              >
                                <Icons.Plus className="w-3 h-3 mr-0.5" />
                                <span className="hidden sm:inline">Cadastrar</span>
                              </Link>
                            ) : (
                              '-'
                          )}
                        </td>
                        )}
                        {colunasVisiveis.dataDesmama && (
                          <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-slate-200 border-r border-gray-200 dark:border-slate-600">
                          {desmama?.dataDesmama ? formatDate(desmama.dataDesmama) : '-'}
                        </td>
                        )}
                        {colunasVisiveis.obs && (
                          <td className="px-2 py-2 text-sm text-gray-700 dark:text-slate-200 border-r border-gray-200 dark:border-slate-600 max-w-[300px]">
                          <span className="block whitespace-nowrap overflow-hidden text-ellipsis" title={n.obs || ''}>
                            {n.obs || '-'}
                          </span>
                        </td>
                        )}
                        <td className="px-2 py-2 whitespace-nowrap text-sm text-center sticky right-0 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-600 z-10">
                          <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleAbrirEdicao(n.id)}
                                  className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                                  title="Editar nascimento"
                                >
                              <Icons.Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setPesagemNascimentoId(n.id);
                                setPesagemEditando(null);
                                setModalPesagemOpen(true);
                              }}
                              className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                              title="Adicionar pesagem"
                            >
                              <Icons.Scale className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setVacinaNascimentoId(n.id);
                                setVacinaEditando(null);
                                setModalVacinaOpen(true);
                              }}
                              className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                              title="Adicionar vacinação"
                            >
                              <Icons.Injection className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setHistoricoEntityId(n.id);
                                const matrizIdentificador = matrizMap.get(n.matrizId) || n.matrizId;
                                setHistoricoEntityNome(`Matriz ${matrizIdentificador}${n.brincoNumero ? ` - Brinco ${n.brincoNumero}` : ''}`);
                                setHistoricoOpen(true);
                              }}
                              className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                              title="Ver histórico de alterações"
                            >
                              <Icons.History className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                const matrizIdentificador = matrizMap.get(n.matrizId) || n.matrizId;
                                setConfirmDialog({
                                  open: true,
                                  title: 'Excluir nascimento',
                                  message: `Deseja realmente excluir o nascimento da matriz ${matrizIdentificador}?`,
                                  variant: 'danger',
                                  onConfirm: async () => {
                                    setConfirmDialog(prev => ({ ...prev, open: false }));
                                    try {
                                    // Auditoria: snapshot antes da exclusão
                                    const antes = n;

                                    // Excluir desmama associada se existir (local e remoto)
                                    const desmamasAssociadas = await db.desmamas.where('nascimentoId').equals(n.id).toArray();
                                    for (const d of desmamasAssociadas) {
                                      if (d.remoteId) {
                                        try {
                                          const { supabase } = await import('../api/supabaseClient');
                                          await supabase.from('desmamas_online').delete().eq('id', d.remoteId);
                                        } catch (err) {
                                          console.error('Erro ao excluir desmama no servidor:', err);
                                        }
                                      }
                                      await db.desmamas.delete(d.id);
                                    }
                                    
                                    // Registrar exclusão ANTES de excluir (para salvar o remoteId)
                                    const { uuid } = await import('../utils/uuid');
                                    const deletedId = uuid();
                                    
                                    await db.deletedRecords.add({
                                      id: deletedId,
                                      uuid: n.id,
                                      remoteId: n.remoteId || null,
                                      deletedAt: new Date().toISOString(),
                                      synced: false
                                    });
                                    
                                    // Excluir nascimento no servidor se tiver remoteId
                                    if (n.remoteId) {
                                      try {
                                        const { supabase } = await import('../api/supabaseClient');
                                        const { error } = await supabase
                                          .from('nascimentos_online')
                                          .delete()
                                          .eq('id', n.remoteId);
                                        
                                        if (!error) {
                                          await db.deletedRecords.update(deletedId, { synced: true });
                                        } else {
                                          console.error('Erro ao excluir no servidor:', error);
                                        }
                                      } catch (err) {
                                        console.error('Erro ao excluir nascimento no servidor:', err);
                                      }
                                    } else {
                                      await db.deletedRecords.update(deletedId, { synced: true });
                                    }
                                    
                                    // Excluir nascimento local
                                    await db.nascimentos.delete(n.id);

                                    // Auditoria: exclusão de nascimento
                                    await registrarAudit({
                                      entity: 'nascimento',
                                      entityId: n.id,
                                      action: 'delete',
                                      before: antes,
                                      after: null,
                                      user: currentUser ? { id: currentUser.id, nome: currentUser.nome } : null,
                                      description: 'Exclusão de nascimento na planilha'
                                    });
                                  } catch (error) {
                                    console.error('Erro ao excluir:', error);
                                    showToast({ type: 'error', title: 'Erro ao excluir', message: error instanceof Error ? error.message : 'Erro desconhecido' });
                                  }
                                }
                              });
                              }}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Excluir nascimento"
                            >
                              <Icons.Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Controles de Paginação */}
          {(totalPaginas > 1 || nascimentosFiltrados.length > 0) && (
            <div className="bg-white dark:bg-slate-900 px-4 py-3 border-t border-gray-200 dark:border-slate-800">
              {/* Seletor de Itens por Página */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700 dark:text-slate-300">Itens por página:</label>
                  <select
                    value={itensPorPagina}
                    onChange={(e) => {
                      const novoValor = Number(e.target.value);
                      if (OPCOES_ITENS_POR_PAGINA.includes(novoValor)) {
                        setItensPorPagina(novoValor);
                      }
                    }}
                    className={`px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} bg-white dark:bg-slate-900`}
                  >
                    {OPCOES_ITENS_POR_PAGINA.map(opcao => (
                      <option key={opcao} value={opcao}>{opcao}</option>
                    ))}
                  </select>
                </div>
                <div className="text-sm text-gray-700 dark:text-slate-300">
                  Total: <span className="font-medium">{nascimentosFiltrados.length}</span> registros
                </div>
              </div>

              {/* Navegação de Páginas */}
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between">
                  <div className="flex-1 flex items-center justify-between sm:hidden">
                    <button
                      onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                      disabled={paginaAtual === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-slate-700 text-sm font-medium rounded-md text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      Página {paginaAtual} de {totalPaginas}
                    </span>
                    <button
                      onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaAtual === totalPaginas}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-slate-700 text-sm font-medium rounded-md text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Próxima
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-slate-300">
                        Mostrando <span className="font-medium">{inicio + 1}</span> até{' '}
                        <span className="font-medium">{Math.min(fim, nascimentosFiltrados.length)}</span> de{' '}
                        <span className="font-medium">{nascimentosFiltrados.length}</span> resultados
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                          disabled={paginaAtual === 1}
                              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-gray-500 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Icons.ChevronLeft className="h-5 w-5" />
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
                              onClick={() => setPaginaAtual(paginaNumero)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                paginaAtual === paginaNumero
                                  ? `z-10 ${getThemeClasses(primaryColor, 'bg-light')} ${getThemeClasses(primaryColor, 'border')} ${getThemeClasses(primaryColor, 'text')}`
                                  : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-500 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              {paginaNumero}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                          disabled={paginaAtual === totalPaginas}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-gray-500 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Icons.ChevronRight className="h-5 w-5" />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Versão Mobile - Cards */}
        <div className="md:hidden space-y-3 mt-4">
          {nascimentosView.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm text-center text-gray-500 dark:text-slate-400">
              Nenhum nascimento cadastrado ainda.
            </div>
        ) : (
            nascimentosView.map((n) => {
              const desmama = desmamasMap.get(n.id);
              const matrizIdentificador = matrizMap.get(n.matrizId) || n.matrizId;
              return (
                <div key={n.id} className="bg-white dark:bg-slate-900 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-slate-800">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleAbrirHistoricoMatriz(n.matrizId)}
                          className={`text-sm sm:text-base font-semibold ${getTitleTextClass(primaryColor)} ${getThemeClasses(primaryColor, 'hover-text')} break-words underline-offset-2 hover:underline`}
                        >
                          Matriz: {matrizIdentificador}
                        </button>
                        {n.novilha && <span className={`px-2 py-0.5 text-xs ${getPrimaryBadgeClass(primaryColor)} rounded whitespace-nowrap`}>Novilha</span>}
                        {n.vaca && <span className={`px-2 py-0.5 text-xs ${getPrimaryBadgeClass(primaryColor)} rounded whitespace-nowrap`}>Vaca</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm text-gray-600">
                        <div><span className="font-medium">Mês/Ano:</span> {getMesNome(n.mes)}/{n.ano}</div>
                        <div><span className="font-medium">Sexo:</span> {n.sexo || '-'}</div>
                        <div><span className="font-medium">Raça:</span> {n.raca || '-'}</div>
                        <div><span className="font-medium">Brinco:</span> {n.brincoNumero || '-'}</div>
                        {n.dataNascimento ? (
                          <div><span className="font-medium">Data Nasc:</span> {formatDate(n.dataNascimento)}</div>
                        ) : (
                          <div><span className="font-medium">Data Nasc:</span> -</div>
                        )}
                        {desmama?.pesoDesmama ? (
                          <div><span className="font-medium">Peso Desmama:</span> {desmama.pesoDesmama} kg</div>
                        ) : (
                          <div><span className="font-medium">Peso Desmama:</span> -</div>
                        )}
                        {desmama?.dataDesmama ? (
                          <div><span className="font-medium">Data Desmama:</span> {formatDate(desmama.dataDesmama)}</div>
                        ) : (
                          <div><span className="font-medium">Data Desmama:</span> -</div>
                        )}
                      </div>
                      <div className="mt-2 text-xs sm:text-sm text-gray-600 break-words">
                        <span className="font-medium">Obs:</span> {n.obs || '-'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                      <button
                        onClick={() => {
                          setPesagemNascimentoId(n.id);
                          setPesagemEditando(null);
                          setModalPesagemOpen(true);
                        }}
                        className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                        title="Adicionar pesagem"
                      >
                        <Icons.Scale className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setVacinaNascimentoId(n.id);
                          setVacinaEditando(null);
                          setModalVacinaOpen(true);
                        }}
                        className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                        title="Adicionar vacinação"
                      >
                        <Icons.Injection className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAbrirEdicao(n.id)}
                        className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                        title="Editar"
                      >
                        <Icons.Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setHistoricoEntityId(n.id);
                          const matrizIdentificador = matrizMap.get(n.matrizId) || n.matrizId;
                          setHistoricoEntityNome(`Matriz ${matrizIdentificador}${n.brincoNumero ? ` - Brinco ${n.brincoNumero}` : ''}`);
                          setHistoricoOpen(true);
                        }}
                        className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                        title="Ver histórico"
                      >
                        <Icons.History className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const matrizIdentificador = matrizMap.get(n.matrizId) || n.matrizId;
                          setConfirmDialog({
                            open: true,
                            title: 'Excluir nascimento',
                            message: `Deseja realmente excluir o nascimento da matriz ${matrizIdentificador}?`,
                            variant: 'danger',
                            onConfirm: async () => {
                              setConfirmDialog(prev => ({ ...prev, open: false }));
                            try {
                              // Excluir desmama associada se existir (local e remoto)
                              const desmamasAssociadas = await db.desmamas.where('nascimentoId').equals(n.id).toArray();
                              for (const d of desmamasAssociadas) {
                                if (d.remoteId) {
                                  try {
                                    const { supabase } = await import('../api/supabaseClient');
                                    await supabase.from('desmamas_online').delete().eq('id', d.remoteId);
                                  } catch (err) {
                                    console.error('Erro ao excluir desmama no servidor:', err);
                                  }
                                }
                                await db.desmamas.delete(d.id);
                              }
                              
                              // Registrar exclusão ANTES de excluir (para salvar o remoteId)
                              const { uuid } = await import('../utils/uuid');
                              const deletedId = uuid();
                              
                              await db.deletedRecords.add({
                                id: deletedId,
                                uuid: n.id,
                                remoteId: n.remoteId || null,
                                deletedAt: new Date().toISOString(),
                                synced: false
                              });
                              
                              // Excluir nascimento no servidor se tiver remoteId
                              if (n.remoteId) {
                                try {
                                  const { supabase } = await import('../api/supabaseClient');
                                  const { error } = await supabase
                                    .from('nascimentos_online')
                                    .delete()
                                    .eq('id', n.remoteId);
                                  
                                  if (!error) {
                                    await db.deletedRecords.update(deletedId, { synced: true });
                                  } else {
                                    console.error('Erro ao excluir no servidor:', error);
                                  }
                                } catch (err) {
                                  console.error('Erro ao excluir nascimento no servidor:', err);
                                }
                              } else {
                                await db.deletedRecords.update(deletedId, { synced: true });
                              }
                              
                              // Excluir nascimento local
                              await db.nascimentos.delete(n.id);
                            } catch (error) {
                              console.error('Erro ao excluir:', error);
                              showToast({ type: 'error', title: 'Erro ao excluir', message: error instanceof Error ? error.message : 'Erro desconhecido' });
                            }
                          }
                        });
                        }}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                        title="Excluir"
                      >
                        <Icons.Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {!desmama && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <Link 
                        to={`/desmama/${n.id}`}
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium ${getPrimaryBadgeClass(primaryColor)} rounded hover:opacity-80 transition-colors`}
                      >
                        <Icons.Plus className="w-3 h-3 mr-1" />
                        Cadastrar Desmama
                      </Link>
                    </div>
                  )}
                </div>
              );
            })
          )}
          
          {/* Controles de Paginação Mobile */}
          {(totalPaginas > 1 || nascimentosFiltrados.length > 0) && (
            <div className="mt-4 bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-200">
              {/* Seletor de Itens por Página Mobile */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-700">Itens por página:</label>
                  <select
                    value={itensPorPagina}
                    onChange={(e) => {
                      const novoValor = Number(e.target.value);
                      if (OPCOES_ITENS_POR_PAGINA.includes(novoValor)) {
                        setItensPorPagina(novoValor);
                      }
                    }}
                    className={`px-2 py-1 text-xs border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} bg-white`}
                  >
                    {OPCOES_ITENS_POR_PAGINA.map(opcao => (
                      <option key={opcao} value={opcao}>{opcao}</option>
                    ))}
                  </select>
                </div>
                <div className="text-xs text-gray-700">
                  Total: <span className="font-medium">{nascimentosFiltrados.length}</span>
                </div>
              </div>

              {/* Navegação Mobile */}
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                    disabled={paginaAtual === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-slate-700 text-sm font-medium rounded-md text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icons.ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </button>
                  <span className="text-sm text-gray-700 dark:text-slate-300 font-medium">
                    Página {paginaAtual} de {totalPaginas}
                  </span>
                  <button
                    onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaAtual === totalPaginas}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-slate-700 text-sm font-medium rounded-md text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próxima
                    <Icons.ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé com Totalizadores */}
        <div className="mt-6 bg-white dark:bg-slate-900 shadow-sm rounded-lg overflow-hidden">
          <div className="px-3 py-3 bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-800">
            <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Resumo</h3>
          </div>
          <div className="p-3">
            {/* Cards principais */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-6">
              {/* Card Vacas */}
              <div className={`bg-gradient-to-br ${getThemeClasses(primaryColor, 'gradient-from')} rounded-lg p-4 border ${getThemeClasses(primaryColor, 'border-light')}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`text-xs sm:text-sm font-medium ${getTitleTextClass(primaryColor)} tracking-wide`}>Vacas</h4>
                  <Icons.Vaca className={`w-6 h-6 ${getThemeClasses(primaryColor, 'text')}`} />
                </div>
                <div className={`text-2xl sm:text-3xl font-bold ${getTitleTextClass(primaryColor)}`}>{totais.vacas}</div>
              </div>

              {/* Card Novilhas */}
              <div className={`bg-gradient-to-br ${getThemeClasses(primaryColor, 'gradient-from')} rounded-lg p-4 border ${getThemeClasses(primaryColor, 'border-light')}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`text-xs sm:text-sm font-medium ${getTitleTextClass(primaryColor)} tracking-wide`}>Novilhas</h4>
                  <Icons.Novilha className={`w-5 h-5 sm:w-7 sm:h-7 ${getThemeClasses(primaryColor, 'text')}`} />
                </div>
                <div className={`text-2xl sm:text-3xl font-bold ${getTitleTextClass(primaryColor)}`}>{totais.novilhas}</div>
              </div>

              {/* Card Fêmeas */}
              <div className={`bg-gradient-to-br ${getThemeClasses(primaryColor, 'gradient-from')} rounded-lg p-4 border ${getThemeClasses(primaryColor, 'border-light')}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`text-xs sm:text-sm font-medium ${getTitleTextClass(primaryColor)} tracking-wide`}>Fêmeas</h4>
                  <Icons.Venus className={`w-5 h-5 sm:w-6 sm:h-6 ${getThemeClasses(primaryColor, 'text')}`} />
                </div>
                <div className={`text-2xl sm:text-3xl font-bold ${getTitleTextClass(primaryColor)}`}>{totais.femeas}</div>
              </div>

              {/* Card Machos */}
              <div className={`bg-gradient-to-br ${getThemeClasses(primaryColor, 'gradient-from')} rounded-lg p-4 border ${getThemeClasses(primaryColor, 'border-light')}`}>
                  <div className="flex items-center justify-between mb-2">
                  <h4 className={`text-xs sm:text-sm font-medium ${getTitleTextClass(primaryColor)} tracking-wide`}>Machos</h4>
                  <Icons.Mars className={`w-5 h-5 sm:w-6 sm:h-6 ${getThemeClasses(primaryColor, 'text')}`} />
                </div>
                <div className={`text-2xl sm:text-3xl font-bold ${getTitleTextClass(primaryColor)}`}>{totais.machos}</div>
              </div>
            </div>

            {/* Totais por Raça */}
            {totais.totaisPorRaca.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Totais por Raça</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {totais.totaisPorRaca.map(({ raca, total }) => (
                    <div key={raca} className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-700">
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 mb-1 break-words">{raca}</div>
                      <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100">{total}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card Total Geral */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 rounded-lg p-4 sm:p-6 border-2 border-gray-300 dark:border-slate-600">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs sm:text-sm font-medium text-gray-800 dark:text-slate-200  tracking-wide">Total Geral</h4>
                <Icons.TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />
              </div>
              <div className="flex items-baseline flex-wrap">
                <span className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100">{totais.totalGeral}</span>
                <span className="ml-2 text-xs sm:text-sm text-gray-700 dark:text-slate-300">nascimentos</span>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-300 dark:border-slate-700">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2 text-xs sm:text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-slate-300">Vacas: </span>
                    <span className="font-semibold text-gray-800 dark:text-slate-100">{totais.vacas}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-slate-300">Novilhas: </span>
                    <span className="font-semibold text-gray-800 dark:text-slate-100">{totais.novilhas}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-slate-300">Fêmeas: </span>
                    <span className="font-semibold text-gray-800 dark:text-slate-100">{totais.femeas}</span>
                  </div>
                <div>
                    <span className="text-gray-600 dark:text-slate-300">Machos: </span>
                    <span className="font-semibold text-gray-800 dark:text-slate-100">{totais.machos}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Modal Novo Nascimento */}
      <NascimentoModal
        open={modalNovoNascimentoOpen}
        mode="create"
        fazendaOptions={fazendaOptions.filter(opt => opt.value !== '')}
        racasOptions={racasOptions}
        defaultFazendaId={fazendaSelecionada || undefined}
        defaultMes={mesAtual}
        defaultAno={anoAtual}
        onClose={() => setModalNovoNascimentoOpen(false)}
        onSaved={() => {
          // Dados serão atualizados automaticamente pelo useLiveQuery
        }}
        onAddRaca={() => setModalRacaOpen(true)}
        novaRacaSelecionada={novaRacaSelecionada}
        verificarBrincoDuplicado={verificarBrincoDuplicado}
        matrizInputRef={matrizInputRef}
        onFocusMatriz={() => {
          // Callback já é tratado internamente pelo componente
        }}
      />

      {/* Modal Editar Nascimento */}
      <NascimentoModal
        open={modalEditarNascimentoOpen}
        mode="edit"
        fazendaOptions={fazendas.map(f => ({ label: f.nome, value: f.id }))}
        racasOptions={racasOptions}
        initialData={nascimentoEditando || null}
        onClose={handleFecharEdicao}
        onSaved={() => {
          // Dados serão atualizados automaticamente pelo useLiveQuery
        }}
        onAddRaca={() => setModalRacaOpen(true)}
        novaRacaSelecionada={novaRacaSelecionada}
        verificarBrincoDuplicado={verificarBrincoDuplicado}
      />

      {/* Modais inline antigos - REMOVIDOS - usando NascimentoModal acima */}
      {false && modalNovoNascimentoOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Overlay */}
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setModalNovoNascimentoOpen(false)}></div>

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-50">Novo Nascimento/Desmama</h2>
                <button
                  onClick={() => setModalNovoNascimentoOpen(false)}
                  className={`text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} rounded-md p-1`}
                >
                  <Icons.X className="w-6 h-6" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitNascimento(onSubmitNascimento)} className="p-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="flex-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Fazenda *</label>
                    <Combobox
                      value={watchNascimento('fazendaId') || ''}
                      onChange={(value) => setValueNascimento('fazendaId', value)}
                  options={fazendaOptions.filter(opt => opt.value !== '')}
                      placeholder="Selecione a fazenda"
                      allowCustomValue={false}
                    />
                    {errorsNascimento.fazendaId && <p className="text-red-600 text-sm mt-1">{String(errorsNascimento.fazendaId.message)}</p>}
                  </div>

                  <div className="md:w-40">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mês *</label>
                    <Combobox
                      value={watchNascimento('mes') && !isNaN(Number(watchNascimento('mes'))) ? watchNascimento('mes').toString() : ''}
                      onChange={(value) => {
                        if (value) {
                          const numValue = Number(value);
                          if (!isNaN(numValue)) {
                            setValueNascimento('mes', numValue, { shouldValidate: true });
                          }
                        }
                      }}
                      options={Array.from({ length: 12 }, (_, i) => {
                        const mes = i + 1;
                        return {
                          label: new Date(2000, mes - 1).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase(),
                          value: mes.toString()
                        };
                      })}
                      placeholder="Selecione o mês"
                      allowCustomValue={false}
                    />
                    {errorsNascimento.mes && <p className="text-red-600 text-sm mt-1">{String(errorsNascimento.mes.message)}</p>}
                  </div>

                  <div className="md:w-28">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ano *</label>
                    <input 
                      type="number"
                      min="2000"
                      max="2100"
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`} 
                      {...registerNascimento('ano', { valueAsNumber: true })} 
                    />
                    {errorsNascimento.ano && <p className="text-red-600 text-sm mt-1">{String(errorsNascimento.ano.message)}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Matriz *</label>
                    <input 
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`} 
                      {...registerNascimento('matrizId', {
                        onBlur: () => {},
                      })}
                      ref={(e) => {
                        registerNascimento('matrizId').ref(e);
                        matrizInputRef.current = e;
                      }}
                      placeholder="Número da matriz"
                      autoFocus
                    />
                    {errorsNascimento.matrizId && <p className="text-red-600 text-sm mt-1">{String(errorsNascimento.matrizId.message)}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número do Brinco</label>
                    <input 
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`} 
                      {...registerNascimento('brincoNumero')} 
                      placeholder="Número do brinco"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento *</label>
                    <input 
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`} 
                      placeholder="dd/mm/yyyy"
                      {...registerNascimento('dataNascimento', {
                        onChange: (e) => {
                          // Normalizar durante digitação sem validar
                          const norm = normalizarDataInput(e.target.value);
                          if (norm !== e.target.value) {
                            e.target.value = norm;
                            setValueNascimento('dataNascimento', norm, { shouldValidate: false });
                          }
                        },
                        onBlur: (e) => {
                          // Validar apenas ao perder foco
                          const norm = normalizarDataInput(e.target.value);
                          setValueNascimento('dataNascimento', norm, { shouldValidate: true });
                        }
                      })}
                      defaultValue=""
                    />
                    {errorsNascimento.dataNascimento && <p className="text-red-600 text-sm mt-1">{String(errorsNascimento.dataNascimento.message)}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sexo *</label>
                    <Combobox
                      value={watchNascimento('sexo') || ''}
                      onChange={(value) => setValueNascimento('sexo', value as 'M' | 'F', { shouldValidate: true })}
                      options={[
                        { label: 'Macho', value: 'M' },
                        { label: 'Fêmea', value: 'F' }
                      ]}
                      placeholder="Selecione o sexo"
                      allowCustomValue={false}
                    />
                    {errorsNascimento.sexo && <p className="text-red-600 text-sm mt-1">{String(errorsNascimento.sexo.message)}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Raça</label>
                    <Combobox
                      value={watchNascimento('raca') || ''}
                      onChange={(value) => setValueNascimento('raca', value)}
                      options={racasOptions}
                      placeholder="Digite ou selecione uma raça"
                      onAddNew={() => setModalRacaOpen(true)}
                      addNewLabel="Cadastrar nova raça"
                      favoritoTipo="raca"
                      isFavorito={(value) => isFavorito('raca', value)}
                      onToggleFavorito={(value) => toggleFavorito('raca', value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          value="novilha"
                          className={`w-4 h-4 ${getCheckboxClass(primaryColor)}`}
                          {...registerNascimento('tipo')} 
                        />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Novilha</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          value="vaca"
                          className={`w-4 h-4 ${getCheckboxClass(primaryColor)}`}
                          {...registerNascimento('tipo')} 
                        />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Vaca</span>
                      </label>
                    </div>
                    {errorsNascimento.tipo && <p className="text-red-600 text-xs sm:text-sm mt-1">{String(errorsNascimento.tipo.message)}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea 
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
                    rows={3}
                    {...registerNascimento('obs')} 
                    placeholder="Observações adicionais"
                  />
                </div>

              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/40 rounded-md">
                  <input 
                    type="checkbox" 
                    id="morto-modal"
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500" 
                    {...registerNascimento('morto')} 
                  />
                  <label htmlFor="morto-modal" className="text-sm font-medium text-red-800 cursor-pointer">
                    Bezerro nasceu morto
                  </label>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-slate-800">
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className={`flex-1 px-4 py-2 ${getPrimaryButtonClass(primaryColor)} text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isSubmitting ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button 
                    type="button" 
                    onClick={handleLimparNascimento}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-yellow-500 text-white font-medium rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                  >
                    Limpar
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setModalNovoNascimentoOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Nascimento - REMOVIDO - usando NascimentoModal acima */}
      {false && modalEditarNascimentoOpen && nascimentoEditando && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Overlay */}
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleFecharEdicao}></div>

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Editar Nascimento/Desmama</h2>
                <button
                  onClick={handleFecharEdicao}
                  className={`text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} rounded-md p-1`}
                >
                  <Icons.X className="w-6 h-6" />
                </button>
              </div>

              {/* Abas */}
              <div className="border-b border-gray-200 dark:border-slate-700">
                <nav className="flex -mb-px px-6" aria-label="Tabs">
                  <button
                    type="button"
                    onClick={() => setAbaAtivaEdicao('nascimento')}
                    className={`
                      py-4 px-4 border-b-2 font-medium text-sm transition-colors
                      ${abaAtivaEdicao === 'nascimento'
                        ? `${getThemeClasses(primaryColor, 'border')} ${getThemeClasses(primaryColor, 'text')}`
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                    `}
                  >
                    Nascimento
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbaAtivaEdicao('desmama')}
                    className={`
                      py-4 px-4 border-b-2 font-medium text-sm transition-colors
                      ${abaAtivaEdicao === 'desmama'
                        ? `${getThemeClasses(primaryColor, 'border')} ${getThemeClasses(primaryColor, 'text')}`
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                    `}
                  >
                    Desmama
                  </button>
                </nav>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitEdicao(onSubmitEdicao)} className="p-6 space-y-4">
                {/* Aba Nascimento */}
                {abaAtivaEdicao === 'nascimento' && (
                  <>
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="flex-1">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Fazenda *</label>
                    <Combobox
                      value={watchEdicao('fazendaId') || ''}
                      onChange={(value) => setValueEdicao('fazendaId', value)}
                      options={fazendas.map(f => ({ label: f.nome, value: f.id }))}
                      placeholder="Selecione a fazenda"
                      allowCustomValue={false}
                    />
                    {errorsEdicao.fazendaId && <p className="text-red-600 text-sm mt-1">{String(errorsEdicao.fazendaId.message)}</p>}
                  </div>

                  <div className="md:w-40">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mês *</label>
                    <Combobox
                      value={watchEdicao('mes') && !isNaN(Number(watchEdicao('mes'))) ? watchEdicao('mes').toString() : ''}
                      onChange={(value) => {
                        if (value) {
                          const numValue = Number(value);
                          if (!isNaN(numValue)) {
                            setValueEdicao('mes', numValue, { shouldValidate: true });
                          }
                        }
                      }}
                      options={Array.from({ length: 12 }, (_, i) => {
                        const mes = i + 1;
                        return {
                          label: new Date(2000, mes - 1).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase(),
                          value: mes.toString()
                        };
                      })}
                      placeholder="Selecione o mês"
                      allowCustomValue={false}
                    />
                    {errorsEdicao.mes && <p className="text-red-600 text-sm mt-1">{String(errorsEdicao.mes.message)}</p>}
                  </div>

                  <div className="md:w-28">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ano *</label>
                    <input 
                      type="number"
                      min="2000"
                      max="2100"
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`} 
                      {...registerEdicao('ano', { valueAsNumber: true })} 
                    />
                    {errorsEdicao.ano && <p className="text-red-600 text-sm mt-1">{String(errorsEdicao.ano.message)}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Matriz *</label>
                    <input 
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`} 
                      {...registerEdicao('matrizId', {
                        onBlur: () => {},
                      })}
                      ref={(e) => {
                        registerEdicao('matrizId').ref(e);
                        matrizInputRefEdicao.current = e;
                      }}
                      placeholder="Número da matriz"
                    />
                    {errorsEdicao.matrizId && <p className="text-red-600 text-sm mt-1">{String(errorsEdicao.matrizId.message)}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número do Brinco</label>
                    <input 
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`} 
                      {...registerEdicao('brincoNumero')} 
                      placeholder="Número do brinco"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento *</label>
                    <input 
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`} 
                      placeholder="dd/mm/yyyy"
                      {...registerEdicao('dataNascimento', {
                        onChange: (e) => {
                          // Normalizar durante digitação sem validar
                          const norm = normalizarDataInput(e.target.value);
                          if (norm !== e.target.value) {
                            e.target.value = norm;
                            setValueEdicao('dataNascimento', norm, { shouldValidate: false });
                          }
                        },
                        onBlur: (e) => {
                          // Validar apenas ao perder foco
                          const norm = normalizarDataInput(e.target.value);
                          setValueEdicao('dataNascimento', norm, { shouldValidate: true });
                        }
                      })}
                      defaultValue=""
                    />
                    {errorsEdicao.dataNascimento && <p className="text-red-600 text-sm mt-1">{String(errorsEdicao.dataNascimento.message)}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sexo *</label>
                    <Combobox
                      value={watchEdicao('sexo') || ''}
                      onChange={(value) => setValueEdicao('sexo', value as 'M' | 'F', { shouldValidate: true })}
                      options={[
                        { label: 'Macho', value: 'M' },
                        { label: 'Fêmea', value: 'F' }
                      ]}
                      placeholder="Selecione o sexo"
                      allowCustomValue={false}
                    />
                    {errorsEdicao.sexo && <p className="text-red-600 text-sm mt-1">{String(errorsEdicao.sexo.message)}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Raça</label>
                    <Combobox
                      value={watchEdicao('raca') || ''}
                      onChange={(value) => setValueEdicao('raca', value)}
                      options={racasOptions}
                      placeholder="Digite ou selecione uma raça"
                      onAddNew={() => setModalRacaOpen(true)}
                      addNewLabel="Cadastrar nova raça"
                      favoritoTipo="raca"
                      isFavorito={(value) => isFavorito('raca', value)}
                      onToggleFavorito={(value) => toggleFavorito('raca', value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          value="novilha"
                          className={`w-4 h-4 ${getCheckboxClass(primaryColor)}`} 
                          {...registerEdicao('tipo')} 
                        />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Novilha</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          value="vaca"
                          className={`w-4 h-4 ${getCheckboxClass(primaryColor)}`}
                          {...registerEdicao('tipo')} 
                        />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Vaca</span>
                      </label>
                    </div>
                    {errorsEdicao.tipo && <p className="text-red-600 text-xs sm:text-sm mt-1">{String(errorsEdicao.tipo.message)}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea 
                    className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
                    rows={3}
                    {...registerEdicao('obs')} 
                    placeholder="Observações adicionais"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/40 rounded-md">
                  <input 
                    type="checkbox" 
                    id="morto-edicao"
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500" 
                    {...registerEdicao('morto')} 
                  />
                  <label htmlFor="morto-edicao" className="text-sm font-medium text-red-800 cursor-pointer">
                    Bezerro nasceu morto
                  </label>
                </div>
                  </>
                )}

                {/* Aba Desmama */}
                {abaAtivaEdicao === 'desmama' && (
                  <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Data de Desmama</label>
                    <input 
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} dark:bg-slate-800 dark:text-slate-100`} 
                      placeholder="dd/mm/yyyy"
                      value={watchEdicao('dataDesmama') ? converterDataParaFormatoInput(watchEdicao('dataDesmama') || '') : ''}
                      onChange={(e) => {
                        const norm = normalizarDataInput(e.target.value);
                        setValueEdicao('dataDesmama', norm, { shouldValidate: true });
                      }}
                      onBlur={(e) => {
                        const norm = normalizarDataInput(e.target.value);
                        setValueEdicao('dataDesmama', norm, { shouldValidate: true });
                      }}
                    />
                    {errorsEdicao.dataDesmama && <p className="text-red-600 text-sm mt-1">{String(errorsEdicao.dataDesmama.message)}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Peso de Desmama (kg)</label>
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} dark:bg-slate-800 dark:text-slate-100`} 
                      placeholder="Ex: 180.5"
                      value={watchEdicao('pesoDesmama') || ''}
                      onChange={(e) => setValueEdicao('pesoDesmama', e.target.value, { shouldValidate: true })}
                    />
                    {errorsEdicao.pesoDesmama && <p className="text-red-600 text-sm mt-1">{String(errorsEdicao.pesoDesmama.message)}</p>}
                  </div>
                </div>
                <div className={`${getPrimaryCardClass(primaryColor)} rounded-md p-3`}>
                  <p className={`text-sm ${getTitleTextClass(primaryColor)}`}>
                    <strong>Dica:</strong> Preencha pelo menos um dos campos (Data ou Peso) para salvar os dados de desmama. Se ambos estiverem vazios, o registro de desmama será removido.
                  </p>
                </div>
                  </>
                )}

                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button 
                    type="submit" 
                    disabled={isSubmittingEdicao}
                    className={`flex-1 px-4 py-2 ${getPrimaryButtonClass(primaryColor)} text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isSubmittingEdicao ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                  <button 
                    type="button" 
                    onClick={handleFecharEdicao}
                    disabled={isSubmittingEdicao}
                    className="px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico Matriz */}
      {matrizHistoricoOpen && matrizHistoricoId && (
        <div key={`modal-historico-${matrizHistoricoId}`} className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden" role="dialog" aria-modal="true">
            <div
              className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm transition-opacity"
              onClick={handleFecharHistoricoMatriz}
            />
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200/50 dark:border-slate-700/50 backdrop-blur-xl">
                {/* Header com gradiente */}
                <div className={`relative px-8 py-6 border-b border-gray-200/50 dark:border-slate-700/50 bg-gradient-to-br ${getThemeClasses(primaryColor, 'bg-light')} overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent dark:from-black/10"></div>
                  <div className="relative flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2.5 rounded-xl ${getThemeClasses(primaryColor, 'bg')} bg-opacity-10 dark:bg-opacity-20`}>
                          <Icons.Cow className={`w-6 h-6 ${getThemeClasses(primaryColor, 'text')}`} />
                        </div>
                        <div>
                          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 truncate">
                            Histórico da Matriz
                          </h2>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                            {matrizMap.get(matrizHistoricoId) || matrizHistoricoId}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleFecharHistoricoMatriz}
                      className="ml-4 p-2.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all hover:scale-105"
                    >
                      <Icons.X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Resumo da Matriz - Movido para fora do header para não ser coberto pelas abas */}
                {matrizResumo && (
                  <div className="px-8 py-4 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm border-b border-gray-200/50 dark:border-slate-700/50">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-3 border border-white/50 dark:border-slate-700/50 shadow-sm">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Partos</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{matrizResumo.totalPartos}</div>
                      </div>
                      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-3 border border-white/50 dark:border-slate-700/50 shadow-sm">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Vivos</div>
                        <div className={`text-2xl font-bold ${getThemeClasses(primaryColor, 'text')}`}>{matrizResumo.vivos}</div>
                      </div>
                      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-3 border border-white/50 dark:border-slate-700/50 shadow-sm">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Mortos</div>
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{matrizResumo.mortos}</div>
                      </div>
                      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-3 border border-white/50 dark:border-slate-700/50 shadow-sm">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Média Peso</div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {matrizResumo.mediaPeso.toFixed(2)} <span className="text-sm font-normal text-gray-500">kg</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Abas: Tabela / Timeline */}
              <div className="border-b border-gray-200/50 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-800/30">
                <div className="flex gap-2 px-8">
                  <button
                    type="button"
                    onClick={() => setAbaHistoricoMatriz('tabela')}
                    className={`px-6 py-3.5 text-sm font-semibold rounded-t-xl transition-all relative ${
                      abaHistoricoMatriz === 'tabela'
                        ? `${getThemeClasses(primaryColor, 'bg')} ${getThemeClasses(primaryColor, 'text')} text-white dark:text-white shadow-md`
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icons.FileSpreadsheet className="w-4 h-4" />
                      Tabela
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbaHistoricoMatriz('timeline')}
                    className={`px-6 py-3.5 text-sm font-semibold rounded-t-xl transition-all relative ${
                      abaHistoricoMatriz === 'timeline'
                        ? `${getThemeClasses(primaryColor, 'bg')} ${getThemeClasses(primaryColor, 'text')} text-white dark:text-white shadow-md`
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icons.Calendar className="w-4 h-4" />
                      Timeline
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 bg-gray-50/30 dark:bg-slate-900/50">
                {matrizHistorico.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Icons.Info className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
                    <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                      Nenhum parto encontrado para esta matriz.
                    </p>
                  </div>
                ) : abaHistoricoMatriz === 'timeline' ? (
                  // Visualização Timeline
                  <div className="space-y-6">
                    {matrizHistorico.map((item) => {
                      if (!item || !item.id) return null;
                      const nascimentoCompleto = Array.isArray(nascimentosTodos) && nascimentosTodos.length > 0 
                        ? nascimentosTodos.find(n => n && n.id === item.id) 
                        : null;
                      const desmamaCompleta = Array.isArray(desmamas) && desmamas.length > 0
                        ? desmamas.find(d => d && d.nascimentoId === item.id)
                        : null;
                      if (!nascimentoCompleto) return null;

                      return (
                        <div key={item.id} className="bg-gradient-to-br from-gray-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-200 dark:border-slate-700">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                                {item.brinco ? `Brinco ${item.brinco}` : 'Animal sem brinco'}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">{item.periodo}</span>
                                <span>•</span>
                                <span>{item.fazenda}</span>
                                <span>•</span>
                                <span>{item.sexo || '-'}</span>
                                <span>•</span>
                                <span>{item.raca || '-'}</span>
                              </div>
                            </div>
                            {item.morto && (
                              <span className="ml-4 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold whitespace-nowrap">
                                Morto
                              </span>
                            )}
                          </div>
                          <TimelineAnimal
                            nascimento={nascimentoCompleto}
                            desmama={desmamaCompleta}
                            pesagens={item.pesagens || []}
                            vacinacoes={item.vacinacoes || []}
                            onEditNascimento={(id) => {
                              handleFecharHistoricoMatriz();
                              handleAbrirEdicao(id);
                            }}
                            onAddPesagem={(id) => {
                              setPesagemNascimentoId(id);
                              setPesagemEditando(null);
                              setModalPesagemOpen(true);
                            }}
                            onEditPesagem={(pesagem) => {
                              setPesagemEditando(pesagem);
                              setPesagemNascimentoId(pesagem.nascimentoId);
                              setModalPesagemOpen(true);
                            }}
                            onAddVacina={(id) => {
                              setVacinaNascimentoId(id);
                              setVacinaEditando(null);
                              setModalVacinaOpen(true);
                            }}
                            onEditVacina={(vacina) => {
                              setVacinaEditando(vacina);
                              setVacinaNascimentoId(vacina.nascimentoId);
                              setModalVacinaOpen(true);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Visualização Cards
                  <div className="space-y-4">
                    {matrizHistorico.map((item, index) => (
                      <div
                        key={item.id}
                        className={`p-5 rounded-xl border-2 shadow-lg transition-all duration-200 hover:shadow-xl ${
                          item.morto
                            ? 'bg-red-50/70 dark:bg-red-950/30 border-red-500 dark:border-red-700'
                            : 'bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border-gray-200 dark:border-slate-700'
                        }`}
                      >
                        {/* Header do Card */}
                        <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200 dark:border-slate-700">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                Período: {item.periodo}
                              </span>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                item.sexo === 'M' 
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  : item.sexo === 'F'
                                  ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                              }`}>
                                {item.sexo || '-'}
                              </span>
                              {item.morto && (
                                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold">
                                  MORTO
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {item.fazenda}
                            </p>
                          </div>
                        </div>

                        {/* Grid de Informações */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                          {/* Raça */}
                          <div>
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Raça</span>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                              {item.raca || '-'}
                            </p>
                          </div>

                          {/* Brinco */}
                          <div>
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Brinco</span>
                            <div className="mt-1">
                              {item.brinco ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 text-sm font-semibold text-gray-900 dark:text-gray-100">
                                  {item.brinco}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                              )}
                            </div>
                          </div>

                          {/* Data Nascimento */}
                          <div>
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Data Nascimento</span>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                              {item.dataNascimento ? formatDate(item.dataNascimento) : <span className="text-gray-400">-</span>}
                            </p>
                          </div>

                          {/* Data Desmama */}
                          <div>
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Data Desmama</span>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                              {item.dataDesmama ? formatDate(item.dataDesmama) : <span className="text-gray-400">-</span>}
                            </p>
                          </div>

                          {/* Peso Desmama */}
                          <div>
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Peso Desmama</span>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
                              {item.pesoDesmama ? (
                                <>
                                  {item.pesoDesmama} <span className="text-gray-500 dark:text-gray-400 text-xs">kg</span>
                                </>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Ações - Pesagens e Vacinações */}
                        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                          {/* Pesagens */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pesagens:</span>
                            {item.pesagens && item.pesagens.length > 0 ? (
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${getThemeClasses(primaryColor, 'bg')} ${getThemeClasses(primaryColor, 'text')} text-white dark:text-white`}>
                                  {item.pesagens.length}
                                </span>
                                <button
                                  onClick={() => {
                                    setPesagemNascimentoId(item.id);
                                    setPesagemEditando(null);
                                    setModalPesagemOpen(true);
                                  }}
                                  className={`p-2 rounded-lg ${getPrimaryActionButtonLightClass(primaryColor)} hover:opacity-90 transition-all hover:scale-110 shadow-sm`}
                                  title={`Ver ${item.pesagens.length} pesagem(ns)`}
                                >
                                  <Icons.Eye className="w-4 h-4" />
                                </button>
                              </div>
                            ) : null}
                            <button
                              onClick={() => {
                                setPesagemNascimentoId(item.id);
                                setPesagemEditando(null);
                                setModalPesagemOpen(true);
                              }}
                              className={`p-2 rounded-lg ${getPrimaryActionButtonLightClass(primaryColor)} hover:opacity-90 transition-all hover:scale-110 shadow-sm`}
                              title="Adicionar pesagem"
                            >
                              <Icons.Plus className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Vacinações */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Vacinações:</span>
                            {item.vacinacoes && item.vacinacoes.length > 0 ? (
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${getThemeClasses(primaryColor, 'bg')} ${getThemeClasses(primaryColor, 'text')} text-white dark:text-white`}>
                                  {item.vacinacoes.length}
                                </span>
                                <button
                                  onClick={() => {
                                    setVacinaNascimentoId(item.id);
                                    setVacinaEditando(null);
                                    setModalVacinaOpen(true);
                                  }}
                                  className={`p-2 rounded-lg ${getPrimaryActionButtonLightClass(primaryColor)} hover:opacity-90 transition-all hover:scale-110 shadow-sm`}
                                  title={`Ver ${item.vacinacoes.length} vacinação(ões)`}
                                >
                                  <Icons.Eye className="w-4 h-4" />
                                </button>
                              </div>
                            ) : null}
                            <button
                              onClick={() => {
                                setVacinaNascimentoId(item.id);
                                setVacinaEditando(null);
                                setModalVacinaOpen(true);
                              }}
                              className={`p-2 rounded-lg ${getPrimaryActionButtonLightClass(primaryColor)} hover:opacity-90 transition-all hover:scale-110 shadow-sm`}
                              title="Adicionar vacinação"
                            >
                              <Icons.Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pesagem */}
      {pesagemNascimentoId && (
        <PesagemModal
          open={modalPesagemOpen}
          mode={pesagemEditando ? 'edit' : 'create'}
          nascimentoId={pesagemNascimentoId}
          initialData={pesagemEditando}
          onClose={() => {
            setModalPesagemOpen(false);
            setPesagemNascimentoId(null);
            setPesagemEditando(null);
          }}
          onSaved={() => {
            // Dados serão atualizados automaticamente pelo useLiveQuery
          }}
          onEditPesagem={(pesagem) => {
            if (pesagem) {
              setPesagemEditando(pesagem);
              setPesagemNascimentoId(pesagem.nascimentoId);
              setModalPesagemOpen(true);
            } else {
              // Voltar para modo create
              setPesagemEditando(null);
              // nascimentoId já está definido, não precisa alterar
            }
          }}
          onDeletePesagem={(pesagem) => {
            // Callback para exclusão da timeline (já implementado no modal)
          }}
        />
      )}

      {/* Modal Vacinação */}
      {vacinaNascimentoId && (
        <VacinaModal
          open={modalVacinaOpen}
          mode={vacinaEditando ? 'edit' : 'create'}
          nascimentoId={vacinaNascimentoId}
          initialData={vacinaEditando}
          onClose={() => {
            setModalVacinaOpen(false);
            setVacinaNascimentoId(null);
            setVacinaEditando(null);
          }}
          onSaved={() => {
            // Dados serão atualizados automaticamente pelo useLiveQuery
          }}
          onEditVacina={(vacina) => {
            if (vacina) {
              setVacinaEditando(vacina);
              setVacinaNascimentoId(vacina.nascimentoId);
              setModalVacinaOpen(true);
            } else {
              // Voltar para modo create
              setVacinaEditando(null);
              // nascimentoId já está definido, não precisa alterar
            }
          }}
          onDeleteVacina={(vacina) => {
            // Callback para exclusão da timeline (já implementado no modal)
          }}
        />
      )}

      {/* Modal Raça */}
      <ModalRaca 
        open={modalRacaOpen}
        onClose={() => setModalRacaOpen(false)}
        onRacaCadastrada={(racaNome) => {
          // A raça será aplicada automaticamente pelo NascimentoModal via novaRacaSelecionada
          setNovaRacaSelecionada(racaNome);
        }}
      />

      {/* Modal Histórico de Alterações */}
      {historicoEntityId && (
        <HistoricoAlteracoes
          open={historicoOpen}
          entity="nascimento"
          entityId={historicoEntityId}
          entityNome={historicoEntityNome}
          onClose={() => {
            setHistoricoOpen(false);
            setHistoricoEntityId(null);
            setHistoricoEntityNome('');
          }}
          onRestored={() => {
            // Dados serão atualizados automaticamente pelo useLiveQuery
          }}
        />
      )}

      {/* Modal de Confirmação */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />

      {/* Botão Flutuante - Novo Nascimento */}
      <button
        onClick={() => {
          if (fazendas.length === 0) {
            showToast({ type: 'warning', title: 'Cadastre uma fazenda', message: 'Crie pelo menos uma fazenda antes de lançar nascimentos.' });
            return;
          }
          setModalNovoNascimentoOpen(true);
        }}
        className={`fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-3 ${getPrimaryButtonClass(primaryColor)} text-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all shadow-lg hover:shadow-xl hover:scale-105`}
        title="Novo Nascimento"
        aria-label="Novo Nascimento"
      >
        <Icons.Plus className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">Novo Nascimento</span>
      </button>
    </div>
  );
}
