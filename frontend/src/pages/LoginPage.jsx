import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const redirectTo = location.state?.from || '/analisis'
  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.email || !form.password) {
      setError('Completá el correo electrónico y la contraseña.')
      return
    }
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo iniciar sesión. Verificá tus datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={onSubmit}>
        <div className="auth__brand"><span aria-hidden="true">◇</span> SpotWise</div>
        <p className="auth__tagline">Inteligencia geoespacial</p>
        <h1 className="auth__title">Iniciar sesión</h1>

        {error && <div className="auth__error">{error}</div>}

        <label className="field">
          <span>Correo electrónico</span>
          <input
            type="email" name="email" value={form.email} onChange={onChange}
            placeholder="usuario@ejemplo.com" autoComplete="email"
          />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            type="password" name="password" value={form.password} onChange={onChange}
            placeholder="••••••••" autoComplete="current-password"
          />
        </label>

        <button className="btn btn--primary btn--block" type="submit" disabled={loading}>
          {loading ? 'Ingresando…' : 'Iniciar sesión'}
        </button>

        <p className="auth__alt">¿No tenés una cuenta? <Link to="/registro">Registrate</Link></p>
      </form>
    </div>
  )
}
