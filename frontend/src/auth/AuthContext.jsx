import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api, { ACCESS_KEY, REFRESH_KEY } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Al montar, si hay token guardado, recupera el usuario actual.
  useEffect(() => {
    const token = localStorage.getItem(ACCESS_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get('/auth/me/')
      .then(({ data }) => setUser(data))
      .catch(() => {
        localStorage.removeItem(ACCESS_KEY)
        localStorage.removeItem(REFRESH_KEY)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login/', { email, password })
    localStorage.setItem(ACCESS_KEY, data.access)
    localStorage.setItem(REFRESH_KEY, data.refresh)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(
    async (payload) => {
      await api.post('/auth/register/', payload)
      // Auto-login luego del registro exitoso.
      return login(payload.email, payload.password)
    },
    [login],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    setUser(null)
  }, [])

  const value = { user, loading, isAuthenticated: Boolean(user), login, register, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
