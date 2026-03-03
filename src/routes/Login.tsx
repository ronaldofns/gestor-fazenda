import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { Icons } from "../utils/iconMapping";
import { t } from "../i18n/pt-BR";
import { useAuth } from "../hooks/useAuth";
import { db } from "../db/dexieDB";
import { useAppSettings } from "../hooks/useAppSettings";
import { ColorPaletteKey } from "../hooks/useThemeColors";
import { getThemeClasses, getPrimaryButtonClass } from "../utils/themeHelpers";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading, login } = useAuth();
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificandoUsuarios, setVerificandoUsuarios] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [temUsuarios, setTemUsuarios] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm();
  const isDev =
    import.meta.env?.DEV === true || import.meta.env?.MODE === "development";

  // Sincronizar usuários do Supabase antes de verificar
  useEffect(() => {
    const verificarUsuarios = async () => {
      try {
        // Sempre sincronizar usuários do Supabase primeiro para garantir dados atualizados
        setSincronizando(true);
        try {
          // Fazer pull apenas de usuários do Supabase (mais rápido)
          const { pullUsuarios } = await import("../api/syncService");
          await pullUsuarios();
        } catch (syncError) {
          console.error("Erro ao sincronizar usuários:", syncError);
          // Continuar mesmo se a sincronização falhar (pode estar offline)
        } finally {
          setSincronizando(false);
        }

        // Verificar se há usuários após sincronização
        const usuarios = await db.usuarios.toArray();
        setTemUsuarios(usuarios.length > 0);
      } catch (error) {
        console.error("Erro ao verificar usuários:", error);
      } finally {
        setVerificandoUsuarios(false);
      }
    };

    verificarUsuarios();
  }, []);

  // Verificar se já está autenticado — sempre redirecionar para o dashboard
  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Redirecionar para setup se não há usuários (após verificação)
  useEffect(() => {
    if (!verificandoUsuarios && !temUsuarios) {
      navigate("/setup", { replace: true });
    }
  }, [verificandoUsuarios, temUsuarios, navigate]);

  async function onSubmit(data: any) {
    setError(null);
    setLoading(true);

    try {
      const { email, password } = data;
      await login(email, password);

      // Login bem-sucedido — sempre redirecionar para o dashboard
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  async function handleAcessoRapidoDev() {
    setValue("email", "ronaldofnsdeveloper@gmail.com");
    setValue("password", "123456");
    await onSubmit({
      email: "ronaldofnsdeveloper@gmail.com",
      password: "123456",
    });
  }

  if (authLoading || verificandoUsuarios) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${getThemeClasses(primaryColor, "gradient-from")} via-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-900`}
      >
        <div className="text-center">
          <div
            className={`w-12 h-12 border-4 ${getThemeClasses(primaryColor, "border")} border-t-transparent rounded-full animate-spin mx-auto mb-4`}
          ></div>
          <div className="text-gray-500 dark:text-slate-400">
            {sincronizando ? t("login.syncUsers") : t("common.loading")}
          </div>
          {sincronizando && (
            <div
              className={`mt-4 flex items-center justify-center gap-2 text-sm ${getThemeClasses(primaryColor, "text")}`}
            >
              <Icons.RefreshCw className="w-4 h-4 animate-spin" />
              <span>{t("login.fetchingUsers")}</span>
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
    <div
      className={`min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 px-4 relative overflow-hidden`}
    >
      {/* Elementos Decorativos de Fundo (Blur) */}
      <div
        className={`absolute -top-[10%] -left-[10%] w-72 h-72 rounded-full blur-3xl opacity-20 ${getThemeClasses(primaryColor, "bg")}`}
      />
      <div
        className={`absolute -bottom-[10%] -right-[10%] w-96 h-96 rounded-full blur-3xl opacity-20 ${getThemeClasses(primaryColor, "bg")}`}
      />

      <div className="max-w-md w-full z-10">
        {/* Logo/Header */}
        <div className="text-center mb-10">
          <div
            className={`inline-flex items-center justify-center w-24 h-24 bg-gradient-to-tr ${getThemeClasses(primaryColor, "gradient-from")} to-white/20 rounded-3xl shadow-2xl mb-6 ring-4 ring-black/50 dark:ring-slate-800/50`}
          >
            <Icons.LogIn
              className={`w-12 h-12 ${getThemeClasses(primaryColor, "text")} drop-shadow-md`}
            />
          </div>
          <h1
            className={`text-4xl font-extrabold ${getThemeClasses(primaryColor, "text")} dark:text-white tracking-tight`}
          >
            Gestor{" "}
            <span className={`${getThemeClasses(primaryColor, "text")}`}>
              Fazenda
            </span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Sistema de Gestão de Rebanho
          </p>
        </div>

        {/* Card de Login com Efeito Glassmorphism */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[1rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-5 border border-white dark:border-slate-800 transition-all duration-300 hover:shadow-[0_25px_60px_rgba(0,0,0,0.15)]">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-8 text-center uppercase tracking-widest">
            {t("login.title")}
          </h2>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
            noValidate
          >
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-xl animate-shake">
                <p className="text-red-700 dark:text-red-400 text-sm font-semibold flex items-center gap-2">
                  <Icons.AlertCircle className="w-4 h-4" /> {error}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                {t("login.email")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icons.Mail
                    className={`h-5 w-5 ${getThemeClasses(primaryColor, "text")}`}
                  />
                </div>
                <input
                  type="email"
                  className={`w-full pl-10 pr-12 py-3.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-gray-300/60 dark:border-slate-700 shadow-sm
                     focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, "ring")} focus:border-transparent transition-all duration-200`}
                  placeholder={t("login.emailPlaceholder")}
                  {...register("email", { required: t("login.emailRequired") })}
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-xs mt-1 ml-1 font-medium">
                  {String(errors.email.message)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                {t("login.password")}
              </label>

              <div className="relative">
                {/* Ícone lock */}
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Icons.Lock
                    className={`h-5 w-5 ${getThemeClasses(primaryColor, "text")}`}
                  />
                </div>

                {/* Input */}
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("login.passwordPlaceholder")}
                  {...register("password", {
                    required: t("login.passwordRequired"),
                  })}
                  className={`w-full pl-10 pr-12 py-3.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-gray-300/60 dark:border-slate-700 shadow-sm
                     focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, "ring")} focus:border-transparent transition-all duration-200`}
                />

                {/* Toggle show/hide */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? (
                    <Icons.EyeOff className="h-5 w-5" />
                  ) : (
                    <Icons.Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {errors.password && (
                <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                  {String(errors.password.message)}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 ${getPrimaryButtonClass(primaryColor)} text-white font-bold rounded-2xl shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-3 mt-4`}
            >
              {loading ? (
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <Icons.LogIn className="w-5 h-5" />
                </>
              )}
            </button>

            {isDev && (
              <button
                type="button"
                onClick={handleAcessoRapidoDev}
                className="w-full py-3 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl hover:bg-amber-100 transition-colors flex items-center justify-center gap-2 border border-amber-200 dark:border-amber-800/50"
              >
                <Icons.Zap className="w-4 h-4" />
                ACESSO DESENVOLVEDOR
              </button>
            )}
          </form>

          {!temUsuarios && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
              <Link
                to="/setup"
                className={`text-sm font-semibold ${getThemeClasses(primaryColor, "text")} hover:brightness-110 transition-all`}
              >
                Primeira vez?{" "}
                <span className="underline decoration-2 underline-offset-4">
                  Configure o sistema aqui
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">
            © 2025 Gerenciador de Fazendas • Desenvolvido por Ronaldo
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-xs font-medium">
            Versão {import.meta.env?.VITE_APP_VERSION || "1.0.0"}
          </p>
        </div>
      </div>
    </div>
  );
}
