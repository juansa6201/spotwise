import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  const [apiStatus, setApiStatus] = useState('checking')

  useEffect(() => {
    api
      .get('/health/')
      .then((res) => setApiStatus(res.data?.status === 'ok' ? 'ok' : 'error'))
      .catch(() => setApiStatus('error'))
  }, [])

  return (
    <section className="home">
      <div className="home__hero">
        <h1>Evaluá el potencial comercial de una ubicación</h1>
        <p className="home__subtitle">
          Analizá competencia, actividad comercial y datos demográficos para tomar
          mejores decisiones.
        </p>

        <div className="home__actions">
          <Link to="/analisis" className="btn btn--primary">◎ Comenzar análisis</Link>
          {!isAuthenticated && (
            <Link to="/login" className="btn btn--ghost">Iniciar sesión</Link>
          )}
        </div>

        <ApiBadge status={apiStatus} />
      </div>

      <div className="home__cards">
        <article className="card">
          <span className="card__label">DEMOGRAFÍA</span>
          <strong className="card__value">Población Alta</strong>
          <div className="bar">
            <div className="bar__fill" style={{ width: '72%' }} />
          </div>
        </article>

        <article className="card">
          <span className="card__label">ACTIVIDAD COMERCIAL</span>
          <strong className="card__value">
            Alto Tráfico <small>Concentración de retail</small>
          </strong>
          <div className="sparkbars">
            {[40, 55, 35, 90, 50, 65, 45].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} className={h === 90 ? 'is-peak' : ''} />
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

function ApiBadge({ status }) {
  const map = {
    checking: { text: 'Verificando conexión con la API…', cls: 'badge--muted' },
    ok: { text: 'API conectada', cls: 'badge--ok' },
    error: { text: 'Sin conexión con la API (¿levantaste el backend?)', cls: 'badge--err' },
  }
  const { text, cls } = map[status]
  return <span className={`badge ${cls}`}>● {text}</span>
}
