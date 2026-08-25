import { z } from 'zod'
import { MOTIVOS_GLOSA } from '@/domain'

/**
 * Contratos de saida das funcoes de IA (§11).
 *
 * Toda resposta e validada aqui. Se nao validar, FALHA EXPLICITA - nunca
 * aproveitar parcialmente uma saida de modelo em dado de faturamento.
 */

/** Campo com score de confianca proprio. valor null = o modelo nao leu. */
const campo = <T extends z.ZodTypeAny>(tipo: T) =>
  z.object({
    valor: tipo.nullable(),
    confianca: z.number().min(0).max(1),
    /** true quando o campo existe no papel mas esta ilegivel */
    ilegivel: z.boolean().optional().default(false),
  })

const texto = () => campo(z.string())

export const esquemaProcedimentoExtraido = z.object({
  codigo_tuss: texto(),
  /** senha NUNCA e preenchida por inferencia: ilegivel vira null */
  senha: texto(),
  descricao: texto(),
})

export const esquemaExtracao = z.object({
  tipo_documento: z.enum(['boletim', 'ficha', 'guia', 'outro']),
  confianca_geral: z.number().min(0).max(1),
  data: texto(),
  hora_inicio: texto(),
  hora_fim: texto(),
  paciente_nome: texto(),
  carteira: texto(),
  numero_atendimento: texto(),
  data_internacao: texto(),
  acomodacao: texto(),
  plano: texto(),
  tipo_anestesia: texto(),
  cirurgiao_principal: texto(),
  procedimentos: z.array(esquemaProcedimentoExtraido),
  materiais: z.array(z.object({ nome: z.string(), utilizado: z.boolean().nullable() })),
  tela_utilizada: campo(z.boolean()),
  /** transcricao LITERAL, sem resumo - e a prova documental usada nos recursos */
  descricao_cirurgica: texto(),
  campos_ilegiveis: z.array(z.string()),
})

export type Extracao = z.infer<typeof esquemaExtracao>
export type CampoExtraido<T = string> = { valor: T | null; confianca: number; ilegivel?: boolean }

export const esquemaRisco = z.object({
  compativel: z.boolean(),
  risco: z.enum(['baixo', 'medio', 'alto']),
  achados: z.array(
    z.object({
      tipo: z.string(),
      explicacao: z.string(),
      sugestao_de_redacao: z.string().nullable(),
    }),
  ),
  confianca: z.number().min(0).max(1),
})

export type AnaliseRisco = z.infer<typeof esquemaRisco>

export const esquemaNormalizacao = z.object({
  itens: z.array(
    z.object({
      id: z.string(),
      motivo: z.enum(MOTIVOS_GLOSA),
      confianca: z.number().min(0).max(1),
    }),
  ),
})

export type Normalizacao = z.infer<typeof esquemaNormalizacao>

export const esquemaRedacaoRecurso = z.object({
  fundamentacao: z.array(z.string()),
  texto: z.string(),
  confianca: z.number().min(0).max(1),
  /** fatos do registro que o modelo diz ter usado - para conferencia */
  fatos_usados: z.array(z.string()),
})

export type RedacaoRecurso = z.infer<typeof esquemaRedacaoRecurso>
