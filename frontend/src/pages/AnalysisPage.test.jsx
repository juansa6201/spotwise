import { StrictMode } from 'react'
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
import { guardarPendiente, limpiarPendiente } from '../utils/analisisPendiente.js'
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

// El análisis sólo debe sobrevivir al ida y vuelta del login (retenido en
// memoria). Al recargar o navegar de otra forma no hay nada retenido y se
// arranca de cero.
describe('AnalysisPage · retención para el login', () => {
  const RESULTADO = {
    lat: -31.42, lng: -64.19, radio_m: 500, score: 72, decision: 'ALTA',
    rubro: { id: 3, nombre: 'Farmacia' },
    barrio: { nombre: 'GÜEMES', densidad_hab_km2: 9799.6, indice_socioeconomico: 'Medio', semaforo: 'AMARILLO' },
    indicadores: { actividad_economica: 60, competencia: 80 },
    competencia: { competidores_directos: 2, comercios_totales: 40 },
    lugares: [],
  }
  const SNAPSHOT = {
    rubroId: '3',
    position: { lat: -31.42, lng: -64.19 },
    validacion: { dentro_de_cordoba: true, mensaje: 'Ubicación válida' },
    direccion: 'Avenida Colón 1000',
    resultado: RESULTADO,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    limpiarPendiente() // descarta lo retenido de un test anterior
    window.google = { maps: { Geocoder: class { geocode() {} }, SymbolPath: { CIRCLE: 0 } } }
    api.get.mockResolvedValue({ data: [] })
    api.post.mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    delete window.google
    limpiarPendiente()
  })

  it('restaura el análisis retenido al volver del login (sin sesión aún)', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false })
    guardarPendiente(SNAPSHOT)
    renderPage()

    expect(await screen.findByText('72')).toBeInTheDocument()
    expect(screen.getByText('Alta viabilidad')).toBeInTheDocument()
    expect(screen.getByText('GÜEMES')).toBeInTheDocument()
    // Sin sesión: se ofrece iniciar sesión sin perder el resultado.
    expect(screen.getByText('Iniciá sesión')).toBeInTheDocument()
  })

  it('tras el login el resultado restaurado muestra el formulario para guardar', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true })
    guardarPendiente(SNAPSHOT)
    renderPage()

    expect(await screen.findByText('72')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Nombre de referencia/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar ubicación/i })).toBeInTheDocument()
  })

  it('sin nada retenido (recarga o navegación normal) arranca sin análisis', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false })
    renderPage()

    expect(await screen.findByText(/Hacé clic en el mapa/i)).toBeInTheDocument()
    expect(screen.queryByText('72')).not.toBeInTheDocument()
  })

  it('la retención se consume una sola vez: un segundo montaje ya no la restaura', async () => {
    useAuth.mockReturnValue({ isAuthenticated: false })
    guardarPendiente(SNAPSHOT)
    const { unmount } = renderPage()
    expect(await screen.findByText('72')).toBeInTheDocument()
    unmount()

    // Volver a montar (p. ej. navegar a otra página y regresar) no debe restaurar.
    renderPage()
    expect(await screen.findByText(/Hacé clic en el mapa/i)).toBeInTheDocument()
    expect(screen.queryByText('72')).not.toBeInTheDocument()
  })

  // Regresión: en dev la app va envuelta en StrictMode, que monta dos veces. La
  // restauración debía sobrevivir a ese doble montaje (antes se perdía).
  it('restaura bajo StrictMode (doble montaje en desarrollo)', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true })
    guardarPendiente(SNAPSHOT)
    render(
      <StrictMode>
        <MemoryRouter>
          <AnalysisPage />
        </MemoryRouter>
      </StrictMode>,
    )

    expect(await screen.findByText('72')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Guardar ubicación/i })).toBeInTheDocument()
  })
})
