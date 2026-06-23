import { describe, it, expect } from 'vitest'
import { tipoPrincipal } from './places.js'

describe('tipoPrincipal', () => {
  it('elige el primer tipo no genérico y reemplaza guiones bajos', () => {
    expect(tipoPrincipal(['establishment', 'shopping_mall'])).toBe('shopping mall')
    expect(tipoPrincipal(['restaurant', 'food', 'point_of_interest'])).toBe('restaurant')
  })

  it('cae al primer tipo si todos son genéricos', () => {
    expect(tipoPrincipal(['establishment', 'point_of_interest'])).toBe('establishment')
  })

  it('devuelve null si no hay tipos', () => {
    expect(tipoPrincipal([])).toBeNull()
    expect(tipoPrincipal()).toBeNull()
  })
})
