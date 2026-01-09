import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Icons } from '../utils/iconMapping';
import { useAuth } from '../hooks/useAuth';
import { db } from '../db/dexieDB';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getThemeClasses, getPrimaryButtonClass } from '../utils/themeHelpers';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, login } = useAuth();
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificandoUsuarios, setVerificandoUsuarios] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [temUsuarios, setTemUsuarios] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  // Sincronizar usuários do Supabase antes de verificar
  useEffect(() => {
    const verificarUsuarios = async () => {
      try {
        // Sempre sincronizar usuários do Supabase primeiro para garantir dados atualizados
        setSincronizando(true);
        try {
          // Fazer pull apenas de usuários do Supabase (mais rápido)
          const { pullUsuarios } = await import('../api/syncService');
          await pullUsuarios();
        } catch (syncError) {
          console.error('Erro ao sincronizar usuários:', syncError);
          // Continuar mesmo se a sincronização falhar (pode estar offline)
        } finally {
          setSincronizando(false);
        }
        
        // Verificar se há usuários após sincronização
        const usuarios = await db.usuarios.toArray();
        setTemUsuarios(usuarios.length > 0);
      } catch (error) {
        console.error('Erro ao verificar usuários:', error);
      } finally {
        setVerificandoUsuarios(false);
      }
    };

    verificarUsuarios();
  }, []);

  // Verificar se já está autenticado
  useEffect(() => {
    if (!authLoading && user) {
      // Usuário já autenticado, redirecionar
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, location]);

  // Redirecionar para setup se não há usuários (após verificação)
  useEffect(() => {
    if (!verificandoUsuarios && !temUsuarios) {
      navigate('/setup', { replace: true });
    }
  }, [verificandoUsuarios, temUsuarios, navigate]);

  async function onSubmit(data: any) {
    setError(null);
    setLoading(true);
    
    try {
      const { email, password } = data;
      await login(email, password);
      
      // Login bem-sucedido, redirecionar
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }
  
  if (authLoading || verificandoUsuarios) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${getThemeClasses(primaryColor, 'gradient-from')} via-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-900`}>
        <div className="text-center">
          <div className={`w-12 h-12 border-4 ${getThemeClasses(primaryColor, 'border')} border-t-transparent rounded-full animate-spin mx-auto mb-4`}></div>
          <div className="text-gray-500 dark:text-slate-400">
            {sincronizando ? 'Sincronizando usuários...' : 'Carregando...'}
          </div>
          {sincronizando && (
            <div className={`mt-4 flex items-center justify-center gap-2 text-sm ${getThemeClasses(primaryColor, 'text')}`}>
              <Icons.RefreshCw className="w-4 h-4 animate-spin" />
              <span>Buscando usuários do servidor</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Se não há usuários, não renderizar o formulário (o useEffect acima fará o redirecionamento)
  if (!verificandoUsuarios && !temUsuarios) {
    return null; // Aguardar redirecionamento para setup
  }

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${getThemeClasses(primaryColor, 'gradient-from')} via-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 px-4`}>
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br ${getThemeClasses(primaryColor, 'gradient-to')} rounded-2xl shadow-lg mb-4`}>
            <Icons.LogIn className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">Gestor Fazenda</h1>
          <p className="text-gray-600 dark:text-slate-400">Sistema de Gestão de Rebanho</p>
        </div>

        {/* Card de Login */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-slate-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6 text-center">Entrar</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-md">
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icons.Mail className={`h-5 w-5 ${getThemeClasses(primaryColor, 'text')}`} />
                </div>
                <input 
                  type="email"
                  className={`w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} transition-colors`} 
                  placeholder="seu@email.com" 
                  {...register('email', { required: 'Email é obrigatório' })} 
                />
              </div>
              {errors.email && (
                <p className="text-red-600 text-sm mt-1">{String(errors.email.message)}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icons.Lock className={`h-5 w-5 ${getThemeClasses(primaryColor, 'text')}`} />
                </div>
                <input 
                  type="password"
                  className={`w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} ${getThemeClasses(primaryColor, 'border')} transition-colors`} 
                  placeholder="Sua senha" 
                  {...register('password', { required: 'Senha é obrigatória' })} 
                />
              </div>
              {errors.password && (
                <p className="text-red-600 text-sm mt-1">{String(errors.password.message)}</p>
              )}
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className={`w-full px-4 py-3 ${getPrimaryButtonClass(primaryColor)} text-white font-semibold rounded-lg focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, 'ring')} focus:ring-offset-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <Icons.LogIn className="w-5 h-5" />
                  <span>Entrar</span>
                </>
              )}
            </button>
          </form>
          
          {!temUsuarios && (
            <div className="mt-4 text-center">
              <Link
                to="/setup"
                className={`text-sm ${getThemeClasses(primaryColor, 'text')} ${getThemeClasses(primaryColor, 'hover-text')} hover:underline`}
              >
                Primeira vez? Configure o sistema
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 dark:text-slate-400 text-sm mt-6">
          © 2024 Gestor Fazenda. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
