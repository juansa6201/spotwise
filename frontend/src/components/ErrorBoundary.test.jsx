import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary.jsx'

function Boom() {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('muestra el fallback cuando un hijo lanza un error', () => {
    // React y el logger imprimen el error por consola; lo silenciamos en el test.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renderiza los hijos si no hay error', () => {
    render(
      <ErrorBoundary>
        <p>contenido ok</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('contenido ok')).toBeInTheDocument()
  })
})
