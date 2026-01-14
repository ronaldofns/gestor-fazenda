import React, { useEffect, useMemo, useState, useTransition, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Combobox, { ComboboxOption } from './Combobox';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { Nascimento, Desmama } from '../db/models';
import Modal from './Modal';
import { showToast } from '../utils/toast';
import { criarMatrizSeNaoExistir } from '../utils/criarMatrizAutomatica';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses, getPrimaryButtonClass, getPrimaryCardClass, getTitleTextClass } from '../utils/themeHelpers';
import { Icons } from '../utils/iconMapping';
import { useAuth } from '../hooks/useAuth';
import { checkLock, lockRecord, unlockRecord } from '../utils/recordLock';
import { registrarAudit } from '../utils/audit';

type Mode = 'create' | 'edit';

const schemaNascimento = z.object({
  fazendaId: z.union([
    z.string().min(1, 'Selecione a fazenda'),
    z.object({}).passthrough()
  ]).transform((val) => {
    // Garantir que seja sempre uma string
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val !== null) {
      const obj = val as Record<string, unknown>;
      if ('id' in obj) return String(obj.id);
      if ('value' in obj) return String(obj.value);
    }
    return String(val);
  }).pipe(z.string().min(1, 'Selecione a fazenda')),
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

export type VerificarBrincoFn = (brincoNumero?: string, fazendaId?: string, ignorarId?: string) => Promise<boolean>;

interface NascimentoModalProps {
  open: boolean;
  mode: Mode;
  fazendaOptions: ComboboxOption[];
  racasOptions: ComboboxOption[] | string[];
  defaultFazendaId?: string;
  defaultMes?: number;
  defaultAno?: number;
  initialData?: Nascimento | null;
  onClose: () => void;
  onSaved?: () => void;
  onAddRaca?: () => void;
  novaRacaSelecionada?: string;
  verificarBrincoDuplicado: VerificarBrincoFn;
  onFocusMatriz?: () => void; // Callback para focar na matriz após salvar (modo create)
  matrizInputRef?: React.RefObject<HTMLInputElement> | ((el: HTMLInputElement | null) => void); // Ref para o input de matriz (modo create)
}

function NascimentoModalComponent({
  open,
  mode,
  fazendaOptions,
  racasOptions,
  defaultFazendaId,
  defaultMes,
  defaultAno,
  initialData,
  onClose,
  onSaved,
  onAddRaca,
  novaRacaSelecionada,
  verificarBrincoDuplicado,
  onFocusMatriz,
  matrizInputRef
}: NascimentoModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { appSettings } = useAppSettings();
  const { user } = useAuth();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [isPending, startTransition] = useTransition();
  const [lockError, setLockError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'nascimento' | 'desmama'>('nascimento');
  const inicializadoRef = useRef<string | false>(false);
  const internalMatrizInputRef = useRef<HTMLInputElement>(null);
  
  // Criar ref unificado que funciona com ambos os tipos
  const matrizRef = useMemo(() => {
    if (matrizInputRef) {
      if ('current' in matrizInputRef) {
        return matrizInputRef as React.MutableRefObject<HTMLInputElement | null>;
      }
    }
    return internalMatrizInputRef;
  }, [matrizInputRef]);

  // Mapa de matrizes para converter UUID em identificador
  const matrizes = useLiveQuery(() => db.matrizes.toArray(), []) || [];
  const matrizMap = useMemo(() => {
    const map = new Map<string, string>(); // ID -> identificador
    matrizes.forEach((m) => {
      if (m.id && m.identificador) {
        map.set(m.id, m.identificador);
      }
    });
    return map;
  }, [matrizes]);

  // Carregar desmama no modo edição
  const desmamaEditando = useLiveQuery(
    async () => {
      if (mode === 'edit' && initialData?.id) {
        const desmamas = await db.desmamas.where('nascimentoId').equals(initialData.id).toArray();
        return desmamas.length > 0 ? desmamas[0] : undefined;
      }
      return undefined;
    },
    [mode, initialData?.id]
  );

  // Funções de normalização de data
  const normalizarDataInput = useCallback((valor: string) => {
    const digits = valor.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  }, []);

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

  const titulo = mode === 'create' ? 'Novo Nascimento/Desmama' : 'Editar Nascimento/Desmama';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    getValues
  } = useForm<z.infer<typeof schemaNascimento>>({
    resolver: zodResolver(schemaNascimento),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: mode === 'create'
      ? {
          fazendaId: defaultFazendaId || '',
          mes: defaultMes,
          ano: defaultAno,
          matrizId: '',
          brincoNumero: '',
          dataNascimento: '',
          sexo: undefined,
          raca: '',
          tipo: undefined,
          obs: '',
          morto: false
        }
      : undefined,
    shouldUnregister: false
  });

  // Verificar e bloquear registro ao abrir em modo edição
  useEffect(() => {
    if (mode === 'edit' && initialData && open && user) {
      const verificarLock = async () => {
        try {
          // Verificar se já está bloqueado
          const existingLock = await checkLock('nascimento', initialData.id);
          
          if (existingLock && existingLock.lockedBy !== user.id) {
            // Bloqueado por outro usuário
            setLockError(existingLock.lockedByNome 
              ? `Este registro está sendo editado por ${existingLock.lockedByNome}. Tente novamente em alguns minutos.`
              : 'Este registro está sendo editado por outro usuário. Tente novamente em alguns minutos.'
            );
            setIsLocked(true);
            return;
          }

          // Tentar bloquear
          const lockResult = await lockRecord('nascimento', initialData.id, user.id, user.nome);
          
          if (!lockResult.success) {
            setLockError(lockResult.error || 'Não foi possível bloquear o registro para edição.');
            setIsLocked(true);
            return;
          }

          setIsLocked(false);
          setLockError(null);
        } catch (error: any) {
          console.error('Erro ao verificar/bloquear registro:', error);
          setLockError('Erro ao verificar bloqueio do registro.');
          setIsLocked(true);
        }
      };

      verificarLock();
    } else if (mode === 'create' || !open) {
      // Limpar estado de lock ao fechar ou criar novo
      setIsLocked(false);
      setLockError(null);
    }

    // Liberar lock ao fechar o modal
    return () => {
      if (mode === 'edit' && initialData && user) {
        unlockRecord('nascimento', initialData.id).catch(console.error);
      }
    };
  }, [mode, initialData, open, user]);

  // Pré-carregar dados no modo edição
  useEffect(() => {
    if (mode === 'edit' && initialData && !isLocked) {
      const tipo = initialData.vaca ? 'vaca' : initialData.novilha ? 'novilha' : undefined;
      // Converter UUID da matriz para identificador para exibição
      const matrizIdentificador = matrizMap.get(initialData.matrizId) || initialData.matrizId;
      reset({
        fazendaId: typeof initialData.fazendaId === 'string' ? initialData.fazendaId : String(initialData.fazendaId || ''),
        mes: initialData.mes,
        ano: initialData.ano,
        matrizId: matrizIdentificador,
        brincoNumero: initialData.brincoNumero || '',
        dataNascimento: converterDataParaFormatoInput(initialData.dataNascimento),
        sexo: initialData.sexo,
        raca: initialData.raca || '',
        tipo: tipo as 'novilha' | 'vaca' | undefined,
        obs: initialData.obs || '',
        morto: initialData.morto || false,
        dataDesmama: desmamaEditando?.dataDesmama ? converterDataParaFormatoInput(desmamaEditando.dataDesmama) : '',
        pesoDesmama: desmamaEditando?.pesoDesmama ? desmamaEditando.pesoDesmama.toString() : ''
      });
      // Reset para aba de nascimento apenas quando o modal é aberto pela primeira vez
      // Não resetar se o usuário já selecionou uma aba manualmente
      // Usar uma chave única baseada no ID do registro para rastrear inicialização
      const registroKey = initialData?.id || 'new';
      if (!inicializadoRef.current || inicializadoRef.current !== registroKey) {
        setAbaAtiva('nascimento');
        inicializadoRef.current = registroKey;
      }
    } else if (mode === 'create' && open && !inicializadoRef.current && !acabouDeSalvarRef.current) {
      // Só resetar para valores padrão quando o modal é aberto pela primeira vez
      // Não resetar se já foi inicializado (para manter valores após salvar)
      reset({
        fazendaId: defaultFazendaId || '',
        mes: defaultMes,
        ano: defaultAno,
        matrizId: '',
        brincoNumero: '',
        dataNascimento: '',
        sexo: undefined,
        raca: '',
        tipo: undefined,
        obs: '',
        morto: false,
        dataDesmama: '',
        pesoDesmama: ''
      });
      setAbaAtiva('nascimento');
      inicializadoRef.current = 'create';
    }
    
  }, [mode, initialData?.id, reset, defaultFazendaId, defaultMes, defaultAno, open, matrizMap, isLocked, converterDataParaFormatoInput]);
  
  // Resetar flag quando o modal fechar
  useEffect(() => {
    if (!open) {
      inicializadoRef.current = false;
      setAbaAtiva('nascimento'); // Resetar aba ao fechar
    }
  }, [open]);
  
  // Evitar que o useEffect reset os valores após salvar no modo create
  // Usar uma ref para rastrear se acabamos de salvar
  const acabouDeSalvarRef = useRef(false);
  
  
  // Atualizar campos de desmama quando desmamaEditando mudar (sem resetar a aba)
  useEffect(() => {
    if (mode === 'edit' && initialData && desmamaEditando && !isLocked) {
      setValue('dataDesmama', desmamaEditando.dataDesmama ? converterDataParaFormatoInput(desmamaEditando.dataDesmama) : '');
      setValue('pesoDesmama', desmamaEditando.pesoDesmama ? desmamaEditando.pesoDesmama.toString() : '');
    }
  }, [mode, initialData, desmamaEditando, isLocked, setValue, converterDataParaFormatoInput]);

  // Aplicar nova raça cadastrada externamente
  useEffect(() => {
    if (novaRacaSelecionada) {
      setValue('raca', novaRacaSelecionada);
    }
  }, [novaRacaSelecionada, setValue]);

  // Remover watch() desnecessários que causam re-renders a cada digitação
  // Usar getValues() apenas quando necessário (no handleLimpar)
  const handleLimpar = () => {
    const current = getValues(); // Obter valores sem causar re-render
    reset({
      fazendaId: (() => {
        const fazendaId = current.fazendaId || defaultFazendaId || '';
        if (typeof fazendaId === 'string') return fazendaId;
        if (typeof fazendaId === 'object' && fazendaId !== null) {
          const obj = fazendaId as Record<string, unknown>;
          if ('id' in obj) return String(obj.id);
          if ('value' in obj) return String(obj.value);
        }
        return String(fazendaId);
      })(),
      mes: current.mes || defaultMes,
      ano: current.ano || defaultAno,
      dataNascimento: current.dataNascimento || '',
      matrizId: '',
      brincoNumero: '',
      sexo: undefined,
      raca: '',
      tipo: undefined,
      obs: '',
      morto: false
    });
  };

  const onSubmit = async (values: z.infer<typeof schemaNascimento>) => {
    if (isSubmitting || isLocked) {
      console.warn('Salvamento bloqueado:', { isSubmitting, isLocked });
      return;
    }
    setIsSubmitting(true);
    try {
      console.log('Iniciando salvamento:', { mode, values });
      // Verificar lock antes de salvar (modo edição)
      if (mode === 'edit' && initialData && user) {
        const existingLock = await checkLock('nascimento', initialData.id);
        if (existingLock && existingLock.lockedBy !== user.id) {
          showToast({
            type: 'error',
            title: 'Registro bloqueado',
            message: existingLock.lockedByNome 
              ? `Este registro está sendo editado por ${existingLock.lockedByNome}.`
              : 'Este registro está sendo editado por outro usuário.'
          });
          setIsSubmitting(false);
          return;
        }
      }

      // Garantir que fazendaId seja sempre string
      const fazendaIdStr = typeof values.fazendaId === 'string' 
        ? values.fazendaId 
        : (typeof values.fazendaId === 'object' && values.fazendaId !== null)
          ? (() => {
              const obj = values.fazendaId as Record<string, unknown>;
              if ('id' in obj) return String(obj.id);
              if ('value' in obj) return String(obj.value);
              return String(values.fazendaId);
            })()
          : String(values.fazendaId || '');

      // Validação de brinco duplicado
      if (values.brincoNumero && fazendaIdStr) {
        const duplicado = await verificarBrincoDuplicado(
          values.brincoNumero,
          fazendaIdStr,
          mode === 'edit' && initialData ? initialData.id : undefined
        );
        if (duplicado) {
          showToast({ type: 'warning', title: 'Brinco duplicado', message: 'Já existe para esta fazenda.' });
          setIsSubmitting(false);
          return;
        }
      }

      if (mode === 'create') {
        // Criar matriz automaticamente se não existir
        let matrizId = values.matrizId;
        try {
          matrizId = await criarMatrizSeNaoExistir(
            values.matrizId,
            fazendaIdStr,
            values.tipo,
            values.raca
          );
        } catch (error) {
          console.error('Erro ao criar matriz automaticamente:', error);
          showToast({
            type: 'warning',
            title: 'Aviso',
            message: 'Matriz não encontrada, mas o nascimento será salvo mesmo assim.'
          });
          // Continuar com o matrizId original mesmo se der erro
        }

        const id = uuid();
        const now = new Date().toISOString();
        const novilha = values.tipo === 'novilha';
        const vaca = values.tipo === 'vaca';
        
        const novoNascimento = {
          id,
          fazendaId: fazendaIdStr,
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
          createdAt: now,
          updatedAt: now,
          synced: false
        };
        
        await db.nascimentos.add(novoNascimento);
        console.log('Nascimento salvo com sucesso:', id);

        // Auditoria: criação de nascimento
        await registrarAudit({
          entity: 'nascimento',
          entityId: id,
          action: 'create',
          before: null,
          after: novoNascimento,
          user: user ? { id: user.id, nome: user.nome || '' } : null,
          description: 'Cadastro de nascimento na planilha'
        });

        // Manter campos: Fazenda, Mês, Ano, Data de Nascimento, Raça, Tipo
        // Limpar apenas: Matriz, Brinco, Sexo, Obs
        const currentValues = getValues();
        // Garantir que os valores sejam mantidos corretamente
        const valoresParaManter = {
          fazendaId: currentValues.fazendaId || '',
          mes: currentValues.mes || defaultMes,
          ano: currentValues.ano || defaultAno,
          dataNascimento: currentValues.dataNascimento || '',
          matrizId: '',
          brincoNumero: '',
          sexo: undefined,
          raca: currentValues.raca || '',
          tipo: currentValues.tipo,
          obs: '',
          morto: false,
          dataDesmama: '',
          pesoDesmama: ''
        };
        
        // Marcar que acabamos de salvar para evitar que o useEffect reset os valores
        acabouDeSalvarRef.current = true;
        
        // Usar reset com keepDefaultValues para evitar que o useEffect sobrescreva
        reset(valoresParaManter, {
          keepDefaultValues: false,
          keepValues: false
        });
        
        // Resetar a flag após um pequeno delay
        setTimeout(() => {
          acabouDeSalvarRef.current = false;
        }, 500);

        // Focar no campo Matriz após salvar
        // Aguardar o reset completar e o DOM atualizar
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Tentar múltiplas abordagens para garantir que o foco funcione
        const focusMatriz = () => {
          // Primeiro, tentar usar o ref
          let input: HTMLInputElement | null = null;
          if (matrizRef && 'current' in matrizRef) {
            input = matrizRef.current;
          }
          
          // Se o ref não funcionar, tentar encontrar o input pelo name
          if (!input || !input.focus) {
            const form = document.querySelector('form');
            if (form) {
              const inputByName = form.querySelector<HTMLInputElement>('input[name="matrizId"]');
              if (inputByName) {
                input = inputByName;
              }
            }
          }
          
          // Se ainda não encontrou, tentar pelo placeholder
          if (!input || !input.focus) {
            const inputs = document.querySelectorAll<HTMLInputElement>('input[placeholder="Número da matriz"]');
            if (inputs.length > 0) {
              input = inputs[0];
            }
          }
          
          if (input && typeof input.focus === 'function') {
            try {
              input.focus();
              input.select();
            } catch (e) {
              console.warn('Erro ao focar no campo Matriz:', e);
            }
          }
          
          // Chamar callback externo se fornecido
          onFocusMatriz?.();
        };
        
        // Usar requestAnimationFrame para garantir que o DOM foi atualizado
        requestAnimationFrame(() => {
          setTimeout(focusMatriz, 50);
        });
      } else if (mode === 'edit' && initialData) {
        const novilha = values.tipo === 'novilha';
        const vaca = values.tipo === 'vaca';
        const now = new Date().toISOString();

        // Criar matriz automaticamente se não existir e converter identificador para UUID
        let matrizId = values.matrizId;
        if (matrizId && fazendaIdStr) {
          try {
            const tipo = values.tipo || (initialData.vaca ? 'vaca' : 'novilha');
            matrizId = await criarMatrizSeNaoExistir(
              matrizId,
              fazendaIdStr,
              tipo,
              values.raca
            );
          } catch (error) {
            console.error('Erro ao criar matriz automaticamente:', error);
            // Continuar com o matrizId original mesmo se der erro
          }
        }

        const antes = initialData;
        const updates = {
          fazendaId: fazendaIdStr,
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

        await db.nascimentos.update(initialData.id, updates);

        const depois = { ...initialData, ...updates };

        // Auditoria: edição de nascimento
        await registrarAudit({
          entity: 'nascimento',
          entityId: initialData.id,
          action: 'update',
          before: antes,
          after: depois,
          user: user ? { id: user.id, nome: user.nome || '' } : null,
          description: 'Edição de nascimento na planilha'
        });

        // Salvar ou atualizar dados de desmama
        if (values.dataDesmama || values.pesoDesmama) {
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
                user: user ? { id: user.id, nome: user.nome || '' } : null,
                description: 'Edição de desmama na planilha'
              });
            }
          } else {
            // Criar nova desmama
            const novaDesmama = {
              id: uuid(),
              nascimentoId: initialData.id,
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
              user: user ? { id: user.id, nome: user.nome || '' } : null,
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
            user: user ? { id: user.id, nome: user.nome || '' } : null,
            description: 'Exclusão de desmama na planilha'
          });
        }
      }

      // Liberar lock após salvar com sucesso (modo edição)
      if (mode === 'edit' && initialData) {
        await unlockRecord('nascimento', initialData.id);
        onSaved?.();
        onClose();
      } else if (mode === 'create') {
        // No modo create, não fechar o modal, apenas limpar campos e focar na matriz
        onSaved?.();
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao salvar';
      showToast({ 
        type: 'error', 
        title: 'Erro ao salvar', 
        message: errorMessage || 'Tente novamente.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Liberar lock ao fechar
    if (mode === 'edit' && initialData) {
      unlockRecord('nascimento', initialData.id).catch(console.error);
    }
    setLockError(null);
    setIsLocked(false);
    onClose();
  };

  const conteudoFormulario = (
    <>
      {/* Abas no modo edição - mover para cima */}
      {mode === 'edit' && (
        <div className="border-b border-gray-200 dark:border-slate-700 px-6">
          <nav className="flex -mb-px" aria-label="Tabs">
            <button
              type="button"
              onClick={() => setAbaAtiva('nascimento')}
              className={`
                py-4 px-4 border-b-2 font-medium text-sm transition-colors
                ${abaAtiva === 'nascimento'
                  ? `${getThemeClasses(primaryColor, 'border')} ${getThemeClasses(primaryColor, 'text')}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              Nascimento
            </button>
            <button
              type="button"
              onClick={() => {
                console.log('Clicou na aba Desmama, abaAtiva antes:', abaAtiva);
                setAbaAtiva('desmama');
                console.log('Aba ativa definida como desmama');
              }}
              className={`
                py-4 px-4 border-b-2 font-medium text-sm transition-colors
                ${abaAtiva === 'desmama'
                  ? `${getThemeClasses(primaryColor, 'border')} ${getThemeClasses(primaryColor, 'text')}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              Desmama
            </button>
          </nav>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit, (errors) => {
        console.error('Erros de validação:', errors);
        // Mostrar toast com erros de validação
        const firstError = Object.values(errors)[0];
        if (firstError) {
          showToast({
            type: 'error',
            title: 'Erro de validação',
            message: firstError.message || 'Verifique os campos do formulário.'
          });
        }
      })} className="p-6 space-y-4 bg-white dark:bg-slate-800">
        {/* Aviso de lock */}
        {lockError && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Icons.AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                  Registro Bloqueado
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {lockError}
                </p>
              </div>
            </div>
          </div>
        )}
        <fieldset disabled={isLocked} className={isLocked ? 'opacity-60' : ''}>
          {/* Aba Nascimento - sempre mostrar no modo create, ou quando abaAtiva === 'nascimento' no modo edit */}
          {(mode === 'create' || abaAtiva === 'nascimento') && (
            <>
      <div className="flex flex-col md:flex-row gap-2">
        <div className="flex-1">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Fazenda *</label>
          <Combobox
            value={(() => {
              const fazendaId = watch('fazendaId');
              // Garantir que seja sempre uma string
              if (!fazendaId) return '';
              if (typeof fazendaId === 'string') return fazendaId;
              if (typeof fazendaId === 'object' && fazendaId !== null) {
                // Se for um objeto, tentar extrair o ID
                const obj = fazendaId as Record<string, unknown>;
                if ('id' in obj) return String(obj.id);
                if ('value' in obj) return String(obj.value);
              }
              return String(fazendaId);
            })()}
            onChange={(value) => {
              // Usar startTransition para não bloquear a UI
              startTransition(() => {
                setValue('fazendaId', value, { shouldValidate: false });
              });
            }}
            options={fazendaOptions}
            placeholder="Selecione a fazenda"
            allowCustomValue={false}
          />
          {errors.fazendaId && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{String(errors.fazendaId.message)}</p>}
        </div>

        <div className="md:w-40">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Mês *</label>
          <Combobox
            value={watch('mes') != null && !isNaN(Number(watch('mes'))) ? String(watch('mes')) : ''}
            onChange={(value) => {
              if (value) {
                const numValue = Number(value);
                if (!isNaN(numValue) && numValue >= 1 && numValue <= 12) {
                  setValue('mes', numValue, { shouldValidate: true });
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
          {errors.mes && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{String(errors.mes.message)}</p>}
        </div>

        <div className="md:w-28">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Ano *</label>
          <input
            type="number"
            min="2000"
            max="2100"
            className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
            {...register('ano', { valueAsNumber: true })}
          />
          {errors.ano && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{String(errors.ano.message)}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Matriz *</label>
          <input
            className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
            {...(() => {
              const { ref, ...rest } = register('matrizId', {
                required: 'Informe a matriz',
                minLength: { value: 1, message: 'Informe a matriz' },
                validate: (value) => {
                  const trimmed = String(value || '').trim();
                  if (trimmed.length === 0) {
                    return 'Informe a matriz';
                  }
                  return true;
                }
              });
              return {
                ...rest,
                ref: (e: HTMLInputElement | null) => {
                  // Atualizar o ref do react-hook-form
                  if (typeof ref === 'function') {
                    ref(e);
                  } else if (ref) {
                    try {
                      if ('current' in ref) {
                        (ref as React.MutableRefObject<HTMLInputElement | null>).current = e;
                      }
                    } catch (err) {
                      // Ignorar erro se ref não for mutável
                    }
                  }
                  // Atualizar o ref customizado
                  if (e && matrizRef && 'current' in matrizRef) {
                    (matrizRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
                  }
                }
              };
            })()}
            placeholder="Número da matriz"
            autoFocus={mode === 'create'}
          />
          {errors.matrizId && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{String(errors.matrizId.message)}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Número do Brinco</label>
          <input
            className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
            {...register('brincoNumero')}
            placeholder="Número do brinco"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Data de Nascimento *</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
            placeholder="dd/mm/yyyy"
            {...register('dataNascimento', {
              onChange: (e) => {
                // Normalizar durante digitação sem validar
                const norm = normalizarDataInput(e.target.value);
                if (norm !== e.target.value) {
                  e.target.value = norm;
                  setValue('dataNascimento', norm, { shouldValidate: false });
                }
              },
              onBlur: (e) => {
                // Validar apenas ao perder foco
                const norm = normalizarDataInput(e.target.value);
                setValue('dataNascimento', norm, { shouldValidate: true });
              }
            })}
            defaultValue=""
          />
          {errors.dataNascimento && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{String(errors.dataNascimento.message)}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Sexo *</label>
          <Combobox
            value={watch('sexo') || ''}
            onChange={(value) => setValue('sexo', value as 'M' | 'F', { shouldValidate: true })}
            options={[
              { label: 'Macho', value: 'M' },
              { label: 'Fêmea', value: 'F' }
            ]}
            placeholder="Selecione o sexo"
            allowCustomValue={false}
          />
          {errors.sexo && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{String(errors.sexo.message)}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Raça</label>
          <Combobox
            value={watch('raca') || ''}
            onChange={(value) => setValue('raca', value)}
            options={racasOptions}
            placeholder="Digite ou selecione uma raça"
            onAddNew={onAddRaca}
            addNewLabel="Cadastrar nova raça"
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-100 mb-2">Tipo *</label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="novilha"
                className={`w-4 h-4 ${getThemeClasses(primaryColor, 'text')} border-gray-300 dark:border-slate-600 ${getThemeClasses(primaryColor, 'ring')}`}
                {...register('tipo')}
              />
              <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-100">Novilha</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="vaca"
                className={`w-4 h-4 ${getThemeClasses(primaryColor, 'text')} border-gray-300 dark:border-slate-600 ${getThemeClasses(primaryColor, 'ring')}`}
                {...register('tipo')}
              />
              <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-100">Vaca</span>
            </label>
          </div>
          {errors.tipo && <p className="text-red-600 dark:text-red-400 text-xs sm:text-sm mt-1">{String(errors.tipo.message)}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Observações</label>
        <textarea
          className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
          rows={3}
          {...register('obs')}
          placeholder="Observações adicionais"
        />
      </div>

      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800/60 rounded-md">
        <input
          type="checkbox"
          id="morto-modal"
          className="w-4 h-4 accent-red-600 dark:accent-red-500 border-gray-300 dark:border-slate-600 rounded focus:ring-red-500 dark:focus:ring-red-400"
          {...register('morto')}
        />
        <label htmlFor="morto-modal" className="text-sm font-medium text-red-800 dark:text-red-100 cursor-pointer">
          Bezerro morto?
        </label>
      </div>
            </>
          )}

          {/* Aba Desmama - apenas no modo edição */}
          {mode === 'edit' && abaAtiva === 'desmama' && (
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
                    value={watch('dataDesmama') ? converterDataParaFormatoInput(watch('dataDesmama') || '') : ''}
                    onChange={(e) => {
                      const norm = normalizarDataInput(e.target.value);
                      setValue('dataDesmama', norm, { shouldValidate: false });
                    }}
                    onBlur={(e) => {
                      const norm = normalizarDataInput(e.target.value);
                      setValue('dataDesmama', norm, { shouldValidate: true });
                    }}
                  />
                  {errors.dataDesmama && <p className="text-red-600 text-sm mt-1">{String(errors.dataDesmama.message)}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Peso de Desmama (kg)</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} dark:bg-slate-800 dark:text-slate-100`} 
                    placeholder="Ex: 180.5"
                    {...register('pesoDesmama')}
                  />
                  {errors.pesoDesmama && <p className="text-red-600 text-sm mt-1">{String(errors.pesoDesmama.message)}</p>}
                </div>
              </div>
              <div className={`${getPrimaryCardClass(primaryColor)} rounded-md p-3`}>
                <p className={`text-sm ${getTitleTextClass(primaryColor)}`}>
                  <strong>Dica:</strong> Preencha pelo menos um dos campos (Data ou Peso) para salvar os dados de desmama. Se ambos estiverem vazios, o registro de desmama será removido.
                </p>
              </div>
            </>
          )}

      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
        <button
          type="submit"
            disabled={isSubmitting || isLocked}
          className={`flex-1 px-4 py-2 ${getPrimaryButtonClass(primaryColor)} text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting ? 'Salvando...' : isLocked ? 'Bloqueado' : mode === 'create' ? 'Salvar' : 'Salvar Alterações'}
        </button>
        <button
          type="button"
          onClick={handleLimpar}
            disabled={isSubmitting || isLocked}
          className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-slate-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting || isLocked}
          className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
      </fieldset>
    </form>
    </>
  );

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-50">{titulo}</h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        {conteudoFormulario}
      </div>
    </Modal>
  );
}

export default React.memo(NascimentoModalComponent);

