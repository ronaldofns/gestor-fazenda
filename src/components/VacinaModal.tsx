import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { Vacina } from '../db/models';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { showToast } from '../utils/toast';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses, getPrimaryButtonClass, getPrimaryActionButtonLightClass } from '../utils/themeHelpers';
import { Icons } from '../utils/iconMapping';
import { useAuth } from '../hooks/useAuth';
import { checkLock, lockRecord, unlockRecord } from '../utils/recordLock';
import { registrarAudit } from '../utils/audit';

const schemaVacina = z.object({
  vacina: z.string().min(1, 'Informe o nome da vacina'),
  dataAplicacao: z.string().min(1, 'Informe a data de aplicação'),
  dataVencimento: z.string().optional(),
  lote: z.string().optional(),
  responsavel: z.string().optional(),
  observacao: z.string().optional()
});

type Mode = 'create' | 'edit';

interface VacinaModalProps {
  open: boolean;
  mode: Mode;
  nascimentoId: string; // ID do nascimento (animal)
  initialData?: Vacina | null;
  onClose: () => void;
  onSaved?: () => void;
  onEditVacina?: (vacina: Vacina | null) => void; // Callback para editar vacina da timeline ou voltar para create
  onDeleteVacina?: (vacina: Vacina) => void; // Callback para excluir vacina da timeline
}

function VacinaModalComponent({
  open,
  mode,
  nascimentoId,
  initialData,
  onClose,
  onSaved,
  onEditVacina,
  onDeleteVacina
}: VacinaModalProps) {
  const { appSettings } = useAppSettings();
  const { user } = useAuth();
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

  // Buscar todas as vacinações do animal
  const todasVacinacoes = useLiveQuery(
    () => db.vacinacoes.where('nascimentoId').equals(nascimentoId).toArray(),
    [nascimentoId, open]
  ) || [];

  // Ordenar vacinações por data (mais recente primeiro)
  const vacinacoesOrdenadas = useMemo(() => {
    return [...todasVacinacoes].sort((a, b) => {
      const dataA = a.dataAplicacao.includes('/') 
        ? a.dataAplicacao.split('/').reverse().join('-')
        : a.dataAplicacao;
      const dataB = b.dataAplicacao.includes('/')
        ? b.dataAplicacao.split('/').reverse().join('-')
        : b.dataAplicacao;
      return new Date(dataB).getTime() - new Date(dataA).getTime();
    });
  }, [todasVacinacoes]);

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

  // Verificar se a vacina está vencida
  const isVencida = (dataVencimento?: string): boolean => {
    if (!dataVencimento) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(dataVencimento.includes('/') 
      ? dataVencimento.split('/').reverse().join('-')
      : dataVencimento);
    vencimento.setHours(0, 0, 0, 0);
    return vencimento < hoje;
  };

  // Verificar se a vacina está próxima do vencimento (30 dias)
  const isProximaVencimento = (dataVencimento?: string): boolean => {
    if (!dataVencimento) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(dataVencimento.includes('/') 
      ? dataVencimento.split('/').reverse().join('-')
      : dataVencimento);
    vencimento.setHours(0, 0, 0, 0);
    const diffTime = vencimento.getTime() - hoje.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  };

  const titulo = mode === 'create' ? 'Nova Vacinação' : 'Editar Vacinação';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue
  } = useForm<z.infer<typeof schemaVacina>>({
    resolver: zodResolver(schemaVacina),
    defaultValues: {
      vacina: '',
      dataAplicacao: '',
      dataVencimento: '',
      lote: '',
      responsavel: '',
      observacao: ''
    }
  });

  // Ref para rastrear o ID da vacina que está bloqueada
  const vacinaBloqueadaRef = React.useRef<string | null>(null);

  // Verificar lock no modo edição
  useEffect(() => {
    if (mode === 'edit' && initialData && open && user) {
      const verificarLock = async () => {
        try {
          // Liberar lock anterior se houver
          if (vacinaBloqueadaRef.current && vacinaBloqueadaRef.current !== initialData.id) {
            await unlockRecord('vacina', vacinaBloqueadaRef.current).catch(console.error);
          }

          const existingLock = await checkLock('vacina', initialData.id);
          if (existingLock && existingLock.lockedBy !== user.id) {
            setLockError(existingLock.lockedByNome
              ? `Este registro está sendo editado por ${existingLock.lockedByNome}. Tente novamente em alguns minutos.`
              : 'Este registro está sendo editado por outro usuário. Tente novamente em alguns minutos.'
            );
            setIsLocked(true);
            vacinaBloqueadaRef.current = null;
            return;
          }

          // Tentar bloquear o registro
          const lockResult = await lockRecord('vacina', initialData.id, user.id, user.nome || undefined);
          if (!lockResult.success) {
            setLockError(lockResult.error || 'Não foi possível bloquear o registro para edição.');
            setIsLocked(true);
            vacinaBloqueadaRef.current = null;
            return;
          }

          setIsLocked(false);
          setLockError(null);
          vacinaBloqueadaRef.current = initialData.id;
        } catch (error: any) {
          console.error('Erro ao verificar/bloquear registro:', error);
          setLockError('Erro ao verificar bloqueio do registro.');
          setIsLocked(true);
          vacinaBloqueadaRef.current = null;
        }
      };

      verificarLock();
    } else if (mode === 'create') {
      // Liberar lock se estava em modo edição
      if (vacinaBloqueadaRef.current && user) {
        unlockRecord('vacina', vacinaBloqueadaRef.current).catch(console.error);
        vacinaBloqueadaRef.current = null;
      }
      setIsLocked(false);
      setLockError(null);
    }

    // Liberar lock ao fechar o modal ou mudar de vacina
    return () => {
      if (vacinaBloqueadaRef.current && user) {
        unlockRecord('vacina', vacinaBloqueadaRef.current).catch(console.error);
        vacinaBloqueadaRef.current = null;
      }
    };
  }, [mode, initialData?.id, open, user]);

  // Pré-carregar dados no modo edição
  useEffect(() => {
    if (mode === 'edit' && initialData && !isLocked) {
      // Converter datas para formato DD/MM/YYYY
      let dataAplicacaoFormatada = initialData.dataAplicacao;
      if (dataAplicacaoFormatada.includes('-')) {
        const partes = dataAplicacaoFormatada.split('-');
        if (partes.length === 3) {
          dataAplicacaoFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
      }

      let dataVencimentoFormatada = initialData.dataVencimento || '';
      if (dataVencimentoFormatada && dataVencimentoFormatada.includes('-')) {
        const partes = dataVencimentoFormatada.split('-');
        if (partes.length === 3) {
          dataVencimentoFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
      }
      
      reset({
        vacina: initialData.vacina,
        dataAplicacao: dataAplicacaoFormatada,
        dataVencimento: dataVencimentoFormatada,
        lote: initialData.lote || '',
        responsavel: initialData.responsavel || '',
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
        vacina: '',
        dataAplicacao: dataAtual,
        dataVencimento: '',
        lote: '',
        responsavel: user?.nome || '',
        observacao: ''
      });
    }
  }, [mode, initialData, reset, open, isLocked, user]);

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
      unlockRecord('vacina', initialData.id).catch(console.error);
    }
    setLockError(null);
    setIsLocked(false);
    onClose();
  };

  const onSubmit = async (values: z.infer<typeof schemaVacina>) => {
    if (isSubmitting || isLocked) return;
    setIsSubmitting(true);
    try {
      // Verificar lock antes de salvar (modo edição)
      if (mode === 'edit' && initialData && user) {
        const existingLock = await checkLock('vacina', initialData.id);
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

      // Converter datas de DD/MM/YYYY para YYYY-MM-DD (formato do banco)
      const dataAplicacaoFormatada = converterDataParaFormatoBanco(values.dataAplicacao);
      const dataVencimentoFormatada = values.dataVencimento 
        ? converterDataParaFormatoBanco(values.dataVencimento)
        : undefined;

      if (mode === 'create') {
        const id = uuid();
        const now = new Date().toISOString();

        const novaVacina: Vacina = {
          id,
          nascimentoId,
          vacina: values.vacina,
          dataAplicacao: dataAplicacaoFormatada,
          dataVencimento: dataVencimentoFormatada,
          lote: values.lote || undefined,
          responsavel: values.responsavel || undefined,
          observacao: values.observacao || undefined,
          createdAt: now,
          updatedAt: now,
          synced: false
        };

        await db.vacinacoes.add(novaVacina);

        // Auditoria: criação de vacinação
        await registrarAudit({
          entity: 'vacina',
          entityId: id,
          action: 'create',
          before: null,
          after: novaVacina,
          user: user ? { id: user.id, nome: user.nome || '' } : null,
          description: 'Cadastro de vacinação'
        });

        showToast({
          type: 'success',
          title: 'Vacinação cadastrada',
          message: 'A vacinação foi cadastrada com sucesso.'
        });

        onSaved?.();
        handleClose();
      } else if (mode === 'edit' && initialData) {
        const antes = initialData;
        const now = new Date().toISOString();

        const updates: Partial<Vacina> = {
          vacina: values.vacina,
          dataAplicacao: dataAplicacaoFormatada,
          dataVencimento: dataVencimentoFormatada,
          lote: values.lote || undefined,
          responsavel: values.responsavel || undefined,
          observacao: values.observacao || undefined,
          updatedAt: now,
          synced: false
        };

        await db.vacinacoes.update(initialData.id, updates);

        const depois = { ...initialData, ...updates };

        // Auditoria: edição de vacinação
        await registrarAudit({
          entity: 'vacina',
          entityId: initialData.id,
          action: 'update',
          before: antes,
          after: depois,
          user: user ? { id: user.id, nome: user.nome || '' } : null,
          description: 'Edição de vacinação'
        });

        // Liberar lock após salvar com sucesso
        await unlockRecord('vacina', initialData.id);

        showToast({
          type: 'success',
          title: 'Vacinação atualizada',
          message: 'A vacinação foi atualizada com sucesso.'
        });

        onSaved?.();
        handleClose();
      }
    } catch (error) {
      console.error('Erro ao salvar vacinação:', error);
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
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                Vacina *
              </label>
              <input
                type="text"
                className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
                {...register('vacina')}
                placeholder="Ex: Brucelose, Febre Aftosa..."
              />
              {errors.vacina && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                  {String(errors.vacina.message)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                Data de Aplicação *
              </label>
              <input
                type="text"
                className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
                placeholder="DD/MM/YYYY"
                maxLength={10}
                {...register('dataAplicacao', {
                  onChange: (e) => {
                    const valor = e.target.value;
                    const normalizado = normalizarDataInput(valor);
                    setValue('dataAplicacao', normalizado, { shouldValidate: false });
                  }
                })}
              />
              {errors.dataAplicacao && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                  {String(errors.dataAplicacao.message)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                Data de Vencimento/Revacinação
              </label>
              <input
                type="text"
                className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
                placeholder="DD/MM/YYYY"
                maxLength={10}
                {...register('dataVencimento', {
                  onChange: (e) => {
                    const valor = e.target.value;
                    const normalizado = normalizarDataInput(valor);
                    setValue('dataVencimento', normalizado, { shouldValidate: false });
                  }
                })}
              />
              {errors.dataVencimento && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                  {String(errors.dataVencimento.message)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                Lote
              </label>
              <input
                type="text"
                className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
                {...register('lote')}
                placeholder="Número do lote"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
                Responsável
              </label>
              <input
                type="text"
                className={`w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
                {...register('responsavel')}
                placeholder="Nome do responsável"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
              Observações
            </label>
            <textarea
              className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')}`}
              rows={3}
              {...register('observacao')}
              placeholder="Observações sobre a vacinação (opcional)"
            />
          </div>
        </fieldset>

        {/* Timeline de Vacinações */}
        {vacinacoesOrdenadas.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Icons.Injection className="w-5 h-5 text-gray-600 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                Histórico de Vacinações ({vacinacoesOrdenadas.length} {vacinacoesOrdenadas.length === 1 ? 'vacinação' : 'vacinações'})
              </h3>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {vacinacoesOrdenadas.map((vacina, index) => {
                const isUltima = index === 0;
                const vencida = isVencida(vacina.dataVencimento);
                const proximaVencimento = isProximaVencimento(vacina.dataVencimento);

                return (
                  <div
                    key={vacina.id}
                    className={`p-3 rounded-lg border ${
                      isUltima
                        ? `${getThemeClasses(primaryColor, 'border')} ${getThemeClasses(primaryColor, 'bg-light')}`
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50'
                    } ${vencida ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : ''} ${proximaVencimento && !vencida ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {vacina.vacina}
                          </span>
                          {isUltima && (
                            <span className={`text-xs px-2 py-0.5 rounded ${getThemeClasses(primaryColor, 'bg')} text-white`}>
                              Mais recente
                            </span>
                          )}
                          {vencida && (
                            <span className="text-xs px-2 py-0.5 rounded bg-red-600 text-white">
                              Vencida
                            </span>
                          )}
                          {proximaVencimento && !vencida && (
                            <span className="text-xs px-2 py-0.5 rounded bg-amber-600 text-white">
                              Vence em breve
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-slate-200">
                          <div>Aplicada em: {formatarData(vacina.dataAplicacao)}</div>
                          {vacina.dataVencimento && (
                            <div className={vencida ? 'text-red-600 dark:text-red-400 font-semibold' : proximaVencimento ? 'text-amber-600 dark:text-amber-400' : ''}>
                              Vencimento: {formatarData(vacina.dataVencimento)}
                            </div>
                          )}
                          {vacina.lote && (
                            <div className="text-xs text-gray-500 dark:text-slate-400">Lote: {vacina.lote}</div>
                          )}
                          {vacina.responsavel && (
                            <div className="text-xs text-gray-500 dark:text-slate-400">Responsável: {vacina.responsavel}</div>
                          )}
                        </div>
                        {vacina.observacao && (
                          <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 truncate" title={vacina.observacao}>
                            {vacina.observacao}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {onEditVacina && (
                          <button
                            type="button"
                            onClick={() => {
                              onEditVacina(vacina);
                            }}
                            className={`p-1.5 ${getPrimaryActionButtonLightClass(primaryColor)} rounded transition-colors`}
                            title="Editar vacinação"
                          >
                            <Icons.Edit className="w-4 h-4" />
                          </button>
                        )}
                        {onDeleteVacina && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDialog({
                                open: true,
                                title: 'Excluir vacinação',
                                message: `Deseja realmente excluir a vacinação de ${vacina.vacina} aplicada em ${formatarData(vacina.dataAplicacao)}?`,
                                variant: 'danger',
                                onConfirm: async () => {
                                  setConfirmDialog(prev => ({ ...prev, open: false }));
                                  setIsSubmitting(true);
                                  try {
                                    const antes = vacina;
                                    
                                    // Registrar exclusão no deletedRecords antes de excluir
                                    const deletedId = uuid();
                                    await db.deletedRecords.add({
                                      id: deletedId,
                                      uuid: vacina.id,
                                      remoteId: vacina.remoteId || null,
                                      deletedAt: new Date().toISOString(),
                                      synced: false
                                    });
                                    
                                    // Excluir vacinação no servidor se tiver remoteId
                                    if (vacina.remoteId) {
                                      try {
                                        const { supabase } = await import('../api/supabaseClient');
                                        const { error } = await supabase
                                          .from('vacinacoes_online')
                                          .delete()
                                          .eq('id', vacina.remoteId);
                                        
                                        if (!error) {
                                          await db.deletedRecords.update(deletedId, { synced: true });
                                        } else {
                                          console.error('Erro ao excluir vacinação no servidor:', error);
                                        }
                                      } catch (err) {
                                        console.error('Erro ao excluir vacinação no servidor:', err);
                                      }
                                    } else {
                                      await db.deletedRecords.update(deletedId, { synced: true });
                                    }
                                    
                                    // Excluir vacinação local
                                    await db.vacinacoes.delete(vacina.id);

                                    // Auditoria: exclusão de vacinação
                                    await registrarAudit({
                                      entity: 'vacina',
                                      entityId: vacina.id,
                                      action: 'delete',
                                      before: antes,
                                      after: null,
                                      user: user ? { id: user.id, nome: user.nome || '' } : null,
                                      description: 'Exclusão de vacinação'
                                    });

                                    // Liberar lock após excluir
                                    await unlockRecord('vacina', vacina.id);

                                    showToast({
                                      type: 'success',
                                      title: 'Vacinação excluída',
                                      message: 'A vacinação foi excluída com sucesso.'
                                    });

                                    onSaved?.();
                                    // Se estávamos editando esta vacina, voltar para modo create
                                    if (initialData && initialData.id === vacina.id && onEditVacina) {
                                      onEditVacina(null);
                                    }
                                  } catch (error) {
                                    console.error('Erro ao excluir vacinação:', error);
                                    showToast({
                                      type: 'error',
                                      title: 'Erro ao excluir',
                                      message: 'Não foi possível excluir a vacinação.'
                                    });
                                  } finally {
                                    setIsSubmitting(false);
                                  }
                                }
                              });
                            }}
                            className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Excluir vacinação"
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

export default VacinaModalComponent;
