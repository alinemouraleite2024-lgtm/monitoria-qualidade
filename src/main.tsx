import { StrictMode, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

interface ErrorBoundaryProps { children?: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red', fontFamily: 'sans-serif' }}>
          <h2>Oops! Algo deu errado na aplicação.</h2>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', background: '#ffebeb', padding: '1rem' }}>
            <summary>Ver Detalhes do Erro (Para Suporte)</summary>
            <br />
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* F0-13: roteamento real. O rewrite SPA da Vercel (vercel.json) é o que permite
          abrir uma rota profunda direto na barra de endereços sem 404 do servidor. */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
