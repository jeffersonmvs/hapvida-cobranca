import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatarData, vigentesEm } from '@/domain'
import { repositorio, useDados } from '@/dados/contexto'
import { extrairZip, formatarTamanho, prepararArquivo } from '@/lib/imagem'
import { extrairDocumento, iaDisponivel, IaIndisponivel } from '@/ai/cliente'
import { Botao, Etiqueta, Secao, Vazio } from '@/componentes/ui'

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
 * Captura e importacao de documentos (§8.1) - a entrada principal do sistema.
 *
 * O upload NAO espera a extracao: a fila roda em segundo plano e a tela mostra
 * o progresso. HEIC vira JPEG no cliente antes de qualquer coisa.
 */
export default function Captura() {
  const { documentos, tabela, hoje, recarregar } = useDados()
  const [itens, setItens] = useState<Item[]>([])
  const camera = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const zip = useRef<HTMLInputElement>(null)

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

      <button
        onClick={() => camera.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-brand/50 bg-brand/10 p-10 text-brand"
      >
        <span className="text-4xl leading-none">◉</span>
        <span className="text-sm font-medium">Fotografar (lote)</span>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Botao tipo="secundario" onClick={() => galeria.current?.click()}>Galeria / PDF</Botao>
        <Botao tipo="secundario" onClick={() => zip.current?.click()}>Importar ZIP</Botao>
      </div>

      <input ref={camera} type="file" accept="image/*" capture="environment" multiple
        className="hidden" onChange={(e) => aoSelecionar(e)} />
      <input ref={galeria} type="file" accept="image/*,application/pdf,.heic,.heif" multiple
        className="hidden" onChange={(e) => aoSelecionar(e)} />
      <input ref={zip} type="file" accept=".zip,application/zip"
        className="hidden" onChange={(e) => aoSelecionar(e, true)} />

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
