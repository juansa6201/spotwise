import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import AnalysisPage from './pages/AnalysisPage.jsx'
import MisAnalisisPage from './pages/MisAnalisisPage.jsx'
import AnalisisDetailPage from './pages/AnalisisDetailPage.jsx'

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
          <Route path="/mis-analisis" element={<MisAnalisisPage />} />
          <Route path="/mis-analisis/:id" element={<AnalisisDetailPage />} />
        </Routes>
      </main>
    </>
  )
}
