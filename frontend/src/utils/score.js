// Helpers de presentación del score de viabilidad, compartidos por las pantallas
// de análisis y reutilizables/testeables de forma aislada.

export const COLOR_DECISION = { ALTA: '#15803d', MEDIA: '#b45309', BAJA: '#b91c1c' }
export const LABEL_DECISION = {
  ALTA: 'Alta viabilidad',
  MEDIA: 'Viabilidad media',
  BAJA: 'Baja viabilidad',
}

// Nivel cualitativo de actividad a partir del indicador 0-100.
export const nivelActividad = (v) => (v >= 66 ? 'Alta' : v >= 33 ? 'Moderada' : 'Baja')

// Nivel de competencia a partir de la cantidad de competidores directos.
export const nivelCompetencia = (n) => (n >= 10 ? 'Alta' : n >= 4 ? 'Moderada' : 'Baja')
