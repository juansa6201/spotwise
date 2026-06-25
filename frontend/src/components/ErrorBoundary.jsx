import { Component } from 'react'
import logger from '../utils/logger.js'

// Captura errores de render de React y muestra un fallback en vez de la pantalla
// en blanco, dejando el detalle en la consola (logger).
export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    logger.error('Error de render:', error, info?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="placeholder">
          <h2>Algo salió mal</h2>
          <p>Ocurrió un error inesperado. Probá recargar la página.</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
