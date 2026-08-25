import {
  calcularAtendimento, formatarBRL, formatarData, formatarMes, mesDe, somar,
  type Configuracao, type Procedimento,
} from '@/domain'
import type { AtendimentoCompleto } from '@/dados/repositorio'
import { alertasVivos } from '@/dados/alertas'
import { baixar, linhaHorizontal, linhaValor, novoDocumento, paragrafo, texto, MARGEM, A4 } from './pdf'

/**
 * PDF de producao para o contador (§9.1). Um por dia de cirurgia.
 *
 * Regra de linguagem: NUNCA rotular PQA como "nao faturavel". A decisao de
 * faturar e do contador; aqui a sala e apenas uma informacao.
 */
export async function gerarPdfProducao(opcoes: {
  data: string
  atendimentos: AtendimentoCompleto[]
  acumuladoDoMes: AtendimentoCompleto[]
  tabela: Procedimento[]
  config: Configuracao
}) {
  const { data, atendimentos, acumuladoDoMes, tabela, config } = opcoes
  const c = await novoDocumento()

  texto(c, 'PRODUCAO MEDICA - HAPVIDA', { tamanho: 14, negrito: true, espacoDepois: 2 })
  texto(c, `${config.nome_prestador} — CRM ${config.crm} / RQE ${config.rqe} — CBOS ${config.cbos}`, { tamanho: 9 })
  texto(c, `Codigo na operadora ${config.codigo_prestador_operadora} — CNPJ ${config.cnpj}`, { tamanho: 9 })
  texto(c, `Data da producao: ${formatarData(data)}`, { tamanho: 11, negrito: true, espacoDepois: 8 })
  linhaHorizontal(c)

  const secoes: Array<[string, AtendimentoCompleto[]]> = [
    ['PROCEDIMENTOS EM CENTRO CIRURGICO', atendimentos.filter((a) => a.atendimento.classe !== 'pqa')],
    ['PROCEDIMENTOS EM SALA PQA', atendimentos.filter((a) => a.atendimento.classe === 'pqa')],
  ]

  let totalDia = 0

  for (const [titulo, lista] of secoes) {
    if (lista.length === 0) continue
    c.y -= 4
    texto(c, titulo, { tamanho: 11, negrito: true, espacoDepois: 6 })

    for (const a of lista) {
      const calc = calcularAtendimento(a.procedimentos, tabela, a.atendimento.data)
      totalDia = somar(totalDia, calc.total_cobrado)

      texto(c, `${a.paciente?.nome ?? 'PACIENTE NAO INFORMADO'}`, { tamanho: 10, negrito: true, espacoDepois: 2 })
      texto(c,
        `Atendimento ${a.atendimento.numero}` +
        (a.paciente?.carteira ? ` · Carteira ${a.paciente.carteira}` : '') +
        ` · ${a.atendimento.local ?? ''}` +
        (a.atendimento.hora_inicio ? ` · ${a.atendimento.hora_inicio}–${a.atendimento.hora_fim ?? ''}` : '') +
        (a.atendimento.tipo_anestesia ? ` · anestesia ${a.atendimento.tipo_anestesia}` : ''),
        { tamanho: 8, espacoDepois: 3 })

      for (const i of calc.itens) {
        linhaValor(
          c,
          `   ${i.codigo_tuss}  ${i.descricao}  (senha ${i.senha})`,
          formatarBRL(i.valor_cobrado),
          9,
        )
        if (!i.remunerado && i.motivo_nao_remunerado) {
          texto(c, `      ${i.motivo_nao_remunerado}`, { tamanho: 8, espacoDepois: 2 })
        }
      }
      linhaValor(c, '   Subtotal do atendimento', formatarBRL(calc.total_cobrado), 9, true)
      c.y -= 4
    }
  }

  linhaHorizontal(c)
  linhaValor(c, `TOTAL DO DIA ${formatarData(data)}`, formatarBRL(totalDia), 12, true)

  // ---- observacoes para o faturamento -------------------------------------
  const alertas = atendimentos.flatMap((a) =>
    alertasVivos(a, tabela, a.atendimento.data)
      .filter((x) => !x.resolvido)
      .map((x) => ({ ...x, paciente: a.paciente?.nome ?? '' })),
  )
  if (alertas.length > 0) {
    c.y -= 8
    texto(c, 'OBSERVACOES PARA O FATURAMENTO', { tamanho: 11, negrito: true, espacoDepois: 6 })
    for (const a of alertas) {
      paragrafo(c, `[${a.severidade.toUpperCase()} ${a.regra}] ${a.paciente}: ${a.mensagem}`, 9)
      c.y -= 2
    }
  }

  // ---- acumulado do mes ---------------------------------------------------
  const mes = mesDe(data)
  const doMes = acumuladoDoMes.filter((a) => mesDe(a.atendimento.data) === mes)
  const totalMes = somar(
    ...doMes.flatMap((a) => a.procedimentos.map((p) => p.valor_cobrado)),
  )
  c.y -= 10
  linhaHorizontal(c)
  texto(c, `ACUMULADO DE ${formatarMes(mes)}`, { tamanho: 11, negrito: true, espacoDepois: 6 })
  linhaValor(c, 'Atendimentos no mes', String(doMes.length), 10)
  linhaValor(c, 'Procedimentos no mes', String(doMes.reduce((n, a) => n + a.procedimentos.length, 0)), 10)
  linhaValor(c, 'Total apresentado no mes', formatarBRL(totalMes), 11, true)

  // ---- assinatura ---------------------------------------------------------
  c.y -= 40
  if (c.y < MARGEM + 60) { c.y = MARGEM + 60 }
  c.pagina.drawLine({
    start: { x: MARGEM, y: c.y },
    end: { x: MARGEM + 260, y: c.y },
    thickness: 0.8,
  })
  c.y -= 12
  texto(c, config.nome_prestador, { tamanho: 10, negrito: true, espacoDepois: 2 })
  texto(c, `CRM ${config.crm} — RQE ${config.rqe}`, { tamanho: 9 })

  const rodape = `Gerado pelo app de faturamento · ${formatarData(data)}`
  c.pagina.drawText(rodape, {
    x: MARGEM, y: MARGEM - 14, size: 7, font: c.regular,
  })
  void A4

  await baixar(c, `producao-${data}.pdf`)
}
