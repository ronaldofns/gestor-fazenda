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
  mes: z.number().min(1).max(12),
  ano: z.number().min(2000).max(2100),
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalNovoNascimentoOpen, setModalNovoNascimentoOpen] = useState(false);
  const [modalEditarNascimentoOpen, setModalEditarNascimentoOpen] = useState(false);
  const [nascimentoEditandoId, setNascimentoEditandoId] = useState<string | null>(null);
  const [abaAtivaEdicao, setAbaAtivaEdicao] = useState<'nascimento' | 'desmama'>('nascimento');
  const [modalRacaOpen, setModalRacaOpen] = useState(false);
  const [matrizHistoricoOpen, setMatrizHistoricoOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoEntityId, setHistoricoEntityId] = useState<string | null>(null);
  const [historicoEntityNome, setHistoricoEntityNome] = useState<string>('');
  const [matrizHistoricoId, setMatrizHistoricoId] = useState<string | null>(null);
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
  
  const [filtroMes, setFiltroMes] = useState<number | ''>(
    filtroMesFromUrl ? Number(filtroMesFromUrl) : ''
  );
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

  // Atualizar URL quando filtros, página ou itens por página mudarem
  useEffect(() => {
    const params = new URLSearchParams();
    if (filtroMes !== '') {
      params.set('mes', String(filtroMes));
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

  const { register: registerNascimento, handleSubmit: handleSubmitNascimento, formState: { errors: errorsNascimento }, reset: resetNascimento, setValue: setValueNascimento, watch: watchNascimento, setError: setErrorNascimento } = useForm<FormDataNascimento>({ 
    resolver: zodResolver(schemaNascimento),
    defaultValues: {
      mes: mesAtual,
      ano: anoAtual
    },
    shouldUnregister: false // Manter valores ao perder foco
  });

  // Observar campos que devem ser mantidos
  const fazendaIdForm = watchNascimento('fazendaId');
  const mesForm = watchNascimento('mes');
  const anoForm = watchNascimento('ano');
  const dataNascimentoForm = watchNascimento('dataNascimento');

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
      resetNascimento({
        fazendaId: values.fazendaId,
        mes: values.mes,
        ano: values.ano,
        dataNascimento: values.dataNascimento || '',
        matrizId: '',
        brincoNumero: '',
        sexo: undefined,
        raca: values.raca || '',
        tipo: values.tipo,
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
    resetNascimento({
      fazendaId: fazendaIdForm || '',
      mes: mesForm || mesAtual,
      ano: anoForm || anoAtual,
      dataNascimento: dataNascimentoForm || '',
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

  const { register: registerEdicao, handleSubmit: handleSubmitEdicao, formState: { errors: errorsEdicao }, reset: resetEdicao, setValue: setValueEdicao, watch: watchEdicao, setError: setErrorEdicao } = useForm<FormDataNascimento>({
    resolver: zodResolver(schemaNascimento),
    shouldUnregister: false
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
    
    // Filtrar por mês
    if (filtroMes !== '' && filtroMes !== null && filtroMes !== undefined) {
      filtrados = filtrados.filter(n => n.mes === filtroMes);
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
      const desmama = desmamas.find((d) => d.nascimentoId === n.id);
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
      };
    });

    return lista.sort((a, b) => {
      const aKey = (a.ano || 0) * 100 + (a.mes || 0);
      const bKey = (b.ano || 0) * 100 + (b.mes || 0);
      return aKey - bKey;
    });
  }, [matrizHistoricoId, nascimentosTodos, desmamas, fazendaMap]);

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
        const raca = n.raca.toUpperCase();
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
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
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

  // Verificar se pode gerar relatório (Fazenda, Mês e Ano devem estar preenchidos)
  const podeGerarRelatorio = useMemo(() => {
    return filtroFazenda !== '' && filtroMes !== '' && filtroAno !== '';
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
        mes: filtroMes as number,
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
        mes: filtroMes !== '' ? filtroMes as number : undefined,
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
        mes: filtroMes !== '' ? filtroMes as number : undefined,
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
      <div className="p-4 sm:p-6 text-gray-900 dark:text-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold">PLANILHA NASCIMENTO/DESMAMA</h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              {filtroMes !== '' && filtroAno !== '' && (
                <>MÊS {filtroMes} ({nomeMes(filtroMes)}) ANO {filtroAno}</>
              )}
              {fazendaSelecionada && ` - ${fazendaSelecionada.nome}`}
            </p>
          </div>
            <button
              onClick={() => {
                if (fazendas.length === 0) {
                  showToast({ type: 'warning', title: 'Cadastre uma fazenda', message: 'Crie pelo menos uma fazenda antes de lançar nascimentos.' });
                  return;
                }
                setModalNovoNascimentoOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
            >
              <Icons.Plus className="w-4 h-4" />
                Novo Nascimento
            </button>
          </div>

          {/* Filtros */}
          <div className="pt-4 border-t space-y-3">
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
              <Combobox
                value={filtroMes === '' ? '' : filtroMes.toString()}
                onChange={(value) => setFiltroMes(value === '' ? '' : Number(value))}
                options={[
                  { label: 'Todos', value: '' },
                  ...Array.from({ length: 12 }, (_, i) => {
                    const mes = i + 1;
                    return { label: nomeMes(mes), value: mes.toString() };
                  })
                ]}
                placeholder="Todos os meses"
                allowCustomValue={false}
              />
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Ano</label>
              <input
                type="number"
                min="2000"
                max="2100"
                value={filtroAno}
                onChange={(e) => setFiltroAno(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ano"
              />
            </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Matriz/Brinco</label>
                <input
                  type="text"
                  value={filtroMatrizBrinco}
                  onChange={(e) => setFiltroMatrizBrinco(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Brinco, matriz, fazenda, raça, obs"
                />
              </div>

              <div className="md:col-span-2 flex items-end gap-2">
              {/* Configuração de colunas */}
              <div className="relative" ref={menuColunasRef}>
                <button
                  type="button"
                  onClick={() => setMenuColunasAberto((prev) => !prev)}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-200 font-medium rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
                  title="Escolher colunas da tabela"
                >
                  <Icons.SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">Colunas</span>
                  <span className="sm:hidden">Cols</span>
                </button>
                {menuColunasAberto && (
                  <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-slate-900 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 z-50 max-h-64 overflow-y-auto">
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
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
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
                        <Icons.FileSpreadsheet className="w-4 h-4 text-green-600" />
                        Exportar Excel (.xlsx)
                      </button>
                      <button
                        onClick={handleExportarCSV}
                        disabled={nascimentosFiltrados.length === 0}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={nascimentosFiltrados.length === 0 ? 'Nenhum nascimento encontrado nos dados filtrados' : 'Exportar dados para CSV'}
                      >
                        <Icons.FileSpreadsheet className="w-4 h-4 text-blue-600" />
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

                            const periodoLabel = filtroMes && filtroAno
                              ? `${filtroMes.toString().padStart(2, '0')}/${filtroAno}`
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
                        <Icons.FileText className="w-4 h-4 text-purple-600" />
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
                          if (filtroMes !== '') {
                            // Mês específico selecionado - mostrar informação do mês
                            const mesNum = typeof filtroMes === 'number' ? filtroMes : Number(filtroMes);
                            const nomeMes = new Date(2000, mesNum - 1).toLocaleDateString('pt-BR', { month: 'long' });
                            if (filtroAno !== '') {
                              const anoNum = typeof filtroAno === 'number' ? filtroAno : Number(filtroAno);
                              periodoLabel = `Mês ${mesNum.toString().padStart(2, '0')} (${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}) - Ano ${anoNum}`;
                            } else {
                              periodoLabel = `Mês ${mesNum.toString().padStart(2, '0')} (${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}) - Todos os anos`;
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
                  setFiltroMes('');
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
        <div className="hidden md:block bg-white dark:bg-slate-900 shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-slate-600">
              <thead className="bg-gray-100 dark:bg-slate-600">
                <tr>
                  {colunasVisiveis.matriz && (
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider border-r border-gray-300 dark:border-slate-600 w-24">
                      MATRIZ
                    </th>
                  )}
                  {colunasVisiveis.novilha && (
                    <th className="px-1 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider border-r border-gray-300 dark:border-slate-600 w-14">
                      NOVILHA
                    </th>
                  )}
                  {colunasVisiveis.vaca && (
                    <th className="px-1 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider border-r border-gray-300 dark:border-slate-600 w-14">
                      VACA
                    </th>
                  )}
                  {colunasVisiveis.sexo && (
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider border-r border-gray-300 dark:border-slate-600 w-16">
                      SEXO
                    </th>
                  )}
                  {colunasVisiveis.raca && (
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider border-r border-gray-300 dark:border-slate-600 w-28">
                      RAÇA
                    </th>
                  )}
                  {colunasVisiveis.brinco && (
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider border-r border-gray-300 dark:border-slate-600 w-20">
                      NÚMERO
                      <br />
                      BRINCO
                    </th>
                  )}
                  {colunasVisiveis.morto && (
                    <th className="px-1 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider border-r border-gray-300 dark:border-slate-600 w-16">
                      MORTO
                    </th>
                  )}
                  {colunasVisiveis.pesoDesmama && (
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider border-r border-gray-300 dark:border-slate-600 w-32">
                      PESO
                      <br />
                      DESMAMA
                    </th>
                  )}
                  {colunasVisiveis.dataDesmama && (
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider border-r border-gray-300 dark:border-slate-600 w-28">
                      DATA
                      <br />
                      DESMAMA
                    </th>
                  )}
                  {colunasVisiveis.obs && (
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider border-r border-gray-300 dark:border-slate-600 max-w-[300px]">
                      OBS
                    </th>
                  )}
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider border-r border-gray-300 dark:border-slate-600 w-24 sticky right-0 z-10">AÇÕES</th>
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
                              className="text-left text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200 hover:underline"
                              title="Ver histórico da matriz"
                            >
                          {matrizIdentificador}
                            </button>
                        </td>
                        )}
                        {colunasVisiveis.novilha && (
                          <td className="px-1 py-2 whitespace-nowrap text-center border-r border-gray-200 dark:border-slate-600">
                          {n.novilha ? <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">X</span> : ''}
                        </td>
                        )}
                        {colunasVisiveis.vaca && (
                          <td className="px-1 py-2 whitespace-nowrap text-center border-r border-gray-200 dark:border-slate-600">
                          {n.vaca ? <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">X</span> : ''}
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
                                className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
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
                                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                  title="Editar nascimento"
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
                              className="p-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
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
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900"
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
                                  ? 'z-10 bg-blue-50 dark:bg-blue-900/40 border-blue-500 text-blue-600'
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
                          className="text-sm sm:text-base font-semibold text-blue-700 hover:text-blue-900 break-words underline-offset-2 hover:underline"
                        >
                          Matriz: {matrizIdentificador}
                        </button>
                        {n.novilha && <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded whitespace-nowrap">Novilha</span>}
                        {n.vaca && <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded whitespace-nowrap">Vaca</span>}
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
                        onClick={() => handleAbrirEdicao(n.id)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
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
                        className="p-1.5 text-purple-600 hover:text-purple-800 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
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
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
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
                    className="px-2 py-1 text-xs border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Resumo</h3>
          </div>
          <div className="p-3">
            {/* Cards principais */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-6">
              {/* Card Vacas */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-lg p-4 border border-purple-200 dark:border-purple-500/40">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-purple-800 uppercase tracking-wide">Vacas</h4>
                  <Icons.Vaca className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-purple-900 dark:text-purple-200">{totais.vacas}</div>
              </div>

              {/* Card Novilhas */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-4 border border-green-200 dark:border-green-500/40">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs sm:text-sm font-medium text-green-800 uppercase tracking-wide">Novilhas</h4>
                  <Icons.Novilha className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-green-900 dark:text-green-200">{totais.novilhas}</div>
              </div>

              {/* Card Fêmeas */}
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-900/10 rounded-lg p-4 border border-pink-200 dark:border-pink-500/40">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs sm:text-sm font-medium text-pink-800 uppercase tracking-wide">Fêmeas</h4>
                  <Icons.Venus className="w-5 h-5 sm:w-6 sm:h-6 text-pink-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-pink-900 dark:text-pink-200">{totais.femeas}</div>
              </div>

              {/* Card Machos */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-500/40">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs sm:text-sm font-medium text-blue-800 uppercase tracking-wide">Machos</h4>
                  <Icons.Mars className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-200">{totais.machos}</div>
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
                <h4 className="text-xs sm:text-sm font-medium text-gray-800 dark:text-slate-200 uppercase tracking-wide">Total Geral</h4>
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
      {modalNovoNascimentoOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Overlay */}
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setModalNovoNascimentoOpen(false)}></div>

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold text-gray-900">Novo Nascimento/Desmama</h2>
                <button
                  onClick={() => setModalNovoNascimentoOpen(false)}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
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
                          label: new Date(2000, mes - 1).toLocaleDateString('pt-BR', { month: 'long' }),
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      {...registerNascimento('ano', { valueAsNumber: true })} 
                    />
                    {errorsNascimento.ano && <p className="text-red-600 text-sm mt-1">{String(errorsNascimento.ano.message)}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Matriz *</label>
                    <input 
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="dd/mm/yyyy"
                      value={watchNascimento('dataNascimento') ? converterDataParaFormatoInput(watchNascimento('dataNascimento') || '') : ''}
                      onChange={(e) => {
                        const norm = normalizarDataInput(e.target.value);
                        setValueNascimento('dataNascimento', norm, { shouldValidate: true });
                      }}
                      onBlur={(e) => {
                        const norm = normalizarDataInput(e.target.value);
                        setValueNascimento('dataNascimento', norm, { shouldValidate: true });
                      }}
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
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" 
                          {...registerNascimento('tipo')} 
                        />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Novilha</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          value="vaca"
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" 
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
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
                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Modal Editar Nascimento */}
      {modalEditarNascimentoOpen && nascimentoEditando && (
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
                  className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
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
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
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
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
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
                          label: new Date(2000, mes - 1).toLocaleDateString('pt-BR', { month: 'long' }),
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      {...registerEdicao('ano', { valueAsNumber: true })} 
                    />
                    {errorsEdicao.ano && <p className="text-red-600 text-sm mt-1">{String(errorsEdicao.ano.message)}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Matriz *</label>
                    <input 
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      placeholder="dd/mm/yyyy"
                      value={watchEdicao('dataNascimento') ? converterDataParaFormatoInput(watchEdicao('dataNascimento') || '') : ''}
                      onChange={(e) => {
                        const norm = normalizarDataInput(e.target.value);
                        setValueEdicao('dataNascimento', norm, { shouldValidate: true });
                      }}
                      onBlur={(e) => {
                        const norm = normalizarDataInput(e.target.value);
                        setValueEdicao('dataNascimento', norm, { shouldValidate: true });
                      }}
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
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" 
                          {...registerEdicao('tipo')} 
                        />
                        <span className="text-xs sm:text-sm font-medium text-gray-700">Novilha</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          value="vaca"
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500" 
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100" 
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
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-100" 
                      placeholder="Ex: 180.5"
                      value={watchEdicao('pesoDesmama') || ''}
                      onChange={(e) => setValueEdicao('pesoDesmama', e.target.value, { shouldValidate: true })}
                    />
                    {errorsEdicao.pesoDesmama && <p className="text-red-600 text-sm mt-1">{String(errorsEdicao.pesoDesmama.message)}</p>}
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/40 rounded-md p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Dica:</strong> Preencha pelo menos um dos campos (Data ou Peso) para salvar os dados de desmama. Se ambos estiverem vazios, o registro de desmama será removido.
                  </p>
                </div>
                  </>
                )}

                <div className="flex gap-2 pt-4 border-t border-gray-200">
                  <button 
                    type="submit" 
                    disabled={isSubmittingEdicao}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
      {matrizHistoricoOpen && matrizHistoricoId && (() => {
        const matrizIdentificador = matrizMap.get(matrizHistoricoId) || matrizHistoricoId;
        return (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-gray-500 bg-opacity-60 transition-opacity"
            onClick={handleFecharHistoricoMatriz}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-white">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    Histórico da matriz {matrizIdentificador}
                  </h2>
                  {matrizResumo && (
                    <p className="mt-1 text-xs sm:text-sm text-gray-600">
                      Partos:{' '}
                      <span className="font-semibold">{matrizResumo.totalPartos}</span>
                      {' • '}
                      Vivos:{' '}
                      <span className="font-semibold text-green-700">{matrizResumo.vivos}</span>
                      {' • '}
                      Mortos:{' '}
                      <span className="font-semibold text-red-700">{matrizResumo.mortos}</span>
                      {' • '}
                      Média peso desmama:{' '}
                      <span className="font-semibold">
                        {matrizResumo.mediaPeso.toFixed(2)} kg
                      </span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleFecharHistoricoMatriz}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4 sm:p-6">
                {matrizHistorico.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    Nenhum parto encontrado para esta matriz.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                            Período
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                            Fazenda
                          </th>
                          <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">
                            Sexo
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                            Raça
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                            Brinco
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                            Data nasc.
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">
                            Data desmama
                          </th>
                          <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">
                            Peso desmama
                          </th>
                          <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">
                            Morto
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {matrizHistorico.map((item) => (
                          <tr key={item.id} className={item.morto ? 'bg-red-50' : ''}>
                            <td className="px-2 py-1 whitespace-nowrap text-gray-900">
                              {item.periodo}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap text-gray-700">
                              {item.fazenda}
                            </td>
                            <td className="px-2 py-1 text-center">
                              {item.sexo || '-'}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {item.raca || '-'}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {item.brinco || '-'}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {item.dataNascimento ? formatDate(item.dataNascimento) : '-'}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">
                              {item.dataDesmama ? formatDate(item.dataDesmama) : '-'}
                            </td>
                            <td className="px-2 py-1 text-right">
                              {item.pesoDesmama ? `${item.pesoDesmama} kg` : '-'}
                            </td>
                            <td className="px-2 py-1 text-center">
                              {item.morto ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold">
                                  SIM
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">
                                  NÃO
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
    </div>
  );
      })()}

      {/* Modal Raça */}
      <ModalRaca 
        open={modalRacaOpen}
        onClose={() => setModalRacaOpen(false)}
        onRacaCadastrada={(racaNome) => {
          if (modalEditarNascimentoOpen) {
            handleRacaCadastradaEdicao(racaNome);
          } else {
            handleRacaCadastrada(racaNome);
          }
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
    </div>
  );
}
