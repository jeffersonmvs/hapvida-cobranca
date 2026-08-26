/**
 * Base das funcoes de IA. Roda em Deno, no servidor.
 *
 * A chave da API vive AQUI e so aqui (supabase secrets set ANTHROPIC_API_KEY).
 * Se ela aparecer em qualquer bundle do cliente, e bug de seguranca (§13).
 */

/**
 * Opus 5 e o padrao. Extracao de boletim manuscrito e leitura critica: senha
 * errada vira glosa, e o barato sai caro. Para trocar por um modelo mais
 * barato, defina ANTHROPIC_MODEL nos secrets - e a sua decisao, nao a minha.
 */
export const MODELO = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-5'
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
 * Chama o modelo pedindo a saida por tool use, que garante JSON estruturado -
 * modo texto devolve markdown em volta do JSON com frequencia demais.
 *
 * tool_choice fica em 'auto', nao forcado numa ferramenta especifica: forcar
 * e incompativel com thinking estendido, e no Opus 5 o thinking vem ligado por
 * padrao. Com uma unica ferramenta disponivel e o prompt mandando responder so
 * o JSON do schema, o modelo a chama; se nao chamar, falhamos alto em vez de
 * aproveitar texto solto.
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
      // Nao economizar aqui: estourar o teto trunca a saida no meio e obriga
      // a refazer a chamada inteira.
      max_tokens: opcoes.maxTokens ?? 16000,
      system: opcoes.sistema,
      tools: [
        {
          name: opcoes.nomeFerramenta,
          description: 'Devolve o resultado estruturado.',
          input_schema: opcoes.esquema,
        },
      ],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: opcoes.conteudo }],
    }),
  })

  if (!r.ok) {
    const detalhe = await r.text()
    throw new Error(`Modelo respondeu ${r.status}: ${detalhe.slice(0, 300)}`)
  }

  const dados = await r.json()
  // Opus 5 responde com blocos de thinking antes do tool_use; procuramos o
  // bloco certo em vez de assumir posicao.
  const bloco = (dados.content ?? []).find((c: { type: string }) => c.type === 'tool_use')
  if (!bloco) {
    const texto = (dados.content ?? [])
      .filter((c: { type: string }) => c.type === 'text')
      .map((c: { text?: string }) => c.text ?? '')
      .join(' ')
      .slice(0, 200)
    throw new Error(
      `O modelo nao devolveu saida estruturada (stop_reason: ${dados.stop_reason})` +
        (texto ? `: ${texto}` : ''),
    )
  }
  return bloco.input
}

/** Le o prompt versionado embutido na funcao. */
export function versaoDoPrompt(prompt: string): string {
  return /<!--\s*versao:\s*([\w.]+)\s*-->/.exec(prompt)?.[1] ?? 'desconhecida'
}
