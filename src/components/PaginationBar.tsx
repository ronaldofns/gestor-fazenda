import { Icons } from "../utils/iconMapping";

export interface PaginationBarProps {
  page: number;
  setPage: (p: number) => void;
  total: number;
  pageSize: number;
  /** Opções para "Itens por página" (ex.: [10, 20, 50, 100]). */
  pageSizeOptions: number[];
  /** Chamado ao mudar itens por página. */
  setPageSize: (size: number) => void;
  /** Máximo de números de página visíveis (ex.: 5 => 1 2 3 4 5). Default 5. */
  maxVisiblePages?: number;
  /** Classe CSS adicional para o container */
  className?: string;
}

/**
 * Barra de paginação reutilizável: « ‹ 1 2 3 4 › »
 * Use com usePagination ou com page/setPage/total/pageSize.
 */
export default function PaginationBar({
  page,
  setPage,
  total,
  pageSize,
  pageSizeOptions,
  setPageSize,
  maxVisiblePages = 5,
  className = "",
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showNavigation = totalPages > 1;

  if (total === 0 && !showNavigation) return null;

  const half = Math.floor(maxVisiblePages / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(totalPages, start + maxVisiblePages - 1);
  if (end - start + 1 < maxVisiblePages) {
    start = Math.max(1, end - maxVisiblePages + 1);
  }
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  // 1. Removi "border-gray-300" e "dark:border-slate-600" daqui
  const btnBase =
    "min-w-8 h-8 px-2 inline-flex items-center justify-center rounded-md border bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors";

  // 2. Cores da borda para quando NÃO está selecionado
  const inactiveBorder = "border-gray-300 dark:border-slate-600";

  // 3. Estilo para quando ESTÁ selecionado (Borda azul e Texto Bold)
  const activeClass =
    "border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 font-bold ring-1 ring-blue-600";
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 mt-3 ${className}`}
      role="navigation"
      aria-label="Paginação"
    >
      <div className="flex flex-wrap items-center gap-3 min-w-0">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300 shrink-0">
          <span>Itens por página:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value) && value > 0) {
                setPageSize(value);
                setPage(1);
              }
            }}
            // ADICIONADO: h-8 para igualar a altura e py-0 para centralizar o texto
            className="h-8 px-2 text-sm border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            aria-label="Itens por página"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {showNavigation && (
          <span className="text-xs text-gray-600 dark:text-slate-400">
            Página {page} de {totalPages}
            {total > 0 && (
              <span className="ml-1 text-gray-500 dark:text-slate-500">
                ({(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}{" "}
                de {total})
              </span>
            )}
          </span>
        )}
      </div>
      {showNavigation && (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={page === 1}
            className={`${btnBase} ${inactiveBorder}`}
            title="Primeira página"
            aria-label="Primeira página"
          >
            <Icons.ChevronDoubleLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className={`${btnBase} ${inactiveBorder}`}
            title="Página anterior"
            aria-label="Página anterior"
          >
            <Icons.ChevronLeft className="w-4 h-4" />
          </button>
          {pages.map((p) => {
            const isSelected = p === page;

            return (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                // Lógica: se selecionado usa activeClass, se não, usa inactiveBorder
                className={`${btnBase} ${isSelected ? activeClass : inactiveBorder}`}
                aria-current={isSelected ? "page" : undefined}
              >
                {p}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className={`${btnBase} ${inactiveBorder}`}
            title="Próxima página"
            aria-label="Próxima página"
          >
            <Icons.ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            className={`${btnBase} ${inactiveBorder}`}
            title="Última página"
            aria-label="Última página"
          >
            <Icons.ChevronDoubleRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
