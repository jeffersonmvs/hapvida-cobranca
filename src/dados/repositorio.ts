import type {
  Alerta, Atendimento, Configuracao, Consulta, Glosa, Paciente,
  Procedimento, ProcedimentoRealizado, SituacaoProcedimento,
} from '@/domain'

export interface DocumentoRegistro {
  id: string
  atendimento_id?: string | null
  tipo: 'boletim' | 'ficha' | 'guia' | 'outro' | null
  storage_path: string
  hash_arquivo?: string | null
  extracao_status: 'pendente' | 'processando' | 'extraido' | 'revisado' | 'falhou'
  extracao_json?: unknown
  erro?: string | null
  revisado_em?: string | null
  created_at?: string
}

export interface LoteRegistro {
  id: string
  numero_lote: number
  competencia: string
  guia_inicial: number
  guia_final: number
  qtd_guias: number
  valor_total: number
  hash_documento?: string | null
  gerado_em?: string | null
  enviado_em?: string | null
}

/** Um atendimento com tudo que a tela precisa junto. */
export interface AtendimentoCompleto {
  atendimento: Atendimento
  paciente: Paciente | null
  procedimentos: ProcedimentoRealizado[]
  alertas: Alerta[]
}

export interface EntradaAtendimento {
  atendimento: Atendimento
  paciente: Paciente
  procedimentos: ProcedimentoRealizado[]
  alertas: Alerta[]
}

/**
 * Toda leitura e escrita passa por aqui. Duas implementacoes:
 * Supabase (real) e memoria (modo demonstracao, sem credencial configurada).
 */
export interface Repositorio {
  readonly modo: 'supabase' | 'memoria'

  lerConfiguracao(): Promise<Configuracao>
  salvarConfiguracao(c: Configuracao): Promise<void>

  listarProcedimentos(): Promise<Procedimento[]>
  criarProcedimento(p: Procedimento): Promise<Procedimento>
  atualizarProcedimento(p: Procedimento): Promise<void>

  listarPacientes(): Promise<Paciente[]>
  criarPaciente(p: Paciente): Promise<Paciente>

  listarAtendimentos(): Promise<AtendimentoCompleto[]>
  salvarAtendimento(e: EntradaAtendimento): Promise<AtendimentoCompleto>
  atualizarSituacao(ids: string[], situacao: SituacaoProcedimento, quando: string): Promise<void>
  resolverAlerta(id: string, resolvido: boolean): Promise<void>

  listarGlosas(): Promise<Glosa[]>
  salvarGlosas(g: Glosa[]): Promise<void>
  atualizarGlosa(g: Glosa): Promise<void>

  listarConsultas(): Promise<Consulta[]>
  salvarConsulta(c: Consulta): Promise<Consulta>

  listarDocumentos(): Promise<DocumentoRegistro[]>
  registrarDocumento(d: Omit<DocumentoRegistro, 'id'>): Promise<DocumentoRegistro>
  atualizarDocumento(d: DocumentoRegistro): Promise<void>
  urlDocumento(storagePath: string): Promise<string>
  enviarArquivo(caminho: string, arquivo: Blob, tipoMime: string): Promise<void>

  listarLotes(): Promise<LoteRegistro[]>
  registrarLote(l: Omit<LoteRegistro, 'id'>, atendimentoIds: string[]): Promise<LoteRegistro>
  proximoNumero(chave: 'lote' | 'guia', quantidade: number): Promise<number>
}
