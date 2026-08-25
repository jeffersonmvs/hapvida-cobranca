import type {
  Atendimento, Configuracao, Glosa, Paciente, Procedimento, ProcedimentoRealizado,
} from './tipos'
import { formatarBRL } from './dinheiro'
import { formatarData } from './datas'
import { agruparPorAssinatura } from './glosas'

/**
 * Minuta de recurso de glosa (§11.4).
 *
 * A fundamentacao e montada a partir de FATO DO PROPRIO REGISTRO - senha
 * emitida pela operadora, valor pago, historico de pagamento integral do mesmo
 * codigo, descricao cirurgica literal. Nada de retorica generica.
 *
 * Esta funcao e deterministica de proposito: o app redige a minuta inteira sem
 * IA. A IA (edge function 'redigir-recurso') so refina a redacao em cima
 * destes mesmos fatos, e o resultado fica marcado como sugestao.
 *
 * Limite explicito: isto e minuta administrativa, nao peca juridica.
 */

export const AVISO_JURIDICO =
  'Esta minuta e uma contestacao administrativa. Se a glosa envolver discussao ' +
  'contratual relevante ou valor acumulado alto, procure revisao por advogado ' +
  'ou pela assessoria juridica do sindicato medico.'

export interface EntradaRecurso {
  glosa: Glosa
  procedimento: ProcedimentoRealizado | null
  atendimento: Atendimento | null
  paciente: Paciente | null
  referencia: Procedimento | null
  config: Configuracao
  /** todas as glosas conhecidas, para o argumento de histórico */
  historicoGlosas: Glosa[]
  /** competencias em que o MESMO codigo foi pago integralmente */
  competenciasPagasIntegralmente?: string[]
}

export interface Minuta {
  titulo: string
  identificacao: string[]
  procedimento: string[]
  valores: string[]
  motivo_alegado: string
  fundamentacao: string[]
  pedido: string
  aviso: string
  /** texto corrido, para copiar ou mandar para a IA refinar */
  texto: string
}

export function montarRecurso(e: EntradaRecurso): Minuta {
  const { glosa: g, procedimento: pr, atendimento: at, paciente: pac, referencia: ref, config } = e

  const valorCobrado = pr?.valor_cobrado ?? ref?.valor_cobrar ?? null
  const valorPago =
    valorCobrado != null ? Number((valorCobrado - g.valor_glosado).toFixed(2)) : ref?.valor_pago ?? null

  const identificacao = [
    `Prestador: ${config.nome_prestador} — CRM ${config.crm} / RQE ${config.rqe}`,
    `Codigo na operadora: ${config.codigo_prestador_operadora}`,
    at ? `Guia / atendimento: ${at.numero}` : 'Guia / atendimento: nao informado',
    pac ? `Beneficiario: ${pac.nome}${pac.carteira ? ` — carteira ${pac.carteira}` : ''}` : '',
    `Competencia do demonstrativo: ${g.competencia}`,
    g.data_demonstrativo ? `Data do demonstrativo: ${formatarData(g.data_demonstrativo)}` : '',
  ].filter(Boolean)

  const procedimento = [
    `Codigo: ${g.codigo_tuss ?? pr?.codigo_tuss ?? '—'}${ref ? ` — ${ref.descricao}` : ''}`,
    at ? `Data de execucao: ${formatarData(at.data)}` : '',
    pr?.senha ? `Senha de autorizacao emitida pela operadora: ${pr.senha}` : '',
    at?.local ? `Local: ${at.local}` : '',
  ].filter(Boolean)

  const valores = [
    `Valor apresentado: ${formatarBRL(valorCobrado)}`,
    `Valor pago: ${formatarBRL(valorPago)}`,
    `Valor glosado: ${formatarBRL(g.valor_glosado)}`,
  ]

  const motivo = g.justificativa?.trim() || 'motivo nao informado no demonstrativo'

  // ---- fundamentacao ancorada em fato do registro -------------------------
  const fundamentacao: string[] = []

  if (pr?.senha) {
    fundamentacao.push(
      `A propria operadora autorizou previamente o procedimento e emitiu a senha ` +
        `${pr.senha}. A autorizacao previa e ato da operadora e e incompativel com ` +
        `a alegacao de que o procedimento nao estaria coberto.`,
    )
  }

  if (valorPago != null && valorPago > 0 && valorCobrado != null) {
    fundamentacao.push(
      `O demonstrativo registra pagamento parcial de ${formatarBRL(valorPago)} sobre ` +
        `os ${formatarBRL(valorCobrado)} apresentados. Pagamento parcial e reconhecimento ` +
        `da cobertura: se o procedimento nao estivesse incluso, nao haveria pagamento ` +
        `algum. A contradicao entre pagar e alegar ausencia de cobertura e do proprio ` +
        `demonstrativo.`,
    )
  }

  if (e.competenciasPagasIntegralmente?.length) {
    fundamentacao.push(
      `O mesmo codigo foi pago integralmente pela operadora em ` +
        `${e.competenciasPagasIntegralmente.join(', ')}, o que afasta a tese de ` +
        `exclusao contratual e caracteriza a glosa como divergencia de tabela.`,
    )
  }

  const mesmaAssinatura = agruparPorAssinatura(
    e.historicoGlosas.filter((x) => (x.codigo_tuss ?? '') === (g.codigo_tuss ?? '')),
  )[0]
  if (mesmaAssinatura && mesmaAssinatura.ocorrencias > 1) {
    const textos = mesmaAssinatura.textos
    fundamentacao.push(
      `A glosa se repete: ${mesmaAssinatura.ocorrencias} ocorrencia(s) do mesmo codigo, ` +
        `sempre em ${formatarBRL(mesmaAssinatura.valor_glosado)}, somando ` +
        `${formatarBRL(mesmaAssinatura.valor_total)}` +
        (textos.length > 1
          ? `. A redacao do motivo mudou ao longo das competencias ("${textos.join('", "')}"), ` +
            `mas o valor glosado e o codigo permanecem identicos, o que indica criterio ` +
            `unico aplicado sistematicamente.`
          : '.'),
    )
  }

  if (pr?.descricao_cirurgica?.trim()) {
    fundamentacao.push(
      `A descricao cirurgica registrada no boletim comprova a execucao do ato: ` +
        `"${pr.descricao_cirurgica.trim()}"`,
    )
  }

  if (fundamentacao.length === 0) {
    fundamentacao.push(
      `O procedimento foi executado e apresentado conforme a tabela contratual. ` +
        `Solicita-se a revisao do criterio aplicado e a indicacao expressa da ` +
        `clausula contratual que fundamenta a glosa.`,
    )
  }

  const pedido =
    `Requer-se a revisao da glosa e o pagamento da diferenca de ` +
    `${formatarBRL(g.valor_glosado)}, referente ao codigo ` +
    `${g.codigo_tuss ?? pr?.codigo_tuss ?? ''} na competencia ${g.competencia}.`

  const titulo = `Recurso de glosa — ${g.codigo_tuss ?? ''} — ${g.competencia}`

  const texto = [
    titulo,
    '',
    'IDENTIFICACAO',
    ...identificacao,
    '',
    'PROCEDIMENTO REALIZADO',
    ...procedimento,
    '',
    'VALORES',
    ...valores,
    '',
    'MOTIVO ALEGADO PELA OPERADORA',
    motivo,
    '',
    'FUNDAMENTACAO',
    ...fundamentacao.map((f, i) => `${i + 1}. ${f}`),
    '',
    'PEDIDO',
    pedido,
    '',
    `${config.nome_prestador}`,
    `CRM ${config.crm} — RQE ${config.rqe}`,
  ].join('\n')

  return {
    titulo, identificacao, procedimento, valores,
    motivo_alegado: motivo, fundamentacao, pedido,
    aviso: AVISO_JURIDICO, texto,
  }
}
