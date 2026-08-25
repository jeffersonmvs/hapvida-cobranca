import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigurado = Boolean(url && chave)

/**
 * Schema do faturamento. O projeto Supabase hospeda mais de um sistema, e
 * 'public' ja tem tabelas 'pacientes' e 'atendimentos' de outro app - por isso
 * este sistema vive num schema so dele.
 *
 * Exige 'faturamento' listado em Settings > API > Exposed schemas, senao o
 * PostgREST nao enxerga as tabelas.
 */
export const SCHEMA = 'faturamento'

/** Bucket de documentos. O Storage e global ao projeto, dai o nome proprio. */
export const BUCKET_DOCUMENTOS = 'faturamento-documentos'

/**
 * Cliente Supabase. So a chave anon vive no bundle - toda chamada de IA passa
 * por Edge Function autenticada, nunca daqui (§13).
 *
 * O tipo sai por inferencia de proposito: anotar como `SupabaseClient` fixaria
 * o schema em 'public' e o compilador reclamaria do nosso.
 */
function criarCliente() {
  if (!url || !chave) return null
  return createClient(url, chave, {
    auth: { persistSession: true, autoRefreshToken: true },
    db: { schema: SCHEMA },
  })
}

export const supabase = criarCliente()

export type ClienteSupabase = NonNullable<ReturnType<typeof criarCliente>>

export function exigirSupabase(): ClienteSupabase {
  if (!supabase) {
    throw new Error(
      'Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
    )
  }
  return supabase
}
