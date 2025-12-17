import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexieDB';
import { lerPlanilha, detectarMapeamento, importarNascimentos, MapeamentoColunas, LinhaImportacao, InfoPlanilha } from '../utils/importPlanilha';
import { showToast } from '../utils/toast';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react';

export default function ImportarPlanilha() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [dados, setDados] = useState<any[]>([]);
  const [colunas, setColunas] = useState<string[]>([]);
  const [mapeamento, setMapeamento] = useState<MapeamentoColunas>({});
  const [fazendaPadraoId, setFazendaPadraoId] = useState<string>('');
  const [preview, setPreview] = useState<any[]>([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ sucesso: number; erros: LinhaImportacao[] } | null>(null);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [infoPlanilha, setInfoPlanilha] = useState<{ fazenda?: string; mes?: number; ano?: number }>({});

  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];
  const fazendas = useMemo(() => {
    return fazendasRaw.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [fazendasRaw]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verificar extensão
    const extensao = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extensao || '')) {
      showToast({ type: 'warning', title: 'Arquivo inválido', message: 'Selecione um Excel (.xlsx, .xls) ou CSV (.csv)' });
      return;
    }

    setArquivo(file);
    setResultado(null);
    setMostrarErros(false);

    try {
      const info = await lerPlanilha(file);
      
      if (info.dados.length === 0) {
        showToast({ type: 'warning', title: 'Planilha vazia', message: 'Nenhum dado encontrado no arquivo.' });
        return;
      }

      // Salvar informações extraídas do cabeçalho
      setInfoPlanilha({
        fazenda: info.fazenda,
        mes: info.mes,
        ano: info.ano
      });

      // Extrair nomes das colunas
      const primeiraLinha = info.dados[0];
      const colunasArquivo = Object.keys(primeiraLinha);
      setColunas(colunasArquivo);

      // Detectar mapeamento automaticamente
      const mapeamentoDetectado = detectarMapeamento(colunasArquivo);
      setMapeamento(mapeamentoDetectado);

      // Se encontrou fazenda no cabeçalho, tentar encontrar no banco
      if (info.fazenda) {
        const fazendaEncontrada = fazendas.find(f => 
          f.nome.toLowerCase().includes(info.fazenda!.toLowerCase()) ||
          info.fazenda!.toLowerCase().includes(f.nome.toLowerCase())
        );
        if (fazendaEncontrada) {
          setFazendaPadraoId(fazendaEncontrada.id);
        }
      }

      // Mostrar preview das primeiras 5 linhas
      setPreview(info.dados.slice(0, 5));
      setDados(info.dados);
    } catch (error) {
      console.error('Erro ao ler planilha:', error);
      showToast({ type: 'error', title: 'Erro ao ler planilha', message: 'Verifique se o arquivo está correto.' });
    }
  };

  const handleImportar = async () => {
    if (dados.length === 0) {
      showToast({ type: 'warning', title: 'Nada para importar', message: 'Nenhum dado carregado.' });
      return;
    }

    // Validar mapeamento mínimo
    if (!mapeamento.matrizId) {
      showToast({ type: 'warning', title: 'Mapeamento incompleto', message: 'Selecione a coluna da Matriz.' });
      return;
    }

    if (!fazendaPadraoId && !mapeamento.fazenda) {
      showToast({ type: 'warning', title: 'Mapeamento incompleto', message: 'Selecione uma Fazenda padrão ou coluna de Fazenda.' });
      return;
    }

    setImportando(true);
    setResultado(null);

    try {
      const resultadoImportacao = await importarNascimentos(
        dados,
        mapeamento,
        fazendaPadraoId || undefined,
        infoPlanilha.mes,
        infoPlanilha.ano
      );

      setResultado(resultadoImportacao);
      
      if (resultadoImportacao.erros.length > 0) {
        setMostrarErros(true);
      }
    } catch (error) {
      console.error('Erro ao importar:', error);
      showToast({ type: 'error', title: 'Erro ao importar', message: 'Verifique o console para mais detalhes.' });
    } finally {
      setImportando(false);
    }
  };

  const camposMapeamento: Array<{ key: keyof MapeamentoColunas; label: string; obrigatorio?: boolean }> = [
    { key: 'matrizId', label: 'Matriz', obrigatorio: true },
    { key: 'fazenda', label: 'Fazenda' },
    { key: 'mes', label: 'Mês' },
    { key: 'ano', label: 'Ano' },
    { key: 'novilha', label: 'Novilha' },
    { key: 'vaca', label: 'Vaca' },
    { key: 'brincoNumero', label: 'Número do Brinco' },
    { key: 'dataNascimento', label: 'Data de Nascimento' },
    { key: 'sexo', label: 'Sexo' },
    { key: 'raca', label: 'Raça' },
    { key: 'obs', label: 'Observações' }
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold">Importar Planilha</h2>
        <button
          onClick={() => navigate('/')}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          Voltar
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg p-4 sm:p-6 space-y-6">
        {/* Upload de Arquivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecione o arquivo (Excel ou CSV)
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <Upload className="w-5 h-5" />
              Selecionar Arquivo
            </button>
            {arquivo && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <span>{arquivo.name}</span>
                <span className="text-gray-500">({dados.length} linhas)</span>
              </div>
            )}
          </div>
        </div>

        {/* Fazenda Padrão */}
        {fazendas.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fazenda Padrão (usada quando não houver coluna de Fazenda ou quando a fazenda não for encontrada)
            </label>
            <select
              value={fazendaPadraoId}
              onChange={(e) => setFazendaPadraoId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione uma fazenda</option>
              {fazendas.map(f => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
        )}

        {/* Mapeamento de Colunas */}
        {colunas.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Mapear Colunas da Planilha
            </h3>
            <div className="space-y-3">
              {camposMapeamento.map(campo => (
                <div key={campo.key} className="flex items-center gap-2">
                  <label className="w-32 text-sm text-gray-700 flex-shrink-0">
                    {campo.label}
                    {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <select
                    value={mapeamento[campo.key] || ''}
                    onChange={(e) => {
                      setMapeamento({
                        ...mapeamento,
                        [campo.key]: e.target.value || undefined
                      });
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">-- Não mapear --</option>
                    {colunas.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Preview (primeiras 5 linhas)
            </h3>
            <div className="overflow-x-auto border border-gray-200 rounded-md">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {colunas.map(col => (
                      <th key={col} className="px-2 py-2 text-left font-medium text-gray-700">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.map((linha, idx) => (
                    <tr key={idx}>
                      {colunas.map(col => (
                        <td key={col} className="px-2 py-2 text-gray-900">
                          {linha[col] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Botão Importar */}
        {dados.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={handleImportar}
              disabled={importando || !mapeamento.matrizId}
              className="px-6 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importando ? 'Importando...' : `Importar ${dados.length} registro(s)`}
            </button>
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div className={`p-4 rounded-lg border ${
            resultado.erros.length === 0 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-start gap-2">
              {resultado.erros.length === 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${
                  resultado.erros.length === 0 ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  Importação concluída!
                </p>
                <p className="text-sm mt-1 text-gray-700">
                  {resultado.sucesso} registro(s) importado(s) com sucesso.
                  {resultado.erros.length > 0 && (
                    <span className="ml-2">
                      {resultado.erros.length} registro(s) com erro.
                    </span>
                  )}
                </p>
                
                {resultado.erros.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => setMostrarErros(!mostrarErros)}
                      className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      {mostrarErros ? 'Ocultar' : 'Mostrar'} erros
                    </button>
                    
                    {mostrarErros && (
                      <div className="mt-2 max-h-60 overflow-y-auto">
                        <table className="min-w-full text-xs border border-gray-200 rounded">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 py-1 text-left">Linha</th>
                              <th className="px-2 py-1 text-left">Erros</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {resultado.erros.map((erro, idx) => (
                              <tr key={idx}>
                                <td className="px-2 py-1 font-medium">{erro.linha}</td>
                                <td className="px-2 py-1">
                                  <ul className="list-disc list-inside">
                                    {erro.erros.map((e, i) => (
                                      <li key={i} className="text-red-600">{e}</li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

