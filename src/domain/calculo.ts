import type {
  Consulta,
  Procedimento,
  ProcedimentoRealizado,
} from './tipos'
import { somar } from './dinheiro'
import { vigenteEm } from './honorarios'

/**
 * Calculo do atendimento. Todas as regras de negocio da §6 que afetam VALOR
 * ficam aqui, como funcao pura. A UI nunca soma nada por conta propria.
 *
 * O que NAO esta aqui de proposito:
 *  - regra 1 (um sitio, um procedimento, uma senha): e soma simples, cada
 *    procedimento_realizado ja e um sitio. A senha propria e cobrada pelo
 *    checklist (regra 3 do checklist).
 *  - regra 2 (sala PQA e faturavel): a classe do atendimento nao entra em
 *    nenhuma conta. Ela existe so para separar no relatorio.
 *  - regra 8 (NOTRE SP): mesmos valores, nada a fazer.
 */

export interface ItemCalculado {
  indice: number
  codigo_tuss: string
  descricao: string
  senha: string
  valor_cobrado: number
  /** null = a operadora nunca liquidou esse codigo; nao ha previsao honesta */
  valor_previsto: number | null
  glosa_recorrente: number
  remunerado: boolean
  motivo_nao_remunerado?: string
  confianca: Procedimento['confianca'] | 'fora_da_tabela'
}

export interface ResultadoCalculo {
  itens: ItemCalculado[]
  /** o que se lanca */
  total_cobrado: number
  /** soma do que a operadora historicamente paga, so dos itens com historico */
  total_previsto: number
  /** codigos sem valor_pago conhecido - aparecem como "a confirmar" na tela */
  sem_previsao: string[]
  /** soma das glosas recorrentes conhecidas dos itens lancados */
  total_glosa_recorrente: number
  avisos: string[]
}

export function calcularAtendimento(
  procedimentos: ProcedimentoRealizado[],
  tabela: Procedimento[],
  data: string,
): ResultadoCalculo {
  const avisos: string[] = []

  const base = procedimentos.map((pr, indice) => {
    const ref = vigenteEm(tabela, pr.codigo_tuss, data)
    return {
      indice,
      pr,
      ref,
      item: {
        indice,
        codigo_tuss: pr.codigo_tuss,
        descricao: ref?.descricao ?? '(codigo fora da tabela)',
        senha: pr.senha,
        valor_cobrado: pr.valor_cobrado,
        valor_previsto: ref?.valor_pago ?? null,
        glosa_recorrente: ref?.glosa_recorrente ?? 0,
        remunerado: true,
        confianca: ref?.confianca ?? ('fora_da_tabela' as const),
      } as ItemCalculado,
    }
  })

  // --- regra 3: somente o cirurgiao principal e remunerado -----------------
  for (const b of base) {
    if (b.pr.cirurgiao_principal === false) {
      b.item.remunerado = false
      b.item.motivo_nao_remunerado =
        'Regra 3: somente o cirurgiao principal e remunerado.'
    }
  }

  // --- regra 5: apendicectomia por decisao intraoperatoria ------------------
  for (const b of base) {
    if (b.pr.decisao_intraoperatoria) {
      b.item.remunerado = false
      b.item.motivo_nao_remunerado =
        'Regra 5: procedimento por decisao intraoperatoria nao e remunerado.'
    }
  }

  // --- regra 4: codigos equivalentes remuneram apenas um -------------------
  const ativos = () => base.filter((b) => b.item.remunerado)
  for (const a of ativos()) {
    const equivalente = a.ref?.equivalente_a
    if (!equivalente) continue
    for (const b of ativos()) {
      if (b.indice <= a.indice) continue
      if (b.item.codigo_tuss !== equivalente) continue
      // mantem o de maior valor cobrado; empate mantem o primeiro lancado
      const perdedor = b.item.valor_cobrado > a.item.valor_cobrado ? a : b
      const vencedor = perdedor === a ? b : a
      perdedor.item.remunerado = false
      perdedor.item.motivo_nao_remunerado =
        `Regra 4: ${perdedor.item.codigo_tuss} e equivalente a ` +
        `${vencedor.item.codigo_tuss} - a operadora remunera apenas um.`
      avisos.push(perdedor.item.motivo_nao_remunerado)
    }
  }

  // --- regra 6: pequenas cirurgias adicionais no mesmo ato ------------------
  const pequenas = ativos().filter((b) => b.ref?.pequena_cirurgia)
  if (pequenas.length > 1) {
    const melhor = pequenas.reduce((a, b) =>
      b.item.valor_cobrado > a.item.valor_cobrado ? b : a,
    )
    for (const p of pequenas) {
      if (p.indice === melhor.indice) continue
      p.item.remunerado = false
      p.item.motivo_nao_remunerado =
        'Regra 6: pequenas cirurgias adicionais no mesmo ato - a operadora ' +
        'remunera apenas um procedimento.'
    }
    avisos.push(
      `Regra 6: ${pequenas.length} pequenas cirurgias no mesmo ato; previsto ` +
        `considera apenas ${melhor.item.codigo_tuss}.`,
    )
  }

  const itens = base.map((b) => b.item)
  const remunerados = itens.filter((i) => i.remunerado)

  return {
    itens,
    total_cobrado: somar(...itens.map((i) => i.valor_cobrado)),
    total_previsto: somar(
      ...remunerados.map((i) => i.valor_previsto).filter((v) => v != null),
    ),
    sem_previsao: remunerados
      .filter((i) => i.valor_previsto == null)
      .map((i) => i.codigo_tuss),
    total_glosa_recorrente: somar(
      ...remunerados.map((i) => i.glosa_recorrente),
    ),
    avisos,
  }
}

export interface ResumoConsultas {
  qtd_consultas: number
  qtd_retornos: number
  /** retorno entra na producao mas nao no valor (regra 7) */
  valor: number
}

export function calcularConsultas(consultas: Consulta[]): ResumoConsultas {
  return {
    qtd_consultas: consultas.reduce((a, c) => a + c.qtd_consultas, 0),
    qtd_retornos: consultas.reduce((a, c) => a + c.qtd_retornos, 0),
    valor: somar(
      ...consultas.map((c) => c.qtd_consultas * c.valor_unitario),
    ),
  }
}
