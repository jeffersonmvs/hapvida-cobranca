import { describe, expect, it } from 'vitest'
import { conciliar, parsearRelatorio } from './conciliacao'

describe('parsearRelatorio', () => {
  it('le CSV com cabecalho', () => {
    const linhas = parsearRelatorio(
      [
        'Senha;Codigo;Paciente;Data;Valor Apresentado;Valor Pago;Glosa;Motivo',
        '444555;31009115;MARIA JOSE;10/03/2026;280,00;192,00;88,00;Procedimento nao incluso em contrato',
        '666777;31009166;JOAO SILVA;10/03/2026;148,00;148,00;0,00;',
      ].join('\n'),
    )
    expect(linhas).toHaveLength(2)
    expect(linhas[0].senha).toBe('444555')
    expect(linhas[0].valor_apresentado).toBe(280)
    expect(linhas[0].valor_pago).toBe(192)
    expect(linhas[0].data).toBe('2026-03-10')
    expect(linhas[0].justificativa).toContain('nao incluso')
  })

  it('le colagem de texto solto do portal', () => {
    const linhas = parsearRelatorio(
      '10/03/2026 MARIA JOSE 31009115 444555 280,00 192,00\n' +
      '10/03/2026 JOAO SILVA 31009166 666777 148,00 148,00',
    )
    expect(linhas).toHaveLength(2)
    expect(linhas[0].senha).toBe('444555')
    expect(linhas[0].valor_pago).toBe(192)
  })
})

describe('conciliar (criterio 13)', () => {
  const banco = [
    { codigo_tuss: '31009115', senha: '444555', valor_cobrado: 280 },
    { codigo_tuss: '31009166', senha: '666777', valor_cobrado: 148 },
    { codigo_tuss: '31009093', senha: '888999', valor_cobrado: 148 },
  ]
  const relatorio = parsearRelatorio(
    [
      'Senha;Valor Apresentado;Valor Pago',
      '444555;280,00;192,00',
      '666777;100,00;100,00',
      '000111;476,00;476,00',
    ].join('\n'),
  )
  const r = conciliar(relatorio, banco)

  it('separa o que confere', () => {
    expect(r.conferem.map((c) => c.senha)).toEqual(['444555'])
  })

  it('separa o que diverge no valor', () => {
    expect(r.divergem.map((c) => c.senha)).toEqual(['666777'])
    expect(r.divergem[0].diferenca).toBe(48)
  })

  it('mostra a producao que nunca chegou ao relatorio', () => {
    expect(r.nao_encontrados_no_relatorio.map((p) => p.senha)).toEqual(['888999'])
  })

  it('mostra o que o relatorio traz e o banco nao conhece', () => {
    expect(r.nao_encontrados_no_banco.map((l) => l.senha)).toEqual(['000111'])
  })

  it('cruza por senha ignorando formatacao', () => {
    const c = conciliar(
      [{ senha: '444.555', valor_apresentado: 280, linha_original: '' }],
      [{ codigo_tuss: '31009115', senha: '444555', valor_cobrado: 280 }],
    )
    expect(c.conferem).toHaveLength(1)
  })
})
