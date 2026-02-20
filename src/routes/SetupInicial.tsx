import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { createUser } from "../utils/auth";
import { Icons } from "../utils/iconMapping";
import { db } from "../db/dexieDB";
import { showToast } from "../utils/toast";
import { useAppSettings } from "../hooks/useAppSettings";
import { ColorPaletteKey } from "../hooks/useThemeColors";
import { getThemeClasses, getPrimaryButtonClass } from "../utils/themeHelpers";
import { msg } from "../utils/validationMessages";

const schema = z
  .object({
    nome: z.string().min(1, msg.obrigatorio),
    email: z.string().min(1, msg.obrigatorio).email(msg.emailInvalido),
    senha: z.string().min(6, msg.senhaMinima),
    confirmarSenha: z.string().min(1, msg.confirmeSenha),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: msg.senhasNaoCoincidem,
    path: ["confirmarSenha"],
  });

type FormData = z.infer<typeof schema>;

export default function SetupInicial() {
  const navigate = useNavigate();
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;
  const [loading, setLoading] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [temUsuarios, setTemUsuarios] = useState(false);

  useEffect(() => {
    const verificarUsuarios = async () => {
      try {
        // Primeiro, verificar se há usuários locais
        let usuarios = await db.usuarios.toArray();

        // Sempre sincronizar usuários do Supabase primeiro para garantir dados atualizados
        setSincronizando(true);
        try {
          // Fazer pull apenas de usuários do Supabase (mais rápido)
          const { pullUsuarios } = await import("../api/syncService");
          await pullUsuarios();
          // Verificar novamente após sincronização
          usuarios = await db.usuarios.toArray();
        } catch (syncError) {
          console.error("Erro ao sincronizar usuários:", syncError);
          // Continuar mesmo se a sincronização falhar (pode estar offline)
        } finally {
          setSincronizando(false);
        }

        // Verificar se há pelo menos um usuário ADMIN
        // Log para debug
        console.log(
          "[SetupInicial] Total de usuários encontrados:",
          usuarios.length,
        );
        if (usuarios.length > 0) {
          console.log(
            "[SetupInicial] Detalhes dos usuários:",
            usuarios.map((u) => ({
              id: u.id,
              nome: u.nome,
              email: u.email,
              role: u.role,
              roleType: typeof u.role,
              ativo: u.ativo,
              ativoType: typeof u.ativo,
            })),
          );
        }

        // Verificar se há admin (ativo pode ser undefined/null, então verificar explicitamente)
        // Normalizar role para lowercase para comparação
        const temAdmin = usuarios.some((u) => {
          const roleNormalizado = String(u.role || "")
            .toLowerCase()
            .trim();
          const isAdmin = roleNormalizado === "admin";
          // Se ativo não está definido ou é null, assume que está ativo (comportamento padrão)
          const isAtivo = u.ativo !== false; // true, undefined, null = ativo

          const resultado = isAdmin && isAtivo;
          if (isAdmin) {
            console.log(
              `[SetupInicial] Usuário admin encontrado: ${u.nome} (${u.email}), role: "${u.role}", ativo: ${u.ativo}, resultado: ${resultado}`,
            );
          }
          return resultado;
        });

        console.log("[SetupInicial] Tem admin?", temAdmin);

        if (temAdmin) {
          console.log(
            "[SetupInicial] Admin encontrado! Redirecionando para login...",
          );
          setTemUsuarios(true);
          // Se já tem admin, redirecionar para login imediatamente (sem setTimeout)
          // Usar replace para não deixar histórico
          navigate("/login", { replace: true });
          return; // Sair da função para evitar processamento adicional
        } else {
          console.log(
            "[SetupInicial] Nenhum admin encontrado. Mostrando tela de setup.",
          );
          setTemUsuarios(false);
        }
      } catch (error) {
        console.error("Erro ao verificar usuários:", error);
      } finally {
        setVerificando(false);
      }
    };

    verificarUsuarios();
  }, [navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      // Criar primeiro usuário como admin
      await createUser({
        nome: data.nome,
        email: data.email,
        senha: data.senha,
        role: "admin", // Primeiro usuário sempre é admin
      });

      showToast({
        type: "success",
        title: "Administrador criado",
        message: "Redirecionando para login...",
      });
      navigate("/login");
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error);
      showToast({
        type: "error",
        title: "Erro ao criar usuário",
        message: error?.message || "Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (verificando) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${getThemeClasses(primaryColor, "gradient-from")} via-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-900`}
      >
        <div className="text-center">
          <div
            className={`w-12 h-12 border-4 ${getThemeClasses(primaryColor, "border")} border-t-transparent rounded-full animate-spin mx-auto mb-4`}
          ></div>
          <div className="text-gray-500 dark:text-slate-400">
            {sincronizando ? "Sincronizando usuários..." : "Verificando..."}
          </div>
          {sincronizando && (
            <div
              className={`mt-4 flex items-center justify-center gap-2 text-sm ${getThemeClasses(primaryColor, "text")}`}
            >
              <Icons.RefreshCw className="w-4 h-4 animate-spin" />
              <span>Buscando usuários do servidor</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (temUsuarios) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${getThemeClasses(primaryColor, "gradient-from")} via-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-900`}
      >
        <div className="text-center">
          <div
            className={`w-16 h-16 ${getThemeClasses(primaryColor, "bg-light")} rounded-full flex items-center justify-center mx-auto mb-4`}
          >
            <Icons.LogIn
              className={`w-8 h-8 ${getThemeClasses(primaryColor, "text")}`}
            />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
            Sistema já configurado
          </h2>
          <p className="text-gray-600 dark:text-slate-400 mb-4">
            Redirecionando para login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${getThemeClasses(primaryColor, "gradient-from")} via-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 px-4`}
    >
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br ${getThemeClasses(primaryColor, "gradient-to")} rounded-2xl shadow-lg mb-4`}
          >
            <Icons.UserPlus className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            Configuração Inicial
          </h1>
          <p className="text-gray-600 dark:text-slate-400">
            Crie o primeiro usuário administrador
          </p>
        </div>

        {/* Card de Cadastro */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-slate-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6 text-center">
            Criar Administrador
          </h2>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                Nome *
              </label>
              <input
                type="text"
                className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, "ring")} ${getThemeClasses(primaryColor, "border")} transition-colors`}
                placeholder="Seu nome completo"
                {...register("nome")}
              />
              {errors.nome && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.nome.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                Email *
              </label>
              <input
                type="email"
                className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, "ring")} ${getThemeClasses(primaryColor, "border")} transition-colors`}
                placeholder="seu@email.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                Senha *
              </label>
              <input
                type="password"
                className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, "ring")} ${getThemeClasses(primaryColor, "border")} transition-colors`}
                placeholder="Mínimo 6 caracteres"
                {...register("senha")}
              />
              {errors.senha && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.senha.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                Confirmar Senha *
              </label>
              <input
                type="password"
                className={`w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg shadow-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, "ring")} ${getThemeClasses(primaryColor, "border")} transition-colors`}
                placeholder="Digite a senha novamente"
                {...register("confirmarSenha")}
              />
              {errors.confirmarSenha && (
                <p className="text-red-600 text-sm mt-1">
                  {errors.confirmarSenha.message}
                </p>
              )}
            </div>

            <div
              className={`p-3 ${getThemeClasses(primaryColor, "bg-light")} border-l-4 ${getThemeClasses(primaryColor, "border")} rounded-md`}
            >
              <p className={`${getThemeClasses(primaryColor, "text")} text-sm`}>
                <strong>Nota:</strong> Este será o primeiro usuário do sistema e
                terá permissões de administrador.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full px-4 py-3 ${getPrimaryButtonClass(primaryColor)} text-white font-semibold rounded-lg focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, "ring")} focus:ring-offset-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <Icons.UserPlus className="w-5 h-5" />
                  <span>Criar Administrador</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 dark:text-slate-400 text-sm mt-6">
          © 2024 Gestor Fazenda. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
