import SparkMD5 from 'spark-md5'
import type {
  Atendimento,
  Configuracao,
  Paciente,
  Procedimento,
  ProcedimentoRealizado,
} from './tipos'
import { formatarTISS, somar } from './dinheiro'
import { horaCompleta } from './datas'
import { semAcento } from './texto'
import { vigenteEm } from './honorarios'

/**
 * Lote TISS 04.03.00 - guia de honorario individual (§9.2).
 *
 * Pontos que ja custaram rejeicao antes e estao codificados aqui:
 *  - encoding ISO-8859-1 e valores de campo sem acento;
 *  - identificacaoPrestador e um choice: sai codigoPrestadorNaOperadora e
 *    NUNCA uma tag <ans:CPF> vazia;
 *  - codigoTabela 22, conselho 1, UF 23, CBOS 225265, grauParticipacao 00;
 *  - CNES obrigatorio: sem ele a geracao e bloqueada com explicacao;
 *  - <ans:hash> no epilogo = MD5 da concatenacao de todos os valores de campo
 *    do documento, na ordem, excluindo o proprio hash;
 *  - uma guiaHonorarioIndividual por atendimento; multiplos sitios viram
 *    multiplos procedimentoRealizado na MESMA guia, cada um com sua senha.
 *
 * IMPORTANTE: a ordem dos elementos abaixo segue a estrutura da guia de
 * honorario individual do padrao. A validacao final contra o XSD oficial da
 * ANS roda em validarContraXsd() (scripts/validar-tiss.mjs, com xmllint) e o
 * download so e liberado depois dela.
 */

export const PADRAO_TISS = '4.03.00'
export const CODIGO_TABELA = '22'
export const GRAU_PARTICIPACAO_CIRURGIAO = '00'

// --------------------------------------------------------------------------
// Arvore XML minima. Guardar a arvore (em vez de concatenar string) permite
// caminhar os valores de campo na ordem do documento para calcular o hash.
// --------------------------------------------------------------------------

export type No = { tag: string; filhos: No[] } | { tag: string; valor: string }

export function el(tag: string, filhos: Array<No | null | undefined>): No {
  return { tag, filhos: filhos.filter((f): f is No => f != null) }
}

export function campo(tag: string, valor: string | number | null | undefined): No | null {
  if (valor == null || valor === '') return null
  return { tag, valor: semAcento(String(valor)) }
}

function ehFolha(n: No): n is { tag: string; valor: string } {
  return 'valor' in n
}

/** Valores de campo na ordem do documento - base do hash do epilogo. */
export function valoresEmOrdem(no: No): string[] {
  if (ehFolha(no)) return [no.valor]
  return no.filhos.flatMap(valoresEmOrdem)
}

function escapar(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function serializar(no: No, nivel = 0): string {
  const ident = '  '.repeat(nivel)
  if (ehFolha(no)) return `${ident}<ans:${no.tag}>${escapar(no.valor)}</ans:${no.tag}>`
  const dentro = no.filhos.map((f) => serializar(f, nivel + 1)).join('\n')
  return `${ident}<ans:${no.tag}>\n${dentro}\n${ident}</ans:${no.tag}>`
}

/** MD5 da concatenacao dos valores de campo, na ordem, sem o proprio hash. */
export function calcularHash(valores: string[]): string {
  return SparkMD5.hash(valores.join(''))
}

// --------------------------------------------------------------------------
// Entrada e validacao
// --------------------------------------------------------------------------

export interface GuiaEntrada {
  atendimento: Atendimento
  paciente: Paciente
  procedimentos: ProcedimentoRealizado[]
  numero_guia: number
}

export interface LoteEntrada {
  config: Configuracao
  tabela: Procedimento[]
  numero_lote: number
  sequencial_transacao: number
  /** data/hora do registro da transacao - injetadas, nunca lidas do relogio */
  data_registro: string
  hora_registro: string
  guias: GuiaEntrada[]
}

export interface Pendencia {
  campo: string
  mensagem: string
  guia?: string
}

/** Pendencias que impedem o fechamento do lote (§10, nivel 1). */
export function validarLote(entrada: LoteEntrada): Pendencia[] {
  const p: Pendencia[] = []
  const { config, guias, tabela } = entrada

  if (!config.cnes || config.cnes.trim() === '' || config.cnes.toUpperCase() === 'PENDENTE') {
    p.push({
      campo: 'CNES',
      mensagem:
        'O CNES do estabelecimento e obrigatorio na guia de honorario ' +
        'individual e ainda esta PENDENTE. Informe o CNES em Configuracao ' +
        'para liberar a geracao do XML.',
    })
  }
  if (!config.codigo_prestador_operadora) {
    p.push({ campo: 'codigoPrestadorNaOperadora', mensagem: 'Codigo do prestador na operadora nao informado.' })
  }
  if (!config.registro_ans) {
    p.push({ campo: 'registroANS', mensagem: 'Registro ANS da operadora nao informado.' })
  }
  if (guias.length === 0) {
    p.push({ campo: 'loteGuias', mensagem: 'O lote nao tem nenhuma guia.' })
  }

  for (const g of guias) {
    const id = `guia ${g.numero_guia} (atendimento ${g.atendimento.numero})`
    if (!g.paciente.carteira) {
      p.push({ campo: 'numeroCarteira', guia: id, mensagem: `${id}: numero da carteira do beneficiario ausente.` })
    }
    if (!g.paciente.nome) {
      p.push({ campo: 'nomeBeneficiario', guia: id, mensagem: `${id}: nome do beneficiario ausente.` })
    }
    if (g.procedimentos.length === 0) {
      p.push({ campo: 'procedimentosRealizados', guia: id, mensagem: `${id}: nenhum procedimento.` })
    }
    for (const pr of g.procedimentos) {
      if (!pr.senha?.trim()) {
        p.push({ campo: 'senhaAutorizacao', guia: id, mensagem: `${id}: ${pr.codigo_tuss} sem senha. Cada sitio tem senha propria.` })
      }
      const ref = vigenteEm(tabela, pr.codigo_tuss, g.atendimento.data)
      if (!ref) {
        p.push({ campo: 'codigoProcedimento', guia: id, mensagem: `${id}: ${pr.codigo_tuss} nao consta na tabela de honorarios.` })
      } else if (ref.codigo_interno) {
        p.push({
          campo: 'codigoProcedimento',
          guia: id,
          mensagem:
            `${id}: "${ref.descricao}" ainda usa codigo interno ${pr.codigo_tuss}. ` +
            `O XML TISS exige codigo da tabela 22 - informe o codigo oficial na ` +
            `tabela de honorarios.`,
        })
      }
      if (pr.rascunho) {
        p.push({ campo: 'procedimentoRealizado', guia: id, mensagem: `${id}: ${pr.codigo_tuss} ainda e rascunho de extracao nao revisada.` })
      }
      if (pr.valor_cobrado == null || pr.valor_cobrado <= 0) {
        p.push({ campo: 'valorTotal', guia: id, mensagem: `${id}: ${pr.codigo_tuss} sem valor.` })
      }
    }
  }
  return p
}

// --------------------------------------------------------------------------
// Montagem
// --------------------------------------------------------------------------

function montarGuia(g: GuiaEntrada, entrada: LoteEntrada): No {
  const { config, tabela } = entrada
  const { atendimento: at, paciente: pac } = g

  // regra 3: so o cirurgiao principal entra no lote de honorario
  const itens = g.procedimentos.filter((p) => p.cirurgiao_principal !== false)

  const valorTotal = somar(...itens.map((p) => p.valor_cobrado))

  return el('guiaHonorarioIndividual', [
    el('cabecalhoGuia', [
      campo('registroANS', config.registro_ans),
      campo('numeroGuiaPrestador', String(g.numero_guia)),
    ]),
    campo('numeroGuiaSolicitacaoInternacao', at.numero),
    el('dadosExecutante', [
      el('contratadoExecutante', [
        // choice identificacaoPrestador: sai o codigo na operadora.
        // NUNCA emitir <ans:CPF> vazia - foi o que reprovava a versao anterior.
        campo('codigoPrestadorNaOperadora', config.codigo_prestador_operadora),
      ]),
      campo('CNES', config.cnes),
    ]),
    el('dadosBeneficiario', [
      campo('numeroCarteira', pac.carteira),
      campo('atendimentoRN', 'N'),
      campo('nomeBeneficiario', pac.nome),
    ]),
    el('dadosInternacao', [
      campo('dataInicioFaturamento', at.data),
      campo('dataFinalFaturamento', at.data),
    ]),
    el(
      'procedimentosRealizados',
      itens.map((pr, i) => {
        const ref = vigenteEm(tabela, pr.codigo_tuss, at.data)
        return el('procedimentoRealizado', [
          campo('sequencialItem', String(i + 1)),
          campo('dataExecucao', at.data),
          campo('horaInicial', horaCompleta(at.hora_inicio)),
          campo('horaFinal', horaCompleta(at.hora_fim)),
          el('procedimento', [
            campo('codigoTabela', CODIGO_TABELA),
            campo('codigoProcedimento', pr.codigo_tuss),
            campo('descricaoProcedimento', ref?.descricao ?? pr.codigo_tuss),
          ]),
          campo('quantidadeExecutada', '1'),
          campo('viaAcesso', null),
          campo('tecnicaUtilizada', null),
          campo('reducaoAcrescimo', '1.00'),
          campo('valorUnitario', formatarTISS(pr.valor_cobrado)),
          campo('valorTotal', formatarTISS(pr.valor_cobrado)),
          el('equipeSeq', [
            campo('grauParticipacao', GRAU_PARTICIPACAO_CIRURGIAO),
            campo('codigoPrestadorNaOperadora', config.codigo_prestador_operadora),
            campo('nomeProfissional', config.nome_prestador),
            campo('conselhoProfissional', config.conselho_profissional),
            campo('numeroConselhoProfissional', config.crm),
            campo('UF', config.uf_conselho),
            campo('CBOS', config.cbos),
          ]),
          campo('senhaAutorizacao', pr.senha),
        ])
      }),
    ),
    campo('valorTotalHonorarios', formatarTISS(valorTotal)),
    campo('observacao', at.observacao),
  ])
}

export interface LoteGerado {
  xml: string
  hash: string
  numero_lote: number
  qtd_guias: number
  valor_total: number
  guias: Array<{ numero_guia: number; atendimento: string; valor: number }>
}

/**
 * Gera o XML do lote. Lanca se houver pendencia - o bloqueio e proposital:
 * cobranca enviada errada e responsabilidade do CRM que assina.
 */
export function gerarLote(entrada: LoteEntrada): LoteGerado {
  const pendencias = validarLote(entrada)
  if (pendencias.length > 0) {
    throw new PendenciasDoLote(pendencias)
  }

  const { config } = entrada

  const cabecalho = el('cabecalho', [
    el('identificacaoTransacao', [
      campo('tipoTransacao', 'ENVIO_LOTE_GUIAS'),
      campo('sequencialTransacao', String(entrada.sequencial_transacao)),
      campo('dataRegistroTransacao', entrada.data_registro),
      campo('horaRegistroTransacao', horaCompleta(entrada.hora_registro) ?? '00:00:00'),
    ]),
    el('origem', [
      el('identificacaoPrestador', [
        campo('codigoPrestadorNaOperadora', config.codigo_prestador_operadora),
      ]),
    ]),
    el('destino', [campo('registroANS', config.registro_ans)]),
    campo('Padrao', PADRAO_TISS),
  ])

  const corpo = el('prestadorParaOperadora', [
    el('loteGuias', [
      campo('numeroLote', String(entrada.numero_lote)),
      el('guiasTISS', entrada.guias.map((g) => montarGuia(g, entrada))),
    ]),
  ])

  const valores = [...valoresEmOrdem(cabecalho), ...valoresEmOrdem(corpo)]
  const hash = calcularHash(valores)

  const mensagem = el('mensagemTISS', [
    cabecalho,
    corpo,
    el('epilogo', [campo('hash', hash)]),
  ])

  const abertura =
    '<?xml version="1.0" encoding="ISO-8859-1"?>\n' +
    '<ans:mensagemTISS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xsi:schemaLocation="http://www.ans.gov.br/padroes/tiss/schemas ' +
    'http://www.ans.gov.br/padroes/tiss/schemas/tissV4_03_00.xsd">'

  const interno = serializar(mensagem)
    .split('\n')
    .slice(1, -1) // remove a tag mensagemTISS gerada sem os namespaces
    .join('\n')

  const xml = `${abertura}\n${interno}\n</ans:mensagemTISS>\n`

  const guias = entrada.guias.map((g) => ({
    numero_guia: g.numero_guia,
    atendimento: g.atendimento.numero,
    valor: somar(
      ...g.procedimentos
        .filter((p) => p.cirurgiao_principal !== false)
        .map((p) => p.valor_cobrado),
    ),
  }))

  return {
    xml,
    hash,
    numero_lote: entrada.numero_lote,
    qtd_guias: guias.length,
    valor_total: somar(...guias.map((g) => g.valor)),
    guias,
  }
}

export class PendenciasDoLote extends Error {
  constructor(public pendencias: Pendencia[]) {
    super(
      `Lote bloqueado por ${pendencias.length} pendencia(s): ` +
        pendencias.map((p) => p.mensagem).join(' | '),
    )
    this.name = 'PendenciasDoLote'
  }
}

/**
 * Bytes ISO-8859-1 do XML. Os valores de campo ja saem sem acento; o que
 * sobrar fora da tabela latin1 vira '?' em vez de corromper o arquivo.
 */
export function paraLatin1(xml: string): Uint8Array {
  const bytes = new Uint8Array(xml.length)
  for (let i = 0; i < xml.length; i++) {
    const c = xml.charCodeAt(i)
    bytes[i] = c <= 0xff ? c : 0x3f
  }
  return bytes
}
