/**
 * Preparo da foto antes do upload (§8.1 / §13).
 *
 * O iPhone entrega HEIC por padrao e HEIC nao e legivel pelo pipeline de
 * extracao. A conversao acontece no CLIENTE, antes de qualquer upload. Os
 * originais chegam com 5-12 MB; sai JPEG de ~2400 px e qualidade 0.8.
 */

export const LADO_MAXIMO = 2400
export const QUALIDADE = 0.8

export interface ArquivoPreparado {
  blob: Blob
  nome: string
  tipo: string
  hash: string
  largura: number
  altura: number
  bytes_originais: number
  bytes_finais: number
  convertido_de_heic: boolean
}

function ehHeic(arquivo: File): boolean {
  const nome = arquivo.name.toLowerCase()
  return (
    arquivo.type === 'image/heic' ||
    arquivo.type === 'image/heif' ||
    nome.endsWith('.heic') ||
    nome.endsWith('.heif')
  )
}

async function converterHeic(arquivo: File): Promise<Blob> {
  const { default: heic2any } = await import('heic2any')
  const saida = await heic2any({ blob: arquivo, toType: 'image/jpeg', quality: QUALIDADE })
  return Array.isArray(saida) ? saida[0] : (saida as Blob)
}

async function carregarBitmap(blob: Blob): Promise<ImageBitmap> {
  if ('createImageBitmap' in globalThis) return createImageBitmap(blob)
  throw new Error('Navegador sem suporte a createImageBitmap.')
}

async function redimensionar(
  blob: Blob,
  ladoMaximo = LADO_MAXIMO,
): Promise<{ blob: Blob; largura: number; altura: number }> {
  const bitmap = await carregarBitmap(blob)
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Nao foi possivel preparar a imagem.')
  ctx.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close?.()

  const saida = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, 'image/jpeg', QUALIDADE),
  )
  if (!saida) throw new Error('Falha ao comprimir a imagem.')
  return { blob: saida, largura, altura }
}

/** SHA-256 do conteudo - dedupe de foto repetida. */
export async function hashArquivo(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function prepararArquivo(arquivo: File): Promise<ArquivoPreparado> {
  const originais = arquivo.size
  const heic = ehHeic(arquivo)

  // PDF passa direto: nao ha o que redimensionar.
  if (arquivo.type === 'application/pdf') {
    const hash = await hashArquivo(arquivo)
    return {
      blob: arquivo, nome: arquivo.name, tipo: 'application/pdf', hash,
      largura: 0, altura: 0, bytes_originais: originais, bytes_finais: arquivo.size,
      convertido_de_heic: false,
    }
  }

  const base = heic ? await converterHeic(arquivo) : arquivo
  const { blob, largura, altura } = await redimensionar(base)
  const hash = await hashArquivo(blob)

  return {
    blob,
    nome: arquivo.name.replace(/\.(heic|heif)$/i, '.jpg'),
    tipo: 'image/jpeg',
    hash,
    largura,
    altura,
    bytes_originais: originais,
    bytes_finais: blob.size,
    convertido_de_heic: heic,
  }
}

/** Importacao em lote de ZIP com varias fotos (§8.1). */
export async function extrairZip(arquivo: File): Promise<File[]> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(arquivo)
  const saida: File[] = []
  for (const nome of Object.keys(zip.files)) {
    const entrada = zip.files[nome]
    if (entrada.dir) continue
    if (!/\.(jpe?g|png|heic|heif|webp|pdf)$/i.test(nome)) continue
    if (nome.startsWith('__MACOSX/')) continue
    const conteudo = await entrada.async('blob')
    saida.push(new File([conteudo], nome.split('/').pop() ?? nome, { type: conteudo.type }))
  }
  return saida
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
