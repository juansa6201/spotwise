import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: vi.fn() }))
// El mapa de Google se stubea: no queremos cargar la librería real en jsdom.
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }) => children,
  Map: () => null,
  Marker: () => null,
  InfoWindow: () => null,
  useMap: () => null,
}))

import api from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import AnalysisPage from './AnalysisPage.jsx'

// La geocodificación inversa se controla por test cambiando esta función.
let geocodeImpl = (req, cb) => cb(null, 'ZERO_RESULTS')

const COMPONENTS_AV_COLON = [
  { types: ['route'], long_name: 'Avenida Colón' },
  { types: ['street_number'], long_name: '1000' },
]

const renderPage = () =>
  render(
    <MemoryRouter>
      <AnalysisPage />
    </MemoryRouter>,
  )

// Dispara la selección de una ubicación a través del buscador de direcciones
// (no depende del mapa, que está stubeado).
const seleccionarUbicacion = async () => {
  fireEvent.change(screen.getByPlaceholderText(/Buscar dirección o zona/i), {
    target: { value: 'Av Colón 1000' },
  })
  fireEvent.click(screen.getByRole('button', { name: /Buscar dirección/i }))
  fireEvent.click(await screen.findByText('Av Colón 1000'))
}

describe('AnalysisPage · geocodificación inversa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    geocodeImpl = (req, cb) => cb(null, 'ZERO_RESULTS')
    window.google = {
      maps: {
        Geocoder: class {
          geocode(req, cb) {
            geocodeImpl(req, cb)
          }
        },
        SymbolPath: { CIRCLE: 0 },
      },
    }
    useAuth.mockReturnValue({ isAuthenticated: false })
    api.get.mockImplementation((url) => {
      if (url === '/catalog/geocode/') {
        return Promise.resolve({
          data: { resultados: [{ nombre: 'Av Colón 1000', lat: -31.42, lng: -64.19 }] },
        })
      }
      return Promise.resolve({ data: [] })
    })
    api.post.mockResolvedValue({ data: { dentro_de_cordoba: true, mensaje: 'Ubicación válida' } })
  })

  afterEach(() => {
    delete window.google
  })

  it('muestra la dirección (calle y número) y no las coordenadas', async () => {
    geocodeImpl = (req, cb) => cb([{ address_components: COMPONENTS_AV_COLON }], 'OK')
    renderPage()
    await seleccionarUbicacion()

    expect(await screen.findByText('Ubicación válida')).toBeInTheDocument()
    expect(screen.getByText('Avenida Colón 1000')).toBeInTheDocument()
    // No debe quedar el flash de coordenadas crudas.
    expect(screen.queryByText(/-31\.42000, -64\.19000/)).not.toBeInTheDocument()
  })

  it('mientras geocodifica muestra "Buscando dirección…" en vez de coordenadas', async () => {
    geocodeImpl = () => {} // callback pendiente: simula la geocodificación en curso
    renderPage()
    await seleccionarUbicacion()

    expect(await screen.findByText('Buscando dirección…')).toBeInTheDocument()
    expect(screen.queryByText(/-31\.42000, -64\.19000/)).not.toBeInTheDocument()
  })

  it('cae a las coordenadas si la geocodificación no devuelve resultados', async () => {
    geocodeImpl = (req, cb) => cb(null, 'ZERO_RESULTS')
    renderPage()
    await seleccionarUbicacion()

    expect(await screen.findByText('Ubicación válida')).toBeInTheDocument()
    expect(screen.getByText(/-31\.42000, -64\.19000/)).toBeInTheDocument()
  })

  it('despliega la mini-ventana con datos del barrio del punto', async () => {
    api.post.mockResolvedValue({
      data: {
        dentro_de_cordoba: true,
        mensaje: 'Ubicación válida',
        barrio: {
          nombre: 'GÜEMES', seccional: '10', semaforo: 'AMARILLO',
          indice_socioeconomico: 'Medio', ips: 4,
          cantidad_habitantes: 11588, total_hogares: 5336, densidad_hab_km2: 9799.6,
        },
      },
    })
    renderPage()
    await seleccionarUbicacion()

    expect(await screen.findByText('GÜEMES')).toBeInTheDocument()
    expect(screen.getByText(/Medio · IPS 4\/5/)).toBeInTheDocument()
    expect(screen.getByText(/11\.588/)).toBeInTheDocument() // habitantes con separador es-AR
  })
})
