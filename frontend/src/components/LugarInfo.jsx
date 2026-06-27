import { tipoPrincipal } from '../utils/places.js'

// Ícono del marcador de un comercio en el mapa: rojo y más grande para los
// competidores directos, gris y chico para el resto.
export function markerIcon(competidor) {
  if (!window.google) return undefined
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale: competidor ? 7 : 5,
    fillColor: competidor ? '#dc2626' : '#9ca3af',
    fillOpacity: 0.9,
    strokeColor: '#ffffff',
    strokeWeight: 1.2,
  }
}

// Contenido del InfoWindow al pulsar un comercio (nombre, calificación, etc.).
export default function LugarInfo({ lugar }) {
  const tipo = tipoPrincipal(lugar.tipos)
  return (
    <div className="lugar-info">
      <strong className="lugar-info__nombre">{lugar.nombre || 'Negocio sin nombre'}</strong>
      <span className={`lugar-info__tag ${lugar.competidor ? 'is-comp' : ''}`}>
        {lugar.competidor ? 'Competidor directo' : 'Comercio'}
      </span>
      <dl className="lugar-info__rows">
        {lugar.rating != null && (
          <div><dt>Calificación</dt><dd>★ {lugar.rating}</dd></div>
        )}
        <div><dt>Reseñas</dt><dd>{(lugar.resenas ?? 0).toLocaleString('es-AR')}</dd></div>
        {tipo && <div><dt>Tipo</dt><dd className="lugar-info__tipo">{tipo}</dd></div>}
      </dl>
    </div>
  )
}
