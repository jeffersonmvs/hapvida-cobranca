/**
 * Aritmetica de dinheiro em centavos. Somar float de reais acumula erro e
 * em faturamento erro de centavo vira divergencia de conciliacao.
 */

export function emCentavos(valor: number): number {
  return Math.round(valor * 100)
}

export function emReais(centavos: number): number {
  return centavos / 100
}

export function somar(...valores: Array<number | null | undefined>): number {
  const total = valores.reduce<number>(
    (acc, v) => acc + (v == null ? 0 : emCentavos(v)),
    0,
  )
  return emReais(total)
}

export function subtrair(a: number, b: number): number {
  return emReais(emCentavos(a) - emCentavos(b))
}

export function multiplicar(valor: number, quantidade: number): number {
  return emReais(emCentavos(valor) * quantidade)
}

const FORMATADOR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
})

/** 'R$ 1.056,78'. null/undefined vira travessao - nunca R$ 0,00 por omissao. */
export function formatarBRL(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return '—'
  return FORMATADOR.format(valor)
}

/** Formato de campo do XML TISS: ponto decimal, duas casas, sem separador de milhar. */
export function formatarTISS(valor: number): string {
  return valor.toFixed(2)
}

/** Aceita '1.056,78', '1056,78', 'R$ 1.056,78' e '1056.78'. */
export function parseBRL(texto: string | null | undefined): number | null {
  if (texto == null) return null
  const limpo = String(texto)
    .replace(/[R$\s ]/gi, '')
    .trim()
  if (!limpo) return null
  let normalizado = limpo
  if (limpo.includes(',')) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}
