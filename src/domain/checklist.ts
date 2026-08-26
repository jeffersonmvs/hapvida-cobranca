import type {
  Alerta,
  Atendimento,
  Procedimento,
  ProcedimentoRealizado,
} from './tipos'
import { vigenteEm } from './honorarios'
import {
  contarOcorrencias,
  contemAlgum,
  contemTodos,
  mesmoNome,
  apenasDigitos,
} from './texto'
import { diaDoMes, ehAntes, ehDepois, mesDe, ultimoDiaDoMes, diffDias, formatarData } from './datas'
import { formatarBRL } from './dinheiro'

/**
 * Checklist antiglosa deterministico (§7).
 *
 * Roda ao salvar qualquer procedimento. NENHUMA regra bloqueia o salvamento -
 * todas viram alerta, aparecem em painel e no PDF do contador.
 *
 * As regras 1, 2 e 9 sao busca por termo, grosseiras de proposito. A camada
 * semantica que as complementa esta em src/ai (analise de risco de glosa) e
 * grava alertas com origem 'ia', visualmente distintos destes.
 */

/** Fornecida como texto copiavel sempre que a regra 2 dispara. */
export const SUGESTAO_TELA_DISPENSADA =
  'herniorrafia com Prolene zero em dois planos (decidido por nao utilizar ' +
  'tela devido ao pequeno tamanho da falha)'

/** Termos que caracterizam justificativa de dispensa de tela. */
const TERMOS_DISPENSA_TELA = [
  'nao utilizar tela',
  'nao utilizacao de tela',
  'sem tela',
  'dispensa da tela',
  'dispensada a tela',
  'optado por nao usar tela',
  'nao foi utilizada tela',
  'pequeno tamanho da falha',
]

export interface DadosDocumento {
  nome?: string | null
  carteira?: string | null
  numero_atendimento?: string | null
}

export interface ContextoChecklist {
  atendimento: Atendimento
  procedimentos: ProcedimentoRealizado[]
  tabela: Procedimento[]
  /** data de referencia - injetada, o dominio nunca le o relogio sozinho */
  hoje: string
  /** cruzamento boletim x ficha de internacao (regra 8) */
  dadosBoletim?: DadosDocumento | null
  dadosFicha?: DadosDocumento | null
}

export interface RegraChecklist {
  id: string
  titulo: string
  severidade: Alerta['severidade']
}

export const REGRAS: RegraChecklist[] = [
  { id: 'R01', titulo: 'Codigo exige retalho e a descricao nao registra', severidade: 'critico' },
  { id: 'R02', titulo: 'Tela autorizada e nao utilizada sem justificativa', severidade: 'critico' },
  { id: 'R03', titulo: 'Senha ausente ou repetida entre sitios', severidade: 'critico' },
  { id: 'R04', titulo: 'Codigo no boletim sem autorizacao na guia', severidade: 'critico' },
  { id: 'R05', titulo: 'Codigo com glosa recorrente', severidade: 'atencao' },
  { id: 'R06', titulo: 'Codigos equivalentes no mesmo atendimento', severidade: 'atencao' },
  { id: 'R07', titulo: 'Cirurgia fora da validade da autorizacao', severidade: 'atencao' },
  { id: 'R08', titulo: 'Divergencia entre boletim e ficha', severidade: 'atencao' },
  { id: 'R09', titulo: 'Dois sitios sem incisoes independentes descritas', severidade: 'atencao' },
  { id: 'R11', titulo: 'Boletim ainda nao anexado', severidade: 'atencao' },
  { id: 'R10', titulo: 'A faturar com o mes terminando', severidade: 'atencao' },
]

export function rodarChecklist(ctx: ContextoChecklist): Alerta[] {
  const alertas: Alerta[] = []
  const { atendimento, procedimentos, tabela, hoje } = ctx
  const data = atendimento.data

  const add = (
    regra: string,
    severidade: Alerta['severidade'],
    mensagem: string,
    indice?: number,
    sugestao?: string,
  ) => {
    alertas.push({
      regra,
      severidade,
      mensagem,
      sugestao: sugestao ?? null,
      origem: 'deterministica',
      indice,
      procedimento_realizado_id:
        indice != null ? procedimentos[indice]?.id ?? null : null,
      resolvido: false,
    })
  }

  /**
   * A ficha de internacao e a guia trazem carteira, acomodacao, codigos e
   * senhas, mas nao tem descricao cirurgica - e nem deveriam ter. Sem boletim,
   * R01, R02 e R09 nao tem o que ler: ausencia de descricao nao e omissao na
   * descricao, e acusar glosa por isso e alarme falso.
   */
  const temDescricao = procedimentos.some(
    (p) => (p.descricao_cirurgica ?? '').trim().length > 0,
  )

  procedimentos.forEach((pr, i) => {
    const ref = vigenteEm(tabela, pr.codigo_tuss, data)

    // -- R01: codigo exige retalho e a descricao nao contem os termos --------
    if (ref?.exige_retalho && temDescricao) {
      const termos = ref.termos_exigidos?.length ? ref.termos_exigidos : ['retalho']
      if (!contemTodos(pr.descricao_cirurgica, termos)) {
        add(
          'R01',
          'critico',
          `${pr.codigo_tuss} exige registro de ${termos.join(' + ')} na descricao ` +
            `cirurgica e o texto lancado nao traz o termo. Glosa quase certa.`,
          i,
          'Descreva explicitamente a confeccao e a rotacao/avanco do retalho, ' +
            'com o plano e a dimensao aproximada.',
        )
      }
    }

    // -- R02: tela autorizada e nao utilizada sem justificativa --------------
    if (pr.tela_autorizada && !pr.tela_utilizada && temDescricao) {
      if (!contemAlgum(pr.descricao_cirurgica, TERMOS_DISPENSA_TELA)) {
        add(
          'R02',
          'critico',
          `Tela autorizada e nao utilizada em ${pr.codigo_tuss} sem justificativa ` +
            `na descricao cirurgica.`,
          i,
          SUGESTAO_TELA_DISPENSADA,
        )
      }
    }

    // -- R03a: procedimento sem senha ---------------------------------------
    if (!pr.senha || !pr.senha.trim()) {
      add(
        'R03',
        'critico',
        `${pr.codigo_tuss} lancado sem senha. Cada sitio tem senha propria.`,
        i,
      )
    }

    // -- R04: codigo no boletim sem autorizacao na guia ---------------------
    if (pr.autorizado_na_guia === false) {
      add(
        'R04',
        'critico',
        `${pr.codigo_tuss} consta no boletim mas nao tem autorizacao ` +
          `correspondente na guia.`,
        i,
      )
    }

    // -- R05: codigo com glosa recorrente -----------------------------------
    const glosa = ref?.glosa_recorrente ?? 0
    if (glosa > 0) {
      add(
        'R05',
        'atencao',
        `${pr.codigo_tuss} tem glosa recorrente de ${formatarBRL(glosa)} por ` +
          `procedimento. Cobrar ${formatarBRL(ref?.valor_cobrar ?? pr.valor_cobrado)}, ` +
          `previsto ${formatarBRL(ref?.valor_pago ?? null)}.`,
        i,
      )
    }

    // -- R07: data da cirurgia fora da validade da autorizacao --------------
    if (atendimento.validade_autorizacao) {
      if (ehDepois(data, atendimento.validade_autorizacao)) {
        add(
          'R07',
          'atencao',
          `Cirurgia em ${formatarData(data)} depois da validade da autorizacao ` +
            `(${formatarData(atendimento.validade_autorizacao)}).`,
          i,
        )
      }
    }

    // -- R10: a faturar e o mes do atendimento terminando --------------------
    const situacao = pr.situacao ?? 'a_faturar'
    if (situacao === 'a_faturar') {
      const fimDoMes = ultimoDiaDoMes(mesDe(data))
      const noMes = mesDe(hoje) === mesDe(data)
      if (noMes && diaDoMes(hoje) >= 25) {
        add(
          'R10',
          'atencao',
          `${pr.codigo_tuss} ainda a faturar e faltam ${diffDias(hoje, fimDoMes)} ` +
            `dia(s) para o fim do mes do atendimento. Honorario nao digitado no ` +
            `SAVI e glosado automaticamente.`,
          i,
        )
      } else if (ehAntes(fimDoMes, hoje)) {
        add(
          'R10',
          'atencao',
          `${pr.codigo_tuss} ainda a faturar e o mes do atendimento ja fechou em ` +
            `${formatarData(fimDoMes)}.`,
          i,
        )
      }
    }
  })

  // -- R03b: senha repetida entre sitios diferentes -------------------------
  const porSenha = new Map<string, number[]>()
  procedimentos.forEach((pr, i) => {
    const s = (pr.senha ?? '').trim()
    if (!s) return
    porSenha.set(s, [...(porSenha.get(s) ?? []), i])
  })
  for (const [senha, indices] of porSenha) {
    if (indices.length < 2) continue
    const codigos = indices.map((i) => procedimentos[i].codigo_tuss)
    add(
      'R03',
      'critico',
      `Senha ${senha} repetida em ${indices.length} sitios (${codigos.join(', ')}). ` +
        `Cada sitio precisa da sua propria senha - e o erro de lancamento mais comum.`,
      indices[1],
    )
  }

  // -- R06: codigos equivalentes no mesmo atendimento -----------------------
  const codigosDoAtendimento = procedimentos.map((p) => p.codigo_tuss)
  const jaAvisado = new Set<string>()
  procedimentos.forEach((pr, i) => {
    const ref = vigenteEm(tabela, pr.codigo_tuss, data)
    const eq = ref?.equivalente_a
    if (!eq || !codigosDoAtendimento.includes(eq)) return
    const chave = [pr.codigo_tuss, eq].sort().join('|')
    if (jaAvisado.has(chave)) return
    jaAvisado.add(chave)
    add(
      'R06',
      'atencao',
      `${pr.codigo_tuss} e ${eq} sao equivalentes e estao no mesmo atendimento. ` +
        `A operadora remunera apenas um.`,
      i,
    )
  })

  // -- R08: divergencia entre boletim e ficha -------------------------------
  const { dadosBoletim: b, dadosFicha: f } = ctx
  if (b && f) {
    if (b.nome && f.nome && !mesmoNome(b.nome, f.nome)) {
      add('R08', 'atencao', `Nome divergente: boletim "${b.nome}" x ficha "${f.nome}".`)
    }
    if (
      b.carteira &&
      f.carteira &&
      apenasDigitos(b.carteira) !== apenasDigitos(f.carteira)
    ) {
      add(
        'R08',
        'atencao',
        `Carteira divergente: boletim ${b.carteira} x ficha ${f.carteira}.`,
      )
    }
    if (
      b.numero_atendimento &&
      f.numero_atendimento &&
      apenasDigitos(b.numero_atendimento) !== apenasDigitos(f.numero_atendimento)
    ) {
      add(
        'R08',
        'atencao',
        `Numero de atendimento divergente: boletim ${b.numero_atendimento} x ` +
          `ficha ${f.numero_atendimento}.`,
      )
    }
  }

  // -- R09: dois sitios sem incisoes independentes descritas ----------------
  const sitios = procedimentos.length
  if (sitios >= 2 && temDescricao) {
    const textos = procedimentos.map((p) => p.descricao_cirurgica ?? '').join(' \n ')
    const mencoes = contarOcorrencias(textos, 'incis')
    if (mencoes < sitios) {
      add(
        'R09',
        'atencao',
        `${sitios} sitios lancados e a descricao menciona ${mencoes} incisao(oes). ` +
          `Descreva incisoes independentes para sustentar o faturamento separado.`,
        0,
        'Registre cada acesso separadamente, com localizacao e extensao ' +
          '("incisao infraumbilical de 3 cm" / "incisao inguinal direita de 6 cm").',
      )
    }
  }

  // -- R11: boletim ainda nao anexado ---------------------------------------
  if (!temDescricao && procedimentos.length > 0) {
    add(
      'R11',
      'atencao',
      'Nenhuma descricao cirurgica neste atendimento - o boletim ainda nao foi ' +
        'anexado. As regras que dependem da descricao (retalho, tela e incisoes ' +
        'independentes) nao foram avaliadas.',
      0,
      'Fotografe o boletim de cirurgia deste mesmo atendimento. Ate la o ' +
        'atendimento pode ser salvo, mas a conferencia esta incompleta.',
    )
  }

  return alertas
}

/** Alertas criticos abertos - o que impede o fechamento do lote (§10). */
export function criticosAbertos(alertas: Alerta[]): Alerta[] {
  return alertas.filter((a) => a.severidade === 'critico' && !a.resolvido)
}
