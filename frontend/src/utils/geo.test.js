import { describe, it, expect } from 'vitest'
import { direccionCalleNumero } from './geo.js'

describe('direccionCalleNumero', () => {
  it('arma "Calle Número" cuando hay route y street_number', () => {
    const result = {
      address_components: [
        { types: ['route'], long_name: 'Avenida Colón' },
        { types: ['street_number'], long_name: '1000' },
      ],
    }
    expect(direccionCalleNumero(result)).toBe('Avenida Colón 1000')
  })

  it('devuelve solo la calle si falta el número', () => {
    const result = {
      address_components: [{ types: ['route'], long_name: 'Bv San Juan' }],
    }
    expect(direccionCalleNumero(result)).toBe('Bv San Juan')
  })

  it('cae al primer tramo de formatted_address si no hay calle', () => {
    const result = {
      address_components: [],
      formatted_address: 'Plaza San Martín, Córdoba, Argentina',
    }
    expect(direccionCalleNumero(result)).toBe('Plaza San Martín')
  })
})
