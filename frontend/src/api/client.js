import axios from 'axios'

export const ACCESS_KEY = 'sw_access'
export const REFRESH_KEY = 'sw_refresh'

// baseURL '/api' → en desarrollo Vite lo redirige a http://localhost:8000/api
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Adjunta el token JWT (si existe) a cada petición.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
