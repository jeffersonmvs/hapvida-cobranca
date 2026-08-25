import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigurado = Boolean(url && chave)

/**
 * Cliente Supabase. So a chave anon vive no bundle - toda chamada de IA passa
 * por Edge Function autenticada, nunca daqui (§13).
 */
export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(url as string, chave as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

export function exigirSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
    )
  }
  return supabase
}
