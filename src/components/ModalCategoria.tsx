import { useState } from 'react';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { showToast } from '../utils/toast';
import { registrarAudit } from '../utils/audit';
import { useAuth } from '../hooks/useAuth';

interface ModalCategoriaProps {
  open: boolean;
  onClose: () => void;
  onCategoriaCadastrada: (categoriaId: string, categoriaNome: string) => void;
}

export default function ModalCategoria({ open, onClose, onCategoriaCadastrada }: ModalCategoriaProps) {
  const { user } = useAuth();
  const [nomeCategoria, setNomeCategoria] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCategoria.trim()) return;

    setSalvando(true);
    try {
      const id = uuid();
      const now = new Date().toISOString();
      const novaCategoria = {
        id,
        nome: nomeCategoria.trim(),
        createdAt: now,
        updatedAt: now,
        synced: false,
        remoteId: null
      };
      
      await db.categorias.add(novaCategoria);
      
      // Registrar auditoria
      await registrarAudit({
        entity: 'categoria',
        entityId: id,
        action: 'create',
        before: null,
        after: novaCategoria,
        user: user ? { id: user.id, nome: user.nome } : undefined
      });
      
      onCategoriaCadastrada(id, nomeCategoria.trim());
      setNomeCategoria('');
      onClose();
    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
      showToast({ type: 'error', title: 'Erro ao salvar categoria', message: 'Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-4 sm:p-6">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 break-words">
            Cadastro Rápido de Categoria
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Nome da Categoria *
              </label>
              <input
                type="text"
                value={nomeCategoria}
                onChange={(e) => setNomeCategoria(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Novilha, Vaca, Touro..."
                autoFocus
                disabled={salvando}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={salvando || !nomeCategoria.trim()}
                className="flex-1 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={salvando}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

