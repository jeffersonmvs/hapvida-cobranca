import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Configuracao, Consulta, Glosa, Paciente, Procedimento } from '@/domain'
import { CONFIG_PADRAO, hojeISO } from '@/domain'
import { supabaseConfigurado } from '@/lib/supabase'
import { RepositorioMemoria } from './memoria'
import { RepositorioSupabase } from './supabase'
import type { AtendimentoCompleto, DocumentoRegistro, LoteRegistro, Repositorio } from './repositorio'

export const repositorio: Repositorio = supabaseConfigurado
  ? new RepositorioSupabase()
  : new RepositorioMemoria()

export interface EstadoApp {
  carregando: boolean
  erro: string | null
  modo: Repositorio['modo']
  hoje: string
  config: Configuracao
  tabela: Procedimento[]
  pacientes: Paciente[]
  atendimentos: AtendimentoCompleto[]
  glosas: Glosa[]
  consultas: Consulta[]
  documentos: DocumentoRegistro[]
  lotes: LoteRegistro[]
  recarregar: () => Promise<void>
}

const Contexto = createContext<EstadoApp | null>(null)

export function ProvedorDados({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [config, setConfig] = useState<Configuracao>(CONFIG_PADRAO)
  const [tabela, setTabela] = useState<Procedimento[]>([])
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [atendimentos, setAtendimentos] = useState<AtendimentoCompleto[]>([])
  const [glosas, setGlosas] = useState<Glosa[]>([])
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [documentos, setDocumentos] = useState<DocumentoRegistro[]>([])
  const [lotes, setLotes] = useState<LoteRegistro[]>([])

  const recarregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [c, t, p, a, g, co, d, l] = await Promise.all([
        repositorio.lerConfiguracao(),
        repositorio.listarProcedimentos(),
        repositorio.listarPacientes(),
        repositorio.listarAtendimentos(),
        repositorio.listarGlosas(),
        repositorio.listarConsultas(),
        repositorio.listarDocumentos(),
        repositorio.listarLotes(),
      ])
      setConfig(c); setTabela(t); setPacientes(p); setAtendimentos(a)
      setGlosas(g); setConsultas(co); setDocumentos(d); setLotes(l)
    } catch (e) {
      // Mensagem de erro nunca carrega dado de paciente (§13).
      setErro(e instanceof Error ? e.message : 'Falha ao carregar os dados.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { void recarregar() }, [recarregar])

  const valor = useMemo<EstadoApp>(
    () => ({
      carregando, erro, modo: repositorio.modo, hoje: hojeISO(),
      config, tabela, pacientes, atendimentos, glosas, consultas, documentos, lotes,
      recarregar,
    }),
    [carregando, erro, config, tabela, pacientes, atendimentos, glosas, consultas, documentos, lotes, recarregar],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useDados(): EstadoApp {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useDados fora do ProvedorDados')
  return ctx
}

/** Todos os procedimentos realizados, achatados, com a data do atendimento. */
export function useProcedimentos() {
  const { atendimentos } = useDados()
  return useMemo(
    () =>
      atendimentos.flatMap((a) =>
        a.procedimentos.map((p) => ({
          procedimento: p,
          atendimento: a.atendimento,
          paciente: a.paciente,
        })),
      ),
    [atendimentos],
  )
}
