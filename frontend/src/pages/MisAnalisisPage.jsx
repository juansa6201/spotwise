import { useEffect, useMemo, useState } from 'react'
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

// Valores únicos (no vacíos) de un campo, ordenados alfabéticamente.
const distintos = (items, campo) =>
  [...new Set(items.map((it) => it[campo]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )

const FILTROS_INICIALES = { rubro: '', barrio: '', viabilidad: '', favoritos: false }

export default function MisAnalisisPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [items, setItems] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [orden, setOrden] = useState('fecha_desc')

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

  const rubros = useMemo(() => distintos(items, 'rubro_nombre'), [items])
  const barrios = useMemo(() => distintos(items, 'barrio_nombre'), [items])

  const setFiltro = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }))
  const limpiar = () => { setFiltros(FILTROS_INICIALES); setOrden('fecha_desc') }
  const hayFiltros =
    filtros.rubro || filtros.barrio || filtros.viabilidad || filtros.favoritos

  // Filtrado + ordenamiento en cliente: la lista del usuario es acotada.
  const visibles = useMemo(() => {
    const filtrados = items.filter((it) => {
      if (filtros.rubro && it.rubro_nombre !== filtros.rubro) return false
      if (filtros.barrio && it.barrio_nombre !== filtros.barrio) return false
      if (filtros.viabilidad && it.decision !== filtros.viabilidad) return false
      if (filtros.favoritos && !it.favorito) return false
      return true
    })
    const cmp = {
      fecha_desc: (a, b) => new Date(b.guardado_at) - new Date(a.guardado_at),
      fecha_asc: (a, b) => new Date(a.guardado_at) - new Date(b.guardado_at),
      score_desc: (a, b) => b.score - a.score,
      score_asc: (a, b) => a.score - b.score,
    }
    return [...filtrados].sort(cmp[orden] || cmp.fecha_desc)
  }, [items, filtros, orden])

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
          {hayFiltros
            ? `${visibles.length} de ${items.length} ${items.length === 1 ? 'análisis' : 'análisis'}`
            : `${items.length} ${items.length === 1 ? 'análisis guardado' : 'análisis guardados'}`}
        </p>
      </div>

      {!cargando && !error && items.length > 0 && (
        <div className="saved__filters">
          <label className="saved__filter">
            <span>Rubro</span>
            <select value={filtros.rubro} onChange={(e) => setFiltro('rubro', e.target.value)}>
              <option value="">Todos</option>
              {rubros.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>

          <label className="saved__filter">
            <span>Barrio</span>
            <select value={filtros.barrio} onChange={(e) => setFiltro('barrio', e.target.value)}>
              <option value="">Todos</option>
              {barrios.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>

          <label className="saved__filter">
            <span>Viabilidad</span>
            <select
              value={filtros.viabilidad}
              onChange={(e) => setFiltro('viabilidad', e.target.value)}
            >
              <option value="">Todas</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="BAJA">Baja</option>
            </select>
          </label>

          <label className="saved__filter">
            <span>Ordenar por</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value)}>
              <option value="fecha_desc">Fecha (más nuevo)</option>
              <option value="fecha_asc">Fecha (más viejo)</option>
              <option value="score_desc">Score (mayor a menor)</option>
              <option value="score_asc">Score (menor a mayor)</option>
            </select>
          </label>

          <button
            type="button"
            className={`saved__chip ${filtros.favoritos ? 'is-on' : ''}`}
            onClick={() => setFiltro('favoritos', !filtros.favoritos)}
            aria-pressed={filtros.favoritos}
          >
            {filtros.favoritos ? '★' : '☆'} Favoritos
          </button>

          {hayFiltros && (
            <button type="button" className="saved__clear" onClick={limpiar}>
              Limpiar
            </button>
          )}
        </div>
      )}

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
      ) : visibles.length === 0 ? (
        <p className="saved__muted">
          Ningún análisis coincide con los filtros.{' '}
          <button type="button" className="saved__linkbtn" onClick={limpiar}>
            Limpiar filtros
          </button>
        </p>
      ) : (
        <ul className="saved__list">
          {visibles.map((it) => (
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
