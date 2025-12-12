import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { db } from '../db/dexieDB';
import useSync from '../hooks/useSync';
import SyncStatus from '../components/SyncStatus';
import Combobox from '../components/Combobox';
import ModalRaca from '../components/ModalRaca';
import { Plus, Edit, Trash2, Users, User, TrendingUp, Mars, Venus, Upload, ChevronLeft, ChevronRight, X, FileText, Download, FileSpreadsheet } from 'lucide-react';
import { cleanDuplicateNascimentos } from '../utils/cleanDuplicates';
import { uuid } from '../utils/uuid';
import { gerarRelatorioPDF } from '../utils/gerarRelatorioPDF';
import { exportarParaExcel, exportarParaCSV } from '../utils/exportarDados';

const OPCOES_ITENS_POR_PAGINA = [30, 50, 100];
const ITENS_POR_PAGINA_PADRAO = 50;

const schemaNascimento = z.object({
  fazendaId: z.string().min(1, 'Selecione a fazenda'),
  mes: z.number().min(1).max(12),
  ano: z.number().min(2000).max(2100),
  matrizId: z.string().min(1, 'Informe a matriz'),
  tipo: z.enum(['novilha', 'vaca'], { required_error: 'Selecione o tipo: Vaca ou Novilha' }),
  brincoNumero: z.string().optional(),
  dataNascimento: z.string().optional(),
  sexo: z.enum(['M', 'F'], { required_error: 'Selecione o sexo' }),
  raca: z.string().optional(),
  obs: z.string().optional(),
  morto: z.boolean().optional()
});

type FormDataNascimento = z.infer<typeof schemaNascimento>;

export default function Home() {
  useSync();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalNovoNascimentoOpen, setModalNovoNascimentoOpen] = useState(false);
  const [modalEditarNascimentoOpen, setModalEditarNascimentoOpen] = useState(false);
  const [nascimentoEditandoId, setNascimentoEditandoId] = useState<string | null>(null);
  const [modalRacaOpen, setModalRacaOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingEdicao, setIsSubmittingEdicao] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [menuExportarAberto, setMenuExportarAberto] = useState(false);
  const matrizInputRef = useRef<HTMLInputElement>(null);
  const matrizInputRefEdicao = useRef<HTMLInputElement>(null);
  const menuExportarRef = useRef<HTMLDivElement>(null);
  
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
  const paginaFromUrl = searchParams.get('pagina');
  const itensPorPaginaFromUrl = searchParams.get('itens');
  
  const [filtroMes, setFiltroMes] = useState<number | ''>(
    filtroMesFromUrl ? Number(filtroMesFromUrl) : ''
  );
  const [filtroAno, setFiltroAno] = useState<number | ''>(
    filtroAnoFromUrl ? Number(filtroAnoFromUrl) : ''
  );
  const [filtroFazenda, setFiltroFazenda] = useState<string>(
    filtroFazendaFromUrl || ''
  );
  const [filtroMatrizBrinco, setFiltroMatrizBrinco] = useState<string>(
    filtroMatrizBrincoFromUrl || ''
  );
  const [paginaAtual, setPaginaAtual] = useState<number>(
    paginaFromUrl ? Number(paginaFromUrl) : 1
  );
  const [itensPorPagina, setItensPorPagina] = useState<number>(() => {
    const valor = itensPorPaginaFromUrl ? Number(itensPorPaginaFromUrl) : ITENS_POR_PAGINA_PADRAO;
    return OPCOES_ITENS_POR_PAGINA.includes(valor) ? valor : ITENS_POR_PAGINA_PADRAO;
  });

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

  // Selecionar primeira fazenda automaticamente se não houver filtro na URL e houver fazendas
  useEffect(() => {
    // Só selecionar automaticamente se não houver filtro na URL e não houver fazenda selecionada
    if (!filtroFazendaFromUrl && Array.isArray(fazendas) && fazendas.length > 0 && filtroFazenda === '') {
      const primeiraFazenda = fazendas[0];
      if (primeiraFazenda && primeiraFazenda.id) {
        setFiltroFazenda(primeiraFazenda.id);
      }
    }
  }, [fazendas, filtroFazendaFromUrl, filtroFazenda]);

  // Resetar página quando filtros mudarem
  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroMes, filtroAno, filtroFazenda, filtroMatrizBrinco]);

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

  // Valores padrão para o formulário: mês e ano atual
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  const { register: registerNascimento, handleSubmit: handleSubmitNascimento, formState: { errors: errorsNascimento }, reset: resetNascimento, setValue: setValueNascimento, watch: watchNascimento } = useForm<FormDataNascimento>({ 
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

  async function onSubmitNascimento(values: FormDataNascimento) {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const id = uuid();
      const now = new Date().toISOString();
      
      // Converter 'tipo' para novilha/vaca booleanos
      const novilha = values.tipo === 'novilha';
      const vaca = values.tipo === 'vaca';
      
      await db.nascimentos.add({ 
        fazendaId: values.fazendaId,
        mes: Number(values.mes),
        ano: Number(values.ano),
        matrizId: values.matrizId,
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
      alert('Erro ao salvar. Tente novamente.');
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

  const handleRacaCadastrada = (racaNome: string) => {
    setValueNascimento('raca', racaNome);
  };

  // Formulário de edição
  const nascimentoEditando = useLiveQuery(
    () => nascimentoEditandoId ? db.nascimentos.get(nascimentoEditandoId) : null,
    [nascimentoEditandoId]
  );

  const { register: registerEdicao, handleSubmit: handleSubmitEdicao, formState: { errors: errorsEdicao }, reset: resetEdicao, setValue: setValueEdicao, watch: watchEdicao } = useForm<FormDataNascimento>({ 
    resolver: zodResolver(schemaNascimento),
    shouldUnregister: false
  });

  // Carregar dados quando nascimento para edição for carregado
  useEffect(() => {
    if (nascimentoEditando && modalEditarNascimentoOpen) {
      const tipo = nascimentoEditando.vaca ? 'vaca' : nascimentoEditando.novilha ? 'novilha' : undefined;
      resetEdicao({
        fazendaId: nascimentoEditando.fazendaId,
        mes: nascimentoEditando.mes,
        ano: nascimentoEditando.ano,
        matrizId: nascimentoEditando.matrizId,
        brincoNumero: nascimentoEditando.brincoNumero || '',
        dataNascimento: nascimentoEditando.dataNascimento || '',
        sexo: nascimentoEditando.sexo,
        raca: nascimentoEditando.raca || '',
        tipo: tipo as 'novilha' | 'vaca' | undefined,
        obs: nascimentoEditando.obs || '',
        morto: nascimentoEditando.morto || false
      });
    }
  }, [nascimentoEditando, modalEditarNascimentoOpen, resetEdicao]);

  const handleAbrirEdicao = (id: string) => {
    setNascimentoEditandoId(id);
    setModalEditarNascimentoOpen(true);
  };

  const handleFecharEdicao = () => {
    setModalEditarNascimentoOpen(false);
    setNascimentoEditandoId(null);
  };

  async function onSubmitEdicao(values: FormDataNascimento) {
    if (isSubmittingEdicao || !nascimentoEditandoId) return;
    
    setIsSubmittingEdicao(true);
    try {
      const novilha = values.tipo === 'novilha';
      const vaca = values.tipo === 'vaca';
      
      const now = new Date().toISOString();
      await db.nascimentos.update(nascimentoEditandoId, { 
        fazendaId: values.fazendaId,
        mes: Number(values.mes),
        ano: Number(values.ano),
        matrizId: values.matrizId,
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
      });
      
      handleFecharEdicao();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setIsSubmittingEdicao(false);
    }
  }

  const handleRacaCadastradaEdicao = (racaNome: string) => {
    setValueEdicao('raca', racaNome);
  };

  // Aplicar filtros (mantendo a ordem de lançamento)
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
        const matrizMatch = n.matrizId?.toLowerCase().includes(busca);
        const brincoMatch = n.brincoNumero?.toLowerCase().includes(busca);
        return matrizMatch || brincoMatch;
      });
    }
    
    return filtrados;
  }, [nascimentosTodos, filtroMes, filtroAno, filtroFazenda, filtroMatrizBrinco]);

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
      alert('Por favor, preencha os filtros de Fazenda, Mês e Ano para gerar o relatório.');
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
      });
      setMenuExportarAberto(false);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório. Tente novamente.');
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
        ano: filtroAno !== '' ? filtroAno as number : undefined
      });
      setMenuExportarAberto(false);
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      alert('Erro ao exportar para Excel. Tente novamente.');
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
        ano: filtroAno !== '' ? filtroAno as number : undefined
      });
      setMenuExportarAberto(false);
    } catch (error) {
      console.error('Erro ao exportar para CSV:', error);
      alert('Erro ao exportar para CSV. Tente novamente.');
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 break-words">PLANILHA NASCIMENTO/DESMAMA</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
                {filtroMes !== '' && filtroAno !== '' && (
                  <>MÊS {filtroMes} ({nomeMes(filtroMes)}) ANO {filtroAno}</>
                )}
                {fazendaSelecionada && ` - ${fazendaSelecionada.nome}`}
              </p>
            </div>
            <button
              onClick={() => {
                if (fazendas.length === 0) {
                  alert('Você precisa cadastrar pelo menos uma fazenda antes de criar um nascimento.');
                  return;
                }
                setModalNovoNascimentoOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Novo Nascimento
            </button>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4 border-t">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fazenda</label>
              <Combobox
                value={filtroFazenda}
                onChange={setFiltroFazenda}
                options={[{ label: 'Todas', value: '' }, ...fazendas.map(f => ({ label: f.nome, value: f.id }))]}
                placeholder="Todas as fazendas"
                allowCustomValue={false}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mês</label>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Ano</label>
              <input
                type="number"
                min="2000"
                max="2100"
                value={filtroAno}
                onChange={(e) => setFiltroAno(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ano"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Matriz/Brinco</label>
              <input
                type="text"
                value={filtroMatrizBrinco}
                onChange={(e) => setFiltroMatrizBrinco(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Buscar por matriz ou brinco"
              />
            </div>

            <div className="flex items-end gap-2">
              {/* Dropdown de Exportação */}
              <div className="relative flex-1" ref={menuExportarRef}>
                <button
                  onClick={() => setMenuExportarAberto(!menuExportarAberto)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  title="Exportar dados"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar</span>
                  <span className="sm:hidden">Exp</span>
                </button>
                {/* Menu Dropdown */}
                {menuExportarAberto && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <button
                        onClick={handleExportarExcel}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                        Exportar Excel (.xlsx)
                      </button>
                      <button
                        onClick={handleExportarCSV}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                        Exportar CSV (.csv)
                      </button>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={() => {
                          handleGerarRelatorio();
                          setMenuExportarAberto(false);
                        }}
                        disabled={!podeGerarRelatorio}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!podeGerarRelatorio ? 'Preencha Fazenda, Mês e Ano para gerar o relatório' : 'Gerar relatório PDF'}
                      >
                        <FileText className="w-4 h-4 text-red-600" />
                        Gerar PDF
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
                }}
                className="flex-1 px-3 py-2 text-sm bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        {/* Versão Desktop - Tabela */}
        <div className="hidden md:block bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r w-24">MATRIZ</th>
                  <th className="px-1 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r w-14">NOVILHA</th>
                  <th className="px-1 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r w-14">VACA</th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r w-16">SEXO</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r w-28">RAÇA</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r w-20">NÚMERO<br/>BRINCO</th>
                  <th className="px-1 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r w-16">MORTO</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r w-32">PESO<br/>DESMAMA</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r w-28">DATA<br/>DESMAMA</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r min-w-[140px]">OBS</th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24 sticky right-0 bg-gray-50 z-10">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {nascimentos.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                      Nenhum nascimento cadastrado ainda.
                    </td>
                  </tr>
                ) : (
                  nascimentos.map((n) => {
                    const desmama = desmamasMap.get(n.id);
                    return (
                      <tr key={n.id} className={`hover:bg-gray-50 ${n.morto ? 'bg-red-50' : ''}`}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 border-r">
                          {n.matrizId}
                        </td>
                        <td className="px-1 py-2 whitespace-nowrap text-center border-r">
                          {n.novilha ? <span className="text-blue-600 font-bold text-xs">X</span> : ''}
                        </td>
                        <td className="px-1 py-2 whitespace-nowrap text-center border-r">
                          {n.vaca ? <span className="text-blue-600 font-bold text-xs">X</span> : ''}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-700 text-center border-r">
                          {n.sexo || ''}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-700 border-r">
                          {n.raca || ''}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-700 border-r">
                          {n.brincoNumero || '-'}
                        </td>
                        <td className="px-1 py-2 whitespace-nowrap text-center border-r">
                          {n.morto ? <span className="text-red-600 font-bold text-xs">X</span> : ''}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-700 border-r">
                          {desmama?.pesoDesmama ? (
                            <span>{desmama.pesoDesmama} kg</span>
                          ) : (
                            !desmama ? (
                              <Link 
                                to={`/desmama/${n.id}`}
                                className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                title="Cadastrar desmama"
                              >
                                <Plus className="w-3 h-3 mr-0.5" />
                                <span className="hidden sm:inline">Cadastrar</span>
                              </Link>
                            ) : '-'
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-sm text-gray-700 border-r">
                          {desmama?.dataDesmama ? formatDate(desmama.dataDesmama) : '-'}
                        </td>
                        <td className="px-2 py-2 text-sm text-gray-700 border-r">
                          <span className="block max-w-[140px]" title={n.obs || ''}>
                            {n.obs || '-'}
                          </span>
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-sm text-center sticky right-0 bg-white border-l z-10">
                          <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleAbrirEdicao(n.id)}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                  title="Editar nascimento"
                                >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Deseja realmente excluir o nascimento da matriz ${n.matrizId}?`)) {
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
                                    alert(`Erro ao excluir: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                                  }
                                }
                              }}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                              title="Excluir nascimento"
                            >
                              <Trash2 className="w-4 h-4" />
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
            <div className="bg-white px-4 py-3 border-t border-gray-200">
              {/* Seletor de Itens por Página */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Itens por página:</label>
                  <select
                    value={itensPorPagina}
                    onChange={(e) => {
                      const novoValor = Number(e.target.value);
                      if (OPCOES_ITENS_POR_PAGINA.includes(novoValor)) {
                        setItensPorPagina(novoValor);
                      }
                    }}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    {OPCOES_ITENS_POR_PAGINA.map(opcao => (
                      <option key={opcao} value={opcao}>{opcao}</option>
                    ))}
                  </select>
                </div>
                <div className="text-sm text-gray-700">
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
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <span className="text-sm text-gray-700">
                      Página {paginaAtual} de {totalPaginas}
                    </span>
                    <button
                      onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaAtual === totalPaginas}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Próxima
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
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
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-5 w-5" />
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
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {paginaNumero}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                          disabled={paginaAtual === totalPaginas}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="h-5 w-5" />
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
          {nascimentos.length === 0 ? (
            <div className="bg-white p-6 rounded-lg shadow-sm text-center text-gray-500">
              Nenhum nascimento cadastrado ainda.
            </div>
        ) : (
            nascimentos.map((n) => {
              const desmama = desmamasMap.get(n.id);
              return (
                <div key={n.id} className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-sm sm:text-base font-semibold text-gray-900 break-words">Matriz: {n.matrizId}</span>
                        {n.novilha && <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded whitespace-nowrap">Novilha</span>}
                        {n.vaca && <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-800 rounded whitespace-nowrap">Vaca</span>}
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
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Deseja realmente excluir o nascimento da matriz ${n.matrizId}?`)) {
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
                              alert(`Erro ao excluir: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                            }
                          }
                        }}
                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {!desmama && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <Link 
                        to={`/desmama/${n.id}`}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                      >
                        <Plus className="w-3 h-3 mr-1" />
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
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
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
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </button>
                  <span className="text-sm text-gray-700 font-medium">
                    Página {paginaAtual} de {totalPaginas}
                  </span>
                  <button
                    onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaAtual === totalPaginas}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé com Totalizadores */}
        <div className="mt-6 bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Resumo</h3>
          </div>
          <div className="p-6">
            {/* Cards principais */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Card Vacas */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-purple-800 uppercase tracking-wide">Vacas</h4>
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-purple-900">{totais.vacas}</div>
              </div>

              {/* Card Novilhas */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs sm:text-sm font-medium text-green-800 uppercase tracking-wide">Novilhas</h4>
                  <User className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-green-900">{totais.novilhas}</div>
              </div>

              {/* Card Fêmeas */}
              <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-4 border border-pink-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs sm:text-sm font-medium text-pink-800 uppercase tracking-wide">Fêmeas</h4>
                  <Venus className="w-5 h-5 sm:w-6 sm:h-6 text-pink-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-pink-900">{totais.femeas}</div>
              </div>

              {/* Card Machos */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs sm:text-sm font-medium text-blue-800 uppercase tracking-wide">Machos</h4>
                  <Mars className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-blue-900">{totais.machos}</div>
              </div>
            </div>

            {/* Totais por Raça */}
            {totais.totaisPorRaca.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-3">Totais por Raça</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {totais.totaisPorRaca.map(({ raca, total }) => (
                    <div key={raca} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="text-xs sm:text-sm text-gray-600 mb-1 break-words">{raca}</div>
                      <div className="text-lg sm:text-xl font-bold text-gray-900">{total}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Card Total Geral */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 sm:p-6 border-2 border-gray-300">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs sm:text-sm font-medium text-gray-800 uppercase tracking-wide">Total Geral</h4>
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />
              </div>
              <div className="flex items-baseline flex-wrap">
                <span className="text-3xl sm:text-4xl font-bold text-gray-900">{totais.totalGeral}</span>
                <span className="ml-2 text-xs sm:text-sm text-gray-700">nascimentos</span>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-300">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <span className="text-gray-600">Vacas: </span>
                    <span className="font-semibold text-gray-800">{totais.vacas}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Novilhas: </span>
                    <span className="font-semibold text-gray-800">{totais.novilhas}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Fêmeas: </span>
                    <span className="font-semibold text-gray-800">{totais.femeas}</span>
                  </div>
                <div>
                    <span className="text-gray-600">Machos: </span>
                    <span className="font-semibold text-gray-800">{totais.machos}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Novo Nascimento */}
      {modalNovoNascimentoOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          {/* Overlay */}
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setModalNovoNascimentoOpen(false)}></div>

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold text-gray-900">Novo Nascimento/Desmama</h2>
                <button
                  onClick={() => setModalNovoNascimentoOpen(false)}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                >
                  <X className="w-6 h-6" />
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
                      options={fazendas.map(f => ({ label: f.nome, value: f.id }))}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                    <input 
                      type="date"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      {...registerNascimento('dataNascimento')} 
                    />
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
                      options={racas.map(r => r.nome)}
                      placeholder="Digite ou selecione uma raça"
                      onAddNew={() => setModalRacaOpen(true)}
                      addNewLabel="Cadastrar nova raça"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                    <div className="flex items-center gap-6">
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

                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
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

                <div className="flex gap-3 pt-4 border-t border-gray-200">
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
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold text-gray-900">Editar Nascimento/Desmama</h2>
                <button
                  onClick={handleFecharEdicao}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitEdicao(onSubmitEdicao)} className="p-6 space-y-4">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                    <input 
                      type="date"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                      {...registerEdicao('dataNascimento')} 
                    />
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
                      options={racas.map(r => r.nome)}
                      placeholder="Digite ou selecione uma raça"
                      onAddNew={() => setModalRacaOpen(true)}
                      addNewLabel="Cadastrar nova raça"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                    <div className="flex items-center gap-6">
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

                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
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

                <div className="flex gap-3 pt-4 border-t border-gray-200">
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
    </div>
  );
}
