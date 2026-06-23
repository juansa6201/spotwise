import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'global.css'), 'utf8')

// Las media queries no se pueden testear funcionalmente en jsdom (no calcula
// layout). Estos tests son una guarda de regresión: aseguran que la hoja de
// estilos siga declarando los breakpoints y las reglas responsive clave.
describe('estilos responsive', () => {
  it('define los breakpoints de tablet y teléfono', () => {
    expect(css).toContain('@media (max-width: 860px)')
    expect(css).toContain('@media (max-width: 560px)')
  })

  it('apila el análisis (sidebar + mapa) en pantallas chicas', () => {
    const tablet = css.slice(css.indexOf('@media (max-width: 860px)'))
    expect(tablet).toMatch(/\.analysis\s*\{[^}]*flex-direction:\s*column/)
    // El mapa necesita alto explícito al apilarse (si no, flex:1 lo deja en 0).
    expect(tablet).toMatch(/\.analysis__map\s*\{[^}]*height:/)
  })

  it('colapsa las grillas de formulario a una columna', () => {
    const tablet = css.slice(css.indexOf('@media (max-width: 860px)'))
    expect(tablet).toMatch(/\.field-row\s*\{[^}]*grid-template-columns:\s*1fr/)
  })
})
