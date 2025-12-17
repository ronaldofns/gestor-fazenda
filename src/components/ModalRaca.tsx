import React, { useState } from 'react';
import { db } from '../db/dexieDB';
import { uuid } from '../utils/uuid';
import { showToast } from '../utils/toast';

interface ModalRacaProps {
  open: boolean;
  onClose: () => void;
  onRacaCadastrada: (racaNome: string) => void;
}

export default function ModalRaca({ open, onClose, onRacaCadastrada }: ModalRacaProps) {
  const [nomeRaca, setNomeRaca] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeRaca.trim()) return;

    setSalvando(true);
    try {
      const id = uuid();
      const now = new Date().toISOString();
      await db.racas.add({
        id,
        nome: nomeRaca.trim().toUpperCase(),
        createdAt: now,
        updatedAt: now,
        synced: false, // Marcar como não sincronizado
        remoteId: null
      });
      onRacaCadastrada(nomeRaca.trim().toUpperCase());
      setNomeRaca('');
      onClose();
    } catch (error) {
      console.error('Erro ao salvar raça:', error);
      showToast({ type: 'error', title: 'Erro ao salvar raça', message: 'Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 break-words">Cadastro Rápido de Raça</h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Nome da Raça *
              </label>
              <input
                type="text"
                value={nomeRaca}
                onChange={(e) => setNomeRaca(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: ANGUS, NELORE"
                autoFocus
                disabled={salvando}
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={salvando || !nomeRaca.trim()}
                className="flex-1 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={salvando}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
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

