import type { ProcedimentoRealizado, Glosa } from './tipos'
import { addDias, diaDoMes, diffDias, mesDe, mesSeguinte, ultimoDiaDoMes, formatarData, formatarMes } from './datas'
import { porPrazo } from './glosas'

/**
 * Calendario de prazos (§12).
 *
 *   Digitacao no SAVI ....... ao longo do proprio mes do atendimento
 *   XML no portal ........... ate o dia 7 do mes seguinte
 *   Demonstrativo liberado .. entre 5 e 15 do mes seguinte
 *   Nota fiscal ............. ate o dia 20
 *   Pagamento ............... dia 20 do mes subsequente
 *   Recurso de glosa ........ 30 dias apos o demonstrativo
 *
 * Honorario nao digitado no SAVI e glosado automaticamente. O alerta mais
 * importante do app e o do dia 25 em diante.
 */

export interface EtapaPrazo {
  etapa: string
  vence_em: string
  dias_restantes: number
  detalhe: string
}

export function calendarioDaCompetencia(mes: string): EtapaPrazo[] {
  const seguinte = mesSeguinte(mes)
  const subsequente = mesSeguinte(seguinte)
  return [
    { etapa: 'Digitacao no SAVI', vence_em: ultimoDiaDoMes(mes), dias_restantes: 0, detalhe: 'Ao longo do proprio mes do atendimento.' },
    { etapa: 'XML no portal', vence_em: `${seguinte}-07`, dias_restantes: 0, detalhe: 'Lote TISS ate o dia 7 do mes seguinte.' },
    { etapa: 'Demonstrativo liberado', vence_em: `${seguinte}-15`, dias_restantes: 0, detalhe: 'Liberado entre os dias 5 e 15.' },
    { etapa: 'Nota fiscal', vence_em: `${seguinte}-20`, dias_restantes: 0, detalhe: 'Emissao ate o dia 20.' },
    { etapa: 'Pagamento', vence_em: `${subsequente}-20`, dias_restantes: 0, detalhe: 'Dia 20 do mes subsequente.' },
  ]
}

export function calendarioEm(mes: string, hoje: string): EtapaPrazo[] {
  return calendarioDaCompetencia(mes).map((e) => ({
    ...e,
    dias_restantes: diffDias(hoje, e.vence_em),
  }))
}

export interface AlertaPrazo {
  tipo: 'savi' | 'xml' | 'recurso'
  severidade: 'critico' | 'atencao' | 'info'
  titulo: string
  mensagem: string
  dias_restantes: number | null
}

/**
 * O alerta que existe para o dinheiro nao sumir: quantos procedimentos do mes
 * corrente ainda nao foram faturados e quantos dias faltam.
 */
export function alertaDigitacaoSavi(
  aFaturar: ProcedimentoRealizado[],
  datasPorProcedimento: Map<string, string>,
  hoje: string,
): AlertaPrazo | null {
  const mes = mesDe(hoje)
  const doMes = aFaturar.filter((p) => {
    const d = p.id ? datasPorProcedimento.get(p.id) : undefined
    return d ? mesDe(d) === mes : false
  })
  if (doMes.length === 0) return null
  const fim = ultimoDiaDoMes(mes)
  const restantes = diffDias(hoje, fim)
  const dia = diaDoMes(hoje)
  if (dia < 25) {
    return {
      tipo: 'savi',
      severidade: 'info',
      titulo: `${doMes.length} procedimento(s) a faturar em ${formatarMes(mes)}`,
      mensagem: `Faltam ${restantes} dia(s) para o fim do mes.`,
      dias_restantes: restantes,
    }
  }
  return {
    tipo: 'savi',
    severidade: restantes <= 2 ? 'critico' : 'atencao',
    titulo: `${doMes.length} procedimento(s) ainda nao faturados`,
    mensagem:
      `Faltam ${restantes} dia(s) para o fim do mes. Honorario nao digitado no ` +
      `SAVI e glosado automaticamente.`,
    dias_restantes: restantes,
  }
}

export function alertaXml(mesCompetencia: string, pendentes: number, hoje: string): AlertaPrazo | null {
  if (pendentes === 0) return null
  const limite = `${mesSeguinte(mesCompetencia)}-07`
  const restantes = diffDias(hoje, limite)
  if (restantes > 10) return null
  return {
    tipo: 'xml',
    severidade: restantes < 0 ? 'critico' : restantes <= 2 ? 'critico' : 'atencao',
    titulo: `Lote TISS de ${formatarMes(mesCompetencia)}`,
    mensagem:
      restantes < 0
        ? `Prazo de envio venceu em ${formatarData(limite)}.`
        : `${pendentes} guia(s) para enviar ate ${formatarData(limite)}.`,
    dias_restantes: restantes,
  }
}

export function alertasDeRecurso(glosas: Glosa[], hoje: string): AlertaPrazo[] {
  return porPrazo(glosas, hoje)
    .filter((g) => g.dias_restantes != null && g.dias_restantes <= 10)
    .map((g) => ({
      tipo: 'recurso' as const,
      severidade: g.vencido ? 'critico' : (g.dias_restantes as number) <= 5 ? 'critico' : 'atencao',
      titulo: `Recurso ${g.glosa.codigo_tuss ?? ''} - ${g.glosa.competencia}`,
      mensagem: g.vencido
        ? `Prazo de recurso venceu em ${formatarData(g.prazo as string)}.`
        : `Prazo de recurso vence em ${formatarData(g.prazo as string)} (${g.dias_restantes} dia(s)).`,
      dias_restantes: g.dias_restantes,
    }))
}

/** Prazo de recurso: 30 dias apos o demonstrativo. */
export function prazoRecurso(dataDemonstrativo: string): string {
  return addDias(dataDemonstrativo, 30)
}
