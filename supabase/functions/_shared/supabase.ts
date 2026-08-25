import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Cliente com o JWT do chamador: a RLS continua valendo dentro da funcao. */
export function clienteDoUsuario(req: Request): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
}

export async function exigirUsuario(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb.auth.getUser()
  if (error || !data.user) throw new Error('nao autenticado')
  return data.user.id
}

/**
 * Trilha de auditoria obrigatoria (§11). entrada_resumo NUNCA leva a integra
 * com dado de paciente.
 */
export async function registrarAnalise(
  sb: SupabaseClient,
  registro: {
    tipo: 'extracao' | 'risco_glosa' | 'padrao' | 'recurso' | 'redacao'
    referencia_id?: string | null
    modelo: string
    prompt_versao: string
    entrada_resumo: string
    saida: unknown
    confianca?: number | null
  },
): Promise<void> {
  const { error } = await sb.from('analises_ia').insert({
    ...registro,
    aceita: null,
    editada: null,
  })
  if (error) console.error('falha ao registrar analise_ia:', error.message)
}
