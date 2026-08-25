import type {
  Alerta, Configuracao, Consulta, Glosa, Paciente, Procedimento, SituacaoProcedimento,
} from '@/domain'
import { CONFIG_PADRAO, addDias } from '@/domain'
import type {
  AtendimentoCompleto, DocumentoRegistro, EntradaAtendimento, LoteRegistro, Repositorio,
} from './repositorio'
import {
  ATENDIMENTOS_DEMO, CONSULTAS_DEMO, GLOSAS_DEMO, PACIENTES_DEMO, TABELA_HONORARIOS,
} from './seed'

let contador = 0
const novoId = (prefixo: string) => `${prefixo}${++contador}-${Math.random().toString(36).slice(2, 8)}`

/**
 * Modo demonstracao: roda sem Supabase configurado, para conhecer as telas.
 * NADA e persistido - ao recarregar a pagina os lancamentos somem. A tela
 * mostra isso o tempo todo; o estado real do sistema mora no Supabase (§13).
 */
export class RepositorioMemoria implements Repositorio {
  readonly modo = 'memoria' as const

  private config: Configuracao = { ...CONFIG_PADRAO }
  private tabela: Procedimento[] = TABELA_HONORARIOS.map((p, i) => ({ ...p, id: `t${i}` }))
  private pacientes: Paciente[] = [...PACIENTES_DEMO]
  private atendimentos: AtendimentoCompleto[] = ATENDIMENTOS_DEMO.map((a) => ({
    ...a,
    procedimentos: a.procedimentos.map((p) => ({ ...p })),
    alertas: [...a.alertas],
  }))
  private glosas: Glosa[] = GLOSAS_DEMO.map((g) => ({
    ...g,
    prazo_recurso: g.data_demonstrativo ? addDias(g.data_demonstrativo, 30) : null,
  }))
  private consultas: Consulta[] = [...CONSULTAS_DEMO]
  private documentos: DocumentoRegistro[] = []
  private lotes: LoteRegistro[] = []
  private arquivos = new Map<string, Blob>()
  private sequencias: Record<'lote' | 'guia', number> = { lote: 40, guia: 1200 }

  async lerConfiguracao() { return { ...this.config } }
  async salvarConfiguracao(c: Configuracao) { this.config = { ...c } }

  async listarProcedimentos() { return this.tabela.map((p) => ({ ...p })) }

  async criarProcedimento(p: Procedimento) {
    const novo = { ...p, id: novoId('t') }
    this.tabela.push(novo)
    return { ...novo }
  }

  async atualizarProcedimento(p: Procedimento) {
    const i = this.tabela.findIndex((x) => x.id === p.id)
    if (i >= 0) this.tabela[i] = { ...p }
  }

  async listarPacientes() { return this.pacientes.map((p) => ({ ...p })) }

  async criarPaciente(p: Paciente) {
    const novo = { ...p, id: novoId('p') }
    this.pacientes.push(novo)
    return { ...novo }
  }

  async listarAtendimentos() {
    return this.atendimentos.map((a) => ({
      ...a,
      procedimentos: a.procedimentos.map((p) => ({ ...p })),
      alertas: a.alertas.map((x) => ({ ...x })),
    }))
  }

  async salvarAtendimento(e: EntradaAtendimento): Promise<AtendimentoCompleto> {
    let paciente = e.paciente
    if (!paciente.id) {
      paciente = await this.criarPaciente(paciente)
    }
    const idAt = e.atendimento.id ?? novoId('a')
    const procedimentos = e.procedimentos.map((p) => ({
      ...p,
      id: p.id ?? novoId('pr'),
      atendimento_id: idAt,
    }))
    const alertas: Alerta[] = e.alertas.map((a) => ({
      ...a,
      id: novoId('al'),
      procedimento_realizado_id:
        a.indice != null ? procedimentos[a.indice]?.id ?? null : null,
    }))
    const completo: AtendimentoCompleto = {
      atendimento: { ...e.atendimento, id: idAt, paciente_id: paciente.id },
      paciente,
      procedimentos,
      alertas,
    }
    const i = this.atendimentos.findIndex(
      (a) => a.atendimento.id === idAt || a.atendimento.numero === e.atendimento.numero,
    )
    if (i >= 0) this.atendimentos[i] = completo
    else this.atendimentos.unshift(completo)
    return completo
  }

  async atualizarSituacao(ids: string[], situacao: SituacaoProcedimento, quando: string) {
    for (const a of this.atendimentos) {
      for (const p of a.procedimentos) {
        if (p.id && ids.includes(p.id)) {
          p.situacao = situacao
          if (situacao === 'faturado') p.faturado_em = quando
        }
      }
    }
  }

  async resolverAlerta(id: string, resolvido: boolean) {
    for (const a of this.atendimentos) {
      const al = a.alertas.find((x) => x.id === id)
      if (al) al.resolvido = resolvido
    }
  }

  async listarGlosas() { return this.glosas.map((g) => ({ ...g })) }

  async salvarGlosas(g: Glosa[]) {
    this.glosas.push(
      ...g.map((x) => ({
        ...x,
        id: x.id ?? novoId('g'),
        prazo_recurso: x.data_demonstrativo ? addDias(x.data_demonstrativo, 30) : null,
      })),
    )
  }

  async atualizarGlosa(g: Glosa) {
    const i = this.glosas.findIndex((x) => x.id === g.id)
    if (i >= 0) this.glosas[i] = { ...this.glosas[i], ...g }
  }

  async listarConsultas() { return this.consultas.map((c) => ({ ...c })) }

  async salvarConsulta(c: Consulta) {
    const novo = { ...c, id: novoId('c') }
    this.consultas.unshift(novo)
    return { ...novo }
  }

  async listarDocumentos() { return this.documentos.map((d) => ({ ...d })) }

  async registrarDocumento(d: Omit<DocumentoRegistro, 'id'>) {
    const novo = { ...d, id: novoId('d'), created_at: new Date().toISOString() }
    this.documentos.unshift(novo)
    return { ...novo }
  }

  async atualizarDocumento(d: DocumentoRegistro) {
    const i = this.documentos.findIndex((x) => x.id === d.id)
    if (i >= 0) this.documentos[i] = { ...d }
  }

  async urlDocumento(storagePath: string) {
    const blob = this.arquivos.get(storagePath)
    return blob ? URL.createObjectURL(blob) : ''
  }

  async enviarArquivo(caminho: string, arquivo: Blob) {
    this.arquivos.set(caminho, arquivo)
  }

  async listarLotes() { return this.lotes.map((l) => ({ ...l })) }

  async registrarLote(l: Omit<LoteRegistro, 'id'>) {
    const novo = { ...l, id: novoId('l') }
    this.lotes.unshift(novo)
    return { ...novo }
  }

  async proximoNumero(chave: 'lote' | 'guia', quantidade: number) {
    const primeiro = this.sequencias[chave] + 1
    this.sequencias[chave] += quantidade
    return primeiro
  }
}
