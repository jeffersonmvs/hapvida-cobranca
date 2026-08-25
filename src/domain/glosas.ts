import type { Glosa, MotivoGlosa, Procedimento, ProcedimentoRealizado } from './tipos'
import { somar } from './dinheiro'
import { addDias, diffDias, ehAntes, mesDe, parseCompetencia } from './datas'
import { vigenteEm } from './honorarios'

/**
 * Inteligencia de glosa - parte DETERMINISTICA (§11.3).
 *
 * Toda a estatistica mora aqui: taxa por codigo, serie temporal, ranking,
 * prazo, exposicao do mes. Nada disso passa por modelo de linguagem.
 *
 * A IA entra em dois pontos e so neles:
 *   (a) preencher glosas.justificativa_normalizada com a taxonomia fechada;
 *   (b) interpretar o painel que estas funcoes produzem.
 *
 * O caso que motivou a funcao: fev-mai/2026 a HAPVIDA glosou o 31009115 como
 * "procedimento nao incluso em contrato"; em junho passou a escrever "pago
 * abaixo da tabela contratual". Mesma glosa - R$ 88,00, mesmo codigo, sempre
 * 280,00 cobrado e 192,00 pago. Agrupar por texto da justificativa via dois
 * fenomenos onde ha um so, e foi por isso que 22 casos passaram sem recurso.
 * Por isso a chave de agrupamento e a ASSINATURA, nao a justificativa.
 */

/** Faixa de valor, para aproximar glosas de valor proximo mas nao identico. */
export function faixaValor(valor: number): string {
  if (valor < 50) return '0-50'
  if (valor < 100) return '50-100'
  if (valor < 250) return '100-250'
  if (valor < 500) return '250-500'
  if (valor < 1000) return '500-1000'
  return '1000+'
}

/**
 * Assinatura de glosa: codigo + valor glosado + faixa. NUNCA a justificativa.
 */
export function assinaturaGlosa(g: Pick<Glosa, 'codigo_tuss' | 'valor_glosado'>): string {
  const codigo = g.codigo_tuss ?? 'SEM-CODIGO'
  return `${codigo}|${g.valor_glosado.toFixed(2)}|${faixaValor(g.valor_glosado)}`
}

export interface MudancaDeTexto {
  de: string
  para: string
  em: string
  competencia: string
}

export interface GrupoAssinatura {
  assinatura: string
  codigo_tuss: string
  valor_glosado: number
  ocorrencias: number
  valor_total: number
  valor_recursado: number
  nao_recursadas: number
  primeira: string | null
  ultima: string | null
  competencias: string[]
  /** motivos normalizados vistos no grupo, na ordem em que apareceram */
  motivos: MotivoGlosa[]
  /** textos literais distintos usados pela operadora para a MESMA glosa */
  textos: string[]
  /** viradas de redacao detectadas dentro do grupo */
  mudancas_de_texto: MudancaDeTexto[]
  glosas: Glosa[]
}

function dataDe(g: Glosa): string | null {
  if (g.data_demonstrativo) return g.data_demonstrativo
  const c = parseCompetencia(g.competencia)
  return c ? `${c.mes}-01` : null
}

export function agruparPorAssinatura(glosas: Glosa[]): GrupoAssinatura[] {
  const mapa = new Map<string, Glosa[]>()
  for (const g of glosas) {
    const k = assinaturaGlosa(g)
    mapa.set(k, [...(mapa.get(k) ?? []), g])
  }

  const grupos: GrupoAssinatura[] = []
  for (const [assinatura, itens] of mapa) {
    const ordenadas = [...itens].sort((a, b) =>
      (dataDe(a) ?? '') < (dataDe(b) ?? '') ? -1 : 1,
    )
    const textos: string[] = []
    const motivos: MotivoGlosa[] = []
    const mudancas: MudancaDeTexto[] = []
    let anterior: string | null = null

    for (const g of ordenadas) {
      const texto = (g.justificativa ?? '').trim()
      if (texto && !textos.includes(texto)) textos.push(texto)
      const motivo = g.justificativa_normalizada
      if (motivo && !motivos.includes(motivo)) motivos.push(motivo)
      if (texto && anterior && texto !== anterior) {
        mudancas.push({
          de: anterior,
          para: texto,
          em: dataDe(g) ?? '',
          competencia: g.competencia,
        })
      }
      if (texto) anterior = texto
    }

    grupos.push({
      assinatura,
      codigo_tuss: ordenadas[0].codigo_tuss ?? 'SEM-CODIGO',
      valor_glosado: ordenadas[0].valor_glosado,
      ocorrencias: ordenadas.length,
      valor_total: somar(...ordenadas.map((g) => g.valor_glosado)),
      valor_recursado: somar(...ordenadas.map((g) => g.valor_recurso ?? 0)),
      nao_recursadas: ordenadas.filter((g) => !g.recursada).length,
      primeira: dataDe(ordenadas[0]),
      ultima: dataDe(ordenadas[ordenadas.length - 1]),
      competencias: Array.from(new Set(ordenadas.map((g) => g.competencia))),
      motivos,
      textos,
      mudancas_de_texto: mudancas,
      glosas: ordenadas,
    })
  }

  return grupos.sort((a, b) => b.valor_total - a.valor_total)
}

/**
 * Padrao novo: assinatura que aparece 3+ vezes em 60 dias sem recurso.
 */
export function padroesNovos(
  grupos: GrupoAssinatura[],
  hoje: string,
  opcoes: { minOcorrencias?: number; janelaDias?: number } = {},
): GrupoAssinatura[] {
  const min = opcoes.minOcorrencias ?? 3
  const janela = opcoes.janelaDias ?? 60
  const corte = addDias(hoje, -janela)
  return grupos.filter((g) => {
    const recentes = g.glosas.filter((x) => {
      const d = dataDe(x)
      return d != null && !ehAntes(d, corte)
    })
    return recentes.length >= min && recentes.some((x) => !x.recursada)
  })
}

export interface LinhaRanking {
  codigo_tuss: string
  ocorrencias: number
  valor_total: number
  valor_recuperado: number
  nao_recursadas: number
  /** null quando nao ha producao lancada do codigo para comparar */
  taxa_glosa: number | null
}

export function rankingPorCodigo(
  glosas: Glosa[],
  realizados: ProcedimentoRealizado[] = [],
): LinhaRanking[] {
  const mapa = new Map<string, Glosa[]>()
  for (const g of glosas) {
    const c = g.codigo_tuss ?? 'SEM-CODIGO'
    mapa.set(c, [...(mapa.get(c) ?? []), g])
  }
  const linhas: LinhaRanking[] = []
  for (const [codigo, itens] of mapa) {
    const lancados = realizados.filter((r) => r.codigo_tuss === codigo).length
    linhas.push({
      codigo_tuss: codigo,
      ocorrencias: itens.length,
      valor_total: somar(...itens.map((g) => g.valor_glosado)),
      valor_recuperado: somar(
        ...itens.filter((g) => g.resultado === 'deferido').map((g) => g.valor_recurso ?? 0),
      ),
      nao_recursadas: itens.filter((g) => !g.recursada).length,
      taxa_glosa: lancados > 0 ? itens.length / lancados : null,
    })
  }
  return linhas.sort((a, b) => b.valor_total - a.valor_total)
}

export interface SerieMes {
  mes: string
  ocorrencias: number
  valor: number
}

/** Serie temporal de uma assinatura, mes a mes. */
export function serieTemporal(grupo: GrupoAssinatura): SerieMes[] {
  const mapa = new Map<string, SerieMes>()
  for (const g of grupo.glosas) {
    const d = dataDe(g)
    if (!d) continue
    const mes = mesDe(d)
    const atual = mapa.get(mes) ?? { mes, ocorrencias: 0, valor: 0 }
    atual.ocorrencias += 1
    atual.valor = somar(atual.valor, g.valor_glosado)
    mapa.set(mes, atual)
  }
  return [...mapa.values()].sort((a, b) => (a.mes < b.mes ? -1 : 1))
}

export interface GlosaComPrazo {
  glosa: Glosa
  prazo: string | null
  dias_restantes: number | null
  vencido: boolean
}

/** Glosas ainda nao recursadas, prazo vencendo primeiro (§8.4). */
export function porPrazo(glosas: Glosa[], hoje: string): GlosaComPrazo[] {
  return glosas
    .filter((g) => !g.recursada)
    .map((g) => {
      const prazo =
        g.prazo_recurso ??
        (g.data_demonstrativo ? addDias(g.data_demonstrativo, 30) : null)
      return {
        glosa: g,
        prazo,
        dias_restantes: prazo ? diffDias(hoje, prazo) : null,
        vencido: prazo ? diffDias(hoje, prazo) < 0 : false,
      }
    })
    .sort((a, b) => {
      if (a.dias_restantes == null) return 1
      if (b.dias_restantes == null) return -1
      return a.dias_restantes - b.dias_restantes
    })
}

export interface Exposicao {
  total_a_faturar: number
  /** parcela do que esta a faturar cujo codigo tem historico de glosa */
  exposto: number
  itens: Array<{ codigo_tuss: string; quantidade: number; glosa_unitaria: number; exposto: number }>
}

/** Quanto do que esta a faturar tem historico de glosa (§11.3). */
export function exposicaoDoMes(
  aFaturar: ProcedimentoRealizado[],
  tabela: Procedimento[],
  data: string,
): Exposicao {
  const mapa = new Map<string, { quantidade: number; glosa_unitaria: number }>()
  for (const pr of aFaturar) {
    const ref = vigenteEm(tabela, pr.codigo_tuss, data)
    const glosa = ref?.glosa_recorrente ?? 0
    if (glosa <= 0) continue
    const atual = mapa.get(pr.codigo_tuss) ?? { quantidade: 0, glosa_unitaria: glosa }
    atual.quantidade += 1
    mapa.set(pr.codigo_tuss, atual)
  }
  const itens = [...mapa.entries()].map(([codigo_tuss, v]) => ({
    codigo_tuss,
    quantidade: v.quantidade,
    glosa_unitaria: v.glosa_unitaria,
    exposto: somar(...Array(v.quantidade).fill(v.glosa_unitaria)),
  }))
  return {
    total_a_faturar: somar(...aFaturar.map((p) => p.valor_cobrado)),
    exposto: somar(...itens.map((i) => i.exposto)),
    itens: itens.sort((a, b) => b.exposto - a.exposto),
  }
}

export interface TotaisGlosa {
  glosado: number
  em_recurso: number
  recuperado: number
  perdido: number
}

export function totalizar(glosas: Glosa[], hoje: string): TotaisGlosa {
  const glosado = somar(...glosas.map((g) => g.valor_glosado))
  const emRecurso = somar(
    ...glosas.filter((g) => g.recursada && !g.resultado).map((g) => g.valor_recurso ?? g.valor_glosado),
  )
  const recuperado = somar(
    ...glosas.filter((g) => g.resultado === 'deferido').map((g) => g.valor_recurso ?? g.valor_glosado),
  )
  // perdido = indeferido + prazo vencido sem recurso
  const perdido = somar(
    ...glosas
      .filter((g) => {
        if (g.resultado === 'indeferido') return true
        if (g.recursada) return false
        const prazo = g.prazo_recurso ?? (g.data_demonstrativo ? addDias(g.data_demonstrativo, 30) : null)
        return prazo != null && ehAntes(prazo, hoje)
      })
      .map((g) => g.valor_glosado),
  )
  return { glosado, em_recurso: emRecurso, recuperado, perdido }
}
