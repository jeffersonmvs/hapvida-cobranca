/** Normalizacao de texto usada pelas regras de busca por termo. */

/** minusculas, sem acento, espacos colapsados. */
export function normalizar(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Remove acentos preservando caixa. Usado nos valores de campo do XML TISS. */
export function semAcento(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** true se o texto normalizado contem o termo normalizado. */
export function contem(texto: string | null | undefined, termo: string): boolean {
  return normalizar(texto).includes(normalizar(termo))
}

export function contemAlgum(texto: string | null | undefined, termos: string[]): boolean {
  return termos.some((t) => contem(texto, t))
}

export function contemTodos(texto: string | null | undefined, termos: string[]): boolean {
  return termos.every((t) => contem(texto, t))
}

/** Conta ocorrencias de um radical no texto normalizado. */
export function contarOcorrencias(texto: string | null | undefined, radical: string): number {
  const alvo = normalizar(radical)
  if (!alvo) return 0
  const base = normalizar(texto)
  let n = 0
  let i = base.indexOf(alvo)
  while (i !== -1) {
    n++
    i = base.indexOf(alvo, i + alvo.length)
  }
  return n
}

/** Compara nomes de paciente ignorando acento, caixa e espacos extras. */
export function mesmoNome(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizar(a) === normalizar(b)
}

/** So digitos - carteira, CPF, numero de atendimento, senha. */
export function apenasDigitos(v: string | null | undefined): string {
  return (v ?? '').replace(/\D+/g, '')
}
