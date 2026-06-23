import { nivelActividad, nivelCompetenciaScore } from '../utils/score.js'

const SEM_COLOR = { ROJO: '#dc2626', AMARILLO: '#d97706', VERDE: '#16a34a' }

function Indicador({ label, value, bar, semaforo }) {
  const semColor = SEM_COLOR[semaforo]
  return (
    <div className="ind">
      <span className="ind__label">{label}</span>
      <strong className="ind__value" style={semColor ? { color: semColor } : undefined}>{value}</strong>
      {bar != null && (
        <div className="ind__bar"><div style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} /></div>
      )}
    </div>
  )
}

// Tarjetas de indicadores compartidas entre la pantalla de análisis y la de
// detalle guardado, para que ambas muestren EXACTAMENTE lo mismo.
export default function IndicadoresAnalisis({
  actividadScore,
  competenciaScore,
  densidad,
  indiceSocioeconomico,
  semaforo,
}) {
  return (
    <div className="result__indicators">
      <Indicador
        label="Actividad comercial"
        value={nivelActividad(actividadScore)}
        bar={actividadScore}
      />
      <Indicador
        label="Competencia del rubro"
        value={nivelCompetenciaScore(competenciaScore)}
        bar={100 - competenciaScore}
      />
      <Indicador
        label="Densidad poblacional"
        value={densidad ? `${Math.round(densidad).toLocaleString('es-AR')} hab/km²` : '—'}
      />
      <Indicador
        label="Índice socioeconómico"
        value={indiceSocioeconomico || '—'}
        semaforo={semaforo}
      />
    </div>
  )
}
