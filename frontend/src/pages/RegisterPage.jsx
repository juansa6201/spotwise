import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

const CAMPOS = ['nombre', 'apellido', 'email', 'password', 'password2']

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', password: '', password2: '',
  })
  const [errors, setErrors] = useState([])
  const [loading, setLoading] = useState(false)

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const onSubmit = async (e) => {
    e.preventDefault()
    setErrors([])

    if (CAMPOS.some((k) => !form[k])) {
      setErrors(['Completá todos los campos obligatorios.'])
      return
    }
    if (form.password !== form.password2) {
      setErrors(['Las contraseñas no coinciden.'])
      return
    }

    setLoading(true)
    try {
      await register(form)
      navigate('/analisis', { replace: true })
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        const msgs = []
        for (const v of Object.values(data)) {
          if (Array.isArray(v)) msgs.push(...v)
          else msgs.push(String(v))
        }
        setErrors(msgs.length ? msgs : ['No se pudo completar el registro.'])
      } else {
        setErrors(['No se pudo completar el registro.'])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={onSubmit}>
        <div className="auth__brand"><span aria-hidden="true">◇</span> SpotWise</div>
        <h1 className="auth__title">Crear cuenta</h1>
        <p className="auth__tagline">Comenzá a analizar ubicaciones hoy mismo</p>

        {errors.length > 0 && (
          <div className="auth__error">
            <ul>{errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}

        <div className="field-row">
          <label className="field">
            <span>Nombre</span>
            <input name="nombre" value={form.nombre} onChange={onChange} placeholder="Juan" />
          </label>
          <label className="field">
            <span>Apellido</span>
            <input name="apellido" value={form.apellido} onChange={onChange} placeholder="Pérez" />
          </label>
        </div>
        <label className="field">
          <span>Correo electrónico</span>
          <input type="email" name="email" value={form.email} onChange={onChange} placeholder="nombre@empresa.com" autoComplete="email" />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input type="password" name="password" value={form.password} onChange={onChange} placeholder="Mín. 8 caracteres, 1 mayúscula y 1 minúscula" autoComplete="new-password" />
        </label>
        <label className="field">
          <span>Confirmar contraseña</span>
          <input type="password" name="password2" value={form.password2} onChange={onChange} placeholder="••••••••" autoComplete="new-password" />
        </label>

        <button className="btn btn--primary btn--block" type="submit" disabled={loading}>
          {loading ? 'Creando cuenta…' : 'Registrarse'}
        </button>
        <p className="auth__alt">¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link></p>
      </form>
    </div>
  )
}
