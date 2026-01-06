import React, { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { createUser, updateUser, getUserById } from '../utils/auth';
import { showToast } from '../utils/toast';
import { UserRole } from '../db/models';
import Modal from './Modal';
import Combobox, { ComboboxOption } from './Combobox';
import { Icons } from '../utils/iconMapping';

type Mode = 'create' | 'edit';

const schemaUsuario = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional().or(z.literal('')),
  confirmarSenha: z.string().optional().or(z.literal('')),
  role: z.enum(['admin', 'gerente', 'peao', 'visitante']),
  fazendaId: z.string().optional(),
  ativo: z.boolean()
}).refine((data) => {
  // Se estiver editando e não informou senha, não precisa confirmar
  if (!data.senha) return true;
  // Se informou senha, precisa confirmar
  return data.senha === data.confirmarSenha;
}, {
  message: 'Senhas não coincidem',
  path: ['confirmarSenha']
});

type FormDataUsuario = z.infer<typeof schemaUsuario>;

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  peao: 'Peão',
  visitante: 'Visitante'
};

interface UsuarioModalProps {
  open: boolean;
  mode: Mode;
  initialData?: { id: string } | null;
  onClose: () => void;
  onSaved?: () => void;
}

export default function UsuarioModal({
  open,
  mode,
  initialData,
  onClose,
  onSaved
}: UsuarioModalProps) {
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];

  const fazendaOptions: ComboboxOption[] = React.useMemo(() => {
    return fazendasRaw
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
      .map((f) => ({
        label: f.nome || '',
        value: f.id || ''
      }));
  }, [fazendasRaw]);

  const titulo = mode === 'create' ? 'Novo Usuário' : 'Editar Usuário';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue
  } = useForm<FormDataUsuario>({
    resolver: zodResolver(schemaUsuario),
    defaultValues: {
      nome: '',
      email: '',
      senha: '',
      confirmarSenha: '',
      role: 'peao',
      fazendaId: '',
      ativo: true
    }
  });

  const senha = watch('senha');

  // Carregar dados do usuário se estiver editando
  useEffect(() => {
    if (mode === 'edit' && initialData?.id && open) {
      const loadUsuario = async () => {
        try {
          const usuario = await getUserById(initialData.id);
          if (usuario) {
            reset({
              nome: usuario.nome,
              email: usuario.email,
              senha: '',
              confirmarSenha: '',
              role: usuario.role,
              fazendaId: usuario.fazendaId || '',
              ativo: usuario.ativo
            });
          }
        } catch (error) {
          console.error('Erro ao carregar usuário:', error);
          showToast({ type: 'error', title: 'Erro ao carregar', message: 'Não foi possível carregar o usuário.' });
        }
      };
      loadUsuario();
    } else if (mode === 'create' && open) {
      reset({
        nome: '',
        email: '',
        senha: '',
        confirmarSenha: '',
        role: 'peao',
        fazendaId: '',
        ativo: true
      });
    }
  }, [mode, initialData, reset, open]);

  const handleLimpar = () => {
    reset({
      nome: '',
      email: '',
      senha: '',
      confirmarSenha: '',
      role: 'peao',
      fazendaId: '',
      ativo: true
    });
  };

  const onSubmit = async (data: FormDataUsuario) => {
    setLoading(true);
    try {
      if (mode === 'edit' && initialData?.id) {
        const updateData: any = {
          nome: data.nome,
          email: data.email,
          role: data.role,
          fazendaId: data.fazendaId || undefined,
          ativo: data.ativo
        };

        // Só atualizar senha se foi informada
        if (data.senha && data.senha.length > 0) {
          updateData.senha = data.senha;
        }

        await updateUser(initialData.id, updateData);
        showToast({ type: 'success', title: 'Usuário atualizado', message: data.nome });
      } else {
        // Criar novo usuário
        if (!data.senha || data.senha.length === 0) {
          showToast({ type: 'warning', title: 'Senha obrigatória', message: 'Informe a senha para criar o usuário.' });
          setLoading(false);
          return;
        }

        await createUser({
          nome: data.nome,
          email: data.email,
          senha: data.senha,
          role: data.role,
          fazendaId: data.fazendaId || undefined
        });
        showToast({ type: 'success', title: 'Usuário criado', message: data.nome });
      }

      onSaved?.();
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      showToast({ type: 'error', title: 'Erro ao salvar usuário', message: error?.message || 'Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const conteudoFormulario = (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nome *</label>
          <input
            type="text"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            {...register('nome')}
            autoFocus
          />
          {errors.nome && (
            <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.nome.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email *</label>
          <input
            type="email"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Senha {!mode || mode === 'create' ? '*' : ''}
            {mode === 'edit' && <span className="text-gray-500 text-xs"> (deixe em branco para não alterar)</span>}
          </label>
          <input
            type="password"
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            {...register('senha')}
          />
          {errors.senha && (
            <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.senha.message}</p>
          )}
        </div>

        {senha && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Confirmar Senha *</label>
            <input
              type="password"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              {...register('confirmarSenha')}
            />
            {errors.confirmarSenha && (
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.confirmarSenha.message}</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Role *</label>
          <select
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            {...register('role')}
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.role && (
            <p className="text-red-600 dark:text-red-400 text-xs mt-1">{errors.role.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Fazenda</label>
          <Combobox
            value={watch('fazendaId') || ''}
            onChange={(value) => startTransition(() => setValue('fazendaId', value))}
            options={[
              { label: 'Nenhuma', value: '' },
              ...fazendaOptions
            ]}
            placeholder="Selecione a fazenda"
            allowCustomValue={false}
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="ativo"
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-700 rounded"
            {...register('ativo')}
          />
          <label htmlFor="ativo" className="ml-2 block text-sm text-gray-700 dark:text-slate-300">
            Usuário ativo
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-slate-700">
        <button
          type="button"
          onClick={handleLimpar}
          disabled={loading}
          className="px-4 py-2 text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{titulo}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{conteudoFormulario}</div>
      </div>
    </Modal>
  );
}

