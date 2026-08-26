import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatarData, vigentesEm } from '@/domain'
import { repositorio, useDados } from '@/dados/contexto'
import { extrairZip, formatarTamanho, prepararArquivo } from '@/lib/imagem'
import { extrairDocumento, iaDisponivel, IaIndisponivel } from '@/ai/cliente'
import { Etiqueta, Secao, Vazio } from '@/componentes/ui'

type Estado = 'preparando' | 'enviando' | 'extraindo' | 'pronto' | 'duplicado' | 'erro'

interface Item {
  chave: string
  nome: string
  estado: Estado
  detalhe?: string
  documento_id?: string
  preview?: string
}

let n = 0

/**
 * O input fica dentro de um <label>: quem abre o seletor e o toque do usuario
 * no proprio label, nao um .click() disparado por JS. O Safari do iPhone
 * ignora clique sintetico em input com display:none, e o resultado era o
 * botao "Galeria" nao fazer absolutamente nada.
 *
 * Por isso tambem nao usamos `hidden` (display:none) aqui: o input precisa
 * continuar renderizado para receber o clique encaminhado pelo label. Fica
 * invisivel por tamanho zero e opacidade, nunca por display.
 */
const CLASSE_INPUT_ARQUIVO = 'absolute h-0 w-0 opacity-0'

const CLASSE_BOTAO_ARQUIVO =
  'relative cursor-pointer rounded-lg border border-line bg-surface2 px-4 py-2.5 ' +
  'text-center text-sm font-medium text-slate-100 transition hover:bg-line'

/**
 * Captura e importacao de documentos (§8.1) - a entrada principal do sistema.
 *
 * O upload NAO espera a extracao: a fila roda em segundo plano e a tela mostra
 * o progresso. HEIC vira JPEG no cliente antes de qualquer coisa.
 */
export default function Captura() {
  const { documentos, tabela, hoje, recarregar } = useDados()
  const [itens, setItens] = useState<Item[]>([])

  const atualizar = (chave: string, patch: Partial<Item>) =>
    setItens((is) => is.map((i) => (i.chave === chave ? { ...i, ...patch } : i)))

  const processar = async (arquivos: File[]) => {
    const novos: Item[] = arquivos.map((a) => ({
      chave: `i${++n}`,
      nome: a.name,
      estado: 'preparando' as Estado,
    }))
    setItens((is) => [...novos, ...is])

    // sequencial de proposito: converter HEIC de 8 fotos em paralelo trava o
    // celular. O usuario ve o progresso descer um a um.
    for (let k = 0; k < arquivos.length; k++) {
      const item = novos[k]
      try {
        const preparado = await prepararArquivo(arquivos[k])
        atualizar(item.chave, {
          estado: 'enviando',
          detalhe:
            `${formatarTamanho(preparado.bytes_originais)} → ` +
            `${formatarTamanho(preparado.bytes_finais)}` +
            (preparado.convertido_de_heic ? ' · HEIC convertido' : ''),
          preview: URL.createObjectURL(preparado.blob),
        })

        const jaExiste = documentos.find((d) => d.hash_arquivo === preparado.hash)
        if (jaExiste) {
          atualizar(item.chave, {
            estado: 'duplicado',
            detalhe: 'Foto ja enviada antes.',
            documento_id: jaExiste.id,
          })
          continue
        }

        const caminho = `${hoje}/${preparado.hash}.${preparado.tipo === 'application/pdf' ? 'pdf' : 'jpg'}`
        await repositorio.enviarArquivo(caminho, preparado.blob, preparado.tipo)
        const doc = await repositorio.registrarDocumento({
          tipo: null,
          storage_path: caminho,
          hash_arquivo: preparado.hash,
          extracao_status: 'pendente',
        })
        atualizar(item.chave, { estado: 'extraindo', documento_id: doc.id })

        if (!iaDisponivel) {
          atualizar(item.chave, {
            estado: 'pronto',
            detalhe: 'Enviado. Extracao automatica indisponivel — revisar manualmente.',
          })
          continue
        }

        try {
          await repositorio.atualizarDocumento({ ...doc, extracao_status: 'processando' })
          const extracao = await extrairDocumento({
            storage_path: caminho,
            codigos_vigentes: vigentesEm(tabela, hoje).map((p) => ({
              codigo: p.codigo_tuss,
              descricao: p.descricao,
            })),
          })
          await repositorio.atualizarDocumento({
            ...doc,
            tipo: extracao.tipo_documento,
            extracao_status: 'extraido',
            extracao_json: extracao,
          })
          atualizar(item.chave, { estado: 'pronto', detalhe: 'Extraido — aguardando sua revisao.' })
        } catch (e) {
          const msg = e instanceof IaIndisponivel ? e.message : 'Falha na extracao.'
          await repositorio.atualizarDocumento({ ...doc, extracao_status: 'falhou', erro: msg })
          atualizar(item.chave, { estado: 'erro', detalhe: msg })
        }
      } catch (e) {
        atualizar(item.chave, {
          estado: 'erro',
          detalhe: e instanceof Error ? e.message : 'Falha ao preparar o arquivo.',
        })
      }
    }
    await recarregar()
  }

  const aoSelecionar = async (e: React.ChangeEvent<HTMLInputElement>, ehZip = false) => {
    const arquivos = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (arquivos.length === 0) return
    if (ehZip) {
      const extraidos = await extrairZip(arquivos[0])
      await processar(extraidos)
    } else {
      await processar(arquivos)
    }
  }

  const pendentes = documentos.filter(
    (d) => d.extracao_status === 'extraido' || d.extracao_status === 'pendente',
  )

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold">Capturar documentos</h2>
      <p className="mb-4 text-xs leading-relaxed text-slate-400">
        Fotografe o Boletim de Cirurgia e a Ficha de Internacao de cada paciente.
        Varias fotos seguidas, sem sair da tela. HEIC do iPhone vira JPEG aqui
        mesmo, antes de subir.
      </p>

      <label className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand/50 bg-brand/10 p-10 text-brand">
        <span className="text-4xl leading-none">◉</span>
        <span className="text-sm font-medium">Fotografar (lote)</span>
        <input type="file" accept="image/*" capture="environment" multiple
          className={CLASSE_INPUT_ARQUIVO} onChange={(e) => aoSelecionar(e)} />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className={CLASSE_BOTAO_ARQUIVO}>
          Galeria / PDF
          <input type="file" accept="image/*,application/pdf" multiple
            className={CLASSE_INPUT_ARQUIVO} onChange={(e) => aoSelecionar(e)} />
        </label>
        <label className={CLASSE_BOTAO_ARQUIVO}>
          Importar ZIP
          <input type="file" accept=".zip,application/zip"
            className={CLASSE_INPUT_ARQUIVO} onChange={(e) => aoSelecionar(e, true)} />
        </label>
      </div>

      {itens.length > 0 && (
        <Secao titulo={`Fila (${itens.length})`}>
          <ul className="space-y-2">
            {itens.map((i) => (
              <li key={i.chave} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
                {i.preview
                  ? <img src={i.preview} alt="" className="h-12 w-12 rounded object-cover" />
                  : <div className="h-12 w-12 rounded bg-surface2" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{i.nome}</div>
                  <div className="text-xs text-slate-400">{i.detalhe ?? rotuloEstado(i.estado)}</div>
                </div>
                <EtiquetaEstado estado={i.estado} />
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao titulo={`Aguardando revisao (${pendentes.length})`}>
        <p className="mb-2 text-xs text-slate-400">
          Nada extraido pela IA vira registro faturavel sem a sua confirmacao.
        </p>
        {pendentes.length === 0 ? (
          <Vazio>Nenhum documento aguardando revisao.</Vazio>
        ) : (
          <ul className="space-y-2">
            {pendentes.map((d) => (
              <li key={d.id}>
                <Link to={`/revisao/${d.id}`}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface p-3 hover:border-brand">
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      {d.tipo ? d.tipo : 'documento'} · {d.storage_path.split('/').pop()}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {d.created_at ? formatarData(d.created_at.slice(0, 10)) : ''}
                    </span>
                  </span>
                  <Etiqueta tom={d.extracao_status === 'extraido' ? 'info' : 'neutro'}>
                    {d.extracao_status}
                  </Etiqueta>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  )
}

function rotuloEstado(e: Estado): string {
  return {
    preparando: 'Convertendo e comprimindo…',
    enviando: 'Enviando…',
    extraindo: 'Extraindo campos…',
    pronto: 'Pronto para revisao',
    duplicado: 'Duplicado',
    erro: 'Erro',
  }[e]
}

function EtiquetaEstado({ estado }: { estado: Estado }) {
  if (estado === 'erro') return <Etiqueta tom="critico">erro</Etiqueta>
  if (estado === 'duplicado') return <Etiqueta tom="atencao">duplicado</Etiqueta>
  if (estado === 'pronto') return <Etiqueta tom="info">pronto</Etiqueta>
  return <Etiqueta tom="neutro">…</Etiqueta>
}
