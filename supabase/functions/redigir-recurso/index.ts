import { chamarModelo, CORS, erro, MODELO, resposta } from '../_shared/ia.ts'
import { clienteDoUsuario, exigirUsuario, registrarAnalise } from '../_shared/supabase.ts'
import { PROMPT_RECURSO, PROMPT_RECURSO_VERSAO } from '../_shared/prompts.gen.ts'
import { ESQUEMA_RECURSO } from '../_shared/esquemas.ts'

/**
 * §11.4 - refino da minuta de recurso.
 *
 * A minuta ja chega montada de forma deterministica pelo dominio
 * (src/domain/recurso.ts), com os fatos do proprio registro. Aqui o modelo so
 * melhora a redacao em cima desses fatos - e devolve em fatos_usados o que
 * afirma ter usado, para conferencia.
 *
 * Minimizacao: o nome do paciente NAO e enviado; vai o identificador interno.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = clienteDoUsuario(req)
    await exigirUsuario(sb)

    const {
      referencia_id, minuta, valores, motivo_alegado, senha,
      descricao_cirurgica, historico,
    } = await req.json()
    if (!minuta) return erro('minuta obrigatoria')

    const saida = await chamarModelo({
      sistema: PROMPT_RECURSO,
      nomeFerramenta: 'devolver_recurso',
      esquema: ESQUEMA_RECURSO,
      maxTokens: 16000,
      conteudo: [
        {
          type: 'text',
          text: [
            'FATOS DO REGISTRO (nada fora daqui pode virar argumento):',
            `- valor apresentado: ${valores?.apresentado ?? 'nao informado'}`,
            `- valor pago: ${valores?.pago ?? 'nao informado'}`,
            `- valor glosado: ${valores?.glosado}`,
            `- senha emitida pela operadora: ${senha ?? 'nao informada'}`,
            `- motivo alegado pela operadora: ${motivo_alegado}`,
            `- historico do codigo: ${(historico ?? []).join(' | ') || 'sem historico'}`,
            `- descricao cirurgica literal: ${descricao_cirurgica ?? '(nao registrada)'}`,
            '',
            'MINUTA MONTADA PELO SISTEMA (refine a redacao, preserve os fatos):',
            minuta,
          ].join('\n'),
        },
      ],
    })

    await registrarAnalise(sb, {
      tipo: 'recurso',
      referencia_id: referencia_id ?? null,
      modelo: MODELO,
      prompt_versao: PROMPT_RECURSO_VERSAO,
      entrada_resumo: `glosa de ${valores?.glosado}, motivo "${String(motivo_alegado).slice(0, 80)}"`,
      saida,
      confianca: (saida as { confianca?: number }).confianca ?? null,
    })

    return resposta({ saida })
  } catch (e) {
    return erro(e instanceof Error ? e.message : 'falha ao redigir', 500)
  }
})
