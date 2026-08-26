import { describe, expect, it } from 'vitest'
import { CATALOGO_ELETIVA, CATALOGO_PQA, nomeNoCatalogo } from './catalogo'
import { resolverValor } from './honorarios'
import { TABELA } from './__fixtures__/tabela'

describe('catalogo de procedimentos do servico', () => {
  it('traz as 23 linhas de codigo da planilha de cirurgia eletiva', () => {
    expect(CATALOGO_ELETIVA).toHaveLength(23)
  })

  it('nao repete codigo: rotulos que dividem o mesmo codigo ficam juntos', () => {
    const codigos = CATALOGO_ELETIVA.map((i) => i.codigo)
    expect(new Set(codigos).size).toBe(codigos.length)
  })

  it('agrupa COM e SEM colangiografia sob 31005497, como na planilha', () => {
    expect(nomeNoCatalogo('31005497')).toMatch(/COM colangiografia/)
    expect(nomeNoCatalogo('31005497')).toMatch(/SEM colangiografia/)
  })

  it('devolve null para codigo que nao existe', () => {
    expect(nomeNoCatalogo('99996666')).toBeNull()
  })

  it('PQA tem 14 rotulos e nenhum codigo', () => {
    expect(CATALOGO_PQA).toHaveLength(14)
  })
})

describe('resolverValor distingue os dois motivos de bloqueio', () => {
  it('codigo do catalogo sem preco: manda cadastrar o valor', () => {
    const r = resolverValor(TABELA, '31003281', '2026-08-11')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toMatch(/Enterectomia/)
    expect(r.motivo).toMatch(/sem valor cadastrado/)
  })

  it('codigo fora do catalogo: manda conferir a leitura da foto', () => {
    const r = resolverValor(TABELA, '99996666', '2026-08-11')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.motivo).toMatch(/nao existe no catalogo/)
    expect(r.motivo).toMatch(/leitura errada/)
  })

  it('nos dois casos bloqueia - regra 9 nao afrouxa', () => {
    expect(resolverValor(TABELA, '31003281', '2026-08-11').ok).toBe(false)
    expect(resolverValor(TABELA, '99996666', '2026-08-11').ok).toBe(false)
  })
})
