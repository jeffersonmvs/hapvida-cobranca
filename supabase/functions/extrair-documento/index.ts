import { chamarModelo, CORS, erro, MODELO, resposta } from '../_shared/ia.ts'
import { BUCKET_DOCUMENTOS, clienteDoUsuario, exigirUsuario, registrarAnalise } from '../_shared/supabase.ts'
import { PROMPT_EXTRACAO, PROMPT_EXTRACAO_VERSAO } from '../_shared/prompts.gen.ts'
import { ESQUEMA_EXTRACAO } from '../_shared/esquemas.ts'

/**
 * §11.1 - extracao estruturada do boletim / ficha / guia.
 *
 * A imagem contem identificacao do paciente; e a excecao necessaria a regra de
 * minimizacao (§11). Por isso a imagem nunca sai do Storage privado por URL
 * publica: a funcao baixa com o JWT do proprio medico e manda em base64.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = clienteDoUsuario(req)
    await exigirUsuario(sb)

    const { storage_path, codigos_vigentes } = await req.json()
    if (!storage_path) return erro('storage_path obrigatorio')

    const { data: arquivo, error } = await sb.storage.from(BUCKET_DOCUMENTOS).download(storage_path)
    if (error || !arquivo) return erro('documento nao encontrado no Storage', 404)

    const bytes = new Uint8Array(await arquivo.arrayBuffer())
    let base64 = ''
    for (let i = 0; i < bytes.length; i += 8192) {
      base64 += String.fromCharCode(...bytes.subarray(i, i + 8192))
    }
    base64 = btoa(base64)

    const ehPdf = storage_path.toLowerCase().endsWith('.pdf')
    const lista = (codigos_vigentes ?? [])
      .map((c: { codigo: string; descricao: string }) => `${c.codigo} — ${c.descricao}`)
      .join('\n')

    const saida = await chamarModelo({
      sistema: PROMPT_EXTRACAO,
      nomeFerramenta: 'devolver_extracao',
      esquema: ESQUEMA_EXTRACAO,
      maxTokens: 16000,
      conteudo: [
        ehPdf
          ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
          : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        {
          type: 'text',
          text:
            `Codigos vigentes na tabela de honorarios (use correspondencia exata; ` +
            `nao invente codigo fora desta lista):\n${lista}`,
        },
      ],
    })

    await registrarAnalise(sb, {
      tipo: 'extracao',
      modelo: MODELO,
      prompt_versao: PROMPT_EXTRACAO_VERSAO,
      // resumo sem dado de paciente: so metadados do processamento
      entrada_resumo: `documento ${storage_path.split('/').pop()} (${bytes.length} bytes), ${(codigos_vigentes ?? []).length} codigos no contexto`,
      saida,
      confianca: (saida as { confianca_geral?: number }).confianca_geral ?? null,
    })

    return resposta({ saida })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'falha na extracao', 500)
  }
})
