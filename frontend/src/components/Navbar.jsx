import { NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__brand">
        <span className="navbar__logo" aria-hidden="true">◇</span>
        SpotWise
      </div>

      <nav className="navbar__links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'is-active' : '')}>
          Inicio
        </NavLink>
        <NavLink to="/mis-analisis" className={({ isActive }) => (isActive ? 'is-active' : '')}>
          Mis Análisis
        </NavLink>
      </nav>

      <button className="navbar__user" aria-label="Cuenta de usuario">
        <span aria-hidden="true">◉</span>
      </button>
    </header>
  )
}
