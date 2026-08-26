import { describe, expect, it } from 'vitest'
import { rodarChecklist, SUGESTAO_TELA_DISPENSADA } from './checklist'
import { TABELA, ATENDIMENTO_BASE } from './__fixtures__/tabela'
import type { Atendimento, ProcedimentoRealizado } from './tipos'

const at = (o: Partial<Atendimento> = {}): Atendimento => ({ ...ATENDIMENTO_BASE, ...o })

const p = (
  o: Partial<ProcedimentoRealizado> & { codigo_tuss: string },
): ProcedimentoRealizado => ({ senha: '123456', valor_cobrado: 0, ...o })

const regras = (as: { regra: string }[]) => as.map((a) => a.regra)

describe('R01 - codigo que exige retalho', () => {
  it('dispara critico quando a descricao nao menciona retalho (criterio 3)', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [
        p({
          codigo_tuss: '30101522',
          valor_cobrado: 476,
          descricao_cirurgica:
            'Excisao de cicatriz hipertrofica em dorso, sintese por planos com nylon 4-0.',
        }),
      ],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    const r01 = alertas.find((a) => a.regra === 'R01')
    expect(r01?.severidade).toBe('critico')
  })

  it('nao dispara quando o termo esta na descricao, mesmo com acento e caixa', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [
        p({
          codigo_tuss: '30101450',
          valor_cobrado: 184,
          descricao_cirurgica:
            'Exerese de lesao circular; confeccionado RETALHO de rotacao cutanea local.',
        }),
      ],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    expect(regras(alertas)).not.toContain('R01')
  })
})

describe('R02 - tela autorizada e nao utilizada', () => {
  it('dispara critico e oferece a formula de blindagem', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [
        p({
          codigo_tuss: '31009166',
          valor_cobrado: 148,
          tela_autorizada: true,
          tela_utilizada: false,
          descricao_cirurgica: 'Herniorrafia umbilical, sintese com Prolene zero.',
        }),
      ],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    const r02 = alertas.find((a) => a.regra === 'R02')
    expect(r02?.severidade).toBe('critico')
    expect(r02?.sugestao).toBe(SUGESTAO_TELA_DISPENSADA)
  })

  it('nao dispara quando a descricao ja traz a justificativa', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [
        p({
          codigo_tuss: '31009166',
          valor_cobrado: 148,
          tela_autorizada: true,
          tela_utilizada: false,
          descricao_cirurgica: `Herniorrafia com Prolene zero em dois planos ${SUGESTAO_TELA_DISPENSADA}`,
        }),
      ],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    expect(regras(alertas)).not.toContain('R02')
  })

  it('nao dispara quando a tela foi de fato utilizada', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [
        p({ codigo_tuss: '31009166', valor_cobrado: 148, tela_autorizada: true, tela_utilizada: true }),
      ],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    expect(regras(alertas)).not.toContain('R02')
  })
})

describe('R03 - senhas', () => {
  it('dispara critico quando falta senha', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [p({ codigo_tuss: '31009115', senha: '  ', valor_cobrado: 280 })],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    expect(alertas.find((a) => a.regra === 'R03')?.severidade).toBe('critico')
  })

  it('dispara critico quando a mesma senha aparece em dois sitios (criterio 2)', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [
        p({ codigo_tuss: '31009166', senha: '444555', valor_cobrado: 148 }),
        p({ codigo_tuss: '31009093', senha: '444555', valor_cobrado: 148 }),
      ],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    const r03 = alertas.filter((a) => a.regra === 'R03')
    expect(r03).toHaveLength(1)
    expect(r03[0].mensagem).toContain('444555')
  })

  it('aceita dois sitios com senhas distintas', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [
        p({ codigo_tuss: '31009166', senha: '444555', valor_cobrado: 148, descricao_cirurgica: 'incisao infraumbilical de 3 cm' }),
        p({ codigo_tuss: '31009093', senha: '666777', valor_cobrado: 148, descricao_cirurgica: 'incisao epigastrica propria de 3 cm' }),
      ],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    expect(regras(alertas)).not.toContain('R03')
    expect(regras(alertas)).not.toContain('R09')
  })
})

describe('R04 - codigo sem autorizacao na guia', () => {
  it('dispara critico', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [p({ codigo_tuss: '31009115', valor_cobrado: 280, autorizado_na_guia: false })],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    expect(alertas.find((a) => a.regra === 'R04')?.severidade).toBe('critico')
  })
})

describe('R05 - glosa recorrente', () => {
  it('avisa o valor cobrado, o previsto e a glosa do 31009115 (criterio 4)', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [p({ codigo_tuss: '31009115', valor_cobrado: 280 })],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    const r05 = alertas.find((a) => a.regra === 'R05')
    expect(r05?.severidade).toBe('atencao')
    expect(r05?.mensagem).toContain('88,00')
    expect(r05?.mensagem).toContain('280,00')
    expect(r05?.mensagem).toContain('192,00')
  })
})

describe('R06 - codigos equivalentes', () => {
  it('avisa uma unica vez quando 31005497 e 43050200 estao no mesmo atendimento', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [
        p({ codigo_tuss: '31005497', senha: 'A1', valor_cobrado: 1056.78 }),
        p({ codigo_tuss: '43050200', senha: 'B2', valor_cobrado: 1056.78 }),
      ],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    expect(alertas.filter((a) => a.regra === 'R06')).toHaveLength(1)
  })
})

describe('R07 - validade da autorizacao', () => {
  it('dispara quando a cirurgia ocorre depois da validade', () => {
    const alertas = rodarChecklist({
      atendimento: at({ data: '2026-08-20', validade_autorizacao: '2026-08-15' }),
      procedimentos: [p({ codigo_tuss: '31009115', valor_cobrado: 280 })],
      tabela: TABELA,
      hoje: '2026-08-21',
    })
    expect(regras(alertas)).toContain('R07')
  })

  it('nao dispara dentro da validade', () => {
    const alertas = rodarChecklist({
      atendimento: at({ data: '2026-08-10', validade_autorizacao: '2026-08-15' }),
      procedimentos: [p({ codigo_tuss: '31009115', valor_cobrado: 280 })],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    expect(regras(alertas)).not.toContain('R07')
  })
})

describe('R08 - boletim x ficha (criterio 10)', () => {
  it('dispara quando o numero de atendimento diverge', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [p({ codigo_tuss: '31009115', valor_cobrado: 280 })],
      tabela: TABELA,
      hoje: '2026-08-11',
      dadosBoletim: { nome: 'Maria da Silva', numero_atendimento: '188912993' },
      dadosFicha: { nome: 'Maria da Silva', numero_atendimento: '188912994' },
    })
    expect(alertas.find((a) => a.regra === 'R08')?.mensagem).toContain('atendimento')
  })

  it('ignora diferenca so de acento e caixa no nome', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [p({ codigo_tuss: '31009115', valor_cobrado: 280 })],
      tabela: TABELA,
      hoje: '2026-08-11',
      dadosBoletim: { nome: 'JOSE ANTONIO', carteira: '0012 3456', numero_atendimento: '1' },
      dadosFicha: { nome: 'José Antônio', carteira: '00123456', numero_atendimento: '1' },
    })
    expect(regras(alertas)).not.toContain('R08')
  })
})

describe('R09 - incisoes independentes', () => {
  it('dispara quando dois sitios compartilham uma unica incisao descrita', () => {
    const alertas = rodarChecklist({
      atendimento: at(),
      procedimentos: [
        p({ codigo_tuss: '31009166', senha: '1', valor_cobrado: 148, descricao_cirurgica: 'Incisao infraumbilical unica, tratados os dois sitios.' }),
        p({ codigo_tuss: '31009093', senha: '2', valor_cobrado: 148, descricao_cirurgica: '' }),
      ],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    expect(regras(alertas)).toContain('R09')
  })
})

describe('R10 - mes terminando', () => {
  it('dispara do dia 25 em diante para procedimento a faturar (criterio 5)', () => {
    const alertas = rodarChecklist({
      atendimento: at({ data: '2026-08-10' }),
      procedimentos: [p({ codigo_tuss: '31009115', valor_cobrado: 280, situacao: 'a_faturar' })],
      tabela: TABELA,
      hoje: '2026-08-25',
    })
    expect(regras(alertas)).toContain('R10')
  })

  it('nao dispara no dia 10 do mes', () => {
    const alertas = rodarChecklist({
      atendimento: at({ data: '2026-08-10' }),
      procedimentos: [p({ codigo_tuss: '31009115', valor_cobrado: 280, situacao: 'a_faturar' })],
      tabela: TABELA,
      hoje: '2026-08-10',
    })
    expect(regras(alertas)).not.toContain('R10')
  })

  it('nao dispara para procedimento ja faturado', () => {
    const alertas = rodarChecklist({
      atendimento: at({ data: '2026-08-10' }),
      procedimentos: [p({ codigo_tuss: '31009115', valor_cobrado: 280, situacao: 'faturado' })],
      tabela: TABELA,
      hoje: '2026-08-28',
    })
    expect(regras(alertas)).not.toContain('R10')
  })

  it('dispara quando o mes do atendimento ja fechou', () => {
    const alertas = rodarChecklist({
      atendimento: at({ data: '2026-07-10' }),
      procedimentos: [p({ codigo_tuss: '31009115', valor_cobrado: 280 })],
      tabela: TABELA,
      hoje: '2026-08-03',
    })
    expect(alertas.find((a) => a.regra === 'R10')?.mensagem).toContain('ja fechou')
  })
})

describe('R11 - documento sem descricao cirurgica', () => {
  /**
   * A ficha de internacao e a guia trazem codigos e senhas mas nao tem
   * descricao cirurgica. Antes disso, um atendimento montado so a partir da
   * ficha acusava R09 ("dois sitios sem incisoes descritas") - alarme falso
   * que treina o usuario a ignorar alerta.
   */
  const soFicha = () =>
    rodarChecklist({
      atendimento: at(),
      procedimentos: [
        p({ codigo_tuss: '31009115', senha: 'AL4280002', valor_cobrado: 616 }),
        p({ codigo_tuss: '31005497', senha: 'AL4280003', valor_cobrado: 1056.78 }),
      ],
      tabela: TABELA,
      hoje: '2026-08-11',
    })

  it('nao acusa R09 quando nenhum sitio tem descricao', () => {
    expect(regras(soFicha())).not.toContain('R09')
  })

  it('avisa que o boletim ainda nao foi anexado', () => {
    const r11 = soFicha().find((a) => a.regra === 'R11')
    expect(r11?.severidade).toBe('atencao')
    expect(r11?.mensagem).toMatch(/boletim ainda nao foi anexado/i)
  })

  it('nao bloqueia o lote: R11 e atencao, nunca critico', () => {
    expect(soFicha().filter((a) => a.severidade === 'critico')).toHaveLength(0)
  })

  it('para de avisar assim que a descricao chega, e volta a cobrar as incisoes', () => {
    const comBoletim = rodarChecklist({
      atendimento: at(),
      procedimentos: [
        p({
          codigo_tuss: '31009115',
          senha: 'AL4280002',
          valor_cobrado: 616,
          descricao_cirurgica: 'Incisao inguinal direita de 6 cm.',
        }),
        p({ codigo_tuss: '31005497', senha: 'AL4280003', valor_cobrado: 1056.78 }),
      ],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    expect(regras(comBoletim)).not.toContain('R11')
    expect(regras(comBoletim)).toContain('R09')
  })

  it('atendimento sem nenhum procedimento nao gera R11', () => {
    const vazio = rodarChecklist({
      atendimento: at(),
      procedimentos: [],
      tabela: TABELA,
      hoje: '2026-08-11',
    })
    expect(regras(vazio)).not.toContain('R11')
  })
})
