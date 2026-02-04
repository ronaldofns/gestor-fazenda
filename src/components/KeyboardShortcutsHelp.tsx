import { useState } from 'react';
import { Icons } from '../utils/iconMapping';
import { useKeyboardShortcut, formatShortcut, KeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { useAppSettings } from '../hooks/useAppSettings';
import { ColorPaletteKey } from '../hooks/useThemeColors';
import { getPrimaryButtonClass } from '../utils/themeHelpers';
import Modal from './Modal';

interface ShortcutGroup {
  category: string;
  icon: React.ReactNode;
  shortcuts: Array<{
    keys: {
      key: string;
      ctrl?: boolean;
      shift?: boolean;
      alt?: boolean;
    };
    description: string;
  }>;
}

const SHORTCUTS: ShortcutGroup[] = [
  {
    category: 'Navegação',
    icon: <Icons.Navigation className="w-5 h-5" />,
    shortcuts: [
      { keys: { key: 'd', ctrl: true }, description: 'Ir para Dashboard' },
      { keys: { key: 'h', ctrl: true }, description: 'Ir para Animais' },
      { keys: { key: 'm', ctrl: true }, description: 'Ir para Animais' },
      { keys: { key: 'f', ctrl: true }, description: 'Ir para Fazendas' },
      { keys: { key: 'u', ctrl: true }, description: 'Ir para Usuários' },
    ],
  },
  {
    category: 'Ações',
    icon: <Icons.Zap className="w-5 h-5" />,
    shortcuts: [
      { keys: { key: 'n', ctrl: true }, description: 'Notificações' },
      { keys: { key: 's', ctrl: true }, description: 'Sincronizar' },
      { keys: { key: 'p', ctrl: true }, description: 'Ver Perfil' },
      { keys: { key: 'k', ctrl: true }, description: 'Busca Rápida (em breve)' },
    ],
  },
  {
    category: 'Interface',
    icon: <Icons.Monitor className="w-5 h-5" />,
    shortcuts: [
      { keys: { key: '?', shift: true }, description: 'Mostrar/Ocultar Atalhos' },
      { keys: { key: 't', ctrl: true, shift: true }, description: 'Alternar Tema (Claro/Escuro)' },
      { keys: { key: 'b', ctrl: true }, description: 'Recolher/Expandir Sidebar' },
      { keys: { key: 'Escape' }, description: 'Fechar Modal/Diálogo' },
    ],
  },
  {
    category: 'Sistema',
    icon: <Icons.Settings className="w-5 h-5" />,
    shortcuts: [
      { keys: { key: ',', ctrl: true }, description: 'Configurações' },
      { keys: { key: 'e', ctrl: true }, description: 'Exportar Backup' },
      { keys: { key: 'i', ctrl: true }, description: 'Importar Backup' },
    ],
  },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || 'gray') as ColorPaletteKey;

  // Atalho para abrir/fechar o modal de ajuda
  useKeyboardShortcut({
    key: '?',
    shift: true,
    action: () => setOpen(!open),
  });

  return (
    <>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Atalhos de Teclado"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Use esses atalhos para navegar e executar ações rapidamente no sistema.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SHORTCUTS.map((group) => (
              <div
                key={group.category}
                className="bg-gray-50 dark:bg-slate-800/50 rounded-lg p-4 border border-gray-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="text-gray-700 dark:text-slate-300">
                    {group.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {group.category}
                  </h3>
                </div>

                <div className="space-y-3">
                  {group.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-sm text-gray-700 dark:text-slate-300 flex-1">
                        {shortcut.description}
                      </span>
                      <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded shadow-sm whitespace-nowrap">
                        {formatShortcut(shortcut.keys)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <Icons.Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <strong>Dica:</strong> Pressione <kbd className="px-1.5 py-0.5 mx-1 text-xs font-mono bg-white dark:bg-blue-950 border border-blue-300 dark:border-blue-700 rounded">Shift + ?</kbd> 
              a qualquer momento para ver esta lista de atalhos.
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setOpen(false)}
            className={`px-4 py-2 ${getPrimaryButtonClass(primaryColor)} text-white rounded-lg font-medium transition-colors`}
          >
            Entendi
          </button>
        </div>
      </Modal>

      {/* Botão flutuante de ajuda */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-30 p-3 bg-gray-800 dark:bg-slate-700 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all group"
        title="Atalhos de Teclado (Shift + ?)"
        aria-label="Mostrar atalhos de teclado"
      >
        <Icons.Keyboard className="w-5 h-5" />
        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Shift + ?
        </span>
      </button>
    </>
  );
}
