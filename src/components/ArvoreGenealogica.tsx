import { useState, useMemo, useEffect, JSX } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexieDB";
import { Matriz } from "../db/models";
import Modal from "./Modal";
import { Icons } from "../utils/iconMapping";
import { useAppSettings } from "../hooks/useAppSettings";
import { ColorPaletteKey } from "../hooks/useThemeColors";
import { getThemeClasses } from "../utils/themeHelpers";

interface NodeData {
  id: string;
  identificador: string;
  raca?: string;
  dataNascimento?: string;
  fazendaId: string;
  fazendaNome: string;
  pai?: string;
  mae?: string;
  nivel: number; // Nível na árvore (0 = raiz, 1 = pais, 2 = avós, etc.)
  lado: "pai" | "mae" | "raiz"; // Lado da árvore
}

interface TreeNode extends NodeData {
  paiNode?: TreeNode;
  maeNode?: TreeNode;
  filhos: TreeNode[];
}

interface ArvoreGenealogicaProps {
  open: boolean;
  matrizId: string;
  onClose: () => void;
  onMatrizSelecionada?: (matrizId: string) => void; // Callback para quando uma matriz é selecionada na busca
}

export default function ArvoreGenealogica({
  open,
  matrizId,
  onClose,
  onMatrizSelecionada,
}: ArvoreGenealogicaProps) {
  const { appSettings } = useAppSettings();
  const primaryColor = (appSettings.primaryColor || "gray") as ColorPaletteKey;
  const [buscaLinhagem, setBuscaLinhagem] = useState("");
  const [niveisExpandidos, setNiveisExpandidos] = useState<Set<number>>(
    new Set([0, 1, 2]),
  );
  const [matrizes, setMatrizes] = useState<Matriz[]>([]);
  const [fazendas, setFazendas] = useState<Array<{ id: string; nome: string }>>(
    [],
  );

  const matrizesRaw = useLiveQuery(() => db.matrizes.toArray(), []) || [];
  const fazendasRaw = useLiveQuery(() => db.fazendas.toArray(), []) || [];

  useEffect(() => {
    setMatrizes(matrizesRaw);
    setFazendas(fazendasRaw.map((f) => ({ id: f.id, nome: f.nome || "" })));
  }, [matrizesRaw, fazendasRaw]);

  const fazendaMap = useMemo(() => {
    const map = new Map<string, string>();
    fazendas.forEach((f) => map.set(f.id, f.nome));
    return map;
  }, [fazendas]);

  const matrizMap = useMemo(() => {
    const mapById = new Map<string, Matriz>();
    const mapByIdentificador = new Map<string, Matriz[]>();

    matrizes.forEach((m) => {
      if (m.id) {
        mapById.set(m.id, m);
      }
      if (m.identificador) {
        // Normalizar identificador: remover espaços e converter para minúsculas
        const key = m.identificador.trim().toLowerCase();
        if (!mapByIdentificador.has(key)) {
          mapByIdentificador.set(key, []);
        }
        mapByIdentificador.get(key)!.push(m);
      }
    });

    return { byId: mapById, byIdentificador: mapByIdentificador };
  }, [matrizes]);

  // Buscar matriz por identificador (pode ter múltiplas em fazendas diferentes)
  const buscarMatrizPorIdentificador = (
    identificador: string,
    fazendaId?: string,
  ): Matriz | null => {
    if (!identificador) return null;

    // Normalizar identificador: remover espaços e converter para minúsculas
    const identificadorNormalizado = identificador.trim().toLowerCase();

    // Primeiro, tentar busca exata
    const matrizesEncontradas =
      matrizMap.byIdentificador.get(identificadorNormalizado) || [];

    if (matrizesEncontradas.length > 0) {
      // Se tem fazendaId, priorizar matriz da mesma fazenda
      if (fazendaId) {
        const mesmaFazenda = matrizesEncontradas.find(
          (m) => m.fazendaId === fazendaId,
        );
        if (mesmaFazenda) return mesmaFazenda;
      }
      // Retornar a primeira encontrada
      return matrizesEncontradas[0];
    }

    // Se não encontrou com busca exata, tentar busca parcial (caso tenha espaços ou formatação diferente)
    for (const [, matrizesList] of matrizMap.byIdentificador.entries()) {
      for (const matriz of matrizesList) {
        const matrizIdentificadorNormalizado =
          matriz.identificador?.trim().toLowerCase() || "";
        if (matrizIdentificadorNormalizado === identificadorNormalizado) {
          // Se tem fazendaId, verificar se é da mesma fazenda
          if (fazendaId && matriz.fazendaId === fazendaId) {
            return matriz;
          }
          // Se não tem fazendaId ou não encontrou da mesma fazenda, retornar a primeira
          if (!fazendaId) {
            return matriz;
          }
        }
      }
    }

    return null;
  };

  // Construir árvore recursivamente
  const construirArvore = (
    matriz: Matriz,
    nivel: number = 0,
    lado: "pai" | "mae" | "raiz" = "raiz",
    visitados: Set<string> = new Set(),
  ): TreeNode | null => {
    if (!matriz || !matriz.id) return null;

    // Prevenir loops infinitos
    const chave = `${matriz.id}-${nivel}`;
    if (visitados.has(chave)) return null;
    visitados.add(chave);

    const fazendaNome = fazendaMap.get(matriz.fazendaId) || "Sem fazenda";

    const node: TreeNode = {
      id: matriz.id,
      identificador: matriz.identificador,
      raca: matriz.raca,
      dataNascimento: matriz.dataNascimento,
      fazendaId: matriz.fazendaId,
      fazendaNome,
      pai: matriz.pai,
      mae: matriz.mae,
      nivel,
      lado,
      filhos: [],
    };

    // Buscar pai
    if (matriz.pai && matriz.pai.trim() && nivel < 5) {
      // Limitar a 5 níveis
      const pai = buscarMatrizPorIdentificador(
        matriz.pai.trim(),
        matriz.fazendaId,
      );
      if (pai) {
        const paiNode = construirArvore(
          pai,
          nivel + 1,
          "pai",
          new Set(visitados),
        );
        if (paiNode) {
          node.paiNode = paiNode;
          node.filhos.push(paiNode);
        }
      } else {
        // Debug: log quando não encontra o pai
        console.log("[ArvoreGenealogica] Pai não encontrado:", {
          identificadorPai: matriz.pai,
          matrizAtual: matriz.identificador,
          matrizesDisponiveis: Array.from(
            matrizMap.byIdentificador.keys(),
          ).slice(0, 10),
        });
      }
    }

    // Buscar mãe
    if (matriz.mae && matriz.mae.trim() && nivel < 5) {
      const mae = buscarMatrizPorIdentificador(
        matriz.mae.trim(),
        matriz.fazendaId,
      );
      if (mae) {
        const maeNode = construirArvore(
          mae,
          nivel + 1,
          "mae",
          new Set(visitados),
        );
        if (maeNode) {
          node.maeNode = maeNode;
          node.filhos.push(maeNode);
        }
      } else {
        // Debug: log quando não encontra a mãe
        console.log("[ArvoreGenealogica] Mãe não encontrada:", {
          identificadorMae: matriz.mae,
          matrizAtual: matriz.identificador,
          matrizesDisponiveis: Array.from(
            matrizMap.byIdentificador.keys(),
          ).slice(0, 10),
        });
      }
    }

    return node;
  };

  // Buscar matriz raiz
  const matrizRaiz = useMemo(() => {
    return matrizes.find((m) => m.id === matrizId);
  }, [matrizes, matrizId]);

  // Construir árvore completa
  const arvore = useMemo(() => {
    if (!matrizRaiz) return null;

    // Debug: verificar dados da matriz raiz
    console.log("[ArvoreGenealogica] Construindo árvore para:", {
      matrizId: matrizRaiz.id,
      identificador: matrizRaiz.identificador,
      pai: matrizRaiz.pai,
      mae: matrizRaiz.mae,
      totalMatrizes: matrizes.length,
      totalNoMapa: matrizMap.byIdentificador.size,
    });

    return construirArvore(matrizRaiz);
  }, [matrizRaiz, matrizes, fazendaMap, matrizMap]);

  // Buscar por linhagem
  const resultadosBusca = useMemo(() => {
    if (!buscaLinhagem.trim()) return [];

    const termo = buscaLinhagem.toLowerCase().trim();
    return matrizes.filter((m) => {
      const identificador = m.identificador?.toLowerCase() || "";
      const raca = m.raca?.toLowerCase() || "";
      const fazenda = fazendaMap.get(m.fazendaId)?.toLowerCase() || "";

      return (
        identificador.includes(termo) ||
        raca.includes(termo) ||
        fazenda.includes(termo)
      );
    });
  }, [buscaLinhagem, matrizes, fazendaMap]);

  const toggleNivel = (nivel: number) => {
    setNiveisExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(nivel)) {
        novo.delete(nivel);
      } else {
        novo.add(nivel);
      }
      return novo;
    });
  };

  const renderNode = (
    node: TreeNode,
    isRoot: boolean = false,
  ): JSX.Element | null => {
    if (!node) return null;

    // Verificar se o nível dos filhos (próximo nível) está expandido
    const nivelFilhos = node.nivel + 1;
    const isExpanded = niveisExpandidos.has(nivelFilhos);
    const temAncestrais = node.paiNode || node.maeNode;
    const temPaiMaeCadastrados =
      (node.pai && node.pai.trim()) || (node.mae && node.mae.trim());
    const corLado =
      node.lado === "pai"
        ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700"
        : node.lado === "mae"
          ? "border-pink-300 bg-pink-50 dark:bg-pink-900/20 dark:border-pink-700"
          : "border-gray-300 bg-gray-50 dark:bg-gray-800 dark:border-gray-600";

    return (
      <div
        key={node.id}
        className={`flex flex-col items-center ${isRoot ? "mb-8" : "mb-4"}`}
      >
        <div
          className={`relative p-4 rounded-lg border-2 ${corLado} min-w-[200px] max-w-[250px] shadow-sm`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {node.lado === "pai" && (
                <Icons.Mars className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
              {node.lado === "mae" && (
                <Icons.Venus className="w-4 h-4 text-pink-600 dark:text-pink-400" />
              )}
              {node.lado === "raiz" && (
                <Icons.Cow className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              )}
              <span className="font-bold text-sm text-gray-900 dark:text-slate-100">
                {node.identificador}
              </span>
            </div>
            {isRoot && (
              <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                Raiz
              </span>
            )}
          </div>

          {node.raca && (
            <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">
              Raça: {node.raca}
            </div>
          )}

          {node.dataNascimento && (
            <div className="text-xs text-gray-600 dark:text-slate-400 mb-1">
              Nasc: {node.dataNascimento}
            </div>
          )}

          <div className="text-xs text-gray-500 dark:text-slate-500">
            {node.fazendaNome}
          </div>

          {temAncestrais && (
            <button
              onClick={() => toggleNivel(nivelFilhos)}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  <Icons.ChevronDown className="w-3 h-3 rotate-180" />
                  Ocultar ancestrais
                </>
              ) : (
                <>
                  <Icons.ChevronDown className="w-3 h-3" />
                  Mostrar ancestrais
                </>
              )}
            </button>
          )}

          {!temAncestrais && temPaiMaeCadastrados && (
            <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
              <p className="font-medium">Ancestrais não encontrados</p>
              <p className="text-xs mt-1">
                {node.pai && node.pai.trim() && `Pai: ${node.pai}`}
                {node.pai &&
                  node.pai.trim() &&
                  node.mae &&
                  node.mae.trim() &&
                  " | "}
                {node.mae && node.mae.trim() && `Mãe: ${node.mae}`}
              </p>
              <p className="text-xs mt-1 opacity-75">
                Cadastre essas matrizes para visualizar a árvore completa.
              </p>
            </div>
          )}
        </div>

        {temAncestrais && niveisExpandidos.has(nivelFilhos) && (
          <div className="flex gap-8 mt-4">
            {node.paiNode && (
              <div className="flex flex-col items-center">
                <div className="text-xs text-blue-600 dark:text-blue-400 mb-2 font-medium">
                  Pai
                </div>
                {renderNode(node.paiNode)}
              </div>
            )}
            {node.maeNode && (
              <div className="flex flex-col items-center">
                <div className="text-xs text-pink-600 dark:text-pink-400 mb-2 font-medium">
                  Mãe
                </div>
                {renderNode(node.maeNode)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icons.Cow className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Árvore Genealógica
              </h2>
              {matrizRaiz && (
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Matriz: {matrizRaiz.identificador}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Busca por linhagem */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Icons.Info className="w-5 h-5 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              value={buscaLinhagem}
              onChange={(e) => setBuscaLinhagem(e.target.value)}
              placeholder="Buscar por identificador, raça ou fazenda..."
              className={`flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-md shadow-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${getThemeClasses(primaryColor, "ring")} ${getThemeClasses(primaryColor, "border")}`}
            />
          </div>

          {resultadosBusca.length > 0 && (
            <div
              className={`mt-3 p-3 ${getThemeClasses(primaryColor, "bg-light")} border ${getThemeClasses(primaryColor, "border-light")} rounded-md`}
            >
              <p
                className={`text-sm font-medium ${getThemeClasses(primaryColor, "text")} mb-2`}
              >
                Resultados da busca ({resultadosBusca.length}):
              </p>
              <div className="flex flex-wrap gap-2">
                {resultadosBusca.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (onMatrizSelecionada) {
                        onMatrizSelecionada(m.id);
                        setBuscaLinhagem("");
                      } else {
                        // Se não há callback, apenas limpar a busca
                        setBuscaLinhagem("");
                      }
                    }}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${getThemeClasses(primaryColor, "bg-light")} ${getThemeClasses(primaryColor, "text")} hover:opacity-90`}
                    title={`Clique para ver árvore de ${m.identificador}`}
                  >
                    {m.identificador} {m.raca && `(${m.raca})`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Árvore */}
        <div className="flex-1 overflow-auto p-6">
          {!matrizRaiz ? (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
              <Icons.Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Matriz não encontrada</p>
            </div>
          ) : !arvore ? (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
              <Icons.Cow className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum dado de linhagem disponível</p>
              <p className="text-sm mt-2">
                Cadastre os dados de pai e mãe na matriz para visualizar a
                árvore genealógica.
              </p>
            </div>
          ) : (
            <div className="flex justify-center">
              {renderNode(arvore, true)}
            </div>
          )}
        </div>

        {/* Footer com informações */}
        <div className="border-t border-gray-200 dark:border-slate-700 px-6 py-3 bg-gray-50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-400">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-200 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700"></div>
                <span>Linhagem paterna</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-pink-200 dark:bg-pink-900/40 border border-pink-300 dark:border-pink-700"></div>
                <span>Linhagem materna</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const todosNiveis = new Set(
                    Array.from({ length: 6 }, (_, i) => i),
                  );
                  setNiveisExpandidos(todosNiveis);
                }}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Expandir todos
              </button>
              <button
                onClick={() => {
                  setNiveisExpandidos(new Set([0])); // Apenas nível 0 (raiz)
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300"
              >
                Colapsar todos
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
