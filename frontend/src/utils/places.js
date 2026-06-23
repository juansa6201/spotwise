// Helpers de presentación de lugares de Google Places.

// Tipos genéricos de Google Places que no aportan información útil al usuario.
export const TIPOS_GENERICOS = new Set(['point_of_interest', 'establishment', 'food', 'store'])

// Tipo principal legible de un comercio (omite los genéricos, reemplaza "_").
export function tipoPrincipal(tipos = []) {
  const t = tipos.find((x) => !TIPOS_GENERICOS.has(x)) || tipos[0]
  return t ? t.replace(/_/g, ' ') : null
}
