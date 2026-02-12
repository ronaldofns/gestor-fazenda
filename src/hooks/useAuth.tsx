import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { Usuario, UserRole } from '../db/models';
import { db } from '../db/dexieDB';
import { authenticateUser, getUserById, getUserByEmail } from '../utils/auth';
import { supabase } from '../api/supabaseClient';
import { showToast } from '../utils/toast';

const OFFLINE_LOGIN_FLAG = 'gestor-fazenda-offline-login';

/** Converte uma linha de usuarios_online (Supabase) para o modelo Usuario da aplicação. */
function mapRowToUsuario(row: {
  uuid: string;
  nome: string;
  email: string;
  senha_hash: string;
  role: string;
  fazenda_uuid?: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  id?: number;
}): Usuario {
  return {
    id: row.uuid,
    nome: row.nome,
    email: row.email,
    senhaHash: row.senha_hash,
    role: row.role as Usuario['role'],
    fazendaId: row.fazenda_uuid ?? undefined,
    ativo: row.ativo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    synced: true,
    remoteId: row.id ?? null,
  };
}

/**
 * Busca usuário em usuarios_online pelo email (requer sessão Supabase Auth ativa).
 */
async function getUsuarioFromSupabaseByEmail(email: string): Promise<Usuario | null> {
  const { data, error } = await supabase
    .from('usuarios_online')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  return mapRowToUsuario(data as Parameters<typeof mapRowToUsuario>[0]);
}

interface AuthContextType {
  user: Usuario | null;
  loading: boolean;
  /** true quando o usuário logou offline (Dexie) e deve fazer login de novo para sincronizar */
  isOfflineLogin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isAdmin: () => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Restaurar sessão: com conexão usa Supabase; sem conexão só Dexie
  useEffect(() => {
    const loadSession = async () => {
      try {
        localStorage.removeItem('gestor-fazenda-user-id');
        const online = typeof navigator !== 'undefined' && navigator.onLine;

        if (online) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.email) {
            const usuario = await getUsuarioFromSupabaseByEmail(session.user.email);
            if (usuario && usuario.ativo) {
              setUser(usuario);
              sessionStorage.setItem('gestor-fazenda-user-id', usuario.id);
              sessionStorage.removeItem(OFFLINE_LOGIN_FLAG);
              try {
                await db.usuarios.put(usuario);
              } catch (_) { /* ignora */ }
              console.info('[Auth] Sessão restaurada (Supabase Auth). RLS usa auth.uid().');
              setLoading(false);
              return;
            }
          }
        } else {
          // Offline: tentar sessão Supabase em cache e buscar usuário no Dexie
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.email) {
            const usuario = await getUserByEmail(session.user.email);
            if (usuario && usuario.ativo) {
              setUser(usuario);
              sessionStorage.setItem('gestor-fazenda-user-id', usuario.id);
              sessionStorage.removeItem(OFFLINE_LOGIN_FLAG);
              setLoading(false);
              return;
            }
          }
        }

        const savedUserId = sessionStorage.getItem('gestor-fazenda-user-id');
        if (savedUserId) {
          await db.open();
          let usuario = await getUserById(savedUserId);
          if (!usuario) {
            await new Promise(r => setTimeout(r, 300));
            usuario = await getUserById(savedUserId);
          }
          if (!usuario && online) {
            try {
              const { pullUsuarios } = await import('../api/syncService');
              await pullUsuarios();
              usuario = await getUserById(savedUserId);
            } catch (_) { /* ignora */ }
          }
          if (usuario && usuario.ativo) {
            setUser(usuario);
            if (sessionStorage.getItem(OFFLINE_LOGIN_FLAG)) {
              console.info('[Auth] Sessão restaurada (login offline). Faça login novamente quando houver conexão para sincronizar.');
            } else {
              console.info('[Auth] Sessão restaurada (sessionStorage + Dexie).');
            }
          } else {
            sessionStorage.removeItem('gestor-fazenda-user-id');
            sessionStorage.removeItem(OFFLINE_LOGIN_FLAG);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar sessão:', error);
        sessionStorage.removeItem('gestor-fazenda-user-id');
        sessionStorage.removeItem(OFFLINE_LOGIN_FLAG);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  // Ouvir online/offline para atualizar estado e avisar quando voltar conexão (login offline)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const wasOfflineRef = useRef(false);

  // Quando volta conexão e o usuário está em login offline, pedir para fazer login de novo (só na transição offline → online)
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }
    if (!wasOfflineRef.current || !user) return;
    if (sessionStorage.getItem(OFFLINE_LOGIN_FLAG) !== '1') return;
    wasOfflineRef.current = false;
    showToast({
      type: 'info',
      title: 'Conexão restabelecida',
      message: 'Faça login novamente para sincronizar com o servidor.',
    });
  }, [isOnline, user?.id]);

  const login = async (email: string, password: string) => {
    const simulateOffline =
      typeof window !== 'undefined' &&
      (window.location.search.includes('simulateOffline=1') ||
        (window as unknown as { __TEST_SIMULATE_OFFLINE?: boolean }).__TEST_SIMULATE_OFFLINE === true);
    const online = (typeof navigator !== 'undefined' && navigator.onLine) && !simulateOffline;

    if (!online) {
      const usuario = await authenticateUser(email, password);
      if (!usuario) throw new Error('Email ou senha incorretos');
      setUser(usuario);
      sessionStorage.setItem('gestor-fazenda-user-id', usuario.id);
      sessionStorage.setItem(OFFLINE_LOGIN_FLAG, '1');
      console.info('[Auth] Login OK (offline, Dexie). Sincronize após conectar e fazer login novamente.');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (!error && data?.session?.user?.email) {
      const usuario = await getUsuarioFromSupabaseByEmail(data.session.user.email);
      if (usuario && usuario.ativo) {
        setUser(usuario);
        sessionStorage.setItem('gestor-fazenda-user-id', usuario.id);
        sessionStorage.removeItem(OFFLINE_LOGIN_FLAG);
        try {
          await db.usuarios.put(usuario);
        } catch (_) { /* ignora */ }
        console.info('[Auth] Login OK (Supabase Auth). RLS usa auth.uid().');
        return;
      }
      await supabase.auth.signOut();
      throw new Error('Usuário não encontrado no sistema. Contate o administrador.');
    }

    // Migração suave: usuário existe no Dexie mas ainda não no Supabase Auth
    const errMsg = error?.message ?? '';
    if (errMsg.includes('Invalid') || errMsg.includes('invalid') || error?.status === 400) {
      const usuario = await authenticateUser(email, password);
      if (usuario) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: usuario.email,
          password,
          options: { emailRedirectTo: undefined },
        });
        if (signUpError && !signUpError.message.includes('already registered')) {
          console.warn('[Auth] signUp (migração):', signUpError.message);
        }
        const { data: d2, error: e2 } = await supabase.auth.signInWithPassword({
          email: usuario.email,
          password,
        });
        if (!e2 && d2?.session?.user?.email) {
          const u = await getUsuarioFromSupabaseByEmail(d2.session.user.email);
          if (u && u.ativo) {
            setUser(u);
            sessionStorage.setItem('gestor-fazenda-user-id', u.id);
            sessionStorage.removeItem(OFFLINE_LOGIN_FLAG);
            try {
              await db.usuarios.put(u);
            } catch (_) { /* ignora */ }
            console.info('[Auth] Login OK (migração para Supabase Auth).');
            return;
          }
        }
      }
    }

    if (error?.message) {
      throw new Error(error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message);
    }
    throw new Error('Email ou senha incorretos');
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('gestor-fazenda-user-id');
    sessionStorage.removeItem(OFFLINE_LOGIN_FLAG);
    import('../utils/jwtAuth').then(({ clearJwtCache }) => clearJwtCache());
    supabase.auth.signOut().catch(() => {});
  };

  const refreshUser = async () => {
    if (user?.id) {
      const updatedUser = await getUserById(user.id);
      if (updatedUser) setUser(updatedUser);
      else {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          const u = await getUsuarioFromSupabaseByEmail(session.user.email);
          if (u) setUser(u);
        }
      }
    }
  };

  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    if (Array.isArray(role)) return role.includes(user.role);
    return user.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => hasRole(roles);
  const isAdmin = (): boolean => hasRole('admin');

  const isOfflineLogin =
    !!user &&
    typeof sessionStorage !== 'undefined' &&
    sessionStorage.getItem(OFFLINE_LOGIN_FLAG) === '1';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isOfflineLogin,
        login,
        logout,
        hasRole,
        hasAnyRole,
        isAdmin,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
