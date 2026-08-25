import { BUCKET_DOCUMENTOS, exigirSupabase } from '@/lib/supabase'
import type {
  Alerta, Configuracao, Consulta, Glosa, Paciente, Procedimento, SituacaoProcedimento,
} from '@/domain'
import { CONFIG_PADRAO } from '@/domain'
import type {
  AtendimentoCompleto, DocumentoRegistro, EntradaAtendimento, LoteRegistro, Repositorio,
} from './repositorio'

const BUCKET = BUCKET_DOCUMENTOS

export class RepositorioSupabase implements Repositorio {
  readonly modo = 'supabase' as const

  async lerConfiguracao(): Promise<Configuracao> {
    const { data, error } = await exigirSupabase()
      .from('configuracao').select('*').eq('id', 1).maybeSingle()
    if (error) throw error
    return { ...CONFIG_PADRAO, ...(data ?? {}) }
  }

  async salvarConfiguracao(c: Configuracao): Promise<void> {
    const { error } = await exigirSupabase()
      .from('configuracao')
      .update({ ...c, atualizado_em: new Date().toISOString() })
      .eq('id', 1)
    if (error) throw error
  }

  async listarProcedimentos(): Promise<Procedimento[]> {
    const { data, error } = await exigirSupabase()
      .from('procedimentos').select('*').order('codigo_tuss')
    if (error) throw error
    return (data ?? []) as Procedimento[]
  }

  async criarProcedimento(p: Procedimento): Promise<Procedimento> {
    const { id: _ignorado, ...linha } = p
    const { data, error } = await exigirSupabase()
      .from('procedimentos').insert(linha).select().single()
    if (error) throw error
    return data as Procedimento
  }

  async atualizarProcedimento(p: Procedimento): Promise<void> {
    const { error } = await exigirSupabase()
      .from('procedimentos').update(p).eq('id', p.id)
    if (error) throw error
  }

  async listarPacientes(): Promise<Paciente[]> {
    const { data, error } = await exigirSupabase()
      .from('pacientes').select('*').order('nome')
    if (error) throw error
    return (data ?? []) as Paciente[]
  }

  async criarPaciente(p: Paciente): Promise<Paciente> {
    const { data, error } = await exigirSupabase()
      .from('pacientes').insert(p).select().single()
    if (error) throw error
    return data as Paciente
  }

  async listarAtendimentos(): Promise<AtendimentoCompleto[]> {
    const sb = exigirSupabase()
    const [ats, procs, pacs, alertas] = await Promise.all([
      sb.from('atendimentos').select('*').order('data', { ascending: false }),
      sb.from('procedimentos_realizados').select('*'),
      sb.from('pacientes').select('*'),
      sb.from('alertas').select('*'),
    ])
    for (const r of [ats, procs, pacs, alertas]) if (r.error) throw r.error

    const porPaciente = new Map((pacs.data ?? []).map((p) => [p.id, p as Paciente]))
    return (ats.data ?? []).map((a) => {
      const meus = (procs.data ?? []).filter((p) => p.atendimento_id === a.id)
      const ids = new Set(meus.map((p) => p.id))
      return {
        atendimento: a,
        paciente: a.paciente_id ? porPaciente.get(a.paciente_id) ?? null : null,
        procedimentos: meus,
        alertas: (alertas.data ?? []).filter((al) =>
          ids.has(al.procedimento_realizado_id),
        ),
      } as AtendimentoCompleto
    })
  }

  async salvarAtendimento(e: EntradaAtendimento): Promise<AtendimentoCompleto> {
    const sb = exigirSupabase()

    let paciente = e.paciente
    if (!paciente.id) {
      paciente = await this.criarPaciente(paciente)
    }

    const { data: at, error: errAt } = await sb
      .from('atendimentos')
      .upsert(
        { ...e.atendimento, paciente_id: paciente.id },
        { onConflict: 'numero' },
      )
      .select()
      .single()
    if (errAt) throw errAt

    // procedimentos do atendimento sao reescritos por completo
    const { error: errDel } = await sb
      .from('procedimentos_realizados').delete().eq('atendimento_id', at.id)
    if (errDel) throw errDel

    const { data: procs, error: errProc } = await sb
      .from('procedimentos_realizados')
      .insert(e.procedimentos.map(({ id: _i, ...p }) => ({ ...p, atendimento_id: at.id })))
      .select()
    if (errProc) throw errProc

    const alertas = e.alertas.map((a) => ({
      regra: a.regra,
      severidade: a.severidade,
      mensagem: a.mensagem,
      sugestao: a.sugestao ?? null,
      origem: a.origem,
      resolvido: false,
      procedimento_realizado_id:
        a.indice != null ? (procs ?? [])[a.indice]?.id ?? null : null,
    }))
    if (alertas.length > 0) {
      const { error } = await sb.from('alertas').insert(alertas)
      if (error) throw error
    }

    return {
      atendimento: at,
      paciente,
      procedimentos: procs ?? [],
      alertas: alertas.map((a) => ({ ...a })) as AtendimentoCompleto['alertas'],
    }
  }

  async atualizarSituacao(
    ids: string[], situacao: SituacaoProcedimento, quando: string,
  ): Promise<void> {
    if (ids.length === 0) return
    const patch: Record<string, unknown> = { situacao }
    if (situacao === 'faturado') patch.faturado_em = quando
    const { error } = await exigirSupabase()
      .from('procedimentos_realizados').update(patch).in('id', ids)
    if (error) throw error
  }

  async resolverAlerta(alerta: Alerta, resolvido: boolean): Promise<void> {
    const sb = exigirSupabase()
    if (alerta.id) {
      const { error } = await sb.from('alertas').update({ resolvido }).eq('id', alerta.id)
      if (error) throw error
      return
    }
    const { error } = await sb.from('alertas').insert({
      procedimento_realizado_id: alerta.procedimento_realizado_id ?? null,
      regra: alerta.regra,
      severidade: alerta.severidade,
      mensagem: alerta.mensagem,
      sugestao: alerta.sugestao ?? null,
      origem: alerta.origem,
      resolvido,
    })
    if (error) throw error
  }

  async listarGlosas(): Promise<Glosa[]> {
    const { data, error } = await exigirSupabase()
      .from('glosas').select('*').order('data_demonstrativo', { ascending: false })
    if (error) throw error
    return (data ?? []) as Glosa[]
  }

  async salvarGlosas(g: Glosa[]): Promise<void> {
    if (g.length === 0) return
    const { error } = await exigirSupabase()
      .from('glosas')
      .insert(g.map(({ id: _i, prazo_recurso: _p, ...resto }) => resto))
    if (error) throw error
  }

  async atualizarGlosa(g: Glosa): Promise<void> {
    const { id, prazo_recurso: _p, ...resto } = g
    const { error } = await exigirSupabase().from('glosas').update(resto).eq('id', id)
    if (error) throw error
  }

  async listarConsultas(): Promise<Consulta[]> {
    const { data, error } = await exigirSupabase()
      .from('consultas').select('*').order('data', { ascending: false })
    if (error) throw error
    return (data ?? []) as Consulta[]
  }

  async salvarConsulta(c: Consulta): Promise<Consulta> {
    const { data, error } = await exigirSupabase()
      .from('consultas').insert(c).select().single()
    if (error) throw error
    return data as Consulta
  }

  async listarDocumentos(): Promise<DocumentoRegistro[]> {
    const { data, error } = await exigirSupabase()
      .from('documentos').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as DocumentoRegistro[]
  }

  async registrarDocumento(d: Omit<DocumentoRegistro, 'id'>): Promise<DocumentoRegistro> {
    const { data, error } = await exigirSupabase()
      .from('documentos').insert(d).select().single()
    if (error) throw error
    return data as DocumentoRegistro
  }

  async atualizarDocumento(d: DocumentoRegistro): Promise<void> {
    const { error } = await exigirSupabase()
      .from('documentos').update(d).eq('id', d.id)
    if (error) throw error
  }

  /** URL assinada de validade curta - o bucket e privado (§13). */
  async urlDocumento(storagePath: string): Promise<string> {
    const { data, error } = await exigirSupabase()
      .storage.from(BUCKET).createSignedUrl(storagePath, 300)
    if (error) throw error
    return data.signedUrl
  }

  async enviarArquivo(caminho: string, arquivo: Blob, tipoMime: string): Promise<void> {
    const { error } = await exigirSupabase()
      .storage.from(BUCKET)
      .upload(caminho, arquivo, { contentType: tipoMime, upsert: false })
    if (error) throw error
  }

  async listarLotes(): Promise<LoteRegistro[]> {
    const { data, error } = await exigirSupabase()
      .from('lotes_tiss').select('*').order('numero_lote', { ascending: false })
    if (error) throw error
    return (data ?? []) as LoteRegistro[]
  }

  async registrarLote(
    l: Omit<LoteRegistro, 'id'>,
    guias: Array<{ atendimento_id: string | null; numero_guia: number; valor: number }>,
  ): Promise<LoteRegistro> {
    const sb = exigirSupabase()
    const { data, error } = await sb.from('lotes_tiss').insert(l).select().single()
    if (error) throw error
    if (guias.length > 0) {
      const { error: e2 } = await sb
        .from('lote_guias')
        .insert(guias.map((g) => ({ ...g, lote_id: data.id })))
      if (e2) throw e2
    }
    return data as LoteRegistro
  }

  async proximoNumero(chave: 'lote' | 'guia', quantidade: number): Promise<number> {
    const { data, error } = await exigirSupabase()
      .rpc('proximo_numero', { p_chave: chave, p_quantidade: quantidade })
    if (error) throw error
    return Number(data)
  }
}
