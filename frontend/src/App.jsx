import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import AnalysisPage from './pages/AnalysisPage.jsx'

function Proximamente({ titulo }) {
  return (
    <div className="placeholder">
      <h2>{titulo}</h2>
      <p>Esta funcionalidad se implementa en una próxima fase del proyecto.</p>
    </div>
  )
}

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/analisis" element={<AnalysisPage />} />
          <Route path="/mis-analisis" element={<Proximamente titulo="Mis Análisis" />} />
        </Routes>
      </main>
    </>
  )
}
