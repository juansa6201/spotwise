import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { APIProvider, InfoWindow, Map, Marker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import api from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { COLOR_DECISION, LABEL_DECISION } from '../utils/score.js'
import IndicadoresAnalisis from '../components/IndicadoresAnalisis.jsx'
import LugarInfo, { markerIcon } from '../components/LugarInfo.jsx'
import { direccionCalleNumero } from '../utils/geo.js'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const CORDOBA_CENTER = { lat: -31.4201, lng: -64.1888 }
// Caja de la ciudad de Córdoba: sesga las sugerencias del autocompletado.
const CORDOBA_BOUNDS = { north: -31.30, south: -31.55, east: -64.04, west: -64.36 }
const RADIO_METROS = 500 // radio de análisis predefinido (coincide con el backend)

// Colores tenues por nivel socioeconómico (semáforo del barrio).
const SEM_FILL = { VERDE: '#16a34a', AMARILLO: '#eab308', ROJO: '#dc2626' }

// Capa con la delimitación de los barrios de Córdoba, coloreada por nivel
// socioeconómico con baja opacidad para no opacar el mapa base.
function BarriosLayer() {
  const map = useMap()
  useEffect(() => {
    if (!map || !window.google?.maps) return undefined
    const layer = new window.google.maps.Data({ map })
    layer.setStyle((feature) => {
      const color = SEM_FILL[feature.getProperty('semaforo')] || '#94a3b8'
      return {
        fillColor: color,
        fillOpacity: 0.18,
        strokeColor: color,
        strokeWeight: 1,
        strokeOpacity: 0.45,
        clickable: false, // deja pasar el clic al mapa para seleccionar el punto
      }
    })
    let activo = true
    api
      .get('/catalog/barrios/')
      .then(({ data }) => { if (activo) layer.addGeoJson(data) })
      .catch(() => {})
    return () => {
      activo = false
      layer.setMap(null)
    }
  }, [map])
  return null
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

// Círculo rojo que delimita el radio de análisis alrededor de la ubicación.
// @vis.gl/react-google-maps no expone un componente Circle, así que se maneja
// la instancia nativa de google.maps.Circle vía useMap().
function RadiusCircle({ position, radius }) {
  const map = useMap()
  const circleRef = useRef(null)

  useEffect(() => {
    if (!map || !window.google?.maps) return undefined
    const circle = new window.google.maps.Circle({
      strokeColor: '#dc2626',
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillOpacity: 0, // sin relleno: se ve el mapa dentro del radio
      clickable: false,
    })
    circleRef.current = circle
    return () => {
      circle.setMap(null)
      circleRef.current = null
    }
  }, [map])

  useEffect(() => {
    const circle = circleRef.current
    if (!circle) return
    if (position) {
      circle.setRadius(radius)
      circle.setCenter(position)
      circle.setMap(map)
    } else {
      circle.setMap(null)
    }
  }, [map, position, radius])

  return null
}

// Buscador de direcciones con el autocompletado de Google Places. Usa un
// session token (predicciones + getDetails) para que Google lo facture como
// una sola sesión. Sesga los resultados a Córdoba, Argentina.
function BuscadorDireccion({ onElegir }) {
  const places = useMapsLibrary('places')
  const [texto, setTexto] = useState('')
  const [predicciones, setPredicciones] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [sinResultados, setSinResultados] = useState(false)

  const autoServ = useRef(null) // AutocompleteService (predicciones)
  const placesServ = useRef(null) // PlacesService (detalle → coordenadas)
  const token = useRef(null) // session token de facturación
  const saltar = useRef(false) // evita re-buscar al elegir un resultado

  useEffect(() => {
    if (!places) return
    autoServ.current = new places.AutocompleteService()
    placesServ.current = new places.PlacesService(document.createElement('div'))
  }, [places])

  useEffect(() => {
    if (saltar.current) { saltar.current = false; return undefined }
    const q = texto.trim()
    setSinResultados(false)
    if (q.length < 3 || !autoServ.current) {
      setPredicciones([])
      setBuscando(false)
      return undefined
    }
    if (!token.current) token.current = new places.AutocompleteSessionToken()
    setBuscando(true)
    let activo = true
    const t = setTimeout(() => {
      autoServ.current.getPlacePredictions(
        {
          input: q,
          sessionToken: token.current,
          componentRestrictions: { country: 'ar' },
          bounds: CORDOBA_BOUNDS,
          language: 'es',
        },
        (preds, status) => {
          if (!activo) return
          const ok = status === places.PlacesServiceStatus.OK && preds?.length
          setPredicciones(ok ? preds : [])
          setSinResultados(!ok)
          setBuscando(false)
        },
      )
    }, 300)
    return () => { activo = false; clearTimeout(t) }
  }, [texto, places])

  const elegir = (pred) => {
    saltar.current = true
    setTexto(pred.description)
    setPredicciones([])
    setSinResultados(false)
    setBuscando(false)
    placesServ.current.getDetails(
      {
        placeId: pred.place_id,
        fields: ['geometry', 'address_components', 'formatted_address'],
        sessionToken: token.current,
      },
      (place, status) => {
        token.current = null // cierra la sesión de facturación
        if (status === places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const loc = place.geometry.location
          // Pasa la dirección elegida para mostrarla tal cual (sin re-geocodificar).
          onElegir(loc.lat(), loc.lng(), direccionCalleNumero(place))
        }
      },
    )
  }

  return (
    <div className="analysis__search">
      <label className="field">
        <span>Ubicación</span>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar dirección o zona…"
          autoComplete="off"
        />
      </label>
      {buscando && <p className="analysis__searching">Buscando direcciones…</p>}
      {predicciones.length > 0 && (
        <ul className="analysis__results">
          {predicciones.map((p) => (
            <li key={p.place_id} onClick={() => elegir(p)}>{p.description}</li>
          ))}
        </ul>
      )}
      {sinResultados && !buscando && (
        <p className="analysis__searching">Sin resultados para “{texto.trim()}”.</p>
      )}
    </div>
  )
}

export default function AnalysisPage() {
  const [rubros, setRubros] = useState([])
  const [rubroId, setRubroId] = useState('')
  const [position, setPosition] = useState(null) // { lat, lng }
  const [validacion, setValidacion] = useState(null)
  const [direccion, setDireccion] = useState('')
  const [geocodificando, setGeocodificando] = useState(false)
  const [mostrarBarrio, setMostrarBarrio] = useState(false)

  const [analizando, setAnalizando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [lugarSel, setLugarSel] = useState(null) // índice del lugar abierto en el InfoWindow
  const [errorAnalisis, setErrorAnalisis] = useState('')

  const { isAuthenticated } = useAuth()
  const [guardado, setGuardado] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')

  useEffect(() => {
    api.get('/catalog/rubros/').then(({ data }) => setRubros(data)).catch(() => setRubros([]))
  }, [])

  const seleccionar = async (lat, lng, direccionConocida) => {
    setPosition({ lat, lng })
    setResultado(null)
    setLugarSel(null)
    setErrorAnalisis('')
    setGuardado(null)
    setErrorGuardar('')
    setDireccion(direccionConocida || '')
    // Si la dirección la eligió el usuario en el buscador, se muestra tal cual.
    // Solo se geocodifica inverso cuando se clickea un punto del mapa (sin texto):
    // re-geocodificar la coordenada elegida devolvería un número de portal distinto.
    if (!direccionConocida && window.google?.maps) {
      setGeocodificando(true)
      new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) setDireccion(direccionCalleNumero(results[0]))
        setGeocodificando(false)
      })
    }
    try {
      const { data } = await api.post('/catalog/validar-ubicacion/', { lat, lng })
      setValidacion(data)
      setMostrarBarrio(Boolean(data.barrio))
    } catch {
      setValidacion({ dentro_de_cordoba: false, mensaje: 'No se pudo validar la ubicación.' })
      setMostrarBarrio(false)
    }
  }

  const rubroSel = useMemo(() => rubros.find((r) => r.id === rubroId), [rubros, rubroId])
  const puedeAnalizar = Boolean(position && validacion?.dentro_de_cordoba && rubroId && !analizando)

  const analizar = async () => {
    if (!puedeAnalizar) return
    setAnalizando(true)
    setResultado(null)
    setLugarSel(null)
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
        direccion,
      })
      setGuardado(data)
    } catch (err) {
      setErrorGuardar(err.response?.data?.detail || 'No se pudo guardar el análisis.')
    } finally {
      setGuardando(false)
    }
  }

  const contenido = (
    <div className="analysis">
      <aside className="analysis__sidebar">
        <div className="analysis__sidebar-head">
          <h2>Análisis de Sitio</h2>
          <p>Localización geoespacial</p>
        </div>

        <BuscadorDireccion onElegir={seleccionar} />

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
            <div className="analysis__coords">
              {direccion || (geocodificando ? 'Buscando dirección…' : `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`)}
            </div>
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

      {/* Referencias del semáforo arriba del mapa (solo en pantallas chicas;
          en desktop se usa el cuadro flotante .barrios-legend). */}
      {GOOGLE_MAPS_API_KEY && (
        <div className="barrios-ref">
          <span>Nivel socioeconómico:</span>
          <span><i className="sq sq--verde" /> Alto</span>
          <span><i className="sq sq--amarillo" /> Medio</span>
          <span><i className="sq sq--rojo" /> Bajo</span>
        </div>
      )}

      <div className="analysis__map">
        {GOOGLE_MAPS_API_KEY ? (
            <Map
              style={{ width: '100%', height: '100%' }}
              defaultCenter={CORDOBA_CENTER}
              defaultZoom={13}
              gestureHandling="greedy"
              clickableIcons={false}
              onClick={(ev) => {
                // Con un InfoWindow abierto, el clic en el mapa sólo lo cierra
                // (no re-selecciona la ubicación analizada).
                if (lugarSel != null) {
                  setLugarSel(null)
                  return
                }
                const ll = ev.detail?.latLng
                if (ll) seleccionar(ll.lat, ll.lng)
              }}
            >
              <BarriosLayer />
              {position && <Marker position={position} />}
              <RadiusCircle position={position} radius={RADIO_METROS} />
              {resultado?.lugares?.map((l, i) => (
                <Marker
                  key={i}
                  position={{ lat: l.lat, lng: l.lng }}
                  icon={markerIcon(l.competidor)}
                  clickable={l.competidor} // sólo los competidores muestran detalle
                  onClick={l.competidor ? () => setLugarSel(i) : undefined}
                />
              ))}
              {lugarSel != null && resultado?.lugares?.[lugarSel]?.competidor && (
                <InfoWindow
                  position={{ lat: resultado.lugares[lugarSel].lat, lng: resultado.lugares[lugarSel].lng }}
                  onCloseClick={() => setLugarSel(null)}
                  headerDisabled // sin header ni ×: se cierra clickeando fuera del recuadro
                >
                  <LugarInfo lugar={resultado.lugares[lugarSel]} />
                </InfoWindow>
              )}
              <Recenter position={position} />
            </Map>
        ) : (
          <div className="analysis__map-missing">
            Falta configurar <code>VITE_GOOGLE_MAPS_API_KEY</code> en <code>frontend/.env</code>.
          </div>
        )}

        {GOOGLE_MAPS_API_KEY && (
          <div className="barrios-legend">
            <strong>Nivel socioeconómico</strong>
            <span><i className="sq sq--verde" /> Alto</span>
            <span><i className="sq sq--amarillo" /> Medio</span>
            <span><i className="sq sq--rojo" /> Bajo</span>
          </div>
        )}

        {mostrarBarrio && validacion?.barrio && (
          <BarrioInfoCard barrio={validacion.barrio} onClose={() => setMostrarBarrio(false)} />
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

  // El APIProvider envuelve toda la pantalla para que el buscador del sidebar
  // también pueda usar la librería de Google Places.
  return GOOGLE_MAPS_API_KEY ? (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="es" region="AR">
      {contenido}
    </APIProvider>
  ) : (
    contenido
  )
}

const SEM_DOT = { VERDE: '#16a34a', AMARILLO: '#eab308', ROJO: '#dc2626' }
const fmtNum = (n) => (n == null ? '—' : Math.round(n).toLocaleString('es-AR'))

// Mini-ventana (abajo a la derecha del mapa) con los datos del barrio donde
// cae la ubicación marcada.
function BarrioInfoCard({ barrio, onClose }) {
  return (
    <div className="barrio-card">
      <button className="barrio-card__close" onClick={onClose} title="Cerrar">✕</button>
      <header className="barrio-card__head">
        <span className="barrio-card__dot" style={{ background: SEM_DOT[barrio.semaforo] || '#94a3b8' }} />
        <div>
          <strong>{barrio.nombre}</strong>
          {barrio.seccional && <small>Seccional {barrio.seccional}</small>}
        </div>
      </header>
      <dl className="barrio-card__grid">
        <div>
          <dt>Nivel socioeconómico</dt>
          <dd>{barrio.indice_socioeconomico || '—'}{barrio.ips ? ` · IPS ${barrio.ips}/5` : ''}</dd>
        </div>
        <div>
          <dt>Habitantes</dt>
          <dd>{fmtNum(barrio.cantidad_habitantes)}</dd>
        </div>
        <div>
          <dt>Densidad</dt>
          <dd>{fmtNum(barrio.densidad_hab_km2)} hab/km²</dd>
        </div>
        <div>
          <dt>Hogares</dt>
          <dd>{fmtNum(barrio.total_hogares)}</dd>
        </div>
      </dl>
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
