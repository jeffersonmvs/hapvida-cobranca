import * as XLSX from 'xlsx'
import {
  agruparPorAssinatura, calcularConsultas, formatarData, mesDe, somar,
  type Configuracao, type Consulta, type Glosa, type Procedimento,
} from '@/domain'
import type { AtendimentoCompleto } from '@/dados/repositorio'

/**
 * Planilha XLSX (§9.3). Abas: Resumo, Tabela Honorarios, Glosas, Cirurgias,
 * Ambulatorio. O Resumo usa formulas vivas apontando para as abas de detalhe,
 * com intervalo folgado para as linhas que ainda vao entrar.
 */
const FOLGA = 400

export function gerarPlanilha(opcoes: {
  atendimentos: AtendimentoCompleto[]
  tabela: Procedimento[]
  glosas: Glosa[]
  consultas: Consulta[]
  config: Configuracao
  mes: string
}) {
  const { atendimentos, tabela, glosas, consultas, mes } = opcoes
  const livro = XLSX.utils.book_new()

  // ---- Cirurgias ---------------------------------------------------------
  const cirurgias = atendimentos.flatMap((a) =>
    a.procedimentos.map((p) => ({
      Data: a.atendimento.data,
      Paciente: a.paciente?.nome ?? '',
      Carteira: a.paciente?.carteira ?? '',
      Atendimento: a.atendimento.numero,
      Local: a.atendimento.local ?? '',
      Sala: a.atendimento.classe === 'pqa' ? 'PQA' : 'Centro cirurgico',
      Codigo: p.codigo_tuss,
      Descricao: tabela.find((t) => t.codigo_tuss === p.codigo_tuss)?.descricao ?? '',
      Senha: p.senha,
      Cobrado: p.valor_cobrado,
      Previsto: p.valor_previsto ?? null,
      Situacao: p.situacao ?? 'a_faturar',
      Competencia: mesDe(a.atendimento.data),
    })),
  )
  XLSX.utils.book_append_sheet(livro, XLSX.utils.json_to_sheet(cirurgias), 'Cirurgias')

  // ---- Tabela de honorarios ---------------------------------------------
  XLSX.utils.book_append_sheet(
    livro,
    XLSX.utils.json_to_sheet(
      tabela.map((t) => ({
        Codigo: t.codigo_tuss,
        Descricao: t.descricao,
        Cobrar: t.valor_cobrar,
        Pago: t.valor_pago ?? null,
        Glosa: t.glosa_recorrente ?? 0,
        Confianca: t.confianca,
        'Exige tela': t.exige_tela ? 'sim' : '',
        'Exige retalho': t.exige_retalho ? 'sim' : '',
        'Vigencia inicio': t.vigencia_inicio,
        'Vigencia fim': t.vigencia_fim ?? '',
        Observacao: t.observacao ?? '',
      })),
    ),
    'Tabela Honorarios',
  )

  // ---- Glosas ------------------------------------------------------------
  const grupos = agruparPorAssinatura(glosas)
  const porAssinatura = new Map(
    grupos.flatMap((g) => g.glosas.map((x) => [x.id ?? '', g.assinatura] as const)),
  )
  XLSX.utils.book_append_sheet(
    livro,
    XLSX.utils.json_to_sheet(
      glosas.map((g) => ({
        Competencia: g.competencia,
        Codigo: g.codigo_tuss ?? '',
        Glosado: g.valor_glosado,
        Recurso: g.valor_recurso ?? 0,
        Justificativa: g.justificativa ?? '',
        Taxonomia: g.justificativa_normalizada ?? '',
        Assinatura: porAssinatura.get(g.id ?? '') ?? '',
        Demonstrativo: g.data_demonstrativo ?? '',
        'Prazo recurso': g.prazo_recurso ?? '',
        Recursada: g.recursada ? 'sim' : 'nao',
        Resultado: g.resultado ?? '',
      })),
    ),
    'Glosas',
  )

  // ---- Ambulatorio -------------------------------------------------------
  XLSX.utils.book_append_sheet(
    livro,
    XLSX.utils.json_to_sheet(
      consultas.map((c) => ({
        Data: c.data,
        Unidade: c.unidade,
        Consultas: c.qtd_consultas,
        Retornos: c.qtd_retornos,
        'Valor unitario': c.valor_unitario,
        Valor: c.qtd_consultas * c.valor_unitario,
      })),
    ),
    'Ambulatorio',
  )

  // ---- Resumo com formulas vivas ----------------------------------------
  const resumo = XLSX.utils.aoa_to_sheet([
    ['RESUMO', `Competencia ${mes}`],
    ['Gerado em', formatarData(new Date().toISOString().slice(0, 10))],
    [],
    ['Procedimentos lancados', { f: `COUNTA(Cirurgias!G2:G${FOLGA})` }],
    ['Total cobrado', { f: `SUM(Cirurgias!J2:J${FOLGA})` }],
    ['Total previsto', { f: `SUM(Cirurgias!K2:K${FOLGA})` }],
    ['A faturar', { f: `COUNTIF(Cirurgias!L2:L${FOLGA},"a_faturar")` }],
    [],
    ['Glosado', { f: `SUM(Glosas!C2:C${FOLGA})` }],
    ['Em recurso', { f: `SUM(Glosas!D2:D${FOLGA})` }],
    ['Glosas nao recursadas', { f: `COUNTIF(Glosas!J2:J${FOLGA},"nao")` }],
    [],
    ['Consultas', { f: `SUM(Ambulatorio!C2:C${FOLGA})` }],
    ['Retornos (sem remuneracao)', { f: `SUM(Ambulatorio!D2:D${FOLGA})` }],
    ['Valor ambulatorio', { f: `SUM(Ambulatorio!F2:F${FOLGA})` }],
    [],
    ['Conferencia (sem formula)', ''],
    ['Total cobrado', somar(...cirurgias.map((c) => c.Cobrado))],
    ['Valor ambulatorio', calcularConsultas(consultas).valor],
  ])
  XLSX.utils.book_append_sheet(livro, resumo, 'Resumo')

  // Resumo primeiro
  livro.SheetNames = [
    'Resumo', 'Cirurgias', 'Tabela Honorarios', 'Glosas', 'Ambulatorio',
  ]

  XLSX.writeFile(livro, `faturamento-${mes}.xlsx`)
}
