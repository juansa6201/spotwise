import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import LugarInfo from './LugarInfo.jsx'

describe('LugarInfo', () => {
  it('muestra el nombre, la calificación, las reseñas y el tipo del competidor', () => {
    render(
      <LugarInfo
        lugar={{
          nombre: 'Bar Rival', rating: 4.2, resenas: 1200,
          tipos: ['bar'], competidor: true,
        }}
      />,
    )
    expect(screen.getByText('Bar Rival')).toBeInTheDocument()
    expect(screen.getByText('Competidor directo')).toBeInTheDocument()
    expect(screen.getByText('★ 4.2')).toBeInTheDocument()
    expect(screen.getByText('1.200')).toBeInTheDocument() // reseñas con separador es-AR
  })

  it('usa un nombre por defecto cuando falta', () => {
    render(<LugarInfo lugar={{ tipos: [], resenas: 0 }} />)
    expect(screen.getByText('Negocio sin nombre')).toBeInTheDocument()
  })
})
