import { describe, expect, it } from 'vitest'
import { avaliarDocumento, coberturaDescricao, consolidar, type Gabarito } from './avaliacao'
import type { Extracao } from './esquemas'

const c = (valor: string | null, confianca = 0.9) => ({ valor, confianca, ilegivel: false })

const gabarito: Gabarito = {
  arquivo: 'boletim-01.jpg',
  tipo_documento: 'boletim',
  data: '2026-08-10',
  hora_inicio: '08:00',
  hora_fim: '09:10',
  paciente_nome: 'MARIA JOSE DA CONCEICAO',
  carteira: '00123456789',
  numero_atendimento: '188912993',
  tipo_anestesia: 'raqui',
  acomodacao: 'enfermaria',
  procedimentos: [
    { codigo_tuss: '31009166', senha: '444555' },
    { codigo_tuss: '31009093', senha: null }, // ilegivel no papel
  ],
  descricao_cirurgica:
    'Incisao infraumbilical de tres centimetros, dissecao do saco herniario, ' +
    'reducao do conteudo e herniorrafia com Prolene zero em dois planos.',
}

const extracaoPerfeita: Extracao = {
  tipo_documento: 'boletim',
  confianca_geral: 0.92,
  data: c('2026-08-10'),
  hora_inicio: c('08:00'),
  hora_fim: c('09:10'),
  paciente_nome: c('Maria Jose da Conceicao'),
  carteira: c('00123456789'),
  numero_atendimento: c('188912993'),
  data_internacao: c(null),
  acomodacao: c('enfermaria'),
  plano: c('HAPVIDA'),
  tipo_anestesia: c('raqui'),
  cirurgiao_principal: c('JEFFERSON MENEZES'),
  procedimentos: [
    { codigo_tuss: c('31009166'), senha: c('444555'), descricao: c('hernioplastia umbilical') },
    { codigo_tuss: c('31009093'), senha: { valor: null, confianca: 0.2, ilegivel: true }, descricao: c('hernioplastia epigastrica') },
  ],
  materiais: [{ nome: 'tela', utilizado: false }],
  tela_utilizada: { valor: false, confianca: 0.9, ilegivel: false },
  descricao_cirurgica: c(gabarito.descricao_cirurgica),
  campos_ilegiveis: ['senha[1]'],
}

describe('avaliacao da extracao', () => {
  it('da nota cheia para a extracao correta', () => {
    const r = avaliarDocumento(gabarito, extracaoPerfeita)
    expect(r.acertos).toBe(r.total)
    expect(r.senhas_inventadas).toBe(0)
  })

  it('ignora acento e caixa na comparacao', () => {
    const r = avaliarDocumento(gabarito, extracaoPerfeita)
    expect(r.campos.find((x) => x.campo === 'paciente_nome')?.acertou).toBe(true)
  })

  it('conta como invencao a senha preenchida onde o papel esta ilegivel', () => {
    const ruim: Extracao = {
      ...extracaoPerfeita,
      procedimentos: [
        extracaoPerfeita.procedimentos[0],
        { ...extracaoPerfeita.procedimentos[1], senha: c('444555') },
      ],
    }
    const r = avaliarDocumento(gabarito, ruim)
    expect(r.senhas_inventadas).toBe(1)
    expect(r.campos.find((x) => x.campo === 'senha[1]')?.acertou).toBe(false)
  })

  it('reprova a descricao resumida', () => {
    const resumida: Extracao = {
      ...extracaoPerfeita,
      descricao_cirurgica: c('Herniorrafia umbilical e epigastrica.'),
    }
    const r = avaliarDocumento(gabarito, resumida)
    expect(r.cobertura_descricao).toBeLessThan(0.5)
    expect(r.campos.find((x) => x.campo === 'descricao_cirurgica')?.acertou).toBe(false)
  })

  it('aceita transcricao literal com pontuacao diferente', () => {
    expect(
      coberturaDescricao('Incisao infraumbilical de tres centimetros.', 'incisao infraumbilical de tres centimetros'),
    ).toBe(1)
  })

  it('consolida apontando os campos que mais erram', () => {
    const ruim = avaliarDocumento(gabarito, {
      ...extracaoPerfeita,
      numero_atendimento: c('188912994'),
    })
    const m = consolidar([ruim, avaliarDocumento(gabarito, extracaoPerfeita)])
    expect(m.documentos).toBe(2)
    expect(m.piores_campos[0].campo).toBe('numero_atendimento')
    expect(m.acerto_por_campo).toBeGreaterThan(0.9)
  })
})
