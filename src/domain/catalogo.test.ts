import { describe, expect, it } from 'vitest'
import { CATALOGO_ELETIVA, CATALOGO_PQA, nomeNoCatalogo } from './catalogo'
import { resolverValor } from './honorarios'
import { TABELA } from './__fixtures__/tabela'

describe('catalogo de procedimentos do servico', () => {
  it('traz os 24 codigos: 23 da planilha do servico mais o 30101913 do aviso', () => {
    expect(CATALOGO_ELETIVA).toHaveLength(24)
  })

  it('nao repete codigo: rotulos que dividem o mesmo codigo ficam juntos', () => {
    const codigos = CATALOGO_ELETIVA.map((i) => i.codigo)
    expect(new Set(codigos).size).toBe(codigos.length)
  })

  it('agrupa COM e SEM colangiografia sob 31005497, como na planilha', () => {
    const item = CATALOGO_ELETIVA.find((i) => i.codigo === '31005497')
    expect(item?.nomes.join(' ')).toMatch(/COM colangiografia/)
    expect(item?.nomes.join(' ')).toMatch(/SEM colangiografia/)
  })

  /**
   * Numa glosa quem decide e o texto da operadora, nao o rotulo interno. Onde
   * ha descricao oficial confirmada por documento dela, e essa que aparece.
   */
  it('prefere a descricao oficial da operadora quando ela existe', () => {
    expect(nomeNoCatalogo('31005497')).toBe(
      'Colecistectomia sem colangiografia por videolaparoscopia',
    )
    expect(nomeNoCatalogo('31009115')).toBe('Herniorrafia inguinal - unilateral')
  })

  it('cai no rotulo do servico quando a operadora nao confirmou o codigo', () => {
    expect(nomeNoCatalogo('31003281')).toBe('Enterectomia')
  })

  it('30101913 entrou no catalogo: a operadora o contempla e ele ja tem valor', () => {
    expect(nomeNoCatalogo('30101913')).toBe('TU partes moles - exerese')
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
