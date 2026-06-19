import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// El cliente API y el contexto de auth se mockean para aislar la página.
vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: vi.fn() }))

import api from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import MisAnalisisPage from './MisAnalisisPage.jsx'

const ANALISIS = {
  id: '1', nombre_referencia: 'Local centro', notas: '', favorito: false,
  score: 72, decision: 'ALTA', decision_display: 'Alta viabilidad',
  rubro_nombre: 'Restaurante', barrio_nombre: 'GUEMES',
  guardado_at: '2026-06-19T12:00:00Z', indicadores: [],
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <MisAnalisisPage />
    </MemoryRouter>,
  )

describe('MisAnalisisPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pide iniciar sesión cuando no hay sesión', () => {
    useAuth.mockReturnValue({ isAuthenticated: false, loading: false })
    renderPage()
    expect(screen.getByText(/Iniciá sesión/i)).toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('lista los análisis guardados del usuario', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false })
    api.get.mockResolvedValue({ data: [ANALISIS] })
    renderPage()
    expect(await screen.findByText('Local centro')).toBeInTheDocument()
    expect(screen.getByText('Alta viabilidad')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/analysis/guardados/')
  })

  it('muestra el estado vacío cuando no hay análisis', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false })
    api.get.mockResolvedValue({ data: [] })
    renderPage()
    expect(await screen.findByText(/Todavía no guardaste análisis/i)).toBeInTheDocument()
  })
})
