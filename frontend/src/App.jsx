import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import HomePage from './pages/HomePage.jsx'

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          {/* Las próximas pantallas se incorporan por fase:
              /analisis, /login, /registro, /mis-analisis */}
        </Routes>
      </main>
    </>
  )
}
