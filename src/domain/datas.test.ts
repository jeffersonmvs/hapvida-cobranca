import { describe, expect, it } from 'vitest'
import {
  addDias, competencia, diffDias, formatarData, formatarMes, horaCompleta,
  mesDe, mesSeguinte, parseCompetencia, parseDataBR, ultimoDiaDoMes,
} from './datas'
import { formatarBRL, parseBRL, somar, subtrair } from './dinheiro'

describe('datas', () => {
  it('formata e interpreta no padrao brasileiro', () => {
    expect(formatarData('2026-08-25')).toBe('25/08/2026')
    expect(parseDataBR('25/08/2026')).toBe('2026-08-25')
    expect(parseDataBR('5/8/26')).toBe('2026-08-05')
    expect(parseDataBR('bobagem')).toBeNull()
  })

  it('nao escorrega de dia por fuso', () => {
    expect(addDias('2026-08-01', -1)).toBe('2026-07-31')
    expect(addDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(diffDias('2026-08-10', '2026-09-09')).toBe(30)
  })

  it('resolve fim de mes inclusive fevereiro', () => {
    expect(ultimoDiaDoMes('2026-02')).toBe('2026-02-28')
    expect(ultimoDiaDoMes('2028-02')).toBe('2028-02-29')
    expect(ultimoDiaDoMes('2026-08')).toBe('2026-08-31')
  })

  it('trabalha com competencia', () => {
    expect(competencia('2026-03')).toBe('MEDISA 03/2026')
    expect(competencia('2026-03', 'MEDFOR')).toBe('MEDFOR 03/2026')
    expect(parseCompetencia('MEDISA 03/2026')).toEqual({ fonte: 'MEDISA', mes: '2026-03' })
    expect(mesSeguinte('2026-12')).toBe('2027-01')
    expect(formatarMes(mesDe('2026-08-25'))).toBe('08/2026')
  })

  it('completa a hora no formato do TISS', () => {
    expect(horaCompleta('8:00')).toBe('08:00:00')
    expect(horaCompleta('09:10:30')).toBe('09:10:30')
    expect(horaCompleta(null)).toBeNull()
  })
})

describe('dinheiro', () => {
  it('soma em centavos, sem erro de float', () => {
    expect(somar(0.1, 0.2)).toBe(0.3)
    expect(somar(1056.78, 1056.78, 280)).toBe(2393.56)
    expect(subtrair(280, 192)).toBe(88)
  })

  it('formata em reais e nunca inventa zero', () => {
    expect(formatarBRL(1056.78).replace(/ /g, ' ')).toBe('R$ 1.056,78')
    expect(formatarBRL(null)).toBe('—')
  })

  it('interpreta valor digitado', () => {
    expect(parseBRL('R$ 1.056,78')).toBe(1056.78)
    expect(parseBRL('1056,78')).toBe(1056.78)
    expect(parseBRL('1056.78')).toBe(1056.78)
    expect(parseBRL('')).toBeNull()
  })
})
