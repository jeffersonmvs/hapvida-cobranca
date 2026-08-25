import { rodarChecklist, type Alerta, type Procedimento } from '@/domain'
import type { AtendimentoCompleto } from './repositorio'

/**
 * Alertas vivos de um atendimento.
 *
 * O checklist deterministico e RECALCULADO a cada leitura em vez de confiar no
 * que foi gravado: alerta salvo em 10/08 pode ter deixado de valer depois que
 * a descricao cirurgica foi corrigida - e, pior, pode ter passado a valer sem
 * que nada o gravasse. O que fica guardado no banco e (a) o estado "resolvido"
 * marcado pelo medico e (b) os alertas de IA, que nao dao para recalcular sem
 * chamar o modelo de novo.
 */
export function alertasVivos(
  a: AtendimentoCompleto,
  tabela: Procedimento[],
  hoje: string,
): Alerta[] {
  const chave = (x: Alerta) =>
    `${x.regra}|${x.procedimento_realizado_id ?? ''}|${x.mensagem.slice(0, 60)}`

  const resolvidos = new Set(a.alertas.filter((x) => x.resolvido).map(chave))
  const guardados = new Map(a.alertas.map((x) => [chave(x), x]))

  const deterministicos = rodarChecklist({
    atendimento: a.atendimento,
    procedimentos: a.procedimentos,
    tabela,
    hoje,
  }).map((x) => {
    const k = chave(x)
    return { ...x, id: guardados.get(k)?.id, resolvido: resolvidos.has(k) }
  })

  return [...deterministicos, ...a.alertas.filter((x) => x.origem === 'ia')]
}

export function alertasDeTodos(
  atendimentos: AtendimentoCompleto[],
  tabela: Procedimento[],
  hoje: string,
): Array<Alerta & { atendimento_id?: string; paciente?: string }> {
  return atendimentos.flatMap((a) =>
    alertasVivos(a, tabela, hoje).map((x) => ({
      ...x,
      atendimento_id: a.atendimento.id,
      paciente: a.paciente?.nome,
    })),
  )
}
