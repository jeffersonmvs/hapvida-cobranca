import { supabase, supabaseConfigurado } from '@/lib/supabase'
import {
  esquemaExtracao, esquemaNormalizacao, esquemaRedacaoRecurso, esquemaRisco,
  type AnaliseRisco, type Extracao, type Normalizacao, type RedacaoRecurso,
} from './esquemas'
import type { z } from 'zod'

/**
 * Cliente das funcoes de IA.
 *
 * TODA chamada vai para uma Edge Function autenticada. A chave da API vive
 * apenas no servidor (supabase secrets); se algum dia aparecer no bundle isso e
 * bug de seguranca, nao detalhe de implementacao (§13).
 *
 * A funcao tambem grava em analises_ia - modelo, versao do prompt, entrada
 * resumida e saida - para que dê para auditar e reprocessar depois.
 */

export class IaIndisponivel extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'IaIndisponivel'
  }
}

export const iaDisponivel = supabaseConfigurado

async function invocar<T extends z.ZodTypeAny>(
  funcao: string,
  corpo: Record<string, unknown>,
  esquema: T,
): Promise<z.infer<T>> {
  if (!supabase) {
    throw new IaIndisponivel(
      'IA indisponivel: Supabase nao configurado. O app funciona inteiro sem ela.',
    )
  }
  const { data, error } = await supabase.functions.invoke(funcao, { body: corpo })
  if (error) throw new IaIndisponivel(error.message)
  if (data?.erro) throw new IaIndisponivel(String(data.erro))

  const validado = esquema.safeParse(data?.saida)
  if (!validado.success) {
    // Falha explicita: nunca aproveitar saida parcial em dado de faturamento.
    throw new IaIndisponivel(
      `Resposta da IA nao passou na validacao (${funcao}): ${validado.error.issues
        .map((i) => i.path.join('.'))
        .join(', ')}`,
    )
  }
  return validado.data
}

/** §11.1 - extracao estruturada. A imagem contem identificacao; e a excecao
 * necessaria a regra de minimizacao. */
export function extrairDocumento(entrada: {
  storage_path: string
  codigos_vigentes: Array<{ codigo: string; descricao: string }>
}): Promise<Extracao> {
  return invocar('extrair-documento', entrada, esquemaExtracao)
}

/** §11.2 - analise semantica de risco. Sem nome, carteira ou CPF. */
export function analisarRisco(entrada: {
  referencia_id: string
  codigo_tuss: string
  descricao_codigo: string
  descricao_cirurgica: string
  materiais_autorizados: string[]
}): Promise<AnaliseRisco> {
  return invocar('analisar-risco', entrada, esquemaRisco)
}

/** §11.3 - normalizacao das justificativas. So o texto da operadora viaja. */
export function normalizarGlosas(entrada: {
  itens: Array<{ id: string; justificativa: string }>
}): Promise<Normalizacao> {
  return invocar('normalizar-glosas', entrada, esquemaNormalizacao)
}

/** §11.4 - refino da minuta. Sem nome do paciente: vai identificador interno. */
export function redigirRecurso(entrada: {
  referencia_id: string
  minuta: string
  valores: { apresentado: number | null; pago: number | null; glosado: number }
  motivo_alegado: string
  senha: string | null
  descricao_cirurgica: string | null
  historico: string[]
}): Promise<RedacaoRecurso> {
  return invocar('redigir-recurso', entrada, esquemaRedacaoRecurso)
}
