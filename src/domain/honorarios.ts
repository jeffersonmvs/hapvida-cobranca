import type { Procedimento } from './tipos'
import { ehAntes, ehDepois } from './datas'
import { normalizar } from './texto'
import { nomeNoCatalogo } from './catalogo'

/**
 * Tabela de honorarios: consulta por vigencia e regra 9 (nunca estimar valor).
 */

/** Linha vigente na data informada. null se o codigo nao existe na tabela. */
export function vigenteEm(
  tabela: Procedimento[],
  codigo: string,
  data: string,
): Procedimento | null {
  const candidatos = tabela
    .filter((p) => p.codigo_tuss === codigo)
    .filter((p) => !ehDepois(p.vigencia_inicio, data))
    .filter((p) => !p.vigencia_fim || !ehAntes(p.vigencia_fim, data))
  if (candidatos.length === 0) return null
  // mais recente primeiro
  candidatos.sort((a, b) => (a.vigencia_inicio < b.vigencia_inicio ? 1 : -1))
  return candidatos[0]
}

export type ResolucaoValor =
  | {
      ok: true
      procedimento: Procedimento
      valor_cobrar: number
      /** null quando a operadora ainda nao liquidou nenhum pagamento do codigo */
      valor_previsto: number | null
      glosa_recorrente: number
    }
  | { ok: false; codigo: string; motivo: string }

/**
 * Regra 9: codigo fora da tabela BLOQUEIA o salvamento. Nunca estimar valor -
 * quem informa o valor e o medico, e a linha nasce como 'a_confirmar'.
 *
 * Regra 10: valor_pago NUNCA substitui valor_cobrar. O previsto e informativo.
 */
export function resolverValor(
  tabela: Procedimento[],
  codigo: string,
  data: string,
): ResolucaoValor {
  const proc = vigenteEm(tabela, codigo, data)
  if (!proc) {
    // Codigo conhecido e codigo inexistente sao problemas diferentes, e a
    // acao do medico muda: um pede o valor, o outro pede reler a foto.
    const nome = nomeNoCatalogo(codigo)
    return {
      ok: false,
      codigo,
      motivo: nome
        ? `${codigo} - ${nome}: procedimento do catalogo ainda sem valor ` +
          `cadastrado em ${data}. Informe o valor em Honorarios antes de ` +
          `lancar - o app nao estima valor de procedimento.`
        : `Codigo ${codigo} nao existe no catalogo do servico nem na tabela ` +
          `de honorarios. Confira o codigo no documento: leitura errada e a ` +
          `causa mais provavel.`,
    }
  }
  return {
    ok: true,
    procedimento: proc,
    valor_cobrar: proc.valor_cobrar,
    valor_previsto: proc.valor_pago ?? null,
    glosa_recorrente: proc.glosa_recorrente ?? 0,
  }
}

/** Busca por codigo ou por descricao, para o autocomplete do lancamento. */
export function buscar(tabela: Procedimento[], termo: string): Procedimento[] {
  const t = normalizar(termo)
  if (!t) return tabela
  return tabela.filter(
    (p) =>
      p.codigo_tuss.toLowerCase().includes(t) ||
      normalizar(p.descricao).includes(t),
  )
}

/** Somente a linha vigente hoje de cada codigo. */
export function vigentesEm(tabela: Procedimento[], data: string): Procedimento[] {
  const codigos = Array.from(new Set(tabela.map((p) => p.codigo_tuss)))
  return codigos
    .map((c) => vigenteEm(tabela, c, data))
    .filter((p): p is Procedimento => p != null)
}

/**
 * §8.7 - editar valor cria NOVA vigencia em vez de sobrescrever. O historico
 * importa para auditar faturamento antigo.
 */
export function novaVigencia(
  atual: Procedimento,
  alteracoes: Partial<Procedimento>,
  inicio: string,
): { fechada: Procedimento; nova: Procedimento } {
  if (!ehDepois(inicio, atual.vigencia_inicio)) {
    throw new Error(
      'A nova vigencia precisa comecar depois do inicio da vigencia atual.',
    )
  }
  const fechada: Procedimento = {
    ...atual,
    vigencia_fim: previoA(inicio),
  }
  const nova: Procedimento = {
    ...atual,
    ...alteracoes,
    id: undefined,
    codigo_tuss: atual.codigo_tuss,
    vigencia_inicio: inicio,
    vigencia_fim: null,
  }
  return { fechada, nova }
}

function previoA(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}
