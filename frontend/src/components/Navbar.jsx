import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="navbar">
      <Link to="/" className="navbar__brand">
        <span className="navbar__logo" aria-hidden="true">◇</span>
        SpotWise
      </Link>

      <nav className="navbar__links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'is-active' : '')}>
          Inicio
        </NavLink>
        <NavLink to="/analisis" className={({ isActive }) => (isActive ? 'is-active' : '')}>
          Analizar
        </NavLink>
        <NavLink to="/mis-analisis" className={({ isActive }) => (isActive ? 'is-active' : '')}>
          Mis Análisis
        </NavLink>
      </nav>

      {isAuthenticated ? (
        <div className="navbar__account">
          <span className="navbar__user-name">{user?.nombre}</span>
          <button className="btn btn--ghost btn--sm" onClick={handleLogout}>
            Salir
          </button>
        </div>
      ) : pathname !== '/' ? (
        <Link to="/login" className="btn btn--ghost btn--sm">
          Iniciar sesión
        </Link>
      ) : null}
    </header>
  )
}
