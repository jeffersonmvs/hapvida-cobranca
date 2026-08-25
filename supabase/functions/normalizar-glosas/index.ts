import { chamarModelo, CORS, erro, MODELO, resposta } from '../_shared/ia.ts'
import { clienteDoUsuario, exigirUsuario, registrarAnalise } from '../_shared/supabase.ts'
import { PROMPT_NORMALIZACAO, PROMPT_NORMALIZACAO_VERSAO } from '../_shared/prompts.gen.ts'
import { ESQUEMA_NORMALIZACAO, MOTIVOS } from '../_shared/esquemas.ts'

/**
 * §11.3 - normalizacao das justificativas na taxonomia fechada.
 *
 * A estatistica NAO passa por aqui: taxa de glosa, serie temporal, ranking e
 * agrupamento por assinatura sao SQL e TypeScript. A IA so classifica texto.
 *
 * Minimizacao: viaja apenas o id da glosa e o texto escrito pela operadora.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = clienteDoUsuario(req)
    await exigirUsuario(sb)

    const { itens } = await req.json()
    if (!Array.isArray(itens) || itens.length === 0) return erro('itens obrigatorio')
    if (itens.length > 200) return erro('no maximo 200 itens por chamada')

    const saida = await chamarModelo({
      sistema: PROMPT_NORMALIZACAO,
      nomeFerramenta: 'devolver_classificacao',
      esquema: ESQUEMA_NORMALIZACAO,
      maxTokens: 8192,
      conteudo: [
        {
          type: 'text',
          text:
            `Classifique cada justificativa. Taxonomia: ${MOTIVOS.join(', ')}.\n\n` +
            itens
              .map((i: { id: string; justificativa: string }) => `${i.id}: ${i.justificativa ?? ''}`)
              .join('\n'),
        },
      ],
    })

    // Aplica no banco. A escrita e nossa, nao do modelo: so o campo normalizado.
    const classificacoes = (saida as { itens: Array<{ id: string; motivo: string }> }).itens ?? []
    for (const c of classificacoes) {
      if (!MOTIVOS.includes(c.motivo)) continue
      await sb.from('glosas').update({ justificativa_normalizada: c.motivo }).eq('id', c.id)
    }

    await registrarAnalise(sb, {
      tipo: 'padrao',
      modelo: MODELO,
      prompt_versao: PROMPT_NORMALIZACAO_VERSAO,
      entrada_resumo: `${itens.length} justificativas classificadas`,
      saida,
    })

    return resposta({ saida })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'falha na normalizacao', 500)
  }
})
