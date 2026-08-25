import { useMemo, useState } from 'react'
import { montarRecurso, type Glosa } from '@/domain'
import { useDados } from '@/dados/contexto'
import { iaDisponivel, redigirRecurso } from '@/ai/cliente'
import { Botao, classeInput } from './ui'

/**
 * Minuta de recurso. Gerada de forma deterministica a partir de fato do
 * registro; o botao de refinar com IA e opcional e marca a saida como
 * sugestao (§11.4).
 */
export function PainelRecurso({ glosa, aoFechar }: { glosa: Glosa; aoFechar: () => void }) {
  const { atendimentos, tabela, glosas, config } = useDados()

  const contexto = useMemo(() => {
    const achado = atendimentos.find((a) =>
      a.procedimentos.some((p) => p.id === glosa.procedimento_realizado_id),
    ) ?? atendimentos.find((a) =>
      a.procedimentos.some((p) => p.codigo_tuss === glosa.codigo_tuss),
    )
    const procedimento =
      achado?.procedimentos.find((p) => p.id === glosa.procedimento_realizado_id) ??
      achado?.procedimentos.find((p) => p.codigo_tuss === glosa.codigo_tuss) ??
      null
    return { achado, procedimento }
  }, [atendimentos, glosa])

  const referencia = tabela.find((t) => t.codigo_tuss === (glosa.codigo_tuss ?? '')) ?? null

  const minuta = useMemo(
    () =>
      montarRecurso({
        glosa,
        procedimento: contexto.procedimento,
        atendimento: contexto.achado?.atendimento ?? null,
        paciente: contexto.achado?.paciente ?? null,
        referencia,
        config,
        historicoGlosas: glosas.filter((g) => g.codigo_tuss === glosa.codigo_tuss),
      }),
    [glosa, contexto, referencia, config, glosas],
  )

  const [texto, setTexto] = useState(minuta.texto)
  const [copiado, setCopiado] = useState(false)
  const [refinando, setRefinando] = useState(false)
  const [erroIa, setErroIa] = useState<string | null>(null)
  const [refinado, setRefinado] = useState(false)

  const refinar = async () => {
    setRefinando(true)
    setErroIa(null)
    try {
      const valorCobrado = contexto.procedimento?.valor_cobrado ?? referencia?.valor_cobrar ?? null
      const r = await redigirRecurso({
        referencia_id: glosa.id ?? '',
        minuta: texto,
        valores: {
          apresentado: valorCobrado,
          pago: valorCobrado != null ? Number((valorCobrado - glosa.valor_glosado).toFixed(2)) : null,
          glosado: glosa.valor_glosado,
        },
        motivo_alegado: glosa.justificativa ?? '',
        senha: contexto.procedimento?.senha ?? null,
        descricao_cirurgica: contexto.procedimento?.descricao_cirurgica ?? null,
        historico: glosas
          .filter((g) => g.codigo_tuss === glosa.codigo_tuss)
          .map((g) => `${g.competencia}: ${g.justificativa ?? ''}`),
      })
      setTexto(r.texto)
      setRefinado(true)
    } catch (e) {
      setErroIa(e instanceof Error ? e.message : 'Falha ao refinar.')
    } finally {
      setRefinando(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-brand/40 bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Minuta de recurso</h3>
        <button onClick={aoFechar} className="text-xs text-slate-400">fechar</button>
      </div>

      <textarea
        className={`${classeInput} min-h-[420px] font-mono text-xs leading-relaxed`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />

      {refinado && (
        <p className="mt-2 rounded-lg border border-ia/40 bg-ia/10 p-2 text-xs text-slate-300">
          Redacao refinada por IA — <strong>sugestao</strong>. Confira cada fato
          antes de enviar; o texto vai com a sua assinatura.
        </p>
      )}

      <p className="mt-2 rounded-lg border border-line bg-surface2 p-2 text-xs text-slate-400">
        {minuta.aviso}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Botao onClick={async () => {
          const { gerarPdfRecurso } = await import('@/exportar/pdfRecurso')
          await gerarPdfRecurso({ ...minuta, texto }, `recurso-${glosa.codigo_tuss}-${glosa.competencia.replace(/[ /]/g, '-')}.pdf`)
        }}>
          Baixar PDF
        </Botao>
        <Botao tipo="secundario" onClick={async () => {
          await navigator.clipboard.writeText(texto)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1500)
        }}>
          {copiado ? 'copiado ✓' : 'Copiar texto'}
        </Botao>
        {iaDisponivel && (
          <Botao tipo="secundario" desabilitado={refinando} onClick={refinar}>
            {refinando ? 'Refinando…' : 'Refinar com IA'}
          </Botao>
        )}
        <Botao tipo="fantasma" onClick={() => { setTexto(minuta.texto); setRefinado(false) }}>
          restaurar minuta
        </Botao>
      </div>
      {erroIa && <p className="mt-2 text-xs text-atencao">{erroIa}</p>}
    </div>
  )
}
