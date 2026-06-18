import { useEffect, useMemo, useState } from 'react'
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps'
import api from '../api/client.js'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const CORDOBA_CENTER = { lat: -31.4201, lng: -64.1888 }

// Centra y acerca el mapa cuando cambia la ubicación seleccionada.
function Recenter({ position }) {
  const map = useMap()
  useEffect(() => {
    if (map && position) {
      map.panTo(position)
      map.setZoom(16)
    }
  }, [map, position])
  return null
}

export default function AnalysisPage() {
  const [rubros, setRubros] = useState([])
  const [rubroId, setRubroId] = useState('')
  const [position, setPosition] = useState(null) // { lat, lng }
  const [validacion, setValidacion] = useState(null)
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [confirmado, setConfirmado] = useState(null)

  useEffect(() => {
    api.get('/catalog/rubros/').then(({ data }) => setRubros(data)).catch(() => setRubros([]))
  }, [])

  const seleccionar = async (lat, lng) => {
    setPosition({ lat, lng })
    setConfirmado(null)
    try {
      const { data } = await api.post('/catalog/validar-ubicacion/', { lat, lng })
      setValidacion(data)
    } catch {
      setValidacion({ dentro_de_cordoba: false, mensaje: 'No se pudo validar la ubicación.' })
    }
  }

  const buscarDireccion = async (e) => {
    e.preventDefault()
    if (query.trim().length < 3) return
    setBuscando(true)
    try {
      const { data } = await api.get('/catalog/geocode/', { params: { q: query } })
      setResultados(data.resultados || [])
    } catch {
      setResultados([])
    } finally {
      setBuscando(false)
    }
  }

  const elegirResultado = (r) => {
    setResultados([])
    setQuery(r.nombre)
    seleccionar(r.lat, r.lng)
  }

  const rubroSel = useMemo(() => rubros.find((r) => r.id === rubroId), [rubros, rubroId])
  const puedeAnalizar = Boolean(position && validacion?.dentro_de_cordoba && rubroId)

  const analizar = () => {
    if (!puedeAnalizar) return
    setConfirmado({ lat: position.lat, lng: position.lng, rubro: rubroSel?.nombre })
  }

  return (
    <div className="analysis">
      <aside className="analysis__sidebar">
        <div className="analysis__sidebar-head">
          <h2>Análisis de Sitio</h2>
          <p>Localización geoespacial</p>
        </div>

        <form className="analysis__search" onSubmit={buscarDireccion}>
          <label className="field">
            <span>Ubicación</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar dirección o zona…"
            />
          </label>
          <button type="submit" className="btn btn--ghost btn--sm btn--block" disabled={buscando}>
            {buscando ? 'Buscando…' : 'Buscar dirección'}
          </button>
          {resultados.length > 0 && (
            <ul className="analysis__results">
              {resultados.map((r, i) => (
                <li key={i} onClick={() => elegirResultado(r)}>{r.nombre}</li>
              ))}
            </ul>
          )}
        </form>

        <label className="field">
          <span>Categoría de negocio</span>
          <select value={rubroId} onChange={(e) => setRubroId(e.target.value)}>
            <option value="">Seleccionar categoría…</option>
            {rubros.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </label>

        {position && validacion && (
          <div className={`analysis__validation ${validacion.dentro_de_cordoba ? 'is-ok' : 'is-err'}`}>
            {validacion.mensaje}
            <div className="analysis__coords">
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </div>
          </div>
        )}

        <button className="btn btn--primary btn--block" onClick={analizar} disabled={!puedeAnalizar}>
          Analizar ubicación
        </button>
        <p className="analysis__hint">Radio de análisis predefinido: 500 m.</p>

        {confirmado && (
          <div className="analysis__confirm">
            <strong>Ubicación lista para analizar ✓</strong>
            <p>Rubro: {confirmado.rubro}</p>
            <p>Coordenadas: {confirmado.lat.toFixed(5)}, {confirmado.lng.toFixed(5)}</p>
            <p className="analysis__next">
              El cálculo de competencia, indicadores y score se implementa en la Fase 2/3.
            </p>
          </div>
        )}
      </aside>

      <div className="analysis__map">
        {GOOGLE_MAPS_API_KEY ? (
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="es" region="AR">
            <Map
              style={{ width: '100%', height: '100%' }}
              defaultCenter={CORDOBA_CENTER}
              defaultZoom={13}
              gestureHandling="greedy"
              clickableIcons={false}
              onClick={(ev) => {
                const ll = ev.detail?.latLng
                if (ll) seleccionar(ll.lat, ll.lng)
              }}
            >
              {position && <Marker position={position} />}
              <Recenter position={position} />
            </Map>
          </APIProvider>
        ) : (
          <div className="analysis__map-missing">
            Falta configurar <code>VITE_GOOGLE_MAPS_API_KEY</code> en <code>frontend/.env</code>.
          </div>
        )}
        <div className="analysis__map-hint">Hacé clic en el mapa para seleccionar una ubicación</div>
      </div>
    </div>
  )
}
