import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useForm, Controller, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { Animal, TipoAnimal, StatusAnimal, Origem, Fazenda, Raca, Pesagem, Vacina, Desmama } from '../db/models';
import { uuid } from '../utils/uuid';
import { showToast } from '../utils/toast';
import { Icons } from '../utils/iconMapping';
import { useAppSettings } from '../hooks/useAppSettings';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getThemeClasses } from '../utils/themeHelpers';
import { registrarAudit } from '../utils/audit';
import { recalculateTagUsage } from '../utils/fixTagUsageCount';
import Modal from './Modal';
import Combobox, { ComboboxOption } from './Combobox';
import AnimalSearchCombobox from './AnimalSearchCombobox';
import MatrizSearchCombobox from './MatrizSearchCombobox';
import TipoAnimalModal from './TipoAnimalModal';
import StatusAnimalModal from './StatusAnimalModal';
import TagSelector from './TagSelector';
import Input from './Input';
import Textarea from './Textarea';
import PesagemModal from './PesagemModal';
import VacinaModal from './VacinaModal';
import DesmamaModal from './DesmamaModal';
import { normalizarDataInput, converterDataParaFormatoInput, converterDataParaFormatoBanco } from '../utils/dateInput';

// Helper para validar números opcionais (aceita número, string vazia ou undefined)
const numeroOpcional = z.preprocess(
  (val) => {
    // Se for vazio, null ou undefined, retorna undefined
    if (val === '' || val === null || val === undefined) {
      return undefined;
    }
    // Se já for número, retorna como está (ou undefined se NaN)
    if (typeof val === 'number') {
      return isNaN(val) ? undefined : val;
    }
    // Se for string, tenta converter
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') return undefined;
      const parsed = parseFloat(trimmed);
      return isNaN(parsed) ? undefined : parsed;
    }
    // Qualquer outro tipo, retorna undefined
    return undefined;
  },
  z.number().optional()
);

const schemaAnimal = z.object({
  brinco: z.string().min(1, 'Brinco obrigatório'),
  nome: z.string().optional(),
  tipoId: z.string().min(1, 'Selecione o tipo'),
  tipoMatrizId: z.string().optional(), // Será salvo na Genealogia
  racaId: z.string().optional(),
  sexo: z.enum(['M', 'F'], { required_error: 'Selecione o sexo' }),
  statusId: z.string().min(1, 'Selecione o status'),
  dataNascimento: z.string().min(1, 'Data de nascimento obrigatória').regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Formato inválido (dd/mm/yyyy)'),
  dataCadastro: z.string().optional(),
  dataEntrada: z.string().optional(),
  dataSaida: z.string().optional(),
  origemId: z.string().min(1, 'Selecione a origem'),
  fazendaId: z.string().min(1, 'Selecione a fazenda'),
  fazendaOrigemId: z.string().optional(),
  proprietarioAnterior: z.string().optional(),
  matrizId: z.string().optional(),
  reprodutorId: z.string().optional(),
  valorCompra: numeroOpcional,
  valorVenda: numeroOpcional,
  pelagem: z.string().optional(),
  pesoAtual: numeroOpcional,
  lote: z.string().optional(),
  obs: z.string().optional()
});

type FormDataAnimal = z.infer<typeof schemaAnimal>;

interface AnimalModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData?: Animal | null;
  onClose: () => void;
  onSaved?: () => void;
}

type TabType = 'identificacao' | 'classificacao' | 'datas' | 'origem' | 'genealogia' | 'financeiro' | 'desmama' | 'pesagens' | 'vacinacoes' | 'tags';

// Mapeamento de campos para abas (para validação)
const campoParaAba: Record<string, TabType> = {
  brinco: 'identificacao',
  nome: 'identificacao',
  lote: 'identificacao',
  tipoId: 'classificacao',
  statusId: 'classificacao',
  sexo: 'classificacao',
  racaId: 'classificacao',
  pelagem: 'classificacao',
  dataNascimento: 'datas',
  dataCadastro: 'datas',
  dataEntrada: 'datas',
  dataSaida: 'datas',
  origemId: 'origem',
  fazendaId: 'origem',
  fazendaOrigemId: 'origem',
  proprietarioAnterior: 'origem',
  matrizId: 'genealogia',
  tipoMatrizId: 'genealogia',
  reprodutorId: 'genealogia',
  valorCompra: 'financeiro',
  valorVenda: 'financeiro',
  pesoAtual: 'financeiro',
  obs: 'tags'
};

export default function AnimalModal({ open, mode, initialData, onClose, onSaved }: AnimalModalProps) {
  const { appSettings } = useAppSettings();
  const { user } = useAuth();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [saving, setSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('identificacao');
  
  // Modais de cadastro rápido
  const [tipoModalOpen, setTipoModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  
  // Modais de pesagem, vacinação e desmama
  const [pesagemModalOpen, setPesagemModalOpen] = useState(false);
  const [vacinaModalOpen, setVacinaModalOpen] = useState(false);
  const [desmamaModalOpen, setDesmamaModalOpen] = useState(false);
  const [pesagemEditando, setPesagemEditando] = useState<Pesagem | null>(null);
  const [vacinaEditando, setVacinaEditando] = useState<Vacina | null>(null);
  const [desmamaEditando, setDesmamaEditando] = useState<Desmama | null>(null);
  
  // Estado para brinco temporário
  const [brincoTemporario, setBrincoTemporario] = useState(false);
  const [brincoTemporarioGerado, setBrincoTemporarioGerado] = useState<string | null>(null);
  
  // Refs para focar campos
  const campoRefs = useRef<Record<string, HTMLElement | null>>({});
  
  // Ref para evitar múltiplas reaplicações de valores
  const valoresReaplicadosRef = useRef<string | null>(null);

  // 🚀 OTIMIZAÇÃO CRÍTICA: Carregar dados apenas uma vez quando modal abre
  // Usar useState + useEffect ao invés de useLiveQuery para evitar queries reativas constantes
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [racas, setRacas] = useState<Raca[]>([]);
  const [tipos, setTipos] = useState<TipoAnimal[]>([]);
  const [status, setStatus] = useState<StatusAnimal[]>([]);
  const [origens, setOrigens] = useState<Origem[]>([]);
  const [modalRacaOpen, setModalRacaOpen] = useState(false);

  const { hasPermission } = usePermissions();
  const podeGerenciarRacas = hasPermission('gerenciar_racas');

  const refetchRacas = useCallback(() => {
    db.racas.toArray().then(setRacas);
  }, []);

  // Carregar dados apenas quando modal abrir
  useEffect(() => {
    if (!open) {
      // Limpar dados quando fechar para liberar memória
      setFazendas([]);
      setRacas([]);
      setTipos([]);
      setStatus([]);
      setOrigens([]);
      return;
    }

    // Carregar dados uma única vez
    Promise.all([
      db.fazendas.toArray(),
      db.racas.toArray(),
      db.tiposAnimal.filter(t => t.ativo && !t.deletedAt).toArray(),
      db.statusAnimal.filter(s => s.ativo && !s.deletedAt).toArray(),
      db.origens.filter(o => o.ativo && !o.deletedAt).toArray()
    ]).then(([faz, rac, tip, sta, orig]) => {
      setFazendas(faz);
      setRacas(rac);
      setTipos(tip);
      setStatus(sta);
      setOrigens(orig);
    }).catch(err => {
      console.error('Erro ao carregar dados do modal:', err);
    });
  }, [open]);
  
  // 🚀 OTIMIZAÇÃO: Não carregar todos os animais aqui!
  // AnimalSearchCombobox faz busca assíncrona apenas quando necessário

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    setValue,
    watch,
    getValues
  } = useForm<FormDataAnimal>({
    resolver: zodResolver(schemaAnimal),
    defaultValues: {
      brinco: '',
      nome: '',
      tipoId: '',
      tipoMatrizId: '',
      racaId: '',
      sexo: 'M',
      statusId: '',
      dataNascimento: '',
      dataCadastro: '',
      dataEntrada: '',
      dataSaida: '',
      origemId: '',
      fazendaId: '',
      fazendaOrigemId: '',
      proprietarioAnterior: '',
      matrizId: '',
      reprodutorId: '',
      valorCompra: undefined,
      valorVenda: undefined,
      pelagem: '',
      pesoAtual: undefined,
      lote: '',
      obs: ''
    }
  });

  // Buscar pesagens e vacinações do animal (apenas em modo edição)
  const animalId = mode === 'edit' && initialData ? initialData.id : null;
  
  // Usar useMemo para evitar queries desnecessárias
  const pesagens = useLiveQuery(
    () => {
      if (!open || !animalId) return Promise.resolve([]);
      return db.pesagens
        .filter(p => p.animalId === animalId || p.nascimentoId === animalId)
        .toArray();
    },
    [animalId, open]
  ) || [];
  
  const vacinacoes = useLiveQuery(
    () => {
      if (!open || !animalId) return Promise.resolve([]);
      return db.vacinacoes
        .filter(v => v.animalId === animalId || v.nascimentoId === animalId)
        .toArray();
    },
    [animalId, open]
  ) || [];

  const desmamas = useLiveQuery(
    () => {
      if (!open || !animalId) return Promise.resolve([]);
      return db.desmamas
        .filter(d => d.animalId === animalId || d.nascimentoId === animalId)
        .toArray();
    },
    [animalId, open]
  ) || [];

  // Função para identificar qual aba tem erro e focar no campo
  const focarAbaComErro = (errors: FieldErrors<FormDataAnimal>) => {
    const camposComErro = Object.keys(errors);
    if (camposComErro.length === 0) return;

    // Encontrar a primeira aba com erro
    for (const campo of camposComErro) {
      const aba = campoParaAba[campo];
      if (aba) {
        setActiveTab(aba);
        // Focar no campo após um pequeno delay para garantir que a aba foi renderizada
        setTimeout(() => {
          const elemento = campoRefs.current[campo] || document.querySelector(`[name="${campo}"]`);
          if (elemento) {
            elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (elemento instanceof HTMLElement && 'focus' in elemento) {
              (elemento as HTMLElement).focus();
            }
          }
        }, 100);
        break;
      }
    }
  };

  // Watch para TODOS os campos para garantir atualização completa
  // Campos de texto simples
  const brincoWatch = watch('brinco');
  const nomeWatch = watch('nome');
  const loteWatch = watch('lote');
  const obsWatch = watch('obs');
  const pelagemWatch = watch('pelagem');
  const proprietarioAnteriorWatch = watch('proprietarioAnterior');
  
  // Campos de seleção (Combobox)
  const tipoIdWatch = watch('tipoId');
  const statusIdWatch = watch('statusId');
  const sexoWatch = watch('sexo');
  const racaIdWatch = watch('racaId');
  const origemIdWatch = watch('origemId');
  const fazendaIdWatch = watch('fazendaId');
  const fazendaOrigemIdWatch = watch('fazendaOrigemId');
  const matrizIdWatch = watch('matrizId');
  const tipoMatrizIdWatch = watch('tipoMatrizId');
  const reprodutorIdWatch = watch('reprodutorId');
  
  // Campos de data
  const dataNascimentoWatch = watch('dataNascimento');
  const dataCadastroWatch = watch('dataCadastro');
  const dataEntradaWatch = watch('dataEntrada');
  const dataSaidaWatch = watch('dataSaida');
  
  // Campos numéricos
  const valorCompraWatch = watch('valorCompra');
  const valorVendaWatch = watch('valorVenda');
  const pesoAtualWatch = watch('pesoAtual');


  // 🚀 OTIMIZAÇÃO: Options para comboboxes (processar apenas quando necessário)
  const tipoOptions: ComboboxOption[] = useMemo(() => {
    if (!open || tipos.length === 0) return [];
    // Limitar processamento - tipos geralmente são poucos (< 20)
    return tipos
      .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
      .map(t => ({ label: t.nome, value: t.id }));
  }, [tipos, open]);

  const statusOptions: ComboboxOption[] = useMemo(() => {
    if (!open || status.length === 0) return [];
    return status
      .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
      .map(s => ({ label: s.nome, value: s.id }));
  }, [status, open]);

  const origemOptions: ComboboxOption[] = useMemo(() => {
    if (!open || origens.length === 0) return [];
    return origens
      .sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
      .map(o => ({ label: o.nome, value: o.id }));
  }, [origens, open]);

  const fazendaOptions: ComboboxOption[] = useMemo(() => {
    if (!open || fazendas.length === 0) return [];
    return fazendas
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
      .map(f => ({ label: f.nome, value: f.id }));
  }, [fazendas, open]);

  const racaOptions: ComboboxOption[] = useMemo(() => {
    if (!open) return [{ label: 'Nenhuma', value: '' }];
    return [
      { label: 'Nenhuma', value: '' },
      ...racas
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
        .map(r => ({ label: r.nome, value: r.id }))
    ];
  }, [racas, open]);

  // 🚀 OTIMIZAÇÃO: Limitar animais para genealogia (apenas 100 mais recentes)
  // 🚀 REMOVIDO: animalOptions não é mais necessário
  // AnimalSearchCombobox faz busca assíncrona, não precisa carregar todos os animais

  // Reaplicar valores quando as opções estiverem disponíveis (para garantir que os Combobox encontrem os valores)
  useEffect(() => {
    // Resetar flag quando modal fecha ou muda de animal
    if (!open || !initialData?.id) {
      valoresReaplicadosRef.current = null;
      return;
    }
    
    // Verificar se já reaplicamos para este animal
    if (valoresReaplicadosRef.current === initialData.id) {
      return; // Já reaplicamos, não fazer novamente
    }
    
    if (mode === 'edit' && initialData && tipos.length > 0 && status.length > 0 && origens.length > 0 && fazendas.length > 0) {
      // Aguardar um pouco para garantir que as opções foram carregadas e renderizadas
      const timeoutId = setTimeout(() => {
        const currentValues = getValues();
        
        // Preparar valores do formulário novamente
        const valoresFormulario = {
          brinco: initialData.brinco || '',
          nome: initialData.nome || '',
          tipoId: initialData.tipoId,
          tipoMatrizId: '',
          racaId: initialData.racaId || '',
          sexo: initialData.sexo,
          statusId: initialData.statusId,
          dataNascimento: converterDataParaFormatoInput(initialData.dataNascimento),
          dataCadastro: initialData.dataCadastro ? converterDataParaFormatoInput(initialData.dataCadastro) : '',
          dataEntrada: initialData.dataEntrada ? converterDataParaFormatoInput(initialData.dataEntrada) : '',
          dataSaida: initialData.dataSaida ? converterDataParaFormatoInput(initialData.dataSaida) : '',
          origemId: initialData.origemId,
          fazendaId: initialData.fazendaId,
          fazendaOrigemId: initialData.fazendaOrigemId || '',
          proprietarioAnterior: initialData.proprietarioAnterior || '',
          matrizId: initialData.matrizId || '',
          reprodutorId: initialData.reprodutorId || '',
          valorCompra: initialData.valorCompra,
          valorVenda: initialData.valorVenda,
          pelagem: initialData.pelagem || '',
          pesoAtual: initialData.pesoAtual,
          lote: initialData.lote || '',
          obs: initialData.obs || ''
        };
        
        // Reaplicar TODOS os valores para garantir que os Combobox encontrem os valores nas opções
        Object.entries(valoresFormulario).forEach(([key, value]) => {
          const fieldKey = key as keyof FormDataAnimal;
          const currentValue = currentValues[fieldKey];
          
          // Campos numéricos opcionais - aplicar mesmo se undefined
          if (key === 'valorCompra' || key === 'valorVenda' || key === 'pesoAtual') {
            if (currentValue !== value) {
              setValue(fieldKey, value as any, { shouldValidate: false, shouldDirty: false });
            }
          }
          // Campos de string - aplicar mesmo se vazio
          else if (typeof value === 'string') {
            if (currentValue !== value) {
              setValue(fieldKey, value as any, { shouldValidate: false, shouldDirty: false });
            }
          }
          // Outros campos
          else if (value !== undefined && value !== null && currentValue !== value) {
            setValue(fieldKey, value as any, { shouldValidate: false, shouldDirty: false });
          }
        });
        
        // Garantir que campos específicos sejam aplicados explicitamente
        if (currentValues.brinco !== valoresFormulario.brinco) {
          setValue('brinco', valoresFormulario.brinco, { shouldValidate: false, shouldDirty: false });
        }
        if (currentValues.nome !== valoresFormulario.nome) {
          setValue('nome', valoresFormulario.nome, { shouldValidate: false, shouldDirty: false });
        }
        if (currentValues.lote !== valoresFormulario.lote) {
          setValue('lote', valoresFormulario.lote, { shouldValidate: false, shouldDirty: false });
        }
        if (currentValues.obs !== valoresFormulario.obs) {
          setValue('obs', valoresFormulario.obs, { shouldValidate: false, shouldDirty: false });
        }
        if (currentValues.valorCompra !== valoresFormulario.valorCompra) {
          setValue('valorCompra', valoresFormulario.valorCompra, { shouldValidate: false, shouldDirty: false });
        }
        if (currentValues.valorVenda !== valoresFormulario.valorVenda) {
          setValue('valorVenda', valoresFormulario.valorVenda, { shouldValidate: false, shouldDirty: false });
        }
        if (currentValues.pesoAtual !== valoresFormulario.pesoAtual) {
          setValue('pesoAtual', valoresFormulario.pesoAtual, { shouldValidate: false, shouldDirty: false });
        }
        
        // Reaplicar também tipoMatrizId e reprodutorId da genealogia (apenas uma vez)
        if (initialData?.id) {
          db.genealogias
            .where('animalId')
            .equals(initialData.id)
            .first()
            .then(genealogia => {
              if (genealogia) {
                // tipoMatrizId vem da genealogia
                if (genealogia.tipoMatrizId && getValues('tipoMatrizId') !== genealogia.tipoMatrizId) {
                  setValue('tipoMatrizId', genealogia.tipoMatrizId, { shouldValidate: false, shouldDirty: false });
                }
                // reprodutorId pode vir da genealogia ou do initialData
                const reprodutorIdFinal = genealogia.reprodutorId || initialData.reprodutorId || '';
                if (reprodutorIdFinal && getValues('reprodutorId') !== reprodutorIdFinal) {
                  setValue('reprodutorId', reprodutorIdFinal, { shouldValidate: false, shouldDirty: false });
                }
              } else {
                // Se não há genealogia, usar valores do initialData
                if (initialData.reprodutorId && getValues('reprodutorId') !== initialData.reprodutorId) {
                  setValue('reprodutorId', initialData.reprodutorId, { shouldValidate: false, shouldDirty: false });
                }
              }
            })
            .catch(() => {
              // Em caso de erro, usar valores do initialData
              if (initialData.reprodutorId && getValues('reprodutorId') !== initialData.reprodutorId) {
                setValue('reprodutorId', initialData.reprodutorId, { shouldValidate: false, shouldDirty: false });
              }
            });
        }
        
        // Marcar que já reaplicamos para este animal
        valoresReaplicadosRef.current = initialData.id;
        console.log('✅ Valores reaplicados quando opções disponíveis');
      }, 500); // Aumentar delay para garantir que os Combobox foram renderizados

      return () => clearTimeout(timeoutId);
    }
  }, [open, mode, initialData?.id, tipos.length, status.length, origens.length, fazendas.length, racas.length, setValue, getValues]);

  useEffect(() => {
    if (open) {
      // Resetar para a primeira aba quando abrir o modal
      setActiveTab('identificacao');
      
      // Sempre limpar primeiro quando abrir o modal
      if (mode === 'create') {
        // Data atual no formato DD/MM/YYYY
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
        const dataAtual = `${dia}/${mes}/${ano}`;
        
        // Gerar brinco temporário se necessário
        const gerarBrincoTemporario = () => {
          const agora = new Date();
          const ano = agora.getFullYear();
          const mes = String(agora.getMonth() + 1).padStart(2, '0');
          const dia = String(agora.getDate()).padStart(2, '0');
          const hora = String(agora.getHours()).padStart(2, '0');
          const minuto = String(agora.getMinutes()).padStart(2, '0');
          const segundo = String(agora.getSeconds()).padStart(2, '0');
          return `TEMP-${ano}${mes}${dia}-${hora}${minuto}${segundo}`;
        };
        
        // Marcar checkbox como padrão e gerar brinco temporário
        setBrincoTemporario(true);
        const brincoInicial = gerarBrincoTemporario();
        setBrincoTemporarioGerado(brincoInicial);
        
        // Resetar com valores explícitos vazios para garantir limpeza completa
        reset({
          brinco: brincoInicial,
          nome: '',
          tipoId: '',
          tipoMatrizId: '',
          racaId: '',
          sexo: 'M' as 'M' | 'F',
          statusId: '',
          dataNascimento: '',
          dataCadastro: dataAtual,
          dataEntrada: '',
          dataSaida: '',
          origemId: '',
          fazendaId: '',
          fazendaOrigemId: '',
          proprietarioAnterior: '',
          matrizId: '',
          reprodutorId: '',
          valorCompra: undefined,
          valorVenda: undefined,
          pelagem: '',
          pesoAtual: undefined,
          lote: '',
          obs: ''
        });
        setSelectedTagIds([]);
      } else if (mode === 'edit' && initialData) {
        // Validar apenas campos críticos - não bloquear se alguns campos opcionais estiverem faltando
        if (!initialData.brinco || !initialData.id) {
          console.error('❌ Campos críticos faltando no initialData:', {
            brinco: initialData.brinco,
            id: initialData.id
          });
          showToast({
            type: 'error',
            title: 'Erro ao carregar animal',
            message: 'Dados incompletos. Brinco ou ID do animal está faltando.'
          });
          return;
        }
        
        // Verificar se o brinco atual é temporário
        const brincoAtual = initialData.brinco || '';
        const isBrincoTemporario = brincoAtual.startsWith('TEMP-') || brincoAtual.startsWith('PEND-');
        // Se o brinco tiver valor e não for temporário, desmarcar o checkbox
        if (brincoAtual && brincoAtual.trim().length > 0 && !isBrincoTemporario) {
          setBrincoTemporario(false);
          setBrincoTemporarioGerado(null);
        } else if (isBrincoTemporario) {
          setBrincoTemporario(true);
          setBrincoTemporarioGerado(brincoAtual);
        } else {
          // Se não houver brinco, marcar como temporário
          setBrincoTemporario(true);
          setBrincoTemporarioGerado(null);
        }
        
        // Log de aviso se campos importantes estiverem faltando, mas não bloquear
        if (!initialData.tipoId || !initialData.sexo || !initialData.statusId || !initialData.dataNascimento || !initialData.origemId || !initialData.fazendaId) {
          console.warn('⚠️ Alguns campos importantes faltando no initialData (preenchendo com valores padrão se necessário):', {
            tipoId: initialData.tipoId,
            sexo: initialData.sexo,
            statusId: initialData.statusId,
            dataNascimento: initialData.dataNascimento,
            origemId: initialData.origemId,
            fazendaId: initialData.fazendaId
          });
        }

        const valoresFormulario = {
          brinco: initialData.brinco || '',
          nome: initialData.nome || '',
          tipoId: initialData.tipoId || '',
          tipoMatrizId: '', // Será preenchido depois pela genealogia
          racaId: initialData.racaId || '',
          sexo: initialData.sexo || 'M',
          statusId: initialData.statusId || '',
          dataNascimento: initialData.dataNascimento ? converterDataParaFormatoInput(initialData.dataNascimento) : '',
          dataCadastro: initialData.dataCadastro ? converterDataParaFormatoInput(initialData.dataCadastro) : '',
          dataEntrada: initialData.dataEntrada ? converterDataParaFormatoInput(initialData.dataEntrada) : '',
          dataSaida: initialData.dataSaida ? converterDataParaFormatoInput(initialData.dataSaida) : '',
          origemId: initialData.origemId || '',
          fazendaId: initialData.fazendaId || '',
          fazendaOrigemId: initialData.fazendaOrigemId || '',
          proprietarioAnterior: initialData.proprietarioAnterior || '',
          matrizId: initialData.matrizId || '',
          reprodutorId: initialData.reprodutorId || '',
          valorCompra: initialData.valorCompra,
          valorVenda: initialData.valorVenda,
          pelagem: initialData.pelagem || '',
          pesoAtual: initialData.pesoAtual,
          lote: initialData.lote || '',
          obs: initialData.obs || ''
        };
        
        console.log('📝 Preenchendo formulário com dados:', JSON.stringify(valoresFormulario, null, 2));
        console.log('📝 initialData completo:', JSON.stringify(initialData, null, 2));
        
        // Preencher formulário com dados existentes
        // Usar reset com os valores para garantir que todos os campos sejam preenchidos
        reset(valoresFormulario, { 
          keepDefaultValues: false,
          keepValues: false 
        });

        // Aguardar um pequeno delay para garantir que o reset foi aplicado antes de setar valores adicionais
        const timeoutId = setTimeout(() => {
          // Reaplicar TODOS os valores usando setValue para garantir que sejam aplicados corretamente
          // Isso é necessário porque reset() pode não propagar valores para campos controlados corretamente
          Object.entries(valoresFormulario).forEach(([key, value]) => {
            const fieldKey = key as keyof FormDataAnimal;
            
            // Campos numéricos opcionais podem ser undefined - aplicar sempre
            if (key === 'valorCompra' || key === 'valorVenda' || key === 'pesoAtual') {
              setValue(fieldKey, value as any, { 
                shouldValidate: false, 
                shouldDirty: false,
                shouldTouch: false
              });
            }
            // Campos de string - aplicar sempre, mesmo se vazio
            else if (typeof value === 'string') {
              setValue(fieldKey, value as any, { 
                shouldValidate: false, 
                shouldDirty: false,
                shouldTouch: false
              });
            }
            // Outros campos - aplicar se não for undefined/null
            else if (value !== undefined && value !== null) {
              setValue(fieldKey, value as any, { 
                shouldValidate: false, 
                shouldDirty: false,
                shouldTouch: false
              });
            }
          });
          
          // Garantir que campos específicos sejam aplicados explicitamente (forçar re-render)
          setTimeout(() => {
            setValue('brinco', valoresFormulario.brinco, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
            setValue('nome', valoresFormulario.nome, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
            setValue('lote', valoresFormulario.lote, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
            setValue('obs', valoresFormulario.obs, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
            setValue('valorCompra', valoresFormulario.valorCompra, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
            setValue('valorVenda', valoresFormulario.valorVenda, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
            setValue('pesoAtual', valoresFormulario.pesoAtual, { shouldValidate: false, shouldDirty: false, shouldTouch: false });
          }, 50);
          
          console.log('✅ Valores reaplicados após reset:', valoresFormulario);

          // Carregar genealogia para obter tipoMatrizId e reprodutorId (separadamente)
          db.genealogias
            .where('animalId')
            .equals(initialData.id)
            .first()
            .then(genealogia => {
              if (genealogia) {
                // tipoMatrizId vem da genealogia
                if (genealogia.tipoMatrizId) {
                  setValue('tipoMatrizId', genealogia.tipoMatrizId, { shouldValidate: false, shouldDirty: false });
                }
                // reprodutorId pode vir da genealogia ou do initialData
                const reprodutorIdFinal = genealogia.reprodutorId || initialData.reprodutorId || '';
                if (reprodutorIdFinal) {
                  setValue('reprodutorId', reprodutorIdFinal, { shouldValidate: false, shouldDirty: false });
                }
              } else {
                // Se não há genealogia, usar valores do initialData
                if (initialData.reprodutorId) {
                  setValue('reprodutorId', initialData.reprodutorId, { shouldValidate: false, shouldDirty: false });
                }
              }
            })
            .catch(() => {
              // Em caso de erro, usar valores do initialData
              if (initialData.reprodutorId) {
                setValue('reprodutorId', initialData.reprodutorId, { shouldValidate: false, shouldDirty: false });
              }
            });

          // Carregar tags
          db.tagAssignments
            .where('[entityId+entityType]')
            .equals([initialData.id, 'animal'])
            .and(a => !a.deletedAt)
            .toArray()
            .then(assignments => {
              const tagIds = assignments.map(a => a.tagId);
              setSelectedTagIds(tagIds);
              console.log('✅ Tags carregadas:', tagIds);
            })
            .catch(() => {
              // Ignorar erro silenciosamente
            });
        }, 200);

        // Cleanup do timeout se o componente desmontar ou modal fechar
        return () => {
          clearTimeout(timeoutId);
        };
      }
    } else {
      // Quando o modal fecha, limpar o formulário completamente
      reset({
        brinco: '',
        nome: '',
        tipoId: '',
        tipoMatrizId: '',
        racaId: '',
        sexo: 'M' as 'M' | 'F',
        statusId: '',
        dataNascimento: '',
        dataCadastro: '',
        dataEntrada: '',
        dataSaida: '',
        origemId: '',
        fazendaId: '',
        fazendaOrigemId: '',
        proprietarioAnterior: '',
        matrizId: '',
        reprodutorId: '',
        valorCompra: undefined,
        valorVenda: undefined,
        pelagem: '',
        pesoAtual: undefined,
        lote: '',
        obs: ''
      });
      setSelectedTagIds([]);
      // Resetar flags de brinco temporário ao fechar
      if (!open) {
        setBrincoTemporario(false);
        setBrincoTemporarioGerado(null);
      }
    }
  }, [open, mode, initialData?.id, setValue, reset]); // Removido getValues das dependências para evitar loops

  // REMOVIDO: useEffect que causava loop infinito
  // A lógica de sincronização do checkbox agora está apenas no onChange e onBlur do campo brinco

  const onSubmit = async (data: FormDataAnimal) => {
    if (saving) {
      console.warn('Salvamento já em andamento, ignorando submit duplicado');
      return;
    }
    setSaving(true);
    try {
      console.log('🔄 Salvando animal:', { mode, animalId: initialData?.id, data });
      const now = new Date().toISOString();

      if (mode === 'create') {
        // Se o brinco estiver vazio, gerar um temporário
        let brincoFinal = data.brinco.trim();
        if (!brincoFinal) {
          const agora = new Date();
          const ano = agora.getFullYear();
          const mes = String(agora.getMonth() + 1).padStart(2, '0');
          const dia = String(agora.getDate()).padStart(2, '0');
          const hora = String(agora.getHours()).padStart(2, '0');
          const minuto = String(agora.getMinutes()).padStart(2, '0');
          const segundo = String(agora.getSeconds()).padStart(2, '0');
          brincoFinal = `TEMP-${ano}${mes}${dia}-${hora}${minuto}${segundo}`;
        }
        
        const novoAnimal: Animal = {
          id: uuid(),
          brinco: brincoFinal,
          nome: data.nome?.trim(),
          tipoId: data.tipoId,
          racaId: data.racaId || undefined,
          sexo: data.sexo,
          statusId: data.statusId,
          // Converter datas de DD/MM/YYYY para YYYY-MM-DD
          dataNascimento: converterDataParaFormatoBanco(data.dataNascimento),
          dataCadastro: data.dataCadastro ? converterDataParaFormatoBanco(data.dataCadastro) : new Date().toISOString().split('T')[0],
          dataEntrada: data.dataEntrada ? converterDataParaFormatoBanco(data.dataEntrada) : undefined,
          dataSaida: data.dataSaida ? converterDataParaFormatoBanco(data.dataSaida) : undefined,
          origemId: data.origemId,
          fazendaId: data.fazendaId,
          fazendaOrigemId: data.fazendaOrigemId || undefined,
          proprietarioAnterior: data.proprietarioAnterior?.trim(),
          matrizId: data.matrizId || undefined,
          reprodutorId: data.reprodutorId || undefined,
          valorCompra: data.valorCompra,
          valorVenda: data.valorVenda,
          pelagem: data.pelagem?.trim(),
          pesoAtual: data.pesoAtual,
          lote: data.lote?.trim(),
          obs: data.obs?.trim(),
          createdAt: now,
          updatedAt: now,
          synced: false
        };

        await db.animais.add(novoAnimal);

        // Criar/atualizar genealogia com tipoMatrizId
        if (data.tipoMatrizId || data.matrizId || data.reprodutorId) {
          const genealogiaExistente = await db.genealogias
            .where('animalId')
            .equals(novoAnimal.id)
            .first();
          
          if (genealogiaExistente) {
            await db.genealogias.update(genealogiaExistente.id, {
              tipoMatrizId: data.tipoMatrizId || undefined,
              matrizId: data.matrizId || undefined,
              reprodutorId: data.reprodutorId || undefined,
              updatedAt: now,
              synced: false
            });
          } else {
            await db.genealogias.add({
              id: uuid(),
              animalId: novoAnimal.id,
              tipoMatrizId: data.tipoMatrizId || undefined,
              matrizId: data.matrizId || undefined,
              reprodutorId: data.reprodutorId || undefined,
              geracoes: 1,
              createdAt: now,
              updatedAt: now,
              synced: false
            });
          }
        }

        // Salvar tags
        if (selectedTagIds.length > 0 && user) {
          for (const tagId of selectedTagIds) {
            await db.tagAssignments.add({
              id: uuid(),
              entityId: novoAnimal.id,
              entityType: 'animal',
              tagId,
              assignedBy: user.id,
              createdAt: now,
              updatedAt: now,
              synced: false
            });
          }

          // Recalcular usageCount
          for (const tagId of selectedTagIds) {
            await recalculateTagUsage(tagId);
          }
        }

        // Auditoria
        await registrarAudit({
          entity: 'animal',
          entityId: novoAnimal.id,
          action: 'create',
          before: null,
          after: novoAnimal,
          user: user ? { id: user.id, nome: user.nome } : null,
          description: `Animal ${novoAnimal.brinco} criado`
        });

        showToast({ type: 'success', title: 'Animal cadastrado', message: `Brinco: ${novoAnimal.brinco}` });
      } else if (mode === 'edit' && initialData) {
        const animalAtualizado: Partial<Animal> = {
          brinco: data.brinco.trim(),
          nome: data.nome?.trim() || undefined,
          tipoId: data.tipoId,
          racaId: data.racaId?.trim() || undefined,
          sexo: data.sexo,
          statusId: data.statusId,
          // Converter datas de DD/MM/YYYY para YYYY-MM-DD
          dataNascimento: converterDataParaFormatoBanco(data.dataNascimento),
          dataCadastro: data.dataCadastro?.trim() ? converterDataParaFormatoBanco(data.dataCadastro) : undefined,
          dataEntrada: data.dataEntrada?.trim() ? converterDataParaFormatoBanco(data.dataEntrada) : undefined,
          dataSaida: data.dataSaida?.trim() ? converterDataParaFormatoBanco(data.dataSaida) : undefined,
          origemId: data.origemId,
          fazendaId: data.fazendaId,
          fazendaOrigemId: data.fazendaOrigemId?.trim() || undefined,
          proprietarioAnterior: data.proprietarioAnterior?.trim() || undefined,
          matrizId: data.matrizId?.trim() || undefined,
          reprodutorId: data.reprodutorId?.trim() || undefined,
          valorCompra: data.valorCompra,
          valorVenda: data.valorVenda,
          pelagem: data.pelagem?.trim() || undefined,
          pesoAtual: data.pesoAtual,
          lote: data.lote?.trim() || undefined,
          obs: data.obs?.trim() || undefined,
          updatedAt: now,
          synced: false
        };

        const updated = await db.animais.update(initialData.id, animalAtualizado);
        if (updated === 0) {
          throw new Error('Animal não encontrado ou não foi possível atualizar');
        }
        console.log('✅ Animal atualizado no banco local:', initialData.id);

        // Criar/atualizar genealogia com tipoMatrizId
        const genealogiaExistente = await db.genealogias
          .where('animalId')
          .equals(initialData.id)
          .first();
        
        if (genealogiaExistente) {
          await db.genealogias.update(genealogiaExistente.id, {
            tipoMatrizId: data.tipoMatrizId || undefined,
            matrizId: data.matrizId || undefined,
            reprodutorId: data.reprodutorId || undefined,
            updatedAt: now,
            synced: false
          });
        } else if (data.tipoMatrizId || data.matrizId || data.reprodutorId) {
          await db.genealogias.add({
            id: uuid(),
            animalId: initialData.id,
            tipoMatrizId: data.tipoMatrizId || undefined,
            matrizId: data.matrizId || undefined,
            reprodutorId: data.reprodutorId || undefined,
            geracoes: 1,
            createdAt: now,
            updatedAt: now,
            synced: false
          });
        }

        // Atualizar tags
        if (user) {
          // Buscar tags anteriores
          const tagsAnteriores = await db.tagAssignments
            .where('[entityId+entityType]')
            .equals([initialData.id, 'animal'])
            .and(a => !a.deletedAt)
            .toArray();

          const tagIdsAnteriores = tagsAnteriores.map(a => a.tagId);

          // Tags removidas
          const tagsRemovidas = tagIdsAnteriores.filter(id => !selectedTagIds.includes(id));
          for (const tagId of tagsRemovidas) {
            const assignment = tagsAnteriores.find(a => a.tagId === tagId);
            if (assignment) {
              await db.tagAssignments.update(assignment.id, {
                deletedAt: now,
                synced: false
              });
            }
          }

          // Tags adicionadas
          const tagsAdicionadas = selectedTagIds.filter(id => !tagIdsAnteriores.includes(id));
          for (const tagId of tagsAdicionadas) {
            await db.tagAssignments.add({
              id: uuid(),
              entityId: initialData.id,
              entityType: 'animal',
              tagId,
              assignedBy: user.id,
              createdAt: now,
              updatedAt: now,
              synced: false
            });
          }

          // Recalcular usageCount de todas as tags afetadas
          const todasTagsAfetadas = [...new Set([...tagsRemovidas, ...tagsAdicionadas])];
          for (const tagId of todasTagsAfetadas) {
            await recalculateTagUsage(tagId);
          }
        }

        // Auditoria
        await registrarAudit({
          entity: 'animal',
          entityId: initialData.id,
          action: 'update',
          before: initialData,
          after: { ...initialData, ...animalAtualizado },
          user: user ? { id: user.id, nome: user.nome } : null,
          description: `Animal ${data.brinco} atualizado`
        });

        showToast({ type: 'success', title: 'Animal atualizado', message: data.brinco });
        
        // Chamar callback se fornecido
        onSaved?.();
      }

      // Limpar formulário completamente antes de fechar
      reset({
        brinco: '',
        nome: '',
        tipoId: '',
        tipoMatrizId: '',
        racaId: '',
        sexo: 'M' as 'M' | 'F',
        statusId: '',
        dataNascimento: '',
        dataCadastro: '',
        dataEntrada: '',
        dataSaida: '',
        origemId: '',
        fazendaId: '',
        fazendaOrigemId: '',
        proprietarioAnterior: '',
        matrizId: '',
        reprodutorId: '',
        valorCompra: undefined,
        valorVenda: undefined,
        pelagem: '',
        pesoAtual: undefined,
        lote: '',
        obs: ''
      });
      setSelectedTagIds([]);
      onClose();
    } catch (error: any) {
      console.error('❌ Erro ao salvar animal:', error);
      console.error('Detalhes do erro:', {
        message: error?.message,
        stack: error?.stack,
        mode,
        animalId: initialData?.id
      });
      showToast({ type: 'error', title: 'Erro ao salvar', message: error?.message || 'Tente novamente' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose}>
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-slate-600">
          <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 pt-5 pb-4 flex items-center justify-between z-10">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {mode === 'create' ? 'Cadastrar Novo Animal' : 'Editar Animal'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Icons.X className="w-5 h-5" />
            </button>
          </div>

          {/* Abas */}
          <div className="border-b border-gray-200 dark:border-slate-700 px-6">
            <nav className="flex -mb-px flex-wrap gap-1" aria-label="Tabs">
              {[
                { id: 'identificacao' as TabType, label: 'Identificação', icon: Icons.Tag },
                { id: 'classificacao' as TabType, label: 'Classificação', icon: Icons.List },
                { id: 'datas' as TabType, label: 'Datas', icon: Icons.Calendar },
                { id: 'origem' as TabType, label: 'Origem', icon: Icons.MapPin },
                { id: 'genealogia' as TabType, label: 'Genealogia', icon: Icons.GitBranch },
                { id: 'financeiro' as TabType, label: 'Financeiro', icon: Icons.DollarSign },
                ...(mode === 'edit' ? [
                  { id: 'desmama' as TabType, label: `Desmama${desmamas.length > 0 ? ` (${desmamas.length})` : ''}`, icon: Icons.Baby },
                  { id: 'pesagens' as TabType, label: `Pesagens${pesagens.length > 0 ? ` (${pesagens.length})` : ''}`, icon: Icons.Scale },
                  { id: 'vacinacoes' as TabType, label: `Vacinações${vacinacoes.length > 0 ? ` (${vacinacoes.length})` : ''}`, icon: Icons.Injection }
                ] : []),
                { id: 'tags' as TabType, label: 'Tags/Obs', icon: Icons.Tag }
              ].map((tab) => {
                const Icon = tab.icon;
                const temErro = Object.keys(errors).some(campo => campoParaAba[campo] === tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 py-4 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap
                      ${activeTab === tab.id
                        ? `${getThemeClasses(primaryColor, 'border')} ${getThemeClasses(primaryColor, 'text')}`
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                      ${temErro ? 'text-red-600 dark:text-red-400' : ''}
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    {temErro && <Icons.AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />}
                  </button>
                );
              })}
            </nav>
          </div>

          <form onSubmit={handleSubmit(onSubmit, (errors) => {
            console.error('❌ Erros de validação do formulário:', errors);
            focarAbaComErro(errors);
            const primeiroErro = Object.values(errors)[0];
            if (primeiroErro) {
              showToast({
                type: 'error',
                title: 'Erro de validação',
                message: primeiroErro.message || 'Verifique os campos do formulário'
              });
            }
          })} className="px-6 pt-6 pb-6 space-y-4">
            {/* ABA: Identificação */}
            {activeTab === 'identificacao' && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Icons.Tag className="w-4 h-4" />
                Identificação
              </h3>
              <div className="space-y-3">
                {/* Checkbox "Pendente de brincagem" acima dos campos */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={brincoTemporario}
                    onChange={(e) => {
                      setBrincoTemporario(e.target.checked);
                      if (e.target.checked) {
                        // Se marcar e não houver brinco ou o brinco atual não for temporário, gerar novo
                        const brincoAtual = brincoWatch || '';
                        if (!brincoAtual || (!brincoAtual.startsWith('TEMP-') && !brincoAtual.startsWith('PEND-'))) {
                          const agora = new Date();
                          const ano = agora.getFullYear();
                          const mes = String(agora.getMonth() + 1).padStart(2, '0');
                          const dia = String(agora.getDate()).padStart(2, '0');
                          const hora = String(agora.getHours()).padStart(2, '0');
                          const minuto = String(agora.getMinutes()).padStart(2, '0');
                          const segundo = String(agora.getSeconds()).padStart(2, '0');
                          const brincoTemp = `TEMP-${ano}${mes}${dia}-${hora}${minuto}${segundo}`;
                          setValue('brinco', brincoTemp, { shouldValidate: false });
                          setBrincoTemporarioGerado(brincoTemp);
                        } else {
                          // Se já for temporário, apenas manter o estado
                          setBrincoTemporarioGerado(brincoAtual);
                        }
                      } else {
                        // Se desmarcar e o brinco atual for temporário, limpar
                        const brincoAtual = brincoWatch || '';
                        if (brincoAtual.startsWith('TEMP-') || brincoAtual.startsWith('PEND-')) {
                          setValue('brinco', '', { shouldValidate: false });
                          setBrincoTemporarioGerado(null);
                        } else {
                          // Se não for temporário, apenas desmarcar o checkbox
                          setBrincoTemporarioGerado(null);
                        }
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300">
                    Pendente de brincagem
                  </span>
                </label>
                
                {/* Campos Brinco e Nome na mesma linha */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Input
                      {...(() => {
                        const { ref, onChange, onBlur, name, ...rest } = register('brinco');
                        const currentValue = brincoWatch || '';
                        return {
                          ...rest,
                          name,
                          value: currentValue,
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                            onChange(e);
                            const newValue = e.target.value.trim();
                            setValue('brinco', newValue, { shouldValidate: false });
                            
                            // Se o campo brinco contiver valor (não vazio e não temporário), desmarcar automaticamente
                            if (newValue && newValue.length > 0 && !newValue.startsWith('TEMP-') && !newValue.startsWith('PEND-')) {
                              setBrincoTemporario(false);
                              setBrincoTemporarioGerado(null);
                            } else if (newValue.startsWith('TEMP-') || newValue.startsWith('PEND-')) {
                              // Se for temporário, marcar o checkbox
                              setBrincoTemporario(true);
                              setBrincoTemporarioGerado(newValue);
                            } else if (!newValue || newValue.length === 0) {
                              // Se estiver vazio, marcar o checkbox e gerar temporário
                              setBrincoTemporario(true);
                              const agora = new Date();
                              const ano = agora.getFullYear();
                              const mes = String(agora.getMonth() + 1).padStart(2, '0');
                              const dia = String(agora.getDate()).padStart(2, '0');
                              const hora = String(agora.getHours()).padStart(2, '0');
                              const minuto = String(agora.getMinutes()).padStart(2, '0');
                              const segundo = String(agora.getSeconds()).padStart(2, '0');
                              const brincoTemp = `TEMP-${ano}${mes}${dia}-${hora}${minuto}${segundo}`;
                              setValue('brinco', brincoTemp, { shouldValidate: false });
                              setBrincoTemporarioGerado(brincoTemp);
                            }
                          },
                          onBlur: (e) => {
                            onBlur(e);
                            // Verificar novamente ao perder o foco
                            const value = e.target.value.trim();
                            if (value && value.length > 0 && !value.startsWith('TEMP-') && !value.startsWith('PEND-')) {
                              // Se tiver valor real, desmarcar
                              setBrincoTemporario(false);
                              setBrincoTemporarioGerado(null);
                            } else if (!value || value.length === 0) {
                              // Se estiver vazio, marcar checkbox e gerar temporário
                              setBrincoTemporario(true);
                              const agora = new Date();
                              const ano = agora.getFullYear();
                              const mes = String(agora.getMonth() + 1).padStart(2, '0');
                              const dia = String(agora.getDate()).padStart(2, '0');
                              const hora = String(agora.getHours()).padStart(2, '0');
                              const minuto = String(agora.getMinutes()).padStart(2, '0');
                              const segundo = String(agora.getSeconds()).padStart(2, '0');
                              const brincoTemp = `TEMP-${ano}${mes}${dia}-${hora}${minuto}${segundo}`;
                              setValue('brinco', brincoTemp, { shouldValidate: false });
                              setBrincoTemporarioGerado(brincoTemp);
                            } else if (value.startsWith('TEMP-') || value.startsWith('PEND-')) {
                              // Se for temporário, garantir que está marcado
                              setBrincoTemporario(true);
                              setBrincoTemporarioGerado(value);
                            }
                          },
                          ref
                        };
                      })()}
                      label="Brinco"
                      type="text"
                      required
                      placeholder="Ex: 1234567890 ou deixe vazio para gerar temporário"
                      error={errors.brinco?.message}
                    />
                    {(brincoWatch?.startsWith('TEMP-') || brincoWatch?.startsWith('PEND-')) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                        <Icons.AlertCircle className="w-3 h-3" />
                        Brinco temporário - atualize com o brinco real após a brincagem
                      </p>
                    )}
                  </div>

                  <Input
                    {...(() => {
                      const { ref, onChange, onBlur, name, ...rest } = register('nome');
                      return {
                        ...rest,
                        name,
                        value: nomeWatch || '',
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          onChange(e);
                          setValue('nome', e.target.value, { shouldValidate: false });
                        },
                        onBlur,
                        ref
                      };
                    })()}
                    label="Nome (opcional)"
                    type="text"
                    placeholder="Ex: Mimosa"
                  />
                </div>

                <Input
                  {...(() => {
                    const { ref, onChange, onBlur, name, ...rest } = register('lote');
                    return {
                      ...rest,
                      name,
                      value: loteWatch || '',
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                        onChange(e);
                        setValue('lote', e.target.value, { shouldValidate: false });
                      },
                      onBlur,
                      ref
                    };
                  })()}
                  label="Lote"
                  type="text"
                  placeholder="Ex: Lote 1"
                />
              </div>
            </div>
              </div>
            )}

            {/* ABA: Classificação */}
            {activeTab === 'classificacao' && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Icons.List className="w-4 h-4" />
                Classificação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tipo */}
                <div>
                  <div className="flex items-center justify-end mb-1">
                    <button
                      type="button"
                      onClick={() => setTipoModalOpen(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      title="Cadastrar novo tipo"
                    >
                      <Icons.Plus className="w-3 h-3" />
                      Novo
                    </button>
                  </div>
                  <Controller
                    name="tipoId"
                    control={control}
                    render={({ field }) => {
                      // Usar watch para garantir atualização
                      const currentValue = tipoIdWatch || field.value || '';
                      return (
                        <Combobox
                          label="Tipo"
                          required
                          options={tipoOptions}
                          value={currentValue || ''}
                          onChange={(selected) => {
                            const value = typeof selected === 'string' ? selected : (selected as ComboboxOption)?.value || '';
                            field.onChange(value);
                            setValue('tipoId', value, { shouldValidate: false });
                          }}
                          placeholder="Selecione o tipo"
                          error={errors.tipoId?.message}
                        />
                      );
                    }}
                  />
                </div>

                {/* Status */}
                <div>
                  <div className="flex items-center justify-end mb-1">
                    <button
                      type="button"
                      onClick={() => setStatusModalOpen(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      title="Cadastrar novo status"
                    >
                      <Icons.Plus className="w-3 h-3" />
                      Novo
                    </button>
                  </div>
                  <Controller
                    name="statusId"
                    control={control}
                    render={({ field }) => {
                      // Usar watch para garantir atualização
                      const currentValue = statusIdWatch || field.value || '';
                      return (
                        <Combobox
                          label="Status"
                          required
                          options={statusOptions}
                          value={currentValue || ''}
                          onChange={(selected) => {
                            const value = typeof selected === 'string' ? selected : (selected as ComboboxOption)?.value || '';
                            field.onChange(value);
                            setValue('statusId', value, { shouldValidate: false });
                          }}
                          placeholder="Selecione o status"
                          error={errors.statusId?.message}
                        />
                      );
                    }}
                  />
                </div>

                {/* Sexo */}
                <div>
                  <Controller
                    name="sexo"
                    control={control}
                    render={({ field }) => {
                      // Usar watch para garantir atualização
                      const currentValue = sexoWatch || field.value || 'M';
                      return (
                        <Combobox
                          label="Sexo"
                          required
                          options={[
                            { label: 'Macho', value: 'M' },
                            { label: 'Fêmea', value: 'F' }
                          ]}
                          value={currentValue}
                          onChange={(selected) => {
                            const value = typeof selected === 'string' ? selected : (selected as ComboboxOption)?.value || '';
                            field.onChange(value);
                            setValue('sexo', value as 'M' | 'F', { shouldValidate: false });
                          }}
                          placeholder="Selecione o sexo"
                          error={errors.sexo?.message}
                        />
                      );
                    }}
                  />
                </div>

                {/* Raça */}
                <div>
                  <Controller
                    name="racaId"
                    control={control}
                    render={({ field }) => (
                      <Combobox
                        label="Raça"
                        options={racaOptions}
                        value={field.value || ''}
                        onChange={(selected) => {
                          const value = typeof selected === 'string' ? selected : (selected as ComboboxOption)?.value || '';
                          field.onChange(value);
                        }}
                        placeholder="Selecione a raça"
                        onAddNew={podeGerenciarRacas ? () => setModalRacaOpen(true) : undefined}
                        addNewLabel="Nova raça"
                      />
                    )}
                  />
                </div>
                {modalRacaOpen && (
                  <ModalRaca
                    open={modalRacaOpen}
                    onClose={() => setModalRacaOpen(false)}
                    onRacaCadastrada={(racaId) => {
                      setValue('racaId', racaId);
                      refetchRacas();
                      setModalRacaOpen(false);
                    }}
                  />
                )}

                {/* Pelagem */}
                <div className="md:col-span-2">
                  <Input
                    {...(() => {
                      const { ref, onChange, onBlur, name, ...rest } = register('pelagem');
                      return {
                        ...rest,
                        name,
                        value: pelagemWatch || '',
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          onChange(e);
                          setValue('pelagem', e.target.value, { shouldValidate: false });
                        },
                        onBlur,
                        ref
                      };
                    })()}
                    label="Pelagem/Cor"
                    type="text"
                    placeholder="Ex: Preto, Vermelho, Malhado..."
                  />
                </div>
              </div>
            </div>
              </div>
            )}

            {/* ABA: Datas */}
            {activeTab === 'datas' && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Icons.Calendar className="w-4 h-4" />
                Datas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    {...(() => {
                      const { ref, onChange: registerOnChange, onBlur: registerOnBlur, name, ...rest } = register('dataNascimento');
                      return {
                        ...rest,
                        name,
                        value: dataNascimentoWatch || '',
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          const norm = normalizarDataInput(e.target.value);
                          e.target.value = norm;
                          setValue('dataNascimento', norm, { shouldValidate: false });
                          registerOnChange(e);
                        },
                        onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                          const norm = normalizarDataInput(e.target.value);
                          setValue('dataNascimento', norm, { shouldValidate: true });
                          registerOnBlur(e);
                        },
                        ref
                      };
                    })()}
                    label="Data de Nascimento"
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="DD/MM/YYYY"
                    error={errors.dataNascimento?.message}
                  />
                </div>

                <div>
                  <Input
                    {...(() => {
                      const { ref, onChange: registerOnChange, onBlur: registerOnBlur, name, ...rest } = register('dataCadastro');
                      return {
                        ...rest,
                        name,
                        value: dataCadastroWatch || '',
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          const norm = normalizarDataInput(e.target.value);
                          e.target.value = norm;
                          setValue('dataCadastro', norm, { shouldValidate: false });
                          registerOnChange(e);
                        },
                        onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                          const norm = normalizarDataInput(e.target.value);
                          setValue('dataCadastro', norm, { shouldValidate: true });
                          registerOnBlur(e);
                        },
                        ref
                      };
                    })()}
                    label="Data de Cadastro"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="DD/MM/YYYY"
                    error={errors.dataCadastro?.message}
                  />
                </div>

                <div>
                  <Input
                    {...(() => {
                      const { ref, onChange: registerOnChange, onBlur: registerOnBlur, name, ...rest } = register('dataEntrada');
                      return {
                        ...rest,
                        name,
                        value: dataEntradaWatch || '',
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          const norm = normalizarDataInput(e.target.value);
                          e.target.value = norm;
                          setValue('dataEntrada', norm, { shouldValidate: false });
                          registerOnChange(e);
                        },
                        onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                          const norm = normalizarDataInput(e.target.value);
                          setValue('dataEntrada', norm, { shouldValidate: true });
                          registerOnBlur(e);
                        },
                        ref
                      };
                    })()}
                    label="Data de Entrada na Fazenda"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="DD/MM/YYYY"
                    error={errors.dataEntrada?.message}
                  />
                </div>

                <div>
                  <Input
                    {...(() => {
                      const { ref, onChange: registerOnChange, onBlur: registerOnBlur, name, ...rest } = register('dataSaida');
                      return {
                        ...rest,
                        name,
                        value: dataSaidaWatch || '',
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          const norm = normalizarDataInput(e.target.value);
                          e.target.value = norm;
                          setValue('dataSaida', norm, { shouldValidate: false });
                          registerOnChange(e);
                        },
                        onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                          const norm = normalizarDataInput(e.target.value);
                          setValue('dataSaida', norm, { shouldValidate: true });
                          registerOnBlur(e);
                        },
                        ref
                      };
                    })()}
                    label="Data de Saída (Venda/Morte)"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="DD/MM/YYYY"
                    error={errors.dataSaida?.message}
                  />
                </div>
              </div>
            </div>
              </div>
            )}

            {/* ABA: Origem */}
            {activeTab === 'origem' && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Icons.MapPin className="w-4 h-4" />
                Origem e Proprietário
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Controller
                    name="origemId"
                    control={control}
                    render={({ field }) => {
                      // Usar watch para garantir atualização
                      const currentValue = origemIdWatch || field.value || '';
                      return (
                        <Combobox
                          label="Origem"
                          required
                          options={origemOptions}
                          value={currentValue || ''}
                          onChange={(selected) => {
                            const value = typeof selected === 'string' ? selected : (selected as ComboboxOption)?.value || '';
                            field.onChange(value);
                            setValue('origemId', value, { shouldValidate: false });
                          }}
                          placeholder="Selecione a origem"
                          error={errors.origemId?.message}
                        />
                      );
                    }}
                  />
                </div>

                <div>
                  <Controller
                    name="fazendaId"
                    control={control}
                    render={({ field }) => {
                      // Usar watch para garantir atualização
                      const currentValue = fazendaIdWatch || field.value || '';
                      return (
                        <Combobox
                          label="Fazenda Atual"
                          required
                          options={fazendaOptions}
                          value={currentValue || ''}
                          onChange={(selected) => {
                            const value = typeof selected === 'string' ? selected : (selected as ComboboxOption)?.value || '';
                            field.onChange(value);
                            setValue('fazendaId', value, { shouldValidate: false });
                          }}
                          placeholder="Selecione a fazenda"
                          error={errors.fazendaId?.message}
                        />
                      );
                    }}
                  />
                </div>

                {/* Mostrar apenas se origem for Transferido ou Comprado */}
                {(origemIdWatch && origens.find(o => o.id === origemIdWatch)?.nome !== 'Nascido na Fazenda') && (
                  <>
                    <div>
                      <Controller
                        name="fazendaOrigemId"
                        control={control}
                        render={({ field }) => (
                          <Combobox
                            label="Fazenda de Origem"
                            options={[{ label: 'Nenhuma', value: '' }, ...fazendaOptions]}
                            value={field.value ?? ''}
                            onChange={(selected) => {
                              const value = typeof selected === 'string' ? selected : (selected as ComboboxOption)?.value || '';
                              field.onChange(value);
                            }}
                            placeholder="Fazenda de origem"
                          />
                        )}
                      />
                    </div>

                    <div>
                      <Input
                        {...(() => {
                          const { ref, onChange, onBlur, name, ...rest } = register('proprietarioAnterior');
                          return {
                            ...rest,
                            name,
                            value: proprietarioAnteriorWatch || '',
                            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                              onChange(e);
                              setValue('proprietarioAnterior', e.target.value, { shouldValidate: false });
                            },
                            onBlur,
                            ref
                          };
                        })()}
                        label="Proprietário Anterior"
                        type="text"
                        placeholder="Nome do proprietário"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
              </div>
            )}

            {/* ABA: Genealogia */}
            {activeTab === 'genealogia' && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Icons.GitBranch className="w-4 h-4" />
                Genealogia
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Controller
                    name="matrizId"
                    control={control}
                    render={({ field }) => {
                      // Usar watch para garantir atualização
                      const currentValue = matrizIdWatch || field.value || '';
                      return (
                        <MatrizSearchCombobox
                          label="Mãe (Matriz)"
                          value={currentValue || undefined}
                          onChange={(matrizId) => {
                            field.onChange(matrizId || '');
                            setValue('matrizId', matrizId || '', { shouldValidate: false });
                            if (matrizId) {
                              db.animais.get(matrizId).then(animal => {
                                if (animal?.tipoId) {
                                  setValue('tipoMatrizId', animal.tipoId, { shouldValidate: false });
                                }
                              });
                            } else {
                              setValue('tipoMatrizId', '', { shouldValidate: false });
                            }
                          }}
                          placeholder="Digite o brinco ou nome da mãe..."
                          fazendaId={fazendaIdWatch}
                        />
                      );
                    }}
                  />
                </div>

                <div>
                  <Controller
                    name="tipoMatrizId"
                    control={control}
                    render={({ field }) => {
                      // Usar watch para garantir atualização
                      const currentValue = tipoMatrizIdWatch || field.value || '';
                      return (
                        <Combobox
                          label="Tipo da Matriz"
                          options={tipoOptions}
                          value={currentValue || ''}
                          onChange={(selected) => {
                            const value = typeof selected === 'string' ? selected : (selected as ComboboxOption)?.value || '';
                            field.onChange(value);
                            setValue('tipoMatrizId', value, { shouldValidate: false });
                          }}
                          placeholder="Selecione o tipo da matriz"
                        />
                      );
                    }}
                  />
                </div>

                <div>
                  <Controller
                    name="reprodutorId"
                    control={control}
                    render={({ field }) => {
                      // Usar watch para garantir atualização
                      const currentValue = reprodutorIdWatch || field.value || '';
                      return (
                        <AnimalSearchCombobox
                          label="Pai (Reprodutor)"
                          value={currentValue || undefined}
                          onChange={(animalId) => {
                            field.onChange(animalId || '');
                            setValue('reprodutorId', animalId || '', { shouldValidate: false });
                          }}
                          placeholder="Digite o brinco ou nome do pai..."
                          excludeAnimalId={initialData?.id}
                        />
                      );
                    }}
                  />
                </div>
              </div>
            </div>
              </div>
            )}

            {/* ABA: Financeiro */}
            {activeTab === 'financeiro' && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Icons.DollarSign className="w-4 h-4" />
                Financeiro
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Input
                    {...(() => {
                      const { ref, onChange, onBlur, name, ...rest } = register('valorCompra');
                      return {
                        ...rest,
                        name,
                        value: valorCompraWatch !== undefined && valorCompraWatch !== null ? String(valorCompraWatch) : '',
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          const value = e.target.value;
                          const numValue = value && value.trim() !== '' ? parseFloat(value) : undefined;
                          setValue('valorCompra', numValue, { shouldValidate: false });
                          onChange({ ...e, target: { ...e.target, value: value || '' } });
                        },
                        onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                          const value = e.target.value;
                          const numValue = value && value.trim() !== '' ? parseFloat(value) : undefined;
                          setValue('valorCompra', numValue, { shouldValidate: true });
                          onBlur(e);
                        },
                        ref
                      };
                    })()}
                    label="Valor de Compra (R$)"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Input
                    {...(() => {
                      const { ref, onChange, onBlur, name, ...rest } = register('valorVenda');
                      return {
                        ...rest,
                        name,
                        value: valorVendaWatch !== undefined && valorVendaWatch !== null ? String(valorVendaWatch) : '',
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          const value = e.target.value;
                          const numValue = value && value.trim() !== '' ? parseFloat(value) : undefined;
                          setValue('valorVenda', numValue, { shouldValidate: false });
                          onChange({ ...e, target: { ...e.target, value: value || '' } });
                        },
                        onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                          const value = e.target.value;
                          const numValue = value && value.trim() !== '' ? parseFloat(value) : undefined;
                          setValue('valorVenda', numValue, { shouldValidate: true });
                          onBlur(e);
                        },
                        ref
                      };
                    })()}
                    label="Valor de Venda (R$)"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Input
                    {...(() => {
                      const { ref, onChange, onBlur, name, ...rest } = register('pesoAtual');
                      return {
                        ...rest,
                        name,
                        value: pesoAtualWatch !== undefined && pesoAtualWatch !== null ? String(pesoAtualWatch) : '',
                        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                          const value = e.target.value;
                          const numValue = value && value.trim() !== '' ? parseFloat(value) : undefined;
                          setValue('pesoAtual', numValue, { shouldValidate: false });
                          onChange({ ...e, target: { ...e.target, value: value || '' } });
                        },
                        onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                          const value = e.target.value;
                          const numValue = value && value.trim() !== '' ? parseFloat(value) : undefined;
                          setValue('pesoAtual', numValue, { shouldValidate: true });
                          onBlur(e);
                        },
                        ref
                      };
                    })()}
                    label="Peso Atual (kg)"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
              </div>
            )}

            {/* ABA: Desmama */}
            {activeTab === 'desmama' && mode === 'edit' && animalId && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2">
                      <Icons.Baby className="w-4 h-4" />
                      Desmama
                    </h3>
                    {desmamas.length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDesmamaEditando(null);
                          setDesmamaModalOpen(true);
                        }}
                        className={`px-3 py-1.5 text-sm ${getPrimaryButtonClass(primaryColor)} text-white rounded-md hover:opacity-90 transition-opacity flex items-center gap-2`}
                      >
                        <Icons.Plus className="w-4 h-4" />
                        Adicionar Desmama
                      </button>
                    )}
                  </div>
                  
                  {desmamas.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      Nenhuma desmama cadastrada ainda.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {desmamas
                        .sort((a, b) => {
                          const dataA = a.dataDesmama ? (a.dataDesmama.includes('/') 
                            ? a.dataDesmama.split('/').reverse().join('-')
                            : a.dataDesmama) : '';
                          const dataB = b.dataDesmama ? (b.dataDesmama.includes('/')
                            ? b.dataDesmama.split('/').reverse().join('-')
                            : b.dataDesmama) : '';
                          return new Date(dataB).getTime() - new Date(dataA).getTime();
                        })
                        .map((desmama) => {
                          const dataFormatada = desmama.dataDesmama 
                            ? (desmama.dataDesmama.includes('/')
                              ? desmama.dataDesmama
                              : desmama.dataDesmama.split('-').reverse().join('/'))
                            : '-';
                          return (
                            <div
                              key={desmama.id}
                              className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-gray-900 dark:text-slate-100">
                                    {dataFormatada}
                                  </span>
                                  {desmama.pesoDesmama && (
                                    <span className="text-gray-600 dark:text-slate-400">
                                      {desmama.pesoDesmama.toFixed(2)} kg
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDesmamaEditando(desmama);
                                    setDesmamaModalOpen(true);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                                  title="Editar desmama"
                                >
                                  <Icons.Edit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm(`Deseja realmente excluir o registro de desmama de ${dataFormatada}?`)) {
                                      try {
                                        await db.desmamas.delete(desmama.id);
                                        
                                        if (user) {
                                          await registrarAudit({
                                            entidade: 'desmama',
                                            entidadeId: desmama.id,
                                            operacao: 'delete',
                                            usuarioId: user.id,
                                            detalhes: `Desmama excluída`
                                          });
                                        }
                                        
                                        showToast('Desmama excluída com sucesso!', 'success');
                                      } catch (error) {
                                        console.error('Erro ao excluir desmama:', error);
                                        showToast('Erro ao excluir desmama', 'error');
                                      }
                                    }
                                  }}
                                  className="p-1.5 text-red-400 hover:text-red-600 dark:hover:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  title="Excluir desmama"
                                >
                                  <Icons.Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA: Pesagens */}
            {activeTab === 'pesagens' && mode === 'edit' && animalId && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2">
                      <Icons.Scale className="w-4 h-4" />
                      Pesagens
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setPesagemEditando(null);
                        setPesagemModalOpen(true);
                      }}
                      className={`px-3 py-1.5 text-sm ${getPrimaryButtonClass(primaryColor)} text-white rounded-md hover:opacity-90 transition-opacity flex items-center gap-2`}
                    >
                      <Icons.Plus className="w-4 h-4" />
                      Adicionar Pesagem
                    </button>
                  </div>
                  
                  {pesagens.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      Nenhuma pesagem cadastrada ainda.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pesagens
                        .sort((a, b) => {
                          const dataA = a.dataPesagem.includes('/') 
                            ? a.dataPesagem.split('/').reverse().join('-')
                            : a.dataPesagem;
                          const dataB = b.dataPesagem.includes('/')
                            ? b.dataPesagem.split('/').reverse().join('-')
                            : b.dataPesagem;
                          return new Date(dataB).getTime() - new Date(dataA).getTime();
                        })
                        .map((pesagem) => {
                          const dataFormatada = pesagem.dataPesagem.includes('/')
                            ? pesagem.dataPesagem
                            : pesagem.dataPesagem.split('-').reverse().join('/');
                          return (
                            <div
                              key={pesagem.id}
                              className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-gray-900 dark:text-slate-100">
                                    {dataFormatada}
                                  </span>
                                  <span className="text-gray-600 dark:text-slate-400">
                                    {pesagem.peso.toFixed(2)} kg
                                  </span>
                                  {pesagem.observacao && (
                                    <span className="text-sm text-gray-500 dark:text-slate-400">
                                      {pesagem.observacao}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPesagemEditando(pesagem);
                                    setPesagemModalOpen(true);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                                  title="Editar pesagem"
                                >
                                  <Icons.Edit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm(`Deseja realmente excluir a pesagem de ${dataFormatada} (${pesagem.peso.toFixed(2)} kg)?`)) {
                                      try {
                                        const { uuid } = await import('../utils/uuid');
                                        const deletedId = uuid();
                                        await db.deletedRecords.add({
                                          id: deletedId,
                                          uuid: pesagem.id,
                                          remoteId: pesagem.remoteId || null,
                                          deletedAt: new Date().toISOString(),
                                          synced: false
                                        });
                                        
                                        if (pesagem.remoteId) {
                                          try {
                                            const { supabase } = await import('../api/supabaseClient');
                                            const { error } = await supabase
                                              .from('pesagens_online')
                                              .delete()
                                              .eq('id', pesagem.remoteId);
                                            
                                            if (!error) {
                                              await db.deletedRecords.update(deletedId, { synced: true });
                                            }
                                          } catch (err) {
                                            console.error('Erro ao excluir pesagem no servidor:', err);
                                          }
                                        } else {
                                          await db.deletedRecords.update(deletedId, { synced: true });
                                        }
                                        
                                        await db.pesagens.delete(pesagem.id);
                                        showToast({ type: 'success', title: 'Pesagem excluída', message: 'A pesagem foi excluída com sucesso.' });
                                      } catch (error) {
                                        console.error('Erro ao excluir pesagem:', error);
                                        showToast({ type: 'error', title: 'Erro ao excluir', message: 'Não foi possível excluir a pesagem.' });
                                      }
                                    }
                                  }}
                                  className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                  title="Excluir pesagem"
                                >
                                  <Icons.Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA: Vacinações */}
            {activeTab === 'vacinacoes' && mode === 'edit' && animalId && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-2">
                      <Icons.Injection className="w-4 h-4" />
                      Vacinações
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setVacinaEditando(null);
                        setVacinaModalOpen(true);
                      }}
                      className={`px-3 py-1.5 text-sm ${getPrimaryButtonClass(primaryColor)} text-white rounded-md hover:opacity-90 transition-opacity flex items-center gap-2`}
                    >
                      <Icons.Plus className="w-4 h-4" />
                      Adicionar Vacinação
                    </button>
                  </div>
                  
                  {vacinacoes.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      Nenhuma vacinação cadastrada ainda.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {vacinacoes
                        .sort((a, b) => {
                          const dataA = a.dataAplicacao.includes('/')
                            ? a.dataAplicacao.split('/').reverse().join('-')
                            : a.dataAplicacao;
                          const dataB = b.dataAplicacao.includes('/')
                            ? b.dataAplicacao.split('/').reverse().join('-')
                            : b.dataAplicacao;
                          return new Date(dataB).getTime() - new Date(dataA).getTime();
                        })
                        .map((vacina) => {
                          const dataFormatada = vacina.dataAplicacao.includes('/')
                            ? vacina.dataAplicacao
                            : vacina.dataAplicacao.split('-').reverse().join('/');
                          return (
                            <div
                              key={vacina.id}
                              className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="font-medium text-gray-900 dark:text-slate-100">
                                    {vacina.vacina}
                                  </span>
                                  <span className="text-gray-600 dark:text-slate-400">
                                    {dataFormatada}
                                  </span>
                                  {vacina.dataVencimento && (
                                    <span className="text-sm text-gray-500 dark:text-slate-400">
                                      Venc: {vacina.dataVencimento.includes('/') ? vacina.dataVencimento : vacina.dataVencimento.split('-').reverse().join('/')}
                                    </span>
                                  )}
                                  {vacina.lote && (
                                    <span className="text-sm text-gray-500 dark:text-slate-400">
                                      Lote: {vacina.lote}
                                    </span>
                                  )}
                                </div>
                                {vacina.observacao && (
                                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                                    {vacina.observacao}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVacinaEditando(vacina);
                                    setVacinaModalOpen(true);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                                  title="Editar vacinação"
                                >
                                  <Icons.Edit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const dataFormatada = vacina.dataAplicacao.includes('/')
                                      ? vacina.dataAplicacao
                                      : vacina.dataAplicacao.split('-').reverse().join('/');
                                    if (confirm(`Deseja realmente excluir a vacinação de ${vacina.vacina} aplicada em ${dataFormatada}?`)) {
                                      try {
                                        const { uuid } = await import('../utils/uuid');
                                        const deletedId = uuid();
                                        await db.deletedRecords.add({
                                          id: deletedId,
                                          uuid: vacina.id,
                                          remoteId: vacina.remoteId || null,
                                          deletedAt: new Date().toISOString(),
                                          synced: false
                                        });
                                        
                                        if (vacina.remoteId) {
                                          try {
                                            const { supabase } = await import('../api/supabaseClient');
                                            const { error } = await supabase
                                              .from('vacinacoes_online')
                                              .delete()
                                              .eq('id', vacina.remoteId);
                                            
                                            if (!error) {
                                              await db.deletedRecords.update(deletedId, { synced: true });
                                            }
                                          } catch (err) {
                                            console.error('Erro ao excluir vacinação no servidor:', err);
                                          }
                                        } else {
                                          await db.deletedRecords.update(deletedId, { synced: true });
                                        }
                                        
                                        await db.vacinacoes.delete(vacina.id);
                                        showToast({ type: 'success', title: 'Vacinação excluída', message: 'A vacinação foi excluída com sucesso.' });
                                      } catch (error) {
                                        console.error('Erro ao excluir vacinação:', error);
                                        showToast({ type: 'error', title: 'Erro ao excluir', message: 'Não foi possível excluir a vacinação.' });
                                      }
                                    }
                                  }}
                                  className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                  title="Excluir vacinação"
                                >
                                  <Icons.Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA: Tags e Observações */}
            {activeTab === 'tags' && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <Icons.Tag className="w-4 h-4" />
                Tags e Observações
              </h3>
              
              <div className="space-y-4">
                {/* Tags */}
                <div>
                  <TagSelector
                    selectedTagIds={selectedTagIds}
                    onChange={setSelectedTagIds}
                    entityType="animal"
                  />
                </div>

                {/* Observações */}
                <div>
                  <Textarea
                    {...(() => {
                      const { ref, onChange, onBlur, name, ...rest } = register('obs');
                      return {
                        ...rest,
                        name,
                        value: obsWatch || '',
                        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                          onChange(e);
                          setValue('obs', e.target.value, { shouldValidate: false });
                        },
                        onBlur,
                        ref
                      };
                    })()}
                    label="Observações"
                    rows={3}
                    placeholder="Observações gerais sobre o animal..."
                  />
                </div>
              </div>
            </div>
              </div>
            )}

            {/* Botões Finais */}
            <div className="flex gap-3 pt-4 pb-2 border-t border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`flex-1 px-4 py-2.5 ${getPrimaryButtonClass(primaryColor)} text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2`}
              >
                {saving ? (
                  <>
                    <Icons.Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Icons.Check className="w-4 h-4" />
                    {mode === 'create' ? 'Cadastrar Animal' : 'Salvar Alterações'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modais de Cadastro Rápido */}
      <TipoAnimalModal
        open={tipoModalOpen}
        mode="create"
        onClose={() => setTipoModalOpen(false)}
        onSuccess={(tipoId) => {
          setValue('tipoId', tipoId);
          setTipoModalOpen(false);
        }}
      />

      <StatusAnimalModal
        open={statusModalOpen}
        mode="create"
        onClose={() => setStatusModalOpen(false)}
        onSuccess={(statusId) => {
          setValue('statusId', statusId);
          setStatusModalOpen(false);
        }}
      />

      {/* Modais de Pesagem e Vacinação */}
      {mode === 'edit' && animalId && (
        <>
          <PesagemModal
            open={pesagemModalOpen}
            mode={pesagemEditando ? 'edit' : 'create'}
            nascimentoId={animalId || ''}
            initialData={pesagemEditando || undefined}
            onClose={() => {
              setPesagemModalOpen(false);
              setPesagemEditando(null);
            }}
            onSaved={() => {
              // useLiveQuery atualiza automaticamente
              setPesagemModalOpen(false);
              setPesagemEditando(null);
            }}
            onEditPesagem={(pesagem) => {
              setPesagemEditando(pesagem);
            }}
          />

          <VacinaModal
            open={vacinaModalOpen}
            mode={vacinaEditando ? 'edit' : 'create'}
            nascimentoId={animalId || ''}
            initialData={vacinaEditando || undefined}
            onClose={() => {
              setVacinaModalOpen(false);
              setVacinaEditando(null);
            }}
            onSaved={() => {
              // useLiveQuery atualiza automaticamente
              setVacinaModalOpen(false);
              setVacinaEditando(null);
            }}
            onEditVacina={(vacina) => {
              setVacinaEditando(vacina);
            }}
          />

          <DesmamaModal
            open={desmamaModalOpen}
            mode={desmamaEditando ? 'edit' : 'create'}
            animalId={animalId || ''}
            initialData={desmamaEditando || undefined}
            onClose={() => {
              setDesmamaModalOpen(false);
              setDesmamaEditando(null);
            }}
            onSaved={() => {
              // useLiveQuery atualiza automaticamente
              setDesmamaModalOpen(false);
              setDesmamaEditando(null);
            }}
          />
        </>
      )}
    </>
  );
}
