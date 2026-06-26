import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/client.js', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: vi.fn() }))

// Librería de Google Places falsa. Las implementaciones de los spies se setean
// en beforeEach para poder sobreescribirlas por test.
const gmaps = vi.hoisted(() => {
  const getPlacePredictions = vi.fn()
  const getDetails = vi.fn()
  const placesLib = {
    AutocompleteService: class { getPlacePredictions(req, cb) { return getPlacePredictions(req, cb) } },
    PlacesService: class { getDetails(req, cb) { return getDetails(req, cb) } },
    AutocompleteSessionToken: class {},
    PlacesServiceStatus: { OK: 'OK' },
  }
  return { getPlacePredictions, getDetails, placesLib }
})

// El mapa de Google se stubea: no queremos cargar la librería real en jsdom.
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }) => children,
  Map: () => null,
  Marker: () => null,
  InfoWindow: () => null,
  useMap: () => null,
  useMapsLibrary: () => gmaps.placesLib,
}))

import api from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import AnalysisPage from './AnalysisPage.jsx'

// La geocodificación inversa (Geocoder de Google) se controla por test.
let geocodeImpl = (req, cb) => cb(null, 'ZERO_RESULTS')

const COMPONENTS_AV_COLON = [
  { types: ['route'], long_name: 'Avenida Colón' },
  { types: ['street_number'], long_name: '1000' },
]

// Detalle de lugar SIN dirección: simula una selección que no aporta texto
// (como un clic en el mapa), forzando la geocodificación inversa.
const detalleSinDireccion = (req, cb) =>
  cb({ geometry: { location: { lat: () => -31.42, lng: () => -64.19 } } }, 'OK')

const renderPage = () =>
  render(
    <MemoryRouter>
      <AnalysisPage />
    </MemoryRouter>,
  )

// Selecciona una ubicación a través del autocompletado (tipear + elegir).
const seleccionarUbicacion = async () => {
  fireEvent.change(screen.getByPlaceholderText(/Buscar dirección o zona/i), {
    target: { value: 'Av Colón 1000' },
  })
  fireEvent.click(await screen.findByText('Av Colón 1000'))
}

describe('AnalysisPage · búsqueda y dirección', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    geocodeImpl = (req, cb) => cb(null, 'ZERO_RESULTS')
    window.google = {
      maps: {
        Geocoder: class {
          geocode(req, cb) { geocodeImpl(req, cb) }
        },
        SymbolPath: { CIRCLE: 0 },
      },
    }
    useAuth.mockReturnValue({ isAuthenticated: false })
    api.get.mockResolvedValue({ data: [] }) // rubros
    api.post.mockResolvedValue({ data: { dentro_de_cordoba: true, mensaje: 'Ubicación válida' } })
    // Defaults del autocompletado: una sugerencia que resuelve a Av. Colón 1000.
    gmaps.getPlacePredictions.mockImplementation((req, cb) =>
      cb([{ description: 'Av Colón 1000', place_id: 'p1' }], 'OK'))
    gmaps.getDetails.mockImplementation((req, cb) =>
      cb({
        geometry: { location: { lat: () => -31.42, lng: () => -64.19 } },
        address_components: COMPONENTS_AV_COLON,
        formatted_address: 'Avenida Colón 1000, Córdoba, Argentina',
      }, 'OK'))
  })

  afterEach(() => {
    delete window.google
  })

  it('muestra la dirección elegida en el buscador (no las coordenadas ni re-geocodifica)', async () => {
    // geocodeImpl devolvería otro número; no debe usarse porque la dirección ya
    // vino del buscador.
    geocodeImpl = (req, cb) => cb([{ address_components: [
      { types: ['route'], long_name: 'Avenida Colón' },
      { types: ['street_number'], long_name: '1050' },
    ] }], 'OK')
    renderPage()
    await seleccionarUbicacion()

    expect(await screen.findByText('Ubicación válida')).toBeInTheDocument()
    expect(screen.getByText('Avenida Colón 1000')).toBeInTheDocument()
    expect(screen.queryByText('Avenida Colón 1050')).not.toBeInTheDocument()
    expect(screen.queryByText(/-31\.42000, -64\.19000/)).not.toBeInTheDocument()
  })

  it('si la selección no trae dirección, geocodifica inverso y muestra calle y número', async () => {
    gmaps.getDetails.mockImplementation(detalleSinDireccion)
    geocodeImpl = (req, cb) => cb([{ address_components: COMPONENTS_AV_COLON }], 'OK')
    renderPage()
    await seleccionarUbicacion()

    expect(await screen.findByText('Avenida Colón 1000')).toBeInTheDocument()
    expect(screen.queryByText(/-31\.42000, -64\.19000/)).not.toBeInTheDocument()
  })

  it('si la selección no trae dirección, muestra "Buscando dirección…" mientras geocodifica', async () => {
    gmaps.getDetails.mockImplementation(detalleSinDireccion)
    geocodeImpl = () => {} // callback pendiente: geocodificación en curso
    renderPage()
    await seleccionarUbicacion()

    expect(await screen.findByText('Buscando dirección…')).toBeInTheDocument()
    expect(screen.queryByText(/-31\.42000, -64\.19000/)).not.toBeInTheDocument()
  })

  it('si la selección no trae dirección, cae a las coordenadas sin resultados de geocodificación', async () => {
    gmaps.getDetails.mockImplementation(detalleSinDireccion)
    geocodeImpl = (req, cb) => cb(null, 'ZERO_RESULTS')
    renderPage()
    await seleccionarUbicacion()

    expect(await screen.findByText('Ubicación válida')).toBeInTheDocument()
    expect(screen.getByText(/-31\.42000, -64\.19000/)).toBeInTheDocument()
  })

  it('autocompleta direcciones con Google Places a medida que se escribe (sin botón)', async () => {
    renderPage()
    expect(screen.queryByRole('button', { name: /Buscar dirección/i })).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/Buscar dirección o zona/i), {
      target: { value: 'Av Colón 1000' },
    })
    expect(await screen.findByText('Av Colón 1000')).toBeInTheDocument()
    expect(gmaps.getPlacePredictions).toHaveBeenCalled()
    expect(gmaps.getPlacePredictions.mock.calls[0][0]).toMatchObject({
      input: 'Av Colón 1000',
      componentRestrictions: { country: 'ar' },
    })
  })

  it('no busca con menos de 3 caracteres', async () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText(/Buscar dirección o zona/i), {
      target: { value: 'Av' },
    })
    await new Promise((r) => setTimeout(r, 350))
    expect(gmaps.getPlacePredictions).not.toHaveBeenCalled()
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
