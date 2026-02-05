import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass, getThemeClasses, getPrimaryBadgeClass } from '../utils/themeHelpers';
import { updateUser, verifyPassword } from '../utils/auth';
import { showToast } from '../utils/toast';
import { Icons } from '../utils/iconMapping';
import { FaSpinner, FaClock, FaSave, FaBuilding } from 'react-icons/fa';
import { db } from '../db/dexieDB';
import { Fazenda } from '../db/models';
import { getPrimaryBgClass } from '../utils/themeHelpers';
import Input from '../components/Input';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  peao: 'Peão',
  visitante: 'Visitante'
};

export default function Perfil() {
  const { user, refreshUser } = useAuth();
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fazenda, setFazenda] = useState<Fazenda | null>(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    senhaAtual: '',
    novaSenha: '',
    confirmarSenha: ''
  });

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        nome: user.nome
      }));

      // Carregar fazenda se houver
      if (user.fazendaId) {
        db.fazendas.get(user.fazendaId).then(f => {
          if (f) setFazenda(f);
        });
      }
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    // Validações
    if (!formData.nome.trim()) {
      showToast({
        type: 'error',
        title: 'Nome obrigatório',
        message: 'O nome não pode estar vazio.'
      });
      return;
    }

    // Se está alterando senha, validar
    if (formData.novaSenha || formData.senhaAtual || formData.confirmarSenha) {
      if (!formData.senhaAtual) {
        showToast({
          type: 'error',
          title: 'Senha atual obrigatória',
          message: 'Informe sua senha atual para alterar a senha.'
        });
        return;
      }

      // Verificar se a senha atual está correta
      if (!verifyPassword(formData.senhaAtual, user.senhaHash)) {
        showToast({
          type: 'error',
          title: 'Senha atual incorreta',
          message: 'A senha atual informada está incorreta.'
        });
        return;
      }

      if (!formData.novaSenha || formData.novaSenha.length < 6) {
        showToast({
          type: 'error',
          title: 'Senha inválida',
          message: 'A nova senha deve ter pelo menos 6 caracteres.'
        });
        return;
      }

      if (formData.novaSenha !== formData.confirmarSenha) {
        showToast({
          type: 'error',
          title: 'Senhas não coincidem',
          message: 'A nova senha e a confirmação devem ser iguais.'
        });
        return;
      }
    }

    setLoading(true);
    try {
      const updateData: any = {
        nome: formData.nome.trim()
      };

      // Se está alterando senha, incluir no update
      if (formData.novaSenha) {
        updateData.senha = formData.novaSenha;
      }

      await updateUser(user.id, updateData);
      
      // Atualizar dados do usuário no contexto
      await refreshUser();

      showToast({
        type: 'success',
        title: 'Perfil atualizado',
        message: 'Suas informações foram atualizadas com sucesso.'
      });

      setEditing(false);
      setFormData(prev => ({
        ...prev,
        senhaAtual: '',
        novaSenha: '',
        confirmarSenha: ''
      }));
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      showToast({
        type: 'error',
        title: 'Erro ao atualizar',
        message: error?.message || 'Não foi possível atualizar o perfil. Tente novamente.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        nome: user.nome,
        senhaAtual: '',
        novaSenha: '',
        confirmarSenha: ''
      });
    }
    setEditing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAvatarColor = (name: string): string => {
    const colors = [
      'bg-green-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-red-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getUserInitials = (name: string): string => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FaSpinner className={`w-8 h-8 animate-spin ${getThemeClasses(primaryColor, 'text')} mx-auto mb-4`} />
          <p className="text-gray-600 dark:text-slate-400">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-2 sm:p-4 md:p-6 lg:p-8 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          Meu Perfil
        </h1>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          Gerencie suas informações pessoais e altere sua senha
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card de Informações do Perfil */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informações Básicas */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Informações Pessoais
              </h2>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                >
                  <Icons.Edit className="w-4 h-4" />
                  Editar
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                {editing ? (
                  <Input
                    label="Nome"
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Seu nome completo"
                  />
                ) : (
                  <>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Nome
                    </label>
                    <p className="text-sm text-gray-900 dark:text-slate-100 py-2">{user.nome}</p>
                  </>
                )}
              </div>

              {/* Email (somente leitura) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <p className="text-sm text-gray-900 dark:text-slate-100 py-2">{user.email}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  O email não pode ser alterado. Entre em contato com o administrador se necessário.
                </p>
              </div>

              {/* Role (somente leitura) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Função
                </label>
                <div className="flex items-center gap-2 py-2">
                  <Icons.Shield className={`w-4 h-4 ${getThemeClasses(primaryColor, 'text')}`} />
                  <span className="text-sm text-gray-900 dark:text-slate-100">
                    {roleLabels[user.role] || user.role}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  A função é gerenciada pelo administrador do sistema.
                </p>
              </div>

              {/* Fazenda (se houver) */}
              {fazenda && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Fazenda Associada
                  </label>
                  <div className="flex items-center gap-2 py-2">
                    <FaBuilding className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                    <span className="text-sm text-gray-900 dark:text-slate-100">{fazenda.nome}</span>
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <div className="flex items-center gap-2 py-2">
                  {user.ativo ? (
                    <>
                      <div className={`w-2 h-2 rounded-full ${getPrimaryBgClass(primaryColor)}`}></div>
                      <span className="text-sm text-gray-900 dark:text-slate-100">Ativo</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="text-sm text-gray-900 dark:text-slate-100">Inativo</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Botões de ação quando editando */}
            {editing && (
              <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className={`px-4 py-2 text-sm font-medium text-white ${getPrimaryButtonClass(primaryColor)} rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                >
                  {loading ? (
                    <>
                      <FaSpinner className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <FaSave className="w-4 h-4" />
                      Salvar
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Alterar Senha */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              Alterar Senha
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              Deixe em branco se não quiser alterar a senha.
            </p>

            <div className="space-y-4">
              <Input
                label="Senha Atual"
                type="password"
                value={formData.senhaAtual}
                onChange={(e) => setFormData(prev => ({ ...prev, senhaAtual: e.target.value }))}
                disabled={!editing}
                placeholder="Digite sua senha atual"
              />

              <Input
                label="Nova Senha"
                type="password"
                value={formData.novaSenha}
                onChange={(e) => setFormData(prev => ({ ...prev, novaSenha: e.target.value }))}
                disabled={!editing}
                placeholder="Mínimo 6 caracteres"
              />

              <Input
                label="Confirmar Nova Senha"
                type="password"
                value={formData.confirmarSenha}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmarSenha: e.target.value }))}
                disabled={!editing}
                placeholder="Confirme a nova senha"
              />
            </div>
          </div>
        </div>

        {/* Card Lateral - Avatar e Informações Adicionais */}
        <div className="space-y-6">
          {/* Avatar Card */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 text-center">
            <div className={`w-24 h-24 rounded-full ${getAvatarColor(user.nome)} flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg`}>
              {getUserInitials(user.nome)}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
              {user.nome}
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
              {user.email}
            </p>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getPrimaryBadgeClass(primaryColor)} text-xs font-medium`}>
              <Icons.Shield className="w-3 h-3" />
              {roleLabels[user.role] || user.role}
            </div>
          </div>

          {/* Informações da Conta */}
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4">
              Informações da Conta
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Conta criada em</p>
                <p className="text-sm text-gray-900 dark:text-slate-100">
                  {formatDate(user.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Última atualização</p>
                <p className="text-sm text-gray-900 dark:text-slate-100">
                  {formatDate(user.updatedAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Sincronização</p>
                <div className="flex items-center gap-2">
                  {user.synced ? (
                    <>
                      <Icons.CheckCircle className={`w-4 h-4 ${getThemeClasses(primaryColor, 'text')}`} />
                      <span className="text-sm text-gray-900 dark:text-slate-100">Sincronizado</span>
                    </>
                  ) : (
                    <>
                      <FaClock className="w-4 h-4 text-amber-500" />
                      <span className="text-sm text-gray-900 dark:text-slate-100">Pendente</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
