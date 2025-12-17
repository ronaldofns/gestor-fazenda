import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';

export default function Notificacoes() {
  const notificacoes = useNotifications();

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold">Notificações</h2>
          <p className="text-sm text-gray-600">Pendências detectadas pelo sistema.</p>
        </div>
        <Link
          to="/dashboard"
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          Voltar
        </Link>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-semibold text-gray-900">Desmama atrasada</h3>
            </div>
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">
              {notificacoes.desmamaAtrasada.length} pendência(s)
            </span>
          </div>
          {notificacoes.desmamaAtrasada.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhuma pendência.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {notificacoes.desmamaAtrasada.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded-md border border-amber-100 bg-amber-50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      Matriz {item.matrizId} {item.brinco ? `• Brinco ${item.brinco}` : ''}
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      Fazenda: {item.fazenda} • Nasc.: {item.dataNascimento || '-'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-amber-700 whitespace-nowrap">
                    {item.meses} meses
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900">Mortalidade alta</h3>
            </div>
            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
              {notificacoes.mortalidadeAlta.length} alerta(s)
            </span>
          </div>
          {notificacoes.mortalidadeAlta.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhum alerta.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-auto">
              {notificacoes.mortalidadeAlta.map((item) => (
                <div key={item.fazendaId} className="flex items-center justify-between p-2 rounded-md border border-red-100 bg-red-50">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.fazenda}</p>
                    <p className="text-xs text-gray-600">
                      {item.mortos} mortos de {item.total} nascimentos
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-red-700 whitespace-nowrap">
                    {item.taxa}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

