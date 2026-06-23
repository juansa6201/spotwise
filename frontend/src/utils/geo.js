// Helpers de geocodificación, compartidos por las pantallas de análisis.

// Arma "Calle Número" a partir de un resultado de geocodificación de Google.
export function direccionCalleNumero(result) {
  const comp = result.address_components || []
  const buscar = (tipo) => comp.find((c) => c.types.includes(tipo))?.long_name
  const calle = buscar('route')
  const numero = buscar('street_number')
  if (calle && numero) return `${calle} ${numero}`
  if (calle) return calle
  return (result.formatted_address || '').split(',')[0]
}
