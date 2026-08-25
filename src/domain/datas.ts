/**
 * Datas como string ISO 'AAAA-MM-DD'. Toda aritmetica passa por UTC para nao
 * pegar fuso: no horario de Fortaleza um new Date('2026-08-01') local ja
 * virou 31/07 em ambientes com offset positivo.
 */

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export function ehDataISO(valor: string | null | undefined): boolean {
  return !!valor && RE_ISO.test(valor)
}

function partes(iso: string): [number, number, number] {
  const m = RE_ISO.exec(iso)
  if (!m) throw new Error(`data ISO invalida: ${iso}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function paraUTC(iso: string): number {
  const [a, m, d] = partes(iso)
  return Date.UTC(a, m - 1, d)
}

function paraISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function hojeISO(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(
    agora.getDate(),
  ).padStart(2, '0')}`
}

/** '2026-08-25' -> '25/08/2026'. */
export function formatarData(iso: string | null | undefined): string {
  if (!ehDataISO(iso)) return '—'
  const [a, m, d] = partes(iso as string)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`
}

/** '25/08/2026' -> '2026-08-25'. Aceita tambem '25-08-2026' e ISO. */
export function parseDataBR(texto: string | null | undefined): string | null {
  if (!texto) return null
  const t = texto.trim()
  if (RE_ISO.test(t)) return t
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(t)
  if (!m) return null
  const dia = Number(m[1])
  const mes = Number(m[2])
  let ano = Number(m[3])
  if (ano < 100) ano += 2000
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function addDias(iso: string, dias: number): string {
  return paraISO(paraUTC(iso) + dias * 86400000)
}

/** dias de `de` ate `ate` (positivo se `ate` for posterior). */
export function diffDias(de: string, ate: string): number {
  return Math.round((paraUTC(ate) - paraUTC(de)) / 86400000)
}

export function ehAntes(a: string, b: string): boolean {
  return paraUTC(a) < paraUTC(b)
}

export function ehDepois(a: string, b: string): boolean {
  return paraUTC(a) > paraUTC(b)
}

/** '2026-08-25' -> '2026-08'. */
export function mesDe(iso: string): string {
  return iso.slice(0, 7)
}

export function primeiroDiaDoMes(mes: string): string {
  return `${mes}-01`
}

export function ultimoDiaDoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return paraISO(Date.UTC(a, m, 0))
}

export function diaDoMes(iso: string): number {
  return partes(iso)[2]
}

export function diasRestantesNoMes(iso: string): number {
  return diffDias(iso, ultimoDiaDoMes(mesDe(iso)))
}

/** '2026-08' -> '08/2026'. */
export function formatarMes(mes: string): string {
  const [a, m] = mes.split('-')
  return `${m}/${a}`
}

/** ('2026-08', 'MEDISA') -> 'MEDISA 08/2026'. */
export function competencia(mes: string, fonte = 'MEDISA'): string {
  return `${fonte} ${formatarMes(mes)}`
}

/** 'MEDISA 03/2026' -> { fonte: 'MEDISA', mes: '2026-03' }. */
export function parseCompetencia(
  texto: string,
): { fonte: string; mes: string } | null {
  const m = /^\s*([A-Za-z]+)\s+(\d{2})\/(\d{4})\s*$/.exec(texto)
  if (!m) return null
  return { fonte: m[1].toUpperCase(), mes: `${m[3]}-${m[2]}` }
}

export function mesSeguinte(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  return m === 12
    ? `${a + 1}-01`
    : `${a}-${String(m + 1).padStart(2, '0')}`
}

/** 'HH:MM' ou 'HH:MM:SS' -> 'HH:MM:SS' (formato exigido pelo TISS). */
export function horaCompleta(hora: string | null | undefined): string | null {
  if (!hora) return null
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hora.trim())
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}`
}
