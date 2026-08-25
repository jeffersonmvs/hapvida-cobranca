/**
 * Tipos do dominio de faturamento.
 *
 * Convencao de datas: TODA data circula como string ISO 'AAAA-MM-DD' e toda
 * hora como 'HH:MM' ou 'HH:MM:SS'. Nunca objeto Date no dominio - Date carrega
 * fuso horario e ja custou dia errado em faturamento antes.
 */

export type Confianca = 'confirmado' | 'provavel' | 'a_confirmar'

export type Severidade = 'critico' | 'atencao' | 'info'

export type OrigemAlerta = 'deterministica' | 'ia'

export type SituacaoProcedimento =
  | 'a_faturar'
  | 'faturado'
  | 'pago'
  | 'glosado'
  | 'em_recurso'
  | 'recuperado'

export type ClasseAtendimento = 'centro_cirurgico' | 'pqa'

/** Linha da tabela de honorarios, versionada por vigencia. */
export interface Procedimento {
  id?: string
  codigo_tuss: string
  descricao: string
  valor_cobrar: number
  valor_pago: number | null
  glosa_recorrente: number | null
  confianca: Confianca
  exige_tela?: boolean | null
  exige_retalho?: boolean | null
  termos_exigidos?: string[] | null
  /** regra 6: pequenas cirurgias adicionais no mesmo ato remuneram apenas uma */
  pequena_cirurgia?: boolean | null
  observacao?: string | null
  /** true = ainda sem codigo TUSS oficial (codigo interno SEM-TUSS-xx) */
  codigo_interno?: boolean | null
  /** codigo TUSS equivalente; a operadora remunera apenas um dos dois (regra 4) */
  equivalente_a?: string | null
  vigencia_inicio: string
  vigencia_fim?: string | null
}

export interface Paciente {
  id?: string
  nome: string
  carteira?: string | null
  cpf?: string | null
}

export interface Atendimento {
  id?: string
  paciente_id?: string | null
  numero: string
  data: string
  hora_inicio?: string | null
  hora_fim?: string | null
  local?: string | null
  acomodacao?: string | null
  tipo_anestesia?: string | null
  classe?: ClasseAtendimento | null
  plano?: string | null
  validade_autorizacao?: string | null
  observacao?: string | null
}

export interface ProcedimentoRealizado {
  id?: string
  atendimento_id?: string | null
  codigo_tuss: string
  senha: string
  valor_cobrado: number
  valor_previsto?: number | null
  descricao_cirurgica?: string | null
  /** regra 4 do checklist: codigo do boletim sem autorizacao na guia */
  autorizado_na_guia?: boolean | null
  tela_autorizada?: boolean | null
  tela_utilizada?: boolean | null
  /** regra 3 de negocio: so o cirurgiao principal e remunerado */
  cirurgiao_principal?: boolean | null
  /** regra 5 de negocio: decisao intraoperatoria nao e remunerada */
  decisao_intraoperatoria?: boolean | null
  situacao?: SituacaoProcedimento
  origem?: 'manual' | 'ocr'
  rascunho?: boolean
  faturado_em?: string | null
}

export interface Alerta {
  id?: string
  procedimento_realizado_id?: string | null
  /** indice do procedimento dentro do atendimento, para alertas ainda nao salvos */
  indice?: number
  regra: string
  severidade: Severidade
  mensagem: string
  sugestao?: string | null
  origem: OrigemAlerta
  resolvido?: boolean
}

export interface Glosa {
  id?: string
  procedimento_realizado_id?: string | null
  codigo_tuss?: string | null
  competencia: string
  valor_glosado: number
  valor_recurso?: number | null
  justificativa?: string | null
  justificativa_normalizada?: MotivoGlosa | null
  data_demonstrativo?: string | null
  prazo_recurso?: string | null
  recursada?: boolean | null
  resultado?: string | null
}

/** Taxonomia fechada preenchida pela IA em glosas.justificativa_normalizada. */
export const MOTIVOS_GLOSA = [
  'nao_incluso_contrato',
  'abaixo_tabela',
  'duplicidade',
  'senha_cancelada',
  'usuario_inativo',
  'mudanca_codigo',
  'autorizacao_pendente',
  'documentacao_insuficiente',
  'outro',
] as const

export type MotivoGlosa = (typeof MOTIVOS_GLOSA)[number]

export const ROTULO_MOTIVO: Record<MotivoGlosa, string> = {
  nao_incluso_contrato: 'Nao incluso em contrato',
  abaixo_tabela: 'Pago abaixo da tabela contratual',
  duplicidade: 'Duplicidade',
  senha_cancelada: 'Senha cancelada',
  usuario_inativo: 'Usuario inativo',
  mudanca_codigo: 'Mudanca de codigo',
  autorizacao_pendente: 'Autorizacao pendente',
  documentacao_insuficiente: 'Documentacao insuficiente',
  outro: 'Outro',
}

export interface Consulta {
  id?: string
  data: string
  unidade: string
  qtd_consultas: number
  qtd_retornos: number
  valor_unitario: number
}

export interface Configuracao {
  nome_prestador: string
  crm: string
  conselho_profissional: string
  uf_conselho: string
  rqe: string
  cbos: string
  codigo_prestador_operadora: string
  registro_ans: string
  cnpj: string
  cnes: string | null
  retencao_imagens_meses: number
}

export const CONFIG_PADRAO: Configuracao = {
  nome_prestador: 'JEFFERSON MENEZES VIANA SANTOS',
  crm: '11153',
  conselho_profissional: '1',
  uf_conselho: '23',
  rqe: '10042',
  cbos: '225265',
  codigo_prestador_operadora: '6122248',
  registro_ans: '368253',
  cnpj: '63554067000198',
  cnes: null,
  retencao_imagens_meses: 24,
}

export const LOCAIS = [
  'Hospital Aldeota',
  'Hospital Sao Mateus',
  'Hapclinica Lobo Filho',
] as const

/** NOTRE SP e plano do grupo HAPVIDA, mesmos valores (regra 8). */
export const PLANOS = ['HAPVIDA', 'NOTRE SP'] as const

export const FONTES_REPASSE = ['MEDISA', 'MEDFOR'] as const
