import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { COLOR_DECISION } from '../utils/score.js'

const fmtFecha = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function MisAnalisisPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      setCargando(false)
      return
    }
    api
      .get('/analysis/guardados/')
      .then(({ data }) => setItems(data))
      .catch(() => setError('No se pudieron cargar tus análisis.'))
      .finally(() => setCargando(false))
  }, [isAuthenticated, authLoading])

  const toggleFavorito = async (item) => {
    try {
      const { data } = await api.patch(`/analysis/guardados/${item.id}/`, {
        favorito: !item.favorito,
      })
      setItems((prev) => prev.map((x) => (x.id === item.id ? data : x)))
    } catch {
      /* se mantiene el estado anterior */
    }
  }

  const borrar = async (item) => {
    if (!window.confirm('¿Eliminar este análisis guardado?')) return
    try {
      await api.delete(`/analysis/guardados/${item.id}/`)
      setItems((prev) => prev.filter((x) => x.id !== item.id))
    } catch {
      /* noop */
    }
  }

  if (authLoading) return null

  if (!isAuthenticated) {
    return (
      <div className="placeholder">
        <h2>Mis Análisis</h2>
        <p>
          <Link to="/login">Iniciá sesión</Link> para ver y guardar tus análisis.
        </p>
      </div>
    )
  }

  return (
    <div className="saved">
      <div className="saved__head">
        <h2>Mis Análisis</h2>
        <p>
          {items.length} {items.length === 1 ? 'análisis guardado' : 'análisis guardados'}
        </p>
      </div>

      {cargando ? (
        <p className="saved__muted">Cargando…</p>
      ) : error ? (
        <p className="saved__muted">{error}</p>
      ) : items.length === 0 ? (
        <div className="placeholder">
          <p>
            Todavía no guardaste análisis. Andá a <Link to="/analisis">Analizar</Link>, elegí
            un punto y un rubro, y guardá el resultado.
          </p>
        </div>
      ) : (
        <ul className="saved__list">
          {items.map((it) => (
            <li key={it.id} className="saved__card">
              <Link to={`/mis-analisis/${it.id}`} className="saved__link">
                <div
                  className="saved__score"
                  style={{ color: COLOR_DECISION[it.decision] || '#64748b' }}
                >
                  {Math.round(it.score)}
                  <small>/100</small>
                </div>

                <div className="saved__body">
                  <h3>{it.nombre_referencia || 'Análisis sin nombre'}</h3>
                  <p className="saved__meta">
                    {it.rubro_nombre || 'Sin rubro'} · {it.barrio_nombre || 'Fuera de barrio'} ·{' '}
                    {fmtFecha(it.guardado_at)}
                  </p>
                  {it.notas && <p className="saved__notas">{it.notas}</p>}
                  <span
                    className="saved__badge"
                    style={{ background: COLOR_DECISION[it.decision] || '#64748b' }}
                  >
                    {it.decision_display}
                  </span>
                </div>
              </Link>

              <div className="saved__actions">
                <button
                  className={`saved__star ${it.favorito ? 'is-on' : ''}`}
                  onClick={() => toggleFavorito(it)}
                  title={it.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}
                >
                  {it.favorito ? '★' : '☆'}
                </button>
                <button className="saved__del" onClick={() => borrar(it)} title="Eliminar">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
