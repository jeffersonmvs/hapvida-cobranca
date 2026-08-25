import { describe, expect, it } from 'vitest'
import { calcularAtendimento, calcularConsultas } from './calculo'
import { TABELA } from './__fixtures__/tabela'
import type { ProcedimentoRealizado } from './tipos'

const p = (o: Partial<ProcedimentoRealizado> & { codigo_tuss: string }): ProcedimentoRealizado => ({
  senha: 'S1',
  valor_cobrado: 0,
  ...o,
})

describe('calcularAtendimento', () => {
  it('regra 1: dois sitios de hernia somam o valor das partes (criterio 2)', () => {
    const r = calcularAtendimento(
      [
        p({ codigo_tuss: '31009166', senha: '111', valor_cobrado: 148 }),
        p({ codigo_tuss: '31009093', senha: '222', valor_cobrado: 148 }),
      ],
      TABELA,
      '2026-08-10',
    )
    expect(r.total_cobrado).toBe(296)
    expect(r.total_previsto).toBe(296)
  })

  it('criterio 4: 31009115 cobra 280, preve 192 e conhece a glosa de 88', () => {
    const r = calcularAtendimento(
      [p({ codigo_tuss: '31009115', senha: '900', valor_cobrado: 280 })],
      TABELA,
      '2026-08-10',
    )
    expect(r.total_cobrado).toBe(280)
    expect(r.total_previsto).toBe(192)
    expect(r.total_glosa_recorrente).toBe(88)
  })

  it('regra 10: ooforectomia cobra 1.056,78 - o 697,60 pago nao vira preco', () => {
    const r = calcularAtendimento(
      [p({ codigo_tuss: '31305016', senha: '77', valor_cobrado: 1056.78 })],
      TABELA,
      '2026-08-10',
    )
    expect(r.total_cobrado).toBe(1056.78)
    expect(r.total_previsto).toBe(697.6)
    expect(r.total_glosa_recorrente).toBe(359.18)
  })

  it('regra 2: procedimento em sala PQA nao tem valor zerado', () => {
    const r = calcularAtendimento(
      [p({ codigo_tuss: '30101913', senha: '10', valor_cobrado: 100 })],
      TABELA,
      '2026-08-10',
    )
    // a classe do atendimento nem entra na funcao - o valor e o mesmo
    expect(r.total_cobrado).toBe(100)
    expect(r.itens[0].remunerado).toBe(true)
  })

  it('regra 3: auxiliar nao e remunerado, mas continua registrado', () => {
    const r = calcularAtendimento(
      [
        p({ codigo_tuss: '31009115', senha: '1', valor_cobrado: 280 }),
        p({ codigo_tuss: '31009093', senha: '2', valor_cobrado: 148, cirurgiao_principal: false }),
      ],
      TABELA,
      '2026-08-10',
    )
    expect(r.itens[1].remunerado).toBe(false)
    expect(r.total_previsto).toBe(192)
  })

  it('regra 4: 31005497 e 43050200 no mesmo ato remuneram apenas um', () => {
    const r = calcularAtendimento(
      [
        p({ codigo_tuss: '31005497', senha: 'A', valor_cobrado: 1056.78 }),
        p({ codigo_tuss: '43050200', senha: 'B', valor_cobrado: 1056.78 }),
      ],
      TABELA,
      '2026-08-10',
    )
    expect(r.itens.filter((i) => i.remunerado)).toHaveLength(1)
    expect(r.total_previsto).toBe(1056.78)
  })

  it('regra 5: decisao intraoperatoria nao e remunerada', () => {
    const r = calcularAtendimento(
      [p({ codigo_tuss: '30101913', senha: '1', valor_cobrado: 100, decisao_intraoperatoria: true })],
      TABELA,
      '2026-08-10',
    )
    expect(r.itens[0].remunerado).toBe(false)
    expect(r.total_previsto).toBe(0)
  })

  it('regra 6: duas pequenas cirurgias no mesmo ato preveem apenas a maior', () => {
    const r = calcularAtendimento(
      [
        p({ codigo_tuss: '30101913', senha: '1', valor_cobrado: 100 }),
        p({ codigo_tuss: '42030153', senha: '2', valor_cobrado: 120 }),
      ],
      TABELA,
      '2026-08-10',
    )
    expect(r.total_cobrado).toBe(220)
    expect(r.total_previsto).toBe(100) // 42030153 paga 100
    expect(r.itens.find((i) => i.codigo_tuss === '30101913')?.remunerado).toBe(false)
  })

  it('regra 9: codigo sem valor pago conhecido nao ganha previsao estimada', () => {
    const r = calcularAtendimento(
      [p({ codigo_tuss: '30101450', senha: '1', valor_cobrado: 184 })],
      TABELA,
      '2026-08-10',
    )
    expect(r.itens[0].valor_previsto).toBeNull()
    expect(r.sem_previsao).toEqual(['30101450'])
    expect(r.total_previsto).toBe(0)
  })

  it('soma sem erro de ponto flutuante', () => {
    const r = calcularAtendimento(
      [
        p({ codigo_tuss: '31005497', senha: '1', valor_cobrado: 1056.78 }),
        p({ codigo_tuss: '31009115', senha: '2', valor_cobrado: 280 }),
        p({ codigo_tuss: '31305016', senha: '3', valor_cobrado: 1056.78 }),
      ],
      TABELA,
      '2026-08-10',
    )
    expect(r.total_cobrado).toBe(2393.56)
  })
})

describe('calcularConsultas', () => {
  it('regra 7: retorno entra na producao mas nao no valor', () => {
    const r = calcularConsultas([
      { data: '2026-08-03', unidade: 'Hapclinica Lobo Filho', qtd_consultas: 12, qtd_retornos: 5, valor_unitario: 60 },
    ])
    expect(r.qtd_consultas).toBe(12)
    expect(r.qtd_retornos).toBe(5)
    expect(r.valor).toBe(720)
  })
})
