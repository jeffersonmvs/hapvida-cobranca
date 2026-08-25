import { describe, expect, it } from 'vitest'
import { alertaDigitacaoSavi, alertaXml, alertasDeRecurso, calendarioEm, prazoRecurso } from './prazos'

describe('calendario da competencia (§12)', () => {
  const cal = calendarioEm('2026-08', '2026-08-25')
  const etapa = (n: string) => cal.find((e) => e.etapa === n)

  it('poe o XML no dia 7 do mes seguinte', () => {
    expect(etapa('XML no portal')?.vence_em).toBe('2026-09-07')
  })
  it('poe a nota fiscal no dia 20 do mes seguinte', () => {
    expect(etapa('Nota fiscal')?.vence_em).toBe('2026-09-20')
  })
  it('poe o pagamento no dia 20 do mes subsequente', () => {
    expect(etapa('Pagamento')?.vence_em).toBe('2026-10-20')
  })
  it('fecha a digitacao no SAVI no fim do proprio mes', () => {
    expect(etapa('Digitacao no SAVI')?.vence_em).toBe('2026-08-31')
    expect(etapa('Digitacao no SAVI')?.dias_restantes).toBe(6)
  })
})

describe('alerta de digitacao no SAVI (criterio 5)', () => {
  const aFaturar = [
    { id: 'a', codigo_tuss: '31009115', senha: '1', valor_cobrado: 280 },
    { id: 'b', codigo_tuss: '31009166', senha: '2', valor_cobrado: 148 },
  ]
  const datas = new Map([['a', '2026-08-10'], ['b', '2026-08-12']])

  it('sobe para atencao a partir do dia 25', () => {
    const a = alertaDigitacaoSavi(aFaturar, datas, '2026-08-25')
    expect(a?.severidade).toBe('atencao')
    expect(a?.titulo).toContain('2 procedimento')
    expect(a?.mensagem).toContain('6 dia')
  })

  it('vira critico nos ultimos dois dias', () => {
    expect(alertaDigitacaoSavi(aFaturar, datas, '2026-08-30')?.severidade).toBe('critico')
  })

  it('e apenas informativo no comeco do mes', () => {
    expect(alertaDigitacaoSavi(aFaturar, datas, '2026-08-12')?.severidade).toBe('info')
  })

  it('some quando nao ha nada a faturar', () => {
    expect(alertaDigitacaoSavi([], datas, '2026-08-28')).toBeNull()
  })
})

describe('alerta de XML', () => {
  it('avisa perto do dia 7 do mes seguinte', () => {
    expect(alertaXml('2026-08', 12, '2026-09-05')?.severidade).toBe('critico')
    expect(alertaXml('2026-08', 12, '2026-09-01')?.severidade).toBe('atencao')
    expect(alertaXml('2026-08', 12, '2026-08-10')).toBeNull()
  })
  it('vira critico depois do prazo', () => {
    expect(alertaXml('2026-08', 12, '2026-09-10')?.mensagem).toContain('venceu')
  })
})

describe('prazo de recurso', () => {
  it('sao 30 dias apos o demonstrativo', () => {
    expect(prazoRecurso('2026-08-10')).toBe('2026-09-09')
  })

  it('alerta as glosas com prazo vencendo', () => {
    const alertas = alertasDeRecurso(
      [
        { codigo_tuss: '31009115', competencia: 'MEDISA 08/2026', valor_glosado: 88, data_demonstrativo: '2026-08-10' },
        { codigo_tuss: '31009166', competencia: 'MEDISA 06/2026', valor_glosado: 20, data_demonstrativo: '2026-06-10' },
      ],
      '2026-09-05',
    )
    expect(alertas).toHaveLength(2)
    expect(alertas[0].mensagem).toContain('venceu')
    expect(alertas[1].severidade).toBe('critico')
  })
})
