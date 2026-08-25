/**
 * Base das funcoes de IA. Roda em Deno, no servidor.
 *
 * A chave da API vive AQUI e so aqui (supabase secrets set ANTHROPIC_API_KEY).
 * Se ela aparecer em qualquer bundle do cliente, e bug de seguranca (§13).
 */

export const MODELO = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5'
const CHAVE = Deno.env.get('ANTHROPIC_API_KEY')
const URL_API = 'https://api.anthropic.com/v1/messages'

export const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ORIGEM_PERMITIDA') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export function erro(mensagem: string, status = 400): Response {
  // Mensagem de erro NUNCA carrega dado de paciente (§13).
  return resposta({ erro: mensagem }, status)
}

export interface BlocoConteudo {
  type: 'text' | 'image' | 'document'
  text?: string
  source?: { type: 'base64' | 'url'; media_type?: string; data?: string; url?: string }
}

/**
 * Chama o modelo forcando saida em JSON via tool use - text mode devolve
 * markdown em volta do JSON com frequencia suficiente para nao valer o risco.
 */
export async function chamarModelo(opcoes: {
  sistema: string
  conteudo: BlocoConteudo[]
  esquema: Record<string, unknown>
  nomeFerramenta: string
  maxTokens?: number
}): Promise<unknown> {
  if (!CHAVE) throw new Error('ANTHROPIC_API_KEY nao configurada no ambiente da funcao.')

  const r = await fetch(URL_API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': CHAVE,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: opcoes.maxTokens ?? 4096,
      system: opcoes.sistema,
      tools: [
        {
          name: opcoes.nomeFerramenta,
          description: 'Devolve o resultado estruturado.',
          input_schema: opcoes.esquema,
        },
      ],
      tool_choice: { type: 'tool', name: opcoes.nomeFerramenta },
      messages: [{ role: 'user', content: opcoes.conteudo }],
    }),
  })

  if (!r.ok) {
    const detalhe = await r.text()
    throw new Error(`Modelo respondeu ${r.status}: ${detalhe.slice(0, 300)}`)
  }

  const dados = await r.json()
  const bloco = (dados.content ?? []).find((c: { type: string }) => c.type === 'tool_use')
  if (!bloco) throw new Error('O modelo nao devolveu saida estruturada.')
  return bloco.input
}

/** Le o prompt versionado embutido na funcao. */
export function versaoDoPrompt(prompt: string): string {
  return /<!--\s*versao:\s*([\w.]+)\s*-->/.exec(prompt)?.[1] ?? 'desconhecida'
}
