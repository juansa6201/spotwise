import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

describe('MisAnalisisPage · filtros y orden', () => {
  const VARIOS = [
    { ...ANALISIS, id: 'a', nombre_referencia: 'Local centro', score: 72, decision: 'ALTA',
      rubro_nombre: 'Restaurante', barrio_nombre: 'GUEMES', favorito: false,
      guardado_at: '2026-06-19T12:00:00Z', decision_display: 'Alta' },
    { ...ANALISIS, id: 'b', nombre_referencia: 'Kiosco norte', score: 40, decision: 'MEDIA',
      rubro_nombre: 'Kiosco', barrio_nombre: 'ALBERDI', favorito: true,
      guardado_at: '2026-06-22T12:00:00Z', decision_display: 'Media' },
    { ...ANALISIS, id: 'c', nombre_referencia: 'Bar sur', score: 85, decision: 'ALTA',
      rubro_nombre: 'Restaurante', barrio_nombre: 'GUEMES', favorito: false,
      guardado_at: '2026-06-10T12:00:00Z', decision_display: 'Alta' },
  ]

  const titulos = () =>
    screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

  beforeEach(() => {
    vi.clearAllMocks()
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false })
    api.get.mockResolvedValue({ data: VARIOS })
  })

  it('ordena por fecha descendente por defecto', async () => {
    renderPage()
    await screen.findByText('Local centro')
    expect(titulos()).toEqual(['Kiosco norte', 'Local centro', 'Bar sur'])
  })

  it('filtra por viabilidad', async () => {
    renderPage()
    await screen.findByText('Local centro')
    fireEvent.change(screen.getByLabelText('Viabilidad'), { target: { value: 'MEDIA' } })
    expect(titulos()).toEqual(['Kiosco norte'])
  })

  it('filtra por rubro', async () => {
    renderPage()
    await screen.findByText('Local centro')
    fireEvent.change(screen.getByLabelText('Rubro'), { target: { value: 'Restaurante' } })
    expect(titulos()).toEqual(['Local centro', 'Bar sur'])
  })

  it('filtra solo favoritos', async () => {
    renderPage()
    await screen.findByText('Local centro')
    fireEvent.click(screen.getByRole('button', { name: /Favoritos/ }))
    expect(titulos()).toEqual(['Kiosco norte'])
  })

  it('ordena por score descendente', async () => {
    renderPage()
    await screen.findByText('Local centro')
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'score_desc' } })
    expect(titulos()).toEqual(['Bar sur', 'Local centro', 'Kiosco norte'])
  })

  it('limpia los filtros', async () => {
    renderPage()
    await screen.findByText('Local centro')
    fireEvent.change(screen.getByLabelText('Viabilidad'), { target: { value: 'MEDIA' } })
    expect(titulos()).toEqual(['Kiosco norte'])
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
    expect(titulos()).toEqual(['Kiosco norte', 'Local centro', 'Bar sur'])
  })
})
