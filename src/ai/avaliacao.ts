import type { Extracao } from './esquemas'

/**
 * Conjunto de avaliacao da extracao (§14).
 *
 * Sem medir, mudanca de prompt e chute: nao da para saber se melhorou ou
 * piorou. Cada boletim do conjunto tem um gabarito digitado a mao; a metrica e
 * acerto POR CAMPO, nao por documento.
 *
 * Regras de pontuacao que refletem o custo real do erro:
 *  - senha errada custa mais que senha em branco. Em branco o medico digita;
 *    errada vira glosa. Por isso senha inventada e penalizada em dobro.
 *  - descricao cirurgica e medida por cobertura de palavras, nao por igualdade:
 *    o que interessa e nao ter resumido.
 */

export interface Gabarito {
  arquivo: string
  tipo_documento: Extracao['tipo_documento']
  data?: string | null
  hora_inicio?: string | null
  hora_fim?: string | null
  paciente_nome?: string | null
  carteira?: string | null
  numero_atendimento?: string | null
  tipo_anestesia?: string | null
  acomodacao?: string | null
  procedimentos: Array<{ codigo_tuss: string; senha: string | null }>
  descricao_cirurgica: string
  /** campos que o gabarito considera ilegiveis no papel */
  ilegiveis?: string[]
}

export interface ResultadoCampo {
  campo: string
  acertou: boolean
  esperado: string | null
  obtido: string | null
  /** true quando o modelo inventou onde deveria ter deixado em branco */
  inventou?: boolean
}

export interface ResultadoDocumento {
  arquivo: string
  campos: ResultadoCampo[]
  acertos: number
  total: number
  cobertura_descricao: number
  senhas_inventadas: number
}

function normaliza(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return s === '' ? null : s
}

function comparar(
  campo: string,
  esperado: unknown,
  obtido: unknown,
  ilegivelNoGabarito: boolean,
): ResultadoCampo {
  const e = normaliza(esperado)
  const o = normaliza(obtido)
  if (ilegivelNoGabarito) {
    // o certo e devolver null; qualquer valor aqui e invencao
    return { campo, acertou: o == null, esperado: null, obtido: o, inventou: o != null }
  }
  return { campo, acertou: e === o, esperado: e, obtido: o }
}

/**
 * Fracao das palavras do gabarito presentes na transcricao. Pontuacao nao
 * conta: o que se mede e se o modelo transcreveu ou resumiu, nao se copiou a
 * virgula.
 */
export function coberturaDescricao(esperado: string, obtido: string | null): number {
  const semPontuacao = (v: string | null) =>
    (normaliza(v) ?? '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')
  const palavras = semPontuacao(esperado).split(' ').filter((p) => p.length > 3)
  if (palavras.length === 0) return 1
  const texto = semPontuacao(obtido)
  const presentes = palavras.filter((p) => texto.includes(p)).length
  return presentes / palavras.length
}

export function avaliarDocumento(gabarito: Gabarito, extracao: Extracao): ResultadoDocumento {
  const ilegiveis = new Set(gabarito.ilegiveis ?? [])
  const campos: ResultadoCampo[] = [
    { campo: 'tipo_documento', acertou: gabarito.tipo_documento === extracao.tipo_documento,
      esperado: gabarito.tipo_documento, obtido: extracao.tipo_documento },
    comparar('data', gabarito.data, extracao.data.valor, ilegiveis.has('data')),
    comparar('hora_inicio', gabarito.hora_inicio, extracao.hora_inicio.valor, ilegiveis.has('hora_inicio')),
    comparar('hora_fim', gabarito.hora_fim, extracao.hora_fim.valor, ilegiveis.has('hora_fim')),
    comparar('paciente_nome', gabarito.paciente_nome, extracao.paciente_nome.valor, ilegiveis.has('paciente_nome')),
    comparar('carteira', gabarito.carteira, extracao.carteira.valor, ilegiveis.has('carteira')),
    comparar('numero_atendimento', gabarito.numero_atendimento, extracao.numero_atendimento.valor, ilegiveis.has('numero_atendimento')),
    comparar('tipo_anestesia', gabarito.tipo_anestesia, extracao.tipo_anestesia.valor, ilegiveis.has('tipo_anestesia')),
    comparar('acomodacao', gabarito.acomodacao, extracao.acomodacao.valor, ilegiveis.has('acomodacao')),
    { campo: 'qtd_procedimentos',
      acertou: gabarito.procedimentos.length === extracao.procedimentos.length,
      esperado: String(gabarito.procedimentos.length),
      obtido: String(extracao.procedimentos.length) },
  ]

  let senhasInventadas = 0
  gabarito.procedimentos.forEach((p, i) => {
    const obtido = extracao.procedimentos[i]
    campos.push(comparar(`codigo_tuss[${i}]`, p.codigo_tuss, obtido?.codigo_tuss.valor, false))
    const senha = comparar(`senha[${i}]`, p.senha, obtido?.senha.valor, p.senha == null)
    if (senha.inventou) senhasInventadas++
    campos.push(senha)
  })

  const cobertura = coberturaDescricao(gabarito.descricao_cirurgica, extracao.descricao_cirurgica.valor)
  campos.push({
    campo: 'descricao_cirurgica',
    // 0.95 e o limiar de "transcreveu, nao resumiu"
    acertou: cobertura >= 0.95,
    esperado: `cobertura >= 95%`,
    obtido: `${(cobertura * 100).toFixed(0)}%`,
  })

  return {
    arquivo: gabarito.arquivo,
    campos,
    acertos: campos.filter((c) => c.acertou).length,
    total: campos.length,
    cobertura_descricao: cobertura,
    senhas_inventadas: senhasInventadas,
  }
}

export interface Metrica {
  documentos: number
  acerto_por_campo: number
  cobertura_media_descricao: number
  senhas_inventadas: number
  piores_campos: Array<{ campo: string; erros: number }>
}

export function consolidar(resultados: ResultadoDocumento[]): Metrica {
  const total = resultados.reduce((n, r) => n + r.total, 0)
  const acertos = resultados.reduce((n, r) => n + r.acertos, 0)
  const erros = new Map<string, number>()
  for (const r of resultados) {
    for (const c of r.campos) {
      if (c.acertou) continue
      const chave = c.campo.replace(/\[\d+\]/, '[]')
      erros.set(chave, (erros.get(chave) ?? 0) + 1)
    }
  }
  return {
    documentos: resultados.length,
    acerto_por_campo: total > 0 ? acertos / total : 0,
    cobertura_media_descricao:
      resultados.length > 0
        ? resultados.reduce((n, r) => n + r.cobertura_descricao, 0) / resultados.length
        : 0,
    senhas_inventadas: resultados.reduce((n, r) => n + r.senhas_inventadas, 0),
    piores_campos: [...erros.entries()]
      .map(([campo, e]) => ({ campo, erros: e }))
      .sort((a, b) => b.erros - a.erros)
      .slice(0, 8),
  }
}
