import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps'
import api from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { COLOR_DECISION, LABEL_DECISION } from '../utils/score.js'
import IndicadoresAnalisis from '../components/IndicadoresAnalisis.jsx'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const CORDOBA_CENTER = { lat: -31.4201, lng: -64.1888 }

function markerIcon(competidor) {
  if (!window.google) return undefined
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: competidor ? 7 : 5,
    fillColor: competidor ? '#dc2626' : '#9ca3af',
    fillOpacity: 0.9,
    strokeColor: '#ffffff',
    strokeWeight: 1.2,
  }
}

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

  const [analizando, setAnalizando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [errorAnalisis, setErrorAnalisis] = useState('')

  const { isAuthenticated } = useAuth()
  const [guardado, setGuardado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')

  useEffect(() => {
    api.get('/catalog/rubros/').then(({ data }) => setRubros(data)).catch(() => setRubros([]))
  }, [])

  const seleccionar = async (lat, lng) => {
    setPosition({ lat, lng })
    setResultado(null)
    setErrorAnalisis('')
    setGuardado(null)
    setErrorGuardar('')
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
  const puedeAnalizar = Boolean(position && validacion?.dentro_de_cordoba && rubroId && !analizando)

  const analizar = async () => {
    if (!puedeAnalizar) return
    setAnalizando(true)
    setResultado(null)
    setErrorAnalisis('')
    setGuardado(null)
    setErrorGuardar('')
    try {
      const { data } = await api.post('/analysis/analizar/', {
        lat: position.lat, lng: position.lng, rubro_id: rubroId,
      })
      setResultado(data)
    } catch (err) {
      setErrorAnalisis(err.response?.data?.detail || 'No se pudo completar el análisis. Intentá de nuevo.')
    } finally {
      setAnalizando(false)
    }
  }

  const guardar = async (nombreReferencia) => {
    if (!resultado) return
    setGuardando(true)
    setErrorGuardar('')
    try {
      const { data } = await api.post('/analysis/guardados/', {
        lat: resultado.lat,
        lng: resultado.lng,
        rubro_id: resultado.rubro.id,
        nombre_referencia: nombreReferencia,
      })
      setGuardado(data)
    } catch (err) {
      setErrorGuardar(err.response?.data?.detail || 'No se pudo guardar el análisis.')
    } finally {
      setGuardando(false)
    }
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
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar dirección o zona…" />
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

        {position && validacion && !resultado && !analizando && (
          <div className={`analysis__validation ${validacion.dentro_de_cordoba ? 'is-ok' : 'is-err'}`}>
            {validacion.mensaje}
            <div className="analysis__coords">{position.lat.toFixed(5)}, {position.lng.toFixed(5)}</div>
          </div>
        )}

        <button className="btn btn--primary btn--block" onClick={analizar} disabled={!puedeAnalizar}>
          {analizando ? 'Analizando…' : 'Analizar ubicación'}
        </button>
        <p className="analysis__hint">Radio de análisis predefinido: 500 m.</p>

        {analizando && <ProcessingPanel />}
        {errorAnalisis && <div className="analysis__validation is-err">{errorAnalisis}</div>}
        {resultado && !analizando && (
          <ResultPanel
            r={resultado}
            rubro={rubroSel?.nombre}
            autenticado={isAuthenticated}
            onGuardar={guardar}
            guardando={guardando}
            guardado={guardado}
            errorGuardar={errorGuardar}
          />
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
              {resultado?.lugares?.map((l, i) => (
                <Marker key={i} position={{ lat: l.lat, lng: l.lng }} icon={markerIcon(l.competidor)} />
              ))}
              <Recenter position={position} />
            </Map>
          </APIProvider>
        ) : (
          <div className="analysis__map-missing">
            Falta configurar <code>VITE_GOOGLE_MAPS_API_KEY</code> en <code>frontend/.env</code>.
          </div>
        )}

        {resultado ? (
          <div className="map-legend">
            <span><i className="dot dot--comp" /> Competidores ({resultado.lugares.filter((l) => l.competidor).length})</span>
            <span><i className="dot dot--gen" /> Comercios ({resultado.lugares.filter((l) => !l.competidor).length})</span>
          </div>
        ) : (
          <div className="analysis__map-hint">Hacé clic en el mapa para seleccionar una ubicación</div>
        )}
      </div>
    </div>
  )
}

function ProcessingPanel() {
  const pasos = [
    'Consultando negocios cercanos',
    'Consultando datos demográficos',
    'Calculando indicadores',
    'Generando score de viabilidad',
  ]
  return (
    <div className="processing">
      <div className="processing__spinner" />
      <strong>Analizando ubicación…</strong>
      <ul>{pasos.map((p) => <li key={p}>{p}</li>)}</ul>
    </div>
  )
}

function ResultPanel({ r, rubro, autenticado, onGuardar, guardando, guardado, errorGuardar }) {
  const color = COLOR_DECISION[r.decision] || '#64748b'
  const [nombre, setNombre] = useState('')
  return (
    <div className="result">
      <div className="result__score">
        <div
          className="result__ring"
          style={{ background: `conic-gradient(${color} ${r.score * 3.6}deg, #e5e7eb 0deg)` }}
        >
          <span className="result__num">{Math.round(r.score)}<small>/100</small></span>
        </div>
        <span className="result__badge" style={{ background: color }}>{LABEL_DECISION[r.decision]}</span>
      </div>

      <p className="result__barrio">
        {rubro ? `${rubro} · ` : ''}Barrio <strong>{r.barrio?.nombre || '—'}</strong>
      </p>

      <IndicadoresAnalisis
        actividadScore={r.indicadores.actividad_economica}
        competenciaScore={r.indicadores.competencia}
        densidad={r.barrio?.densidad_hab_km2}
        indiceSocioeconomico={r.barrio?.indice_socioeconomico}
        semaforo={r.barrio?.semaforo}
      />

      <p className="result__counts">
        {r.competencia.competidores_directos} competidores directos · {r.competencia.comercios_totales} comercios en {r.radio_m} m
      </p>

      <div className="result__save">
        {!autenticado ? (
          <p className="result__login-hint">
            <Link to="/login">Iniciá sesión</Link> para guardar este análisis.
          </p>
        ) : guardado ? (
          <p className="result__saved">
            ✓ Guardado en <Link to="/mis-analisis">Mis Análisis</Link>.
          </p>
        ) : (
          <>
            <input
              className="result__save-input"
              placeholder="Nombre de referencia (opcional)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={200}
            />
            <button
              className="btn btn--primary btn--block"
              onClick={() => onGuardar(nombre.trim())}
              disabled={guardando}
            >
              {guardando ? 'Guardando…' : 'Guardar ubicación'}
            </button>
            {errorGuardar && <small className="result__save-error">{errorGuardar}</small>}
          </>
        )}
      </div>
    </div>
  )
}
