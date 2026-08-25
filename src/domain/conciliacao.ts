import type { ProcedimentoRealizado } from './tipos'
import { parseBRL, somar, subtrair } from './dinheiro'
import { parseDataBR } from './datas'
import { apenasDigitos } from './texto'

/**
 * Conciliacao do relatorio do Portal Medico com o banco (§8.8).
 *
 * O cruzamento e por SENHA - e a unica chave que a operadora e o boletim
 * compartilham por sitio. Sai em quatro listas; a terceira e a que interessa:
 * producao que nunca foi faturada.
 */

export interface LinhaRelatorio {
  senha: string
  codigo_tuss?: string | null
  paciente?: string | null
  data?: string | null
  valor_apresentado?: number | null
  valor_pago?: number | null
  glosa?: number | null
  justificativa?: string | null
  linha_original: string
}

const SEPARADORES = [';', '\t', ',', '|']

function detectarSeparador(texto: string): string {
  const primeira = texto.split('\n').find((l) => l.trim().length > 0) ?? ''
  let melhor = ';'
  let max = 0
  for (const s of SEPARADORES) {
    const n = primeira.split(s).length
    if (n > max) {
      max = n
      melhor = s
    }
  }
  return max > 1 ? melhor : ' '
}

const ALIASES: Record<string, keyof LinhaRelatorio> = {
  senha: 'senha',
  autorizacao: 'senha',
  'senha autorizacao': 'senha',
  codigo: 'codigo_tuss',
  'codigo tuss': 'codigo_tuss',
  procedimento: 'codigo_tuss',
  paciente: 'paciente',
  beneficiario: 'paciente',
  data: 'data',
  'data atendimento': 'data',
  'data execucao': 'data',
  apresentado: 'valor_apresentado',
  'valor apresentado': 'valor_apresentado',
  cobrado: 'valor_apresentado',
  pago: 'valor_pago',
  'valor pago': 'valor_pago',
  liberado: 'valor_pago',
  glosa: 'glosa',
  'valor glosa': 'glosa',
  'valor glosado': 'glosa',
  motivo: 'justificativa',
  justificativa: 'justificativa',
}

function normalizarCabecalho(c: string): keyof LinhaRelatorio | null {
  const k = c
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return ALIASES[k] ?? null
}

/**
 * Aceita CSV com cabecalho, colagem de texto tabulado ou linhas soltas.
 * Sem cabecalho reconhecivel, cai no modo heuristico: procura uma sequencia
 * de 6+ digitos como senha e os dois ultimos numeros monetarios da linha.
 */
export function parsearRelatorio(texto: string): LinhaRelatorio[] {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (linhas.length === 0) return []

  const sep = detectarSeparador(texto)
  const cabecalho = linhas[0].split(sep).map(normalizarCabecalho)
  const temCabecalho = cabecalho.filter(Boolean).length >= 2

  const saida: LinhaRelatorio[] = []
  const corpo = temCabecalho ? linhas.slice(1) : linhas

  for (const linha of corpo) {
    if (temCabecalho) {
      const celulas = linha.split(sep)
      const obj: LinhaRelatorio = { senha: '', linha_original: linha }
      cabecalho.forEach((campo, i) => {
        if (!campo) return
        const bruto = (celulas[i] ?? '').trim()
        if (campo === 'valor_apresentado' || campo === 'valor_pago' || campo === 'glosa') {
          ;(obj[campo] as number | null) = parseBRL(bruto)
        } else if (campo === 'data') {
          obj.data = parseDataBR(bruto)
        } else if (campo === 'senha') {
          obj.senha = apenasDigitos(bruto) || bruto
        } else {
          ;(obj[campo] as string | null) = bruto || null
        }
      })
      if (obj.senha) saida.push(obj)
      continue
    }

    // modo heuristico: sequencias de 6+ digitos sao codigo TUSS e/ou senha.
    // A data em dd/mm/aaaa nao entra porque nenhum de seus campos tem 6 digitos.
    const sequencias = (linha.match(/\b\d{6,}\b/g) ?? [])
    if (sequencias.length === 0) continue
    let codigo: string | null = null
    let senha: string
    if (sequencias.length === 1) {
      senha = sequencias[0]
    } else {
      const iCodigo = sequencias.findIndex((s) => s.length === 8)
      codigo = iCodigo >= 0 ? sequencias[iCodigo] : null
      const restantes = sequencias.filter((_, i) => i !== iCodigo)
      senha = restantes[restantes.length - 1]
    }
    const valores = (linha.match(/\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2}/g) ?? [])
      .map(parseBRL)
      .filter((v): v is number => v != null)
    saida.push({
      senha,
      codigo_tuss: codigo,
      data: parseDataBR(/(\d{2}\/\d{2}\/\d{4})/.exec(linha)?.[1] ?? ''),
      valor_apresentado: valores.length >= 2 ? valores[valores.length - 2] : valores[0] ?? null,
      valor_pago: valores.length >= 1 ? valores[valores.length - 1] : null,
      linha_original: linha,
    })
  }
  return saida
}

export interface ParConciliado {
  senha: string
  banco: ProcedimentoRealizado
  relatorio: LinhaRelatorio
  diferenca: number
}

export interface ResultadoConciliacao {
  conferem: ParConciliado[]
  divergem: ParConciliado[]
  /** no banco e ausentes do relatorio: producao que pode nunca ter sido faturada */
  nao_encontrados_no_relatorio: ProcedimentoRealizado[]
  /** no relatorio e ausentes do banco: producao paga que nao foi lancada aqui */
  nao_encontrados_no_banco: LinhaRelatorio[]
  total_banco: number
  total_relatorio: number
}

export function conciliar(
  linhas: LinhaRelatorio[],
  banco: ProcedimentoRealizado[],
  opcoes: { tolerancia?: number } = {},
): ResultadoConciliacao {
  const tolerancia = opcoes.tolerancia ?? 0
  const chave = (s: string) => apenasDigitos(s) || s.trim()

  const porSenhaRelatorio = new Map<string, LinhaRelatorio>()
  for (const l of linhas) porSenhaRelatorio.set(chave(l.senha), l)

  const conferem: ParConciliado[] = []
  const divergem: ParConciliado[] = []
  const semRelatorio: ProcedimentoRealizado[] = []
  const usadas = new Set<string>()

  for (const pr of banco) {
    const k = chave(pr.senha)
    const linha = porSenhaRelatorio.get(k)
    if (!linha) {
      semRelatorio.push(pr)
      continue
    }
    usadas.add(k)
    const apresentado = linha.valor_apresentado ?? linha.valor_pago ?? 0
    const diferenca = subtrair(pr.valor_cobrado, apresentado)
    const par: ParConciliado = { senha: k, banco: pr, relatorio: linha, diferenca }
    if (Math.abs(diferenca) <= tolerancia) conferem.push(par)
    else divergem.push(par)
  }

  const semBanco = linhas.filter((l) => !usadas.has(chave(l.senha)))

  return {
    conferem,
    divergem,
    nao_encontrados_no_relatorio: semRelatorio,
    nao_encontrados_no_banco: semBanco,
    total_banco: somar(...banco.map((p) => p.valor_cobrado)),
    total_relatorio: somar(
      ...linhas.map((l) => l.valor_apresentado ?? l.valor_pago ?? 0),
    ),
  }
}
