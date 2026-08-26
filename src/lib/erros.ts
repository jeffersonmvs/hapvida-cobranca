/**
 * Mensagem legivel de um erro.
 *
 * O supabase-js rejeita com objeto simples ({ message, code, details, hint }),
 * nao com Error. Um `e instanceof Error ? e.message : 'Falha ...'` engole
 * justamente a causa - foi o que fez a tela mostrar "Falha ao carregar os
 * dados" sem dizer que era permissao negada.
 */
export function mensagemDeErro(e: unknown, padrao = 'Falha inesperada.'): string {
  if (typeof e === 'string') return e
  if (e instanceof Error && e.message) return e.message
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    const partes = [o.message, o.error_description, o.details, o.hint]
      .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    const codigo = typeof o.code === 'string' ? ` (${o.code})` : ''
    if (partes.length > 0) return partes[0] + codigo
  }
  return padrao
}

/**
 * Traduz os erros que aparecem quando o ambiente nao esta configurado, para
 * a tela dizer o que fazer em vez de repetir jargao do PostgREST.
 */
export function explicarErro(e: unknown): string {
  const bruto = mensagemDeErro(e)
  const t = bruto.toLowerCase()

  if (t.includes('pgrst106') || t.includes('schema must be one of')) {
    return (
      'O schema "faturamento" nao esta exposto na API do Supabase. ' +
      'Adicione-o em Settings > API > Exposed schemas. ' +
      `(${bruto})`
    )
  }
  if (t.includes('permission denied') || t.includes('42501')) {
    return (
      'Seu usuario nao tem acesso ao faturamento. O e-mail precisa estar em ' +
      'faturamento.usuarios_permitidos. ' +
      `(${bruto})`
    )
  }
  if (t.includes('jwt') || t.includes('invalid api key')) {
    return `Credenciais do Supabase invalidas ou expiradas. (${bruto})`
  }
  return bruto
}
