import { describe, expect, it } from 'vitest'
import { gerarLote, PendenciasDoLote, validarLote, paraLatin1, calcularHash, type LoteEntrada } from './tiss'
import { TABELA } from './__fixtures__/tabela'
import { CONFIG_PADRAO } from './tipos'

const CONFIG_COM_CNES = { ...CONFIG_PADRAO, cnes: '1234567' }

const entrada = (over: Partial<LoteEntrada> = {}): LoteEntrada => ({
  config: CONFIG_COM_CNES,
  tabela: TABELA,
  numero_lote: 41,
  sequencial_transacao: 41,
  data_registro: '2026-09-02',
  hora_registro: '08:30',
  guias: [
    {
      numero_guia: 1201,
      atendimento: {
        numero: '188912993',
        data: '2026-08-10',
        hora_inicio: '08:00',
        hora_fim: '09:10',
        local: 'Hospital Aldeota',
        classe: 'centro_cirurgico',
      },
      paciente: { nome: 'MARIA JOSE DA CONCEICAO', carteira: '00123456789' },
      procedimentos: [
        { codigo_tuss: '31009166', senha: '444555', valor_cobrado: 148 },
        { codigo_tuss: '31009093', senha: '666777', valor_cobrado: 148 },
      ],
    },
  ],
  ...over,
})

describe('validarLote (criterio 11 e 14)', () => {
  it('bloqueia e explica quando o CNES esta pendente', () => {
    const p = validarLote(entrada({ config: { ...CONFIG_PADRAO, cnes: null } }))
    const cnes = p.find((x) => x.campo === 'CNES')
    expect(cnes).toBeTruthy()
    expect(cnes?.mensagem).toContain('Configuracao')
  })

  it('trata a string PENDENTE como ausencia de CNES', () => {
    const p = validarLote(entrada({ config: { ...CONFIG_PADRAO, cnes: 'PENDENTE' } }))
    expect(p.some((x) => x.campo === 'CNES')).toBe(true)
  })

  it('bloqueia procedimento sem senha', () => {
    const e = entrada()
    e.guias[0].procedimentos[1].senha = ''
    expect(validarLote(e).some((p) => p.campo === 'senhaAutorizacao')).toBe(true)
  })

  it('bloqueia codigo interno SEM-TUSS no XML', () => {
    const e = entrada({
      tabela: [
        ...TABELA,
        {
          codigo_tuss: 'SEM-TUSS-04', descricao: 'Exerese de unha', valor_cobrar: 32,
          valor_pago: null, glosa_recorrente: null, confianca: 'a_confirmar',
          codigo_interno: true, vigencia_inicio: '2026-01-01',
        },
      ],
    })
    e.guias[0].procedimentos = [{ codigo_tuss: 'SEM-TUSS-04', senha: '9', valor_cobrado: 32 }]
    const p = validarLote(e)
    expect(p.some((x) => x.mensagem.includes('codigo interno'))).toBe(true)
  })

  it('bloqueia rascunho de extracao nao revisada (criterio 9)', () => {
    const e = entrada()
    e.guias[0].procedimentos[0].rascunho = true
    expect(validarLote(e).some((p) => p.mensagem.includes('rascunho'))).toBe(true)
  })

  it('nao aponta pendencia num lote completo', () => {
    expect(validarLote(entrada())).toEqual([])
  })
})

describe('gerarLote', () => {
  const lote = gerarLote(entrada())

  it('declara ISO-8859-1 e o padrao 4.03.00', () => {
    expect(lote.xml).toContain('encoding="ISO-8859-1"')
    expect(lote.xml).toContain('<ans:Padrao>4.03.00</ans:Padrao>')
  })

  it('usa codigoPrestadorNaOperadora e nunca emite CPF vazia', () => {
    expect(lote.xml).toContain('<ans:codigoPrestadorNaOperadora>6122248</ans:codigoPrestadorNaOperadora>')
    expect(lote.xml).not.toContain('<ans:CPF>')
    expect(lote.xml).not.toMatch(/<ans:\w+><\/ans:\w+>/)
    expect(lote.xml).not.toContain('/>')
  })

  it('emite os dados fixos do prestador', () => {
    expect(lote.xml).toContain('<ans:codigoTabela>22</ans:codigoTabela>')
    expect(lote.xml).toContain('<ans:conselhoProfissional>1</ans:conselhoProfissional>')
    expect(lote.xml).toContain('<ans:UF>23</ans:UF>')
    expect(lote.xml).toContain('<ans:CBOS>225265</ans:CBOS>')
    expect(lote.xml).toContain('<ans:grauParticipacao>00</ans:grauParticipacao>')
    expect(lote.xml).toContain('<ans:CNES>1234567</ans:CNES>')
  })

  it('poe os dois sitios na mesma guia, cada um com sua senha', () => {
    expect(lote.qtd_guias).toBe(1)
    expect(lote.xml.match(/<ans:procedimentoRealizado>/g)).toHaveLength(2)
    expect(lote.xml).toContain('<ans:senhaAutorizacao>444555</ans:senhaAutorizacao>')
    expect(lote.xml).toContain('<ans:senhaAutorizacao>666777</ans:senhaAutorizacao>')
    expect(lote.valor_total).toBe(296)
    expect(lote.xml).toContain('<ans:valorTotalHonorarios>296.00</ans:valorTotalHonorarios>')
  })

  it('emite o hash MD5 no epilogo, calculado sem o proprio hash', () => {
    expect(lote.hash).toMatch(/^[0-9a-f]{32}$/)
    expect(lote.xml).toContain(`<ans:hash>${lote.hash}</ans:hash>`)
    expect(lote.hash).not.toBe(calcularHash([]))
  })

  it('e deterministico: mesma entrada, mesmo hash', () => {
    expect(gerarLote(entrada()).hash).toBe(lote.hash)
  })

  it('muda o hash quando um valor de campo muda', () => {
    const outro = entrada()
    outro.guias[0].procedimentos[0].senha = '999999'
    expect(gerarLote(outro).hash).not.toBe(lote.hash)
  })

  it('remove acento dos valores de campo', () => {
    const e = entrada()
    e.guias[0].paciente.nome = 'JOSÉ ANTÔNIO DA CONCEIÇÃO'
    const x = gerarLote(e).xml
    expect(x).toContain('JOSE ANTONIO DA CONCEICAO')
    // nada fora da tabela latin1 sobrou no corpo (o unico '?' e o do prologo)
    const corpo = x.slice(x.indexOf('?>') + 2)
    expect(corpo).not.toContain('?')
    expect(paraLatin1(corpo)).toHaveLength(corpo.length)
  })

  it('deixa fora do lote o procedimento em que nao foi cirurgiao principal', () => {
    const e = entrada()
    e.guias[0].procedimentos[1].cirurgiao_principal = false
    const l = gerarLote(e)
    expect(l.xml.match(/<ans:procedimentoRealizado>/g)).toHaveLength(1)
    expect(l.valor_total).toBe(148)
  })

  it('lanca PendenciasDoLote em vez de gerar XML incompleto', () => {
    expect(() => gerarLote(entrada({ config: { ...CONFIG_PADRAO, cnes: null } }))).toThrow(
      PendenciasDoLote,
    )
  })
})
