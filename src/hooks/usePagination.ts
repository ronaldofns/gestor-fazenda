import { useMemo, useState, useEffect } from "react";

export function usePagination<T>(items: T[], pageSize: number, resetKey?: any) {
  const [page, setPage] = useState(1);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  // Reset quando muda a aba (ou outro resetKey)
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  // Proteção: se apagar itens e a página ficar inválida
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  return {
    page,
    setPage,
    total,
    totalPages,
    paginated,
  };
}
