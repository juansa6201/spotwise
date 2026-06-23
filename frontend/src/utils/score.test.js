import { describe, it, expect } from 'vitest'
import {
  COLOR_DECISION,
  LABEL_DECISION,
  nivelActividad,
  nivelCompetencia,
  nivelCompetenciaScore,
} from './score.js'

describe('nivelActividad', () => {
  it('clasifica por los umbrales 33 y 66', () => {
    expect(nivelActividad(80)).toBe('Alta')
    expect(nivelActividad(66)).toBe('Alta')
    expect(nivelActividad(50)).toBe('Moderada')
    expect(nivelActividad(33)).toBe('Moderada')
    expect(nivelActividad(10)).toBe('Baja')
    expect(nivelActividad(0)).toBe('Baja')
  })
})

describe('nivelCompetencia', () => {
  it('clasifica por la cantidad de competidores', () => {
    expect(nivelCompetencia(12)).toBe('Alta')
    expect(nivelCompetencia(10)).toBe('Alta')
    expect(nivelCompetencia(5)).toBe('Moderada')
    expect(nivelCompetencia(4)).toBe('Moderada')
    expect(nivelCompetencia(2)).toBe('Baja')
    expect(nivelCompetencia(0)).toBe('Baja')
  })
})

describe('nivelCompetenciaScore', () => {
  it('deriva el nivel del indicador 0-100 (inverso al de competidores)', () => {
    expect(nivelCompetenciaScore(0)).toBe('Alta')
    expect(nivelCompetenciaScore(33.3)).toBe('Alta')
    expect(nivelCompetenciaScore(40)).toBe('Moderada')
    expect(nivelCompetenciaScore(73.3)).toBe('Moderada')
    expect(nivelCompetenciaScore(80)).toBe('Baja')
    expect(nivelCompetenciaScore(100)).toBe('Baja')
  })
})

describe('mapas de decisión', () => {
  it('cubren ALTA, MEDIA y BAJA', () => {
    expect(Object.keys(COLOR_DECISION)).toEqual(['ALTA', 'MEDIA', 'BAJA'])
    expect(LABEL_DECISION.ALTA).toBe('Alta viabilidad')
    expect(LABEL_DECISION.MEDIA).toBe('Viabilidad media')
    expect(LABEL_DECISION.BAJA).toBe('Baja viabilidad')
  })
})
