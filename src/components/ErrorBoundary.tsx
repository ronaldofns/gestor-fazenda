import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary para capturar erros de reconciliação do React
 * (ex: removeChild - node to be removed is not a child)
 * que podem ser causados por extensões do navegador ou HMR.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou erro:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-[200px] flex flex-col items-center justify-center gap-4 p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-sm text-amber-800 dark:text-amber-200 text-center max-w-md">
            Ocorreu um erro ao atualizar a interface. Extensões do navegador (ex: MetaMask) podem causar isso.
            Tente em janela anônima ou desative extensões.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
