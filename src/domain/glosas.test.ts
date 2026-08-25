import { describe, expect, it } from 'vitest'
import {
  agruparPorAssinatura,
  assinaturaGlosa,
  exposicaoDoMes,
  padroesNovos,
  porPrazo,
  rankingPorCodigo,
  serieTemporal,
  totalizar,
} from './glosas'
import { TABELA } from './__fixtures__/tabela'
import type { Glosa } from './tipos'

/**
 * O caso real: 31009115 glosado em R$ 88,00 de fev a jun/2026. Ate maio a
 * operadora escrevia "procedimento nao incluso em contrato"; em junho passou a
 * escrever "pago abaixo da tabela contratual". E a mesma glosa.
 */
const GLOSAS_31009115: Glosa[] = [
  ...['2026-02', '2026-03', '2026-04', '2026-05'].flatMap((mes, i) =>
    Array.from({ length: i === 0 ? 5 : 6 }, (_, k) => ({
      codigo_tuss: '31009115',
      competencia: `MEDISA ${mes.slice(5)}/${mes.slice(0, 4)}`,
      valor_glosado: 88,
      justificativa: 'Procedimento nao incluso em contrato',
      data_demonstrativo: `${mes}-10`,
      recursada: mes === '2026-02' && k < 3,
      valor_recurso: mes === '2026-02' && k < 3 ? 88 : 0,
    })),
  ),
  ...Array.from({ length: 2 }, () => ({
    codigo_tuss: '31009115',
    competencia: 'MEDISA 06/2026',
    valor_glosado: 88,
    justificativa: 'Pago abaixo da tabela contratual',
    data_demonstrativo: '2026-06-10',
    recursada: false,
    valor_recurso: 0,
  })),
]

describe('assinatura de glosa', () => {
  it('e a mesma para glosas de mesmo codigo e valor, com justificativas diferentes', () => {
    expect(
      assinaturaGlosa({ codigo_tuss: '31009115', valor_glosado: 88 }),
    ).toBe(assinaturaGlosa({ codigo_tuss: '31009115', valor_glosado: 88 }))
  })

  it('separa codigos diferentes com o mesmo valor', () => {
    expect(assinaturaGlosa({ codigo_tuss: '31009115', valor_glosado: 88 })).not.toBe(
      assinaturaGlosa({ codigo_tuss: '42030153', valor_glosado: 88 }),
    )
  })
})

describe('agruparPorAssinatura (criterio 16)', () => {
  const grupos = agruparPorAssinatura(GLOSAS_31009115)

  it('agrupa fev-jun/2026 numa unica assinatura apesar da virada de texto', () => {
    expect(grupos).toHaveLength(1)
    expect(grupos[0].ocorrencias).toBe(25)
    expect(grupos[0].valor_total).toBe(2200)
  })

  it('registra as duas redacoes usadas pela operadora', () => {
    expect(grupos[0].textos).toHaveLength(2)
  })

  it('marca em que competencia a justificativa mudou de texto', () => {
    const mudanca = grupos[0].mudancas_de_texto[0]
    expect(mudanca.de).toContain('nao incluso')
    expect(mudanca.para).toContain('abaixo da tabela')
    expect(mudanca.competencia).toBe('MEDISA 06/2026')
  })

  it('conta as nao recursadas - 22 casos, R$ 1.936,00 que passaram despercebidos', () => {
    expect(grupos[0].nao_recursadas).toBe(22)
  })
})

describe('serieTemporal', () => {
  it('devolve a serie mes a mes em ordem', () => {
    const serie = serieTemporal(agruparPorAssinatura(GLOSAS_31009115)[0])
    expect(serie.map((s) => s.mes)).toEqual([
      '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    ])
    expect(serie[0].ocorrencias).toBe(5)
  })
})

describe('padroesNovos', () => {
  it('sinaliza assinatura com 3+ ocorrencias em 60 dias sem recurso', () => {
    const grupos = agruparPorAssinatura(GLOSAS_31009115)
    expect(padroesNovos(grupos, '2026-06-20')).toHaveLength(1)
  })

  it('nao sinaliza fora da janela', () => {
    const grupos = agruparPorAssinatura(GLOSAS_31009115)
    expect(padroesNovos(grupos, '2026-12-31')).toHaveLength(0)
  })
})

describe('rankingPorCodigo', () => {
  it('calcula taxa de glosa quando ha producao lancada para comparar', () => {
    const linhas = rankingPorCodigo(
      GLOSAS_31009115,
      Array.from({ length: 50 }, () => ({
        codigo_tuss: '31009115', senha: 'x', valor_cobrado: 280,
      })),
    )
    expect(linhas[0].taxa_glosa).toBe(0.5)
    expect(linhas[0].valor_total).toBe(2200)
  })

  it('deixa a taxa nula quando nao ha producao para comparar', () => {
    expect(rankingPorCodigo(GLOSAS_31009115)[0].taxa_glosa).toBeNull()
  })
})

describe('porPrazo', () => {
  it('ordena por prazo vencendo primeiro e ignora as ja recursadas', () => {
    const lista = porPrazo(GLOSAS_31009115, '2026-06-15')
    expect(lista).toHaveLength(22)
    expect(lista[0].glosa.data_demonstrativo).toBe('2026-02-10')
    expect(lista[0].vencido).toBe(true)
  })

  it('calcula os 30 dias apos o demonstrativo', () => {
    const lista = porPrazo(
      [{ codigo_tuss: 'x', competencia: 'MEDISA 08/2026', valor_glosado: 10, data_demonstrativo: '2026-08-10' }],
      '2026-08-25',
    )
    expect(lista[0].prazo).toBe('2026-09-09')
    expect(lista[0].dias_restantes).toBe(15)
  })
})

describe('totalizar', () => {
  it('soma glosado, em recurso e o perdido por prazo vencido', () => {
    const t = totalizar(GLOSAS_31009115, '2026-08-25')
    expect(t.glosado).toBe(2200)
    expect(t.em_recurso).toBe(264)
    // 22 x 88,00 = R$ 1.936,00 - exatamente o prejuizo que motivou o app
    expect(t.perdido).toBe(1936)
  })
})

describe('exposicaoDoMes', () => {
  it('estima quanto do que esta a faturar tem historico de glosa', () => {
    const e = exposicaoDoMes(
      [
        { codigo_tuss: '31009115', senha: '1', valor_cobrado: 280 },
        { codigo_tuss: '31009115', senha: '2', valor_cobrado: 280 },
        { codigo_tuss: '31009166', senha: '3', valor_cobrado: 148 },
      ],
      TABELA,
      '2026-08-10',
    )
    expect(e.total_a_faturar).toBe(708)
    expect(e.exposto).toBe(176)
    expect(e.itens[0].codigo_tuss).toBe('31009115')
  })
})
