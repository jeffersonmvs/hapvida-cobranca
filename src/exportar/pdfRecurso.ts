import type { Minuta } from '@/domain'
import { baixar, linhaHorizontal, novoDocumento, paragrafo, texto } from './pdf'

/** PDF da minuta de recurso, pronto para anexar no portal (§11.4). */
export async function gerarPdfRecurso(m: Minuta, nomeArquivo: string) {
  const c = await novoDocumento()

  texto(c, m.titulo.toUpperCase(), { tamanho: 13, negrito: true, espacoDepois: 8 })
  linhaHorizontal(c)

  const bloco = (titulo: string, linhas: string[]) => {
    texto(c, titulo, { tamanho: 10, negrito: true, espacoDepois: 4 })
    for (const l of linhas) paragrafo(c, l, 9.5)
    c.y -= 6
  }

  bloco('IDENTIFICACAO', m.identificacao)
  bloco('PROCEDIMENTO REALIZADO', m.procedimento)
  bloco('VALORES', m.valores)
  bloco('MOTIVO ALEGADO PELA OPERADORA', [m.motivo_alegado])
  bloco('FUNDAMENTACAO', m.fundamentacao.map((f, i) => `${i + 1}. ${f}`))
  bloco('PEDIDO', [m.pedido])

  c.y -= 20
  linhaHorizontal(c)
  paragrafo(c, m.aviso, 8)

  await baixar(c, nomeArquivo)
}
