import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { createUser, updateUser, getUserById } from '../utils/auth';
import { UserRole } from '../db/models';
import { ArrowLeft, Save } from 'lucide-react';
import { Link } from 'react-router-dom';

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

export default function CadastroUsuario() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const fazendas = fazendasRaw.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch
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
    if (isEditing && id) {
      const loadUsuario = async () => {
        try {
          const usuario = await getUserById(id);
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
          alert('Erro ao carregar usuário');
        }
      };
      loadUsuario();
    }
  }, [id, isEditing, reset]);

  const onSubmit = async (data: FormDataUsuario) => {
    setLoading(true);
    try {
      if (isEditing && id) {
        // Atualizar usuário
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

        await updateUser(id, updateData);
        alert('Usuário atualizado com sucesso!');
      } else {
        // Criar novo usuário
        if (!data.senha || data.senha.length === 0) {
          alert('Senha é obrigatória para novo usuário');
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
        alert('Usuário criado com sucesso!');
      }
      navigate('/usuarios');
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      alert(error.message || 'Erro ao salvar usuário');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/usuarios"
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {isEditing ? 'Editar informações do usuário' : 'Cadastrar novo usuário no sistema'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-2 sm:px-4 lg:px-8 py-4 sm:py-6">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  {...register('nome')}
                />
                {errors.nome && <p className="text-red-600 text-sm mt-1">{errors.nome.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  {...register('email')}
                />
                {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha {!isEditing && '*'}
                  {isEditing && <span className="text-gray-500 text-xs">(deixe em branco para não alterar)</span>}
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  {...register('senha')}
                />
                {errors.senha && <p className="text-red-600 text-sm mt-1">{errors.senha.message}</p>}
              </div>

              {senha && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar Senha *</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    {...register('confirmarSenha')}
                  />
                  {errors.confirmarSenha && <p className="text-red-600 text-sm mt-1">{errors.confirmarSenha.message}</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  {...register('role')}
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {errors.role && <p className="text-red-600 text-sm mt-1">{errors.role.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fazenda</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  {...register('fazendaId')}
                >
                  <option value="">Nenhuma</option>
                  {fazendas.map((fazenda) => (
                    <option key={fazenda.id} value={fazenda.id}>
                      {fazenda.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="ativo"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  {...register('ativo')}
                />
                <label htmlFor="ativo" className="ml-2 block text-sm text-gray-700">
                  Usuário ativo
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Link
                to="/usuarios"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

