/**
 * Visualizador de PDF usando react-pdf.
 * Exibe um PDF a partir de Blob ou URL, com zoom, impressão e download.
 */

import { useState, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Icons } from "../utils/iconMapping";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker do pdf.js (deve estar no mesmo módulo que Document/Page)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.1;
const ZOOM_PRESETS = [
  0.4, 0.5, 0.6, 0.75, 1, 1.15, 1.25, 1.5, 1.75, 2, 2.25, 2.5,
];

export interface PdfViewerProps {
  /** PDF como Blob (ex.: gerado por jsPDF) ou URL string */
  file: Blob | string | null;
  /** Título exibido na barra do visualizador */
  title?: string;
  /** Nome do arquivo sugerido ao baixar */
  downloadFileName?: string;
  /** Largura máxima de cada página em pixels (scale é ajustado automaticamente se width for passado) */
  width?: number;
  /** Callback quando o usuário solicita fechar (ex.: botão Fechar) */
  onClose?: () => void;
  /** Se true, mostra botão de download */
  showDownload?: boolean;
  /** Classe CSS do container */
  className?: string;
}

export default function PdfViewer({
  file,
  title = "Visualização do PDF",
  downloadFileName = "relatorio.pdf",
  width,
  onClose,
  showDownload = true,
  className = "",
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const isBlob = file instanceof Blob;
  const src = isBlob ? blobUrl : typeof file === "string" ? file : null;

  // Criar e revogar object URL quando file for Blob
  useEffect(() => {
    if (!(file instanceof Blob)) {
      setBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Ajuste inicial de zoom por tipo de dispositivo:
  // - Mobile: começa mais afastado para caber melhor na tela.
  // - Desktop: mantém o zoom padrão mais próximo.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window.innerWidth;
    if (w <= 480) {
      setScale(0.4);
    } else if (w <= 768) {
      setScale(0.75);
    } else {
      setScale(1.5);
    }
  }, []);

  const onLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setError(null);
  }, []);

  const onLoadError = useCallback((err: Error) => {
    setError(err?.message ?? "Falha ao carregar o PDF.");
  }, []);

  const handleDownload = useCallback(() => {
    if (!(file instanceof Blob)) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = downloadFileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [file, downloadFileName]);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(ZOOM_MAX, s + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(ZOOM_MIN, s - ZOOM_STEP));
  }, []);

  const handlePrint = useCallback(() => {
    if (!src || !(file instanceof Blob)) return;
    const url = URL.createObjectURL(file);
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(url);
        }, 1000);
      }
    };
  }, [src, file]);

  if (!file) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50 p-8 ${className}`}
      >
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Nenhum PDF para exibir.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4 ${className}`}
      >
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60"
          >
            Fechar
          </button>
        )}
      </div>
    );
  }

  const zoomOptions = Array.from(
    new Set([...ZOOM_PRESETS, scale].sort((a, b) => a - b)),
  );

  return (
    <div
      className={`flex flex-col rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden ${className}`}
    >
      {/* Barra de ferramentas */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/90 flex-shrink-0 flex-wrap">
        <span className="text-sm font-medium text-gray-700 dark:text-slate-200 truncate min-w-0">
          {title}
        </span>

        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {/* Zoom */}
          <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= ZOOM_MIN}
              title="Diminuir zoom"
              className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Icons.Minus className="w-4 h-4" />
            </button>
            <select
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              title="Escala do zoom"
              className="appearance-none bg-transparent px-2 py-1.5 text-sm font-medium text-gray-700 dark:text-slate-200 border-x border-gray-200 dark:border-slate-600 min-w-[4.5rem] cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-none"
            >
              {zoomOptions.map((s) => (
                <option key={s} value={s}>
                  {Math.round(s * 100)}%
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= ZOOM_MAX}
              title="Aumentar zoom"
              className="p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Icons.Plus className="w-4 h-4" />
            </button>
          </div>

          {numPages > 0 && (
            <span className="hidden sm:inline text-xs text-gray-500 dark:text-slate-400 self-center">
              {numPages} pág.
            </span>
          )}

          <div className="h-5 w-px bg-gray-200 dark:bg-slate-600" />

          {/* Imprimir */}
          {file instanceof Blob && (
            <button
              type="button"
              onClick={handlePrint}
              title="Imprimir"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            >
              <Icons.Print className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          )}

          {showDownload && file instanceof Blob && (
            <button
              type="button"
              onClick={handleDownload}
              title="Baixar PDF"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Icons.Download className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Baixar</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Fechar"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            >
              <Icons.X className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Fechar</span>
            </button>
          )}
        </div>
      </div>

      {/* Área de conteúdo: todas as páginas em coluna, com scroll */}
      <div className="flex-1 min-h-0 overflow-auto flex justify-center bg-gray-100 dark:bg-slate-900/30 p-4">
        {src && (
          <Document
            file={src}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            loading={
              <div className="flex items-center justify-center py-12 text-gray-500 dark:text-slate-400">
                Carregando PDF…
              </div>
            }
            error={
              <div className="py-8 text-center text-red-600 dark:text-red-400">
                Erro ao carregar o PDF.
              </div>
            }
          >
            <div className="flex flex-col items-center gap-4">
              {Array.from({ length: numPages }, (_, i) => i + 1).map(
                (pageNum) => (
                  <Page
                    key={pageNum}
                    pageNumber={pageNum}
                    width={width ?? undefined}
                    scale={scale}
                    className="shadow-md"
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                ),
              )}
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}
