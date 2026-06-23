import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps'
import api from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { COLOR_DECISION } from '../utils/score.js'
import IndicadoresAnalisis from '../components/IndicadoresAnalisis.jsx'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

const fmtFecha = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function AnalisisDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, loading: authLoading } = useAuth()

  const [analisis, setAnalisis] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Edición de los campos que el usuario controla.
  const [nombre, setNombre] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setCargando(false)
      return
    }
    api
      .get(`/analysis/guardados/${id}/`)
      .then(({ data }) => {
        setAnalisis(data)
        setNombre(data.nombre_referencia || '')
        setNotas(data.notas || '')
      })
      .catch((err) =>
        setError(
          err.response?.status === 404
            ? 'No encontramos este análisis (puede que lo hayas borrado).'
            : 'No se pudo cargar el análisis.',
        ),
      )
      .finally(() => setCargando(false))
  }, [id, isAuthenticated, authLoading])

  const toggleFavorito = async () => {
    try {
      const { data } = await api.patch(`/analysis/guardados/${id}/`, {
        favorito: !analisis.favorito,
      })
      setAnalisis(data)
    } catch {
      /* noop */
    }
  }

  const guardarCambios = async () => {
    setGuardando(true)
    setGuardadoOk(false)
    try {
      const { data } = await api.patch(`/analysis/guardados/${id}/`, {
        nombre_referencia: nombre.trim(),
        notas: notas.trim(),
      })
      setAnalisis(data)
      setGuardadoOk(true)
    } catch {
      setError('No se pudieron guardar los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async () => {
    if (!window.confirm('¿Eliminar este análisis guardado?')) return
    try {
      await api.delete(`/analysis/guardados/${id}/`)
      navigate('/mis-analisis')
    } catch {
      /* noop */
    }
  }

  if (authLoading || cargando) {
    return <div className="placeholder"><p>Cargando…</p></div>
  }

  if (!isAuthenticated) {
    return (
      <div className="placeholder">
        <h2>Detalle del análisis</h2>
        <p><Link to="/login">Iniciá sesión</Link> para ver tus análisis guardados.</p>
      </div>
    )
  }

  if (error || !analisis) {
    return (
      <div className="placeholder">
        <h2>Detalle del análisis</h2>
        <p>{error || 'No se pudo cargar el análisis.'}</p>
        <p><Link to="/mis-analisis">← Volver a Mis Análisis</Link></p>
      </div>
    )
  }

  const color = COLOR_DECISION[analisis.decision] || '#64748b'
  const punto = { lat: analisis.latitud, lng: analisis.longitud }
  const scorePorTipo = Object.fromEntries(analisis.indicadores.map((i) => [i.tipo, i.score]))

  // Dirección persistida al guardar; coordenadas como fallback.
  const ubicacionTexto =
    analisis.direccion || `${punto.lat.toFixed(5)}, ${punto.lng.toFixed(5)}`

  return (
    <div className="detail">
      <Link to="/mis-analisis" className="detail__back">← Mis Análisis</Link>

      <header className="detail__head">
        <div className="result__score">
          <div
            className="result__ring"
            style={{ background: `conic-gradient(${color} ${analisis.score * 3.6}deg, #e5e7eb 0deg)` }}
          >
            <span className="result__num">{Math.round(analisis.score)}<small>/100</small></span>
          </div>
          <span className="result__badge" style={{ background: color }}>{analisis.decision_display}</span>
        </div>

        <div className="detail__meta">
          <h2>{analisis.nombre_referencia || 'Análisis sin nombre'}</h2>
          <p className="detail__sub">
            {analisis.rubro_nombre || 'Sin rubro'} · Barrio <strong>{analisis.barrio_nombre || '—'}</strong>
          </p>
          <p className="detail__coords">
            {ubicacionTexto} · guardado el {fmtFecha(analisis.guardado_at)}
          </p>
          <button
            className={`detail__fav ${analisis.favorito ? 'is-on' : ''}`}
            onClick={toggleFavorito}
          >
            {analisis.favorito ? '★ En favoritos' : '☆ Marcar favorito'}
          </button>
        </div>
      </header>

      <section className="detail__section">
        <h3>Indicadores</h3>
        <IndicadoresAnalisis
          actividadScore={scorePorTipo.actividad_economica ?? 0}
          competenciaScore={scorePorTipo.competencia ?? 0}
          densidad={analisis.barrio_densidad}
          indiceSocioeconomico={analisis.barrio_indice_socioeconomico}
          semaforo={analisis.barrio_semaforo}
        />
      </section>

      {GOOGLE_MAPS_API_KEY && (
        <section className="detail__section">
          <h3>Ubicación</h3>
          <div className="detail__map">
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="es" region="AR">
              <Map
                style={{ width: '100%', height: '260px' }}
                defaultCenter={punto}
                defaultZoom={15}
                gestureHandling="cooperative"
                disableDefaultUI
              >
                <Marker position={punto} />
              </Map>
            </APIProvider>
          </div>
        </section>
      )}

      <section className="detail__section">
        <h3>Detalle</h3>
        <label className="field">
          <span>Nombre de referencia</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} />
        </label>
        <label className="field">
          <span>Notas</span>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={4}
            placeholder="Anotaciones sobre esta ubicación…"
          />
        </label>
        <div className="detail__save-row">
          <button className="btn btn--primary" onClick={guardarCambios} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {guardadoOk && <span className="detail__ok">✓ Cambios guardados</span>}
        </div>
      </section>

      <button className="btn btn--ghost detail__delete" onClick={borrar}>
        Eliminar análisis
      </button>
    </div>
  )
}
