import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { Pesagem } from '../db/models';
import Modal from './Modal';
import Input from './Input';
import Textarea from './Textarea';
import ConfirmDialog from './ConfirmDialog';
import { showToast } from '../utils/toast';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses, getPrimaryButtonClass, getPrimaryCardClass, getTitleTextClass, getPrimaryActionButtonLightClass } from '../utils/themeHelpers';
import { Icons } from '../utils/iconMapping';
import { useAuth } from '../hooks/useAuth';
import { checkLock, lockRecord, unlockRecord } from '../utils/recordLock';
import { registrarAudit } from '../utils/audit';
import { calcularGMD, calcularGMDAcumulado } from '../utils/calcularGMD';
import { useBalancaStore } from '../stores/balancaStore';
import { msg } from '../utils/validationMessages';

const schemaPesagem = z.object({
  dataPesagem: z.string().min(1, msg.dataObrigatoria),
  peso: z.number({ invalid_type_error: msg.informeValor }).min(0.01, msg.valorMaiorQueZero),
  observacao: z.string().optional()
});

type Mode = 'create' | 'edit';

interface PesagemModalProps {
  open: boolean;
  mode: Mode;
  nascimentoId: string; // ID do nascimento (animal)
  initialData?: Pesagem | null;
  onClose: () => void;
  onSaved?: () => void;
  onEditPesagem?: (pesagem: Pesagem | null) => void; // Callback para editar pesagem da timeline ou voltar para create
  onDeletePesagem?: (pesagem: Pesagem) => void; // Callback para excluir pesagem da timeline
}

function PesagemModalComponent({
  open,
  mode,
  nascimentoId,
  initialData,
  onClose,
  onSaved,
  onEditPesagem,
  onDeletePesagem
}: PesagemModalProps) {
  const { appSettings } = useAppSettings();
  const { user } = useAuth();
  const pesoBalança = useBalancaStore((s) => s.pesoKg);
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
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

  // Buscar todas as pesagens do animal (por nascimentoId ou animalId – mesmo valor no sistema atual)
  const todasPesagens = useLiveQuery(
    () => db.pesagens.filter(p => p.nascimentoId === nascimentoId || p.animalId === nascimentoId).toArray(),
    [nascimentoId, open]
  ) || [];

  // Ordenar pesagens por data (mais recente primeiro)
  const pesagensOrdenadas = useMemo(() => {
    return [...todasPesagens].sort((a, b) => {
      const dataA = a.dataPesagem.includes('/') 
        ? a.dataPesagem.split('/').reverse().join('-')
        : a.dataPesagem;
      const dataB = b.dataPesagem.includes('/')
        ? b.dataPesagem.split('/').reverse().join('-')
        : b.dataPesagem;
      return new Date(dataB).getTime() - new Date(dataA).getTime();
    });
  }, [todasPesagens]);

  // Função para formatar data
  const formatarData = (data: string): string => {
    if (data.includes('/')) {
      return data; // Já está em DD/MM/YYYY
    }
    if (data.includes('-')) {
      const partes = data.split('-');
      if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
      }
    }
    return data;
  };

  const parseDate = (data: string): Date | null => {
    if (!data) return null;
    if (data.includes('/')) {
      const [dia, mes, ano] = data.split('/');
      if (dia && mes && ano) {
        const iso = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
        const d = new Date(iso);
        return isNaN(d.getTime()) ? null : d;
      }
    }
    if (data.includes('-')) {
      const d = new Date(data);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const gmdAcumulado = useMemo(() => {
    if (pesagensOrdenadas.length < 2) return null;
    return calcularGMDAcumulado(pesagensOrdenadas);
  }, [pesagensOrdenadas]);

  const titulo = mode === 'create' ? 'Nova Pesagem' : 'Editar Pesagem';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue
  } = useForm<z.infer<typeof schemaPesagem>>({
    resolver: zodResolver(schemaPesagem),
    defaultValues: {
      dataPesagem: '',
      observacao: ''
    }
  });

  // Ref para rastrear o ID da pesagem que está bloqueada
  const pesagemBloqueadaRef = React.useRef<string | null>(null);

  // Verificar lock no modo edição
  useEffect(() => {
    if (mode === 'edit' && initialData && open && user) {
      const verificarLock = async () => {
        try {
          // Liberar lock anterior se houver
          if (pesagemBloqueadaRef.current && pesagemBloqueadaRef.current !== initialData.id) {
            await unlockRecord('pesagem', pesagemBloqueadaRef.current).catch(console.error);
          }

          const existingLock = await checkLock('pesagem', initialData.id);
          if (existingLock && existingLock.lockedBy !== user.id) {
            setLockError(existingLock.lockedByNome
              ? `Este registro está sendo editado por ${existingLock.lockedByNome}. Tente novamente em alguns minutos.`
              : 'Este registro está sendo editado por outro usuário. Tente novamente em alguns minutos.'
            );
            setIsLocked(true);
            pesagemBloqueadaRef.current = null;
            return;
          }

          // Tentar bloquear o registro
          const lockResult = await lockRecord('pesagem', initialData.id, user.id, user.nome || undefined);
          if (!lockResult.success) {
            setLockError(lockResult.error || 'Não foi possível bloquear o registro para edição.');
            setIsLocked(true);
            pesagemBloqueadaRef.current = null;
            return;
          }

          setIsLocked(false);
          setLockError(null);
          pesagemBloqueadaRef.current = initialData.id;
        } catch (error: any) {
          console.error('Erro ao verificar/bloquear registro:', error);
          setLockError('Erro ao verificar bloqueio do registro.');
          setIsLocked(true);
          pesagemBloqueadaRef.current = null;
        }
      };

      verificarLock();
    } else if (mode === 'create') {
      // Liberar lock se estava em modo edição
      if (pesagemBloqueadaRef.current && user) {
        unlockRecord('pesagem', pesagemBloqueadaRef.current).catch(console.error);
        pesagemBloqueadaRef.current = null;
      }
      setIsLocked(false);
      setLockError(null);
    }

    // Liberar lock ao fechar o modal ou mudar de pesagem
    return () => {
      if (pesagemBloqueadaRef.current && user) {
        unlockRecord('pesagem', pesagemBloqueadaRef.current).catch(console.error);
        pesagemBloqueadaRef.current = null;
      }
    };
  }, [mode, initialData?.id, open, user]);

  // Pré-carregar dados no modo edição
  useEffect(() => {
    if (mode === 'edit' && initialData && !isLocked) {
      // Converter data para formato DD/MM/YYYY
      let dataFormatada = initialData.dataPesagem;
      if (dataFormatada.includes('-')) {
        // Se está em YYYY-MM-DD, converter para DD/MM/YYYY
        const partes = dataFormatada.split('-');
        if (partes.length === 3) {
          dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
      }
      
      reset({
        dataPesagem: dataFormatada,
        peso: initialData.peso,
        observacao: initialData.observacao || ''
      });
    } else if (mode === 'create' && open) {
      // Data atual no formato DD/MM/YYYY
      const hoje = new Date();
      const dia = String(hoje.getDate()).padStart(2, '0');
      const mes = String(hoje.getMonth() + 1).padStart(2, '0');
      const ano = hoje.getFullYear();
      const dataAtual = `${dia}/${mes}/${ano}`;
      
      reset({
        dataPesagem: dataAtual,
        observacao: ''
        // peso não é definido, ficará vazio
      });
    }
  }, [mode, initialData, reset, open, isLocked]);

  // Função para normalizar data de input
  const normalizarDataInput = (valor: string) => {
    const digits = valor.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  };

  // Função para converter data de DD/MM/YYYY para YYYY-MM-DD (para salvar no banco)
  const converterDataParaFormatoBanco = (data?: string): string => {
    if (!data) return '';
    // Se já está no formato YYYY-MM-DD, retornar como está
    if (data.includes('-') && data.length === 10) {
      return data;
    }
    // Se está no formato DD/MM/YYYY, converter para YYYY-MM-DD
    if (data.includes('/')) {
      const partes = data.split('/');
      if (partes.length === 3) {
        return `${partes[2]}-${partes[1]}-${partes[0]}`;
      }
    }
    return data;
  };

  const handleClose = () => {
    // Liberar lock ao fechar
    if (mode === 'edit' && initialData && user) {
      unlockRecord('pesagem', initialData.id).catch(console.error);
    }
    setLockError(null);
    setIsLocked(false);
    onClose();
  };

  const onSubmit = async (values: z.infer<typeof schemaPesagem>) => {
    if (isSubmitting || isLocked) return;
    setIsSubmitting(true);
    try {
      // Verificar lock antes de salvar (modo edição)
      if (mode === 'edit' && initialData && user) {
        const existingLock = await checkLock('pesagem', initialData.id);
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

      // Converter data de DD/MM/YYYY para YYYY-MM-DD (formato do banco)
      const dataFormatada = converterDataParaFormatoBanco(values.dataPesagem);

      if (mode === 'create') {
        const id = uuid();
        const now = new Date().toISOString();

        const novaPesagem: Pesagem = {
          id,
          nascimentoId, // compatibilidade com sistema antigo
          animalId: nascimentoId, // UUID do animal (sistema atual) – mesmo valor que nascimentoId
          dataPesagem: dataFormatada,
          peso: values.peso,
          observacao: values.observacao || '',
          createdAt: now,
          updatedAt: now,
          synced: false
        };

        await db.pesagens.add(novaPesagem);

        // Auditoria: criação de pesagem
        await registrarAudit({
          entity: 'pesagem',
          entityId: id,
          action: 'create',
          before: null,
          after: novaPesagem,
          user: user ? { id: user.id, nome: user.nome || '' } : null,
          description: 'Cadastro de pesagem periódica'
        });

        showToast({
          type: 'success',
          title: 'Pesagem cadastrada',
          message: 'A pesagem foi cadastrada com sucesso.'
        });

        onSaved?.();
        // Manter modal aberto para novo lançamento
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
        reset({ dataPesagem: `${dia}/${mes}/${ano}`, peso: undefined, observacao: '' });
      } else if (mode === 'edit' && initialData) {
        const antes = initialData;
        const now = new Date().toISOString();

        const updates: Partial<Pesagem> = {
          dataPesagem: dataFormatada,
          peso: values.peso,
          observacao: values.observacao || '',
          updatedAt: now,
          synced: false
        };

        await db.pesagens.update(initialData.id, updates);

        const depois = { ...initialData, ...updates };

        // Auditoria: edição de pesagem
        await registrarAudit({
          entity: 'pesagem',
          entityId: initialData.id,
          action: 'update',
          before: antes,
          after: depois,
          user: user ? { id: user.id, nome: user.nome || '' } : null,
          description: 'Edição de pesagem periódica'
        });

        // Liberar lock após salvar com sucesso
        await unlockRecord('pesagem', initialData.id);

        showToast({
          type: 'success',
          title: 'Pesagem atualizada',
          message: 'A pesagem foi atualizada com sucesso.'
        });

        onSaved?.();
        // Voltar para modo create sem fechar o modal
        onEditPesagem?.(null);
        setIsLocked(false);
        setLockError(null);
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
        reset({ dataPesagem: `${dia}/${mes}/${ano}`, peso: undefined, observacao: '' });
      }
    } catch (error) {
      console.error('Erro ao salvar pesagem:', error);
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

  const handleDelete = () => {
    if (!initialData || mode !== 'edit') return;
    
    const dataFormatada = formatarData(initialData.dataPesagem);
    
    setConfirmDialog({
      open: true,
      title: 'Excluir pesagem',
      message: `Deseja realmente excluir a pesagem de ${dataFormatada} (${initialData.peso.toFixed(2)} kg)?`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setIsSubmitting(true);
        try {
          const antes = initialData;
          
          // Registrar exclusão no deletedRecords antes de excluir
          const deletedId = uuid();
          await db.deletedRecords.add({
            id: deletedId,
            uuid: initialData.id,
            remoteId: initialData.remoteId || null,
            deletedAt: new Date().toISOString(),
            synced: false
          });
          
          // Excluir pesagem no servidor se tiver remoteId
          if (initialData.remoteId) {
            try {
              const { supabase } = await import('../api/supabaseClient');
              const { error } = await supabase
                .from('pesagens_online')
                .delete()
                .eq('id', initialData.remoteId);
              
              if (!error) {
                await db.deletedRecords.update(deletedId, { synced: true });
              } else {
                console.error('Erro ao excluir pesagem no servidor:', error);
              }
            } catch (err) {
              console.error('Erro ao excluir pesagem no servidor:', err);
            }
          } else {
            await db.deletedRecords.update(deletedId, { synced: true });
          }
          
          // Excluir pesagem local
          await db.pesagens.delete(initialData.id);

          // Auditoria: exclusão de pesagem
          await registrarAudit({
            entity: 'pesagem',
            entityId: initialData.id,
            action: 'delete',
            before: antes,
            after: null,
            user: user ? { id: user.id, nome: user.nome || '' } : null,
            description: 'Exclusão de pesagem periódica'
          });

          // Liberar lock após excluir
          await unlockRecord('pesagem', initialData.id);

          showToast({
            type: 'success',
            title: 'Pesagem excluída',
            message: 'A pesagem foi excluída com sucesso.'
          });

          onSaved?.();
          // Não fechar o modal, apenas resetar para modo create se estávamos editando
          if (onEditPesagem && initialData) {
            // Se estamos editando e excluímos, voltar para modo create
            onEditPesagem(null);
          }
        } catch (error) {
          console.error('Erro ao excluir pesagem:', error);
          showToast({
            type: 'error',
            title: 'Erro ao excluir',
            message: 'Não foi possível excluir a pesagem.'
          });
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-50">{titulo}</h2>
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" noValidate>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              {...register('dataPesagem', {
                onChange: (e) => {
                  const valor = e.target.value;
                  const normalizado = normalizarDataInput(valor);
                  setValue('dataPesagem', normalizado, { shouldValidate: false });
                }
              })}
              label="Data da Pesagem"
              type="text"
              required
              maxLength={10}
              placeholder="DD/MM/YYYY"
              error={errors.dataPesagem?.message}
            />

            <div className="space-y-1">
              <Input
                {...register('peso', { valueAsNumber: true })}
                label="Peso (kg)"
                type="number"
                required
                step="0.01"
                min="0.01"
                placeholder="Ex: 180.5"
                error={errors.peso?.message}
              />
              {pesoBalança != null && mode === 'create' && (
                <button
                  type="button"
                  onClick={() => setValue('peso', pesoBalança, { shouldValidate: true })}
                  className={`flex items-center gap-2 text-sm font-medium ${getPrimaryActionButtonLightClass(primaryColor)} rounded-lg px-3 py-1.5 border border-current`}
                  title="Preencher com o peso lido da balança conectada"
                >
                  <Icons.Scale className="w-4 h-4 shrink-0" />
                  Usar peso da balança ({pesoBalança} kg)
                </button>
              )}
            </div>
          </div>

          <Textarea
            {...register('observacao')}
            label="Observações"
            rows={3}
            placeholder="Observações sobre a pesagem (opcional)"
          />
        </fieldset>

        {/* Timeline de Evolução do Peso */}
        {pesagensOrdenadas.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Icons.TrendingUp className="w-5 h-5 text-gray-600 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                Evolução do Peso ({pesagensOrdenadas.length} {pesagensOrdenadas.length === 1 ? 'pesagem' : 'pesagens'})
              </h3>
              {gmdAcumulado !== null && (
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700">
                  GMD médio: {gmdAcumulado.toFixed(2)} kg/dia
                </span>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {pesagensOrdenadas.map((pesagem, index) => {
                const isUltima = index === 0;
                const pesagemAnterior = index < pesagensOrdenadas.length - 1
                  ? pesagensOrdenadas[index + 1]
                  : null;
                const pesoAnterior = pesagemAnterior ? pesagemAnterior.peso : null;
                const diferenca = pesoAnterior !== null 
                  ? pesagem.peso - pesoAnterior 
                  : null;
                const variacaoPercentual = pesoAnterior && pesoAnterior > 0
                  ? ((diferenca! / pesoAnterior) * 100).toFixed(1)
                  : null;
                const gmd = pesagemAnterior
                  ? calcularGMD(pesagemAnterior.peso, pesagem.peso, pesagemAnterior.dataPesagem, pesagem.dataPesagem)
                  : null;
                const dias = pesagemAnterior
                  ? (() => {
                      const d1 = parseDate(pesagemAnterior.dataPesagem);
                      const d2 = parseDate(pesagem.dataPesagem);
                      if (!d1 || !d2) return null;
                      const diff = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
                      return diff > 0 ? diff : null;
                    })()
                  : null;

                return (
                  <div
                    key={pesagem.id}
                    className={`p-3 rounded-lg border ${
                      isUltima
                        ? `${getThemeClasses(primaryColor, 'border')} ${getThemeClasses(primaryColor, 'bg-light')}`
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {formatarData(pesagem.dataPesagem)}
                          </span>
                          {isUltima && (
                            <span className={`text-xs px-2 py-0.5 rounded ${getThemeClasses(primaryColor, 'bg')} text-white`}>
                              Mais recente
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="font-semibold text-gray-700 dark:text-slate-200">
                            {pesagem.peso.toFixed(2)} kg
                          </span>
                          {diferenca !== null && (
                            <span className={`text-xs flex items-center gap-1 ${
                              diferenca > 0 
                                ? 'text-green-600 dark:text-green-400' 
                                : diferenca < 0 
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-500 dark:text-slate-400'
                            }`}>
                              {diferenca > 0 ? <Icons.ChevronUp className="w-3 h-3" /> : diferenca < 0 ? <Icons.ChevronDown className="w-3 h-3" /> : null}
                              {diferenca > 0 ? '+' : ''}{diferenca.toFixed(2)} kg
                              {variacaoPercentual && (
                                <span className="text-gray-500 dark:text-slate-400">
                                  ({variacaoPercentual}%)
                                </span>
                              )}
                            </span>
                          )}
                          {gmd !== null && dias !== null && (
                            <span className="text-xs text-gray-600 dark:text-slate-300">
                              GMD: <span className="font-semibold">{gmd.toFixed(2)} kg/dia</span> ({dias} dia{dias === 1 ? '' : 's'})
                            </span>
                          )}
                        </div>
                        {pesagem.observacao && (
                          <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 truncate" title={pesagem.observacao}>
                            {pesagem.observacao}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {onEditPesagem && (
                          <button
                            type="button"
                            onClick={() => {
                              onEditPesagem(pesagem);
                            }}
                            className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                            title="Editar pesagem"
                          >
                            <Icons.Edit className="w-4 h-4" />
                          </button>
                        )}
                        {onDeletePesagem && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDialog({
                                open: true,
                                title: 'Excluir pesagem',
                                message: `Deseja realmente excluir a pesagem de ${formatarData(pesagem.dataPesagem)} (${pesagem.peso.toFixed(2)} kg)?`,
                                variant: 'danger',
                                onConfirm: async () => {
                                  setConfirmDialog(prev => ({ ...prev, open: false }));
                                  setIsSubmitting(true);
                                  try {
                                    const antes = pesagem;
                                    // Registrar exclusão no deletedRecords antes de excluir
                                    const deletedId = uuid();
                                    await db.deletedRecords.add({
                                      id: deletedId,
                                      uuid: pesagem.id,
                                      remoteId: pesagem.remoteId || null,
                                      deletedAt: new Date().toISOString(),
                                      synced: false
                                    });
                                    
                                    // Excluir pesagem no servidor se tiver remoteId
                                    if (pesagem.remoteId) {
                                      try {
                                        const { supabase } = await import('../api/supabaseClient');
                                        const { error } = await supabase
                                          .from('pesagens_online')
                                          .delete()
                                          .eq('id', pesagem.remoteId);
                                        
                                        if (!error) {
                                          await db.deletedRecords.update(deletedId, { synced: true });
                                        } else {
                                          console.error('Erro ao excluir pesagem no servidor:', error);
                                        }
                                      } catch (err) {
                                        console.error('Erro ao excluir pesagem no servidor:', err);
                                      }
                                    } else {
                                      await db.deletedRecords.update(deletedId, { synced: true });
                                    }
                                    
                                    // Excluir pesagem local
                                    await db.pesagens.delete(pesagem.id);

                                    // Auditoria: exclusão de pesagem
                                    await registrarAudit({
                                      entity: 'pesagem',
                                      entityId: pesagem.id,
                                      action: 'delete',
                                      before: antes,
                                      after: null,
                                      user: user ? { id: user.id, nome: user.nome || '' } : null,
                                      description: 'Exclusão de pesagem periódica'
                                    });

                                    // Liberar lock após excluir
                                    await unlockRecord('pesagem', pesagem.id);

                                    showToast({
                                      type: 'success',
                                      title: 'Pesagem excluída',
                                      message: 'A pesagem foi excluída com sucesso.'
                                    });

                                    onSaved?.();
                                    // Se estávamos editando esta pesagem, voltar para modo create
                                    if (initialData && initialData.id === pesagem.id && onEditPesagem) {
                                      onEditPesagem(null);
                                    }
                                  } catch (error) {
                                    console.error('Erro ao excluir pesagem:', error);
                                    showToast({
                                      type: 'error',
                                      title: 'Erro ao excluir',
                                      message: 'Não foi possível excluir a pesagem.'
                                    });
                                  } finally {
                                    setIsSubmitting(false);
                                  }
                                }
                              });
                            }}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Excluir pesagem"
                            disabled={isSubmitting}
                          >
                            <Icons.Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-slate-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
        </form>
      </div>

      {/* ConfirmDialog para exclusão */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      />
    </Modal>
  );
}

export default PesagemModalComponent;
