import { describe, expect, it } from 'vitest'
import { montarRecurso } from './recurso'
import { TABELA } from './__fixtures__/tabela'
import { CONFIG_PADRAO, type Glosa } from './tipos'

const glosa: Glosa = {
  codigo_tuss: '31009115',
  competencia: 'MEDISA 06/2026',
  valor_glosado: 88,
  justificativa: 'Procedimento nao incluso em contrato',
  data_demonstrativo: '2026-06-10',
}

const base = {
  glosa,
  procedimento: {
    codigo_tuss: '31009115', senha: '334455', valor_cobrado: 280,
    descricao_cirurgica: 'Hernioplastia inguinal direita a Lichtenstein com tela.',
  },
  atendimento: { numero: '188913120', data: '2026-06-02', local: 'Hospital Aldeota' },
  paciente: { nome: 'MARIA JOSE DA CONCEICAO', carteira: '00123456789' },
  referencia: TABELA.find((p) => p.codigo_tuss === '31009115') ?? null,
  config: CONFIG_PADRAO,
  historicoGlosas: [glosa],
}

describe('montarRecurso (criterio 17)', () => {
  const m = montarRecurso(base)

  it('cita a senha emitida pela propria operadora', () => {
    expect(m.texto).toContain('334455')
    expect(m.fundamentacao.join(' ')).toContain('autorizou previamente')
  })

  it('usa o pagamento parcial de R$ 192,00 como contradicao ao motivo alegado', () => {
    expect(m.texto).toContain('192,00')
    expect(m.fundamentacao.join(' ')).toContain('Pagamento parcial')
  })

  it('reproduz a descricao cirurgica literal como prova', () => {
    expect(m.texto).toContain('Lichtenstein')
  })

  it('pede exatamente o valor glosado', () => {
    expect(m.pedido).toContain('88,00')
  })

  it('assina com CRM e RQE', () => {
    expect(m.texto).toContain('CRM 11153')
    expect(m.texto).toContain('RQE 10042')
  })

  it('avisa que e minuta administrativa, nao peca juridica', () => {
    expect(m.aviso).toContain('advogado')
  })

  it('aponta a mudanca de redacao quando o historico tem duas versoes', () => {
    const historico: Glosa[] = [
      { ...glosa, competencia: 'MEDISA 03/2026', justificativa: 'Procedimento nao incluso em contrato', data_demonstrativo: '2026-03-10' },
      { ...glosa, competencia: 'MEDISA 06/2026', justificativa: 'Pago abaixo da tabela contratual', data_demonstrativo: '2026-06-10' },
    ]
    const comHistorico = montarRecurso({ ...base, historicoGlosas: historico })
    expect(comHistorico.fundamentacao.join(' ')).toContain('redacao do motivo mudou')
  })

  it('cita competencias em que o codigo foi pago integralmente', () => {
    const m2 = montarRecurso({ ...base, competenciasPagasIntegralmente: ['MEDISA 01/2026'] })
    expect(m2.fundamentacao.join(' ')).toContain('pago integralmente')
  })
})
