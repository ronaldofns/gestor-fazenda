import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { createUser } from '../utils/auth';
import { UserPlus, LogIn, RefreshCw } from 'lucide-react';
import { db } from '../db/dexieDB';

const schema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmarSenha: z.string()
}).refine((data) => data.senha === data.confirmarSenha, {
  message: 'Senhas não coincidem',
  path: ['confirmarSenha']
});

type FormData = z.infer<typeof schema>;

export default function SetupInicial() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [temUsuarios, setTemUsuarios] = useState(false);

  useEffect(() => {
    const verificarUsuarios = async () => {
      try {
        // Primeiro, verificar se há usuários locais
        let usuarios = await db.usuarios.toArray();
        
        // Se não houver usuários locais, tentar sincronizar do Supabase
        if (usuarios.length === 0) {
          setSincronizando(true);
          try {
            // Fazer pull apenas de usuários do Supabase (mais rápido)
            const { pullUsuarios } = await import('../api/syncService');
            await pullUsuarios();
            // Verificar novamente após sincronização
            usuarios = await db.usuarios.toArray();
          } catch (syncError) {
            console.error('Erro ao sincronizar usuários:', syncError);
            // Continuar mesmo se a sincronização falhar (pode estar offline)
          } finally {
            setSincronizando(false);
          }
        }
        
        if (usuarios.length > 0) {
          setTemUsuarios(true);
          // Se já tem usuários, redirecionar para login
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        }
      } catch (error) {
        console.error('Erro ao verificar usuários:', error);
      } finally {
        setVerificando(false);
      }
    };

    verificarUsuarios();
  }, [navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      // Criar primeiro usuário como admin
      await createUser({
        nome: data.nome,
        email: data.email,
        senha: data.senha,
        role: 'admin' // Primeiro usuário sempre é admin
      });
      
      alert('Usuário administrador criado com sucesso! Redirecionando para login...');
      navigate('/login');
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      alert(error.message || 'Erro ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-500">
            {sincronizando ? 'Sincronizando usuários...' : 'Verificando...'}
          </div>
          {sincronizando && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Buscando usuários do servidor</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (temUsuarios) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sistema já configurado</h2>
          <p className="text-gray-600 mb-4">Redirecionando para login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 px-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-green-600 rounded-2xl shadow-lg mb-4">
            <UserPlus className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuração Inicial</h1>
          <p className="text-gray-600">Crie o primeiro usuário administrador</p>
        </div>

        {/* Card de Cadastro */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Criar Administrador</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nome *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Seu nome completo"
                {...register('nome')}
              />
              {errors.nome && (
                <p className="text-red-600 text-sm mt-1">{errors.nome.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="seu@email.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Senha *</label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Mínimo 6 caracteres"
                {...register('senha')}
              />
              {errors.senha && (
                <p className="text-red-600 text-sm mt-1">{errors.senha.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Confirmar Senha *</label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Digite a senha novamente"
                {...register('confirmarSenha')}
              />
              {errors.confirmarSenha && (
                <p className="text-red-600 text-sm mt-1">{errors.confirmarSenha.message}</p>
              )}
            </div>

            <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-md">
              <p className="text-blue-800 text-sm">
                <strong>Nota:</strong> Este será o primeiro usuário do sistema e terá permissões de administrador.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>Criar Administrador</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          © 2024 Gestor Fazenda. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}

