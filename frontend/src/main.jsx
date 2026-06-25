import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import logger from './utils/logger.js'
import './styles/global.css'

// Errores no capturados (fuera de React) y promesas rechazadas sin catch.
window.addEventListener('error', (e) => logger.error('window.onerror:', e.message, e.error))
window.addEventListener('unhandledrejection', (e) => logger.error('unhandledrejection:', e.reason))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
