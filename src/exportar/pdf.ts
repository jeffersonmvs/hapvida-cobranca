import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { semAcento } from '@/domain'

/**
 * Camada fina sobre pdf-lib. As fontes padrao do PDF sao WinAnsi e nao
 * aceitam qualquer acento vindo de texto colado; semAcento() evita o erro de
 * encoding no meio da geracao.
 */

export const A4 = { largura: 595.28, altura: 841.89 }
export const MARGEM = 42

export interface Cursor {
  pdf: PDFDocument
  pagina: PDFPage
  y: number
  regular: PDFFont
  negrito: PDFFont
}

export async function novoDocumento(): Promise<Cursor> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pagina = pdf.addPage([A4.largura, A4.altura])
  return { pdf, pagina, y: A4.altura - MARGEM, regular, negrito }
}

export function novaPagina(c: Cursor) {
  c.pagina = c.pdf.addPage([A4.largura, A4.altura])
  c.y = A4.altura - MARGEM
}

export function garantirEspaco(c: Cursor, altura: number) {
  if (c.y - altura < MARGEM) novaPagina(c)
}

export function texto(
  c: Cursor,
  conteudo: string,
  opcoes: { tamanho?: number; negrito?: boolean; x?: number; cor?: [number, number, number]; espacoDepois?: number } = {},
) {
  const tamanho = opcoes.tamanho ?? 10
  garantirEspaco(c, tamanho + 4)
  c.pagina.drawText(semAcento(conteudo), {
    x: opcoes.x ?? MARGEM,
    y: c.y,
    size: tamanho,
    font: opcoes.negrito ? c.negrito : c.regular,
    color: opcoes.cor ? rgb(...opcoes.cor) : rgb(0.12, 0.12, 0.14),
  })
  c.y -= tamanho + (opcoes.espacoDepois ?? 4)
}

/** Quebra o texto na largura util da pagina. */
export function paragrafo(c: Cursor, conteudo: string, tamanho = 10, recuo = 0) {
  const largura = A4.largura - 2 * MARGEM - recuo
  const palavras = semAcento(conteudo).split(/\s+/)
  let linha = ''
  for (const p of palavras) {
    const tentativa = linha ? `${linha} ${p}` : p
    if (c.regular.widthOfTextAtSize(tentativa, tamanho) > largura) {
      texto(c, linha, { tamanho, x: MARGEM + recuo, espacoDepois: 2 })
      linha = p
    } else {
      linha = tentativa
    }
  }
  if (linha) texto(c, linha, { tamanho, x: MARGEM + recuo, espacoDepois: 2 })
}

export function linhaHorizontal(c: Cursor, espessura = 0.6) {
  garantirEspaco(c, 8)
  c.pagina.drawLine({
    start: { x: MARGEM, y: c.y },
    end: { x: A4.largura - MARGEM, y: c.y },
    thickness: espessura,
    color: rgb(0.75, 0.75, 0.78),
  })
  c.y -= 10
}

/** Linha de duas colunas: rotulo a esquerda, valor alinhado a direita. */
export function linhaValor(c: Cursor, rotulo: string, valor: string, tamanho = 10, negrito = false) {
  garantirEspaco(c, tamanho + 4)
  const fonte = negrito ? c.negrito : c.regular
  c.pagina.drawText(semAcento(rotulo), { x: MARGEM, y: c.y, size: tamanho, font: fonte, color: rgb(0.12, 0.12, 0.14) })
  const v = semAcento(valor)
  c.pagina.drawText(v, {
    x: A4.largura - MARGEM - fonte.widthOfTextAtSize(v, tamanho),
    y: c.y, size: tamanho, font: fonte, color: rgb(0.12, 0.12, 0.14),
  })
  c.y -= tamanho + 4
}

export async function baixar(cursor: Cursor, nome: string) {
  const bytes = await cursor.pdf.save()
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
  baixarBlob(blob, nome)
}

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
