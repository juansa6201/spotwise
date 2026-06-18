import axios from 'axios'

// baseURL '/api' → en desarrollo Vite lo redirige a http://localhost:8000/api
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export default api
