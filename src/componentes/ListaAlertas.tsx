import { useState } from 'react'
import type { Alerta } from '@/domain'
import { Etiqueta } from './ui'

/**
 * Alertas deterministicos e alertas de IA aparecem na mesma lista mas com
 * marca visual distinta: o medico precisa saber o que e regra e o que e
 * palpite de modelo (§11.2).
 */
export function ListaAlertas({ alertas, aoResolver }: {
  alertas: Alerta[]
  aoResolver?: (a: Alerta) => void
}) {
  if (alertas.length === 0) return null
  const ordem = { critico: 0, atencao: 1, info: 2 } as const
  const ordenados = [...alertas].sort(
    (a, b) => ordem[a.severidade] - ordem[b.severidade],
  )
  return (
    <ul className="space-y-2">
      {ordenados.map((a, i) => (
        <ItemAlerta key={a.id ?? i} alerta={a} aoResolver={aoResolver} />
      ))}
    </ul>
  )
}

function ItemAlerta({ alerta, aoResolver }: { alerta: Alerta; aoResolver?: (a: Alerta) => void }) {
  const [copiado, setCopiado] = useState(false)
  const daIa = alerta.origem === 'ia'
  const borda = alerta.severidade === 'critico'
    ? 'border-critico/50 bg-critico/10'
    : alerta.severidade === 'atencao'
      ? 'border-atencao/40 bg-atencao/10'
      : 'border-line bg-surface'

  const copiar = async () => {
    if (!alerta.sugestao) return
    await navigator.clipboard.writeText(alerta.sugestao)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  return (
    <li className={`rounded-lg border p-3 ${borda} ${daIa ? 'border-dashed border-l-4 border-l-ia' : ''} ${alerta.resolvido ? 'opacity-50' : ''}`}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <Etiqueta tom={alerta.severidade}>
          {alerta.severidade === 'critico' ? 'CRITICO' : alerta.severidade === 'atencao' ? 'ATENCAO' : 'INFO'}
        </Etiqueta>
        <Etiqueta tom={daIa ? 'ia' : 'neutro'}>
          {daIa ? 'sugestao da IA' : `regra ${alerta.regra}`}
        </Etiqueta>
      </div>
      <p className="text-sm leading-relaxed text-slate-200">{alerta.mensagem}</p>
      {alerta.sugestao && (
        <div className="mt-2 rounded border border-line bg-base/60 p-2">
          <p className="text-xs italic leading-relaxed text-slate-300">"{alerta.sugestao}"</p>
          <button onClick={copiar} className="mt-1 text-xs text-brand">
            {copiado ? 'copiado ✓' : 'copiar texto'}
          </button>
        </div>
      )}
      {aoResolver && (
        <button
          onClick={() => aoResolver(alerta)}
          className="mt-2 text-xs text-slate-400 underline"
        >
          {alerta.resolvido ? 'reabrir' : 'marcar como resolvido'}
        </button>
      )}
    </li>
  )
}
