import type { ReactNode } from 'react'
import type { Confianca, Severidade } from '@/domain'

export function Cartao({ titulo, valor, detalhe, tom = 'neutro' }: {
  titulo: string
  valor: ReactNode
  detalhe?: ReactNode
  tom?: 'neutro' | 'ok' | 'atencao' | 'critico'
}) {
  const cor = {
    neutro: 'border-line',
    ok: 'border-ok/40',
    atencao: 'border-atencao/50',
    critico: 'border-critico/60',
  }[tom]
  return (
    <div className={`rounded-xl border ${cor} bg-surface p-4`}>
      <div className="text-xs uppercase tracking-wide text-slate-400">{titulo}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-slate-400">{detalhe}</div>}
    </div>
  )
}

export function Secao({ titulo, acao, children }: {
  titulo: string
  acao?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  )
}

export function Botao({
  children, onClick, tipo = 'primario', submit, desabilitado, className = '',
}: {
  children: ReactNode
  onClick?: () => void
  tipo?: 'primario' | 'secundario' | 'perigo' | 'fantasma'
  submit?: boolean
  desabilitado?: boolean
  className?: string
}) {
  const estilos = {
    primario: 'bg-brand text-white hover:bg-brand/90',
    secundario: 'bg-surface2 text-slate-100 hover:bg-line border border-line',
    perigo: 'bg-critico/90 text-white hover:bg-critico',
    fantasma: 'text-slate-300 hover:text-white',
  }[tipo]
  return (
    <button
      type={submit ? 'submit' : 'button'}
      onClick={onClick}
      disabled={desabilitado}
      className={`rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${estilos} ${className}`}
    >
      {children}
    </button>
  )
}

export function Campo({ rotulo, children, dica }: {
  rotulo: string
  children: ReactNode
  dica?: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
        {rotulo}
      </span>
      {children}
      {dica && <span className="mt-1 block text-xs text-slate-500">{dica}</span>}
    </label>
  )
}

export const classeInput =
  'w-full rounded-lg border border-line bg-surface2 px-3 py-2.5 text-base ' +
  'text-slate-100 outline-none placeholder:text-slate-500 focus:border-brand'

export function SeloConfianca({ confianca }: { confianca: Confianca | 'fora_da_tabela' }) {
  const mapa: Record<string, [string, string]> = {
    confirmado: ['Confirmado', 'bg-ok/15 text-ok border-ok/30'],
    provavel: ['Provavel', 'bg-atencao/15 text-atencao border-atencao/30'],
    a_confirmar: ['A confirmar', 'bg-slate-500/15 text-slate-300 border-slate-500/30'],
    fora_da_tabela: ['Fora da tabela', 'bg-critico/15 text-critico border-critico/30'],
  }
  const [texto, cor] = mapa[confianca] ?? mapa.a_confirmar
  return <span className={`rounded border px-1.5 py-0.5 text-[11px] ${cor}`}>{texto}</span>
}

export function Etiqueta({ children, tom = 'neutro' }: { children: ReactNode; tom?: Severidade | 'neutro' | 'ia' }) {
  const cor = {
    critico: 'bg-critico/15 text-critico border-critico/30',
    atencao: 'bg-atencao/15 text-atencao border-atencao/30',
    info: 'bg-brand/15 text-brand border-brand/30',
    neutro: 'bg-surface2 text-slate-300 border-line',
    ia: 'bg-ia/15 text-ia border-ia/40',
  }[tom]
  return <span className={`rounded border px-1.5 py-0.5 text-[11px] ${cor}`}>{children}</span>
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface/40 p-6 text-center text-sm text-slate-400">
      {children}
    </div>
  )
}
