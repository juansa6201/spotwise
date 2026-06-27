import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// La key se lee al cargar el módulo, así que la stubeamos antes de importarlo.
vi.hoisted(() => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key')
})

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: vi.fn() }))
// El mapa de Google se stubea: no queremos cargar la librería real en jsdom.
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }) => children,
  Map: () => null,
  Marker: () => null,
  InfoWindow: () => null,
}))

import api from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import AnalisisDetailPage from './AnalisisDetailPage.jsx'

const ANALISIS = {
  id: 'abc', nombre_referencia: 'Esquina Güemes', notas: 'Buena zona',
  favorito: true, latitud: -31.42, longitud: -64.19, direccion: 'Avenida Colón 1000',
  score: 72, decision: 'ALTA', decision_display: 'Alta viabilidad',
  rubro_nombre: 'Restaurante', barrio_nombre: 'GUEMES',
  barrio_densidad: 9799, barrio_indice_socioeconomico: 'Alto', barrio_semaforo: 'VERDE',
  guardado_at: '2026-06-19T12:00:00Z',
  indicadores: [
    { tipo: 'poblacional', tipo_display: 'Poblacional', score: 60 },
    { tipo: 'actividad_economica', tipo_display: 'Actividad económica', score: 53 },
    { tipo: 'competencia', tipo_display: 'Competencia', score: 80 },
  ],
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/mis-analisis/abc']}>
      <Routes>
        <Route path="/mis-analisis/:id" element={<AnalisisDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('AnalisisDetailPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra el detalle del análisis', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false })
    api.get.mockResolvedValue({ data: ANALISIS })
    renderPage()
    expect(await screen.findByText('Esquina Güemes')).toBeInTheDocument()
    expect(screen.getByText('Alta viabilidad')).toBeInTheDocument()
    expect(screen.getByText(/Avenida Colón 1000/)).toBeInTheDocument()
    expect(screen.getByText('Competencia del rubro')).toBeInTheDocument()
    expect(screen.getByText('Actividad comercial')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/analysis/guardados/abc/')
  })

  it('muestra la cantidad de competidores guardados', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false })
    api.get.mockResolvedValue({
      data: {
        ...ANALISIS,
        competidores: [
          { nombre: 'Bar Rival', lat: -31.42, lng: -64.19, rating: 4.2, resenas: 120, tipos: ['bar'], competidor: true },
          { nombre: 'Otro Bar', lat: -31.421, lng: -64.191, rating: 3.9, resenas: 40, tipos: ['bar'], competidor: true },
        ],
      },
    })
    renderPage()
    expect(await screen.findByText(/2 competidores/)).toBeInTheDocument()
  })

  it('muestra un mensaje si el análisis no existe', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false })
    api.get.mockRejectedValue({ response: { status: 404 } })
    renderPage()
    expect(await screen.findByText(/No encontramos este análisis/i)).toBeInTheDocument()
  })
})
