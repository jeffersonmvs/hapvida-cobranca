import { chamarModelo, CORS, erro, MODELO, resposta } from '../_shared/ia.ts'
import { clienteDoUsuario, exigirUsuario, registrarAnalise } from '../_shared/supabase.ts'
import { PROMPT_RISCO, PROMPT_RISCO_VERSAO } from '../_shared/prompts.gen.ts'
import { ESQUEMA_RISCO } from '../_shared/esquemas.ts'

/**
 * §11.2 - analise semantica de risco de glosa, antes do faturamento.
 *
 * Minimizacao: entra codigo, descricao do codigo, descricao cirurgica e
 * materiais autorizados. NAO entra nome, carteira nem CPF - so o identificador
 * interno do procedimento.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = clienteDoUsuario(req)
    await exigirUsuario(sb)

    const entrada = await req.json()
    const {
      referencia_id, codigo_tuss, descricao_codigo, descricao_cirurgica,
      materiais_autorizados,
    } = entrada
    if (!codigo_tuss) return erro('codigo_tuss obrigatorio')

    const saida = await chamarModelo({
      sistema: PROMPT_RISCO,
      nomeFerramenta: 'devolver_analise',
      esquema: ESQUEMA_RISCO,
      conteudo: [
        {
          type: 'text',
          text: [
            `Codigo TUSS: ${codigo_tuss}`,
            `Descricao oficial do codigo: ${descricao_codigo ?? '(nao informada)'}`,
            `Materiais autorizados na guia: ${(materiais_autorizados ?? []).join(', ') || '(nenhum)'}`,
            '',
            'Descricao cirurgica lancada:',
            descricao_cirurgica || '(vazia)',
          ].join('\n'),
        },
      ],
    })

    await registrarAnalise(sb, {
      tipo: 'risco_glosa',
      referencia_id: referencia_id ?? null,
      modelo: MODELO,
      prompt_versao: PROMPT_RISCO_VERSAO,
      entrada_resumo: `codigo ${codigo_tuss}, descricao com ${(descricao_cirurgica ?? '').length} caracteres`,
      saida,
      confianca: (saida as { confianca?: number }).confianca ?? null,
    })

    return resposta({ saida })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'falha na analise', 500)
  }
})
