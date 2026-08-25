import { useMemo, useState } from 'react'
import { formatarBRL, formatarData, mesDe } from '@/domain'
import { repositorio, useDados } from '@/dados/contexto'
import { Cartao, Secao, Vazio, classeInput } from '@/componentes/ui'

/**
 * Digitacao assistida no SAVI (§10, nivel 2).
 *
 * Nao robotiza o navegador: mostra os campos na ordem do formulario do portal,
 * cada um com botao de copiar, e um checkbox "digitado" por procedimento que
 * grava situacao = faturado com data e hora. Assim o "Relatorio de Pendencias"
 * do SAVI vira algo conferivel.
 */
export default function Savi() {
  const { atendimentos, tabela, hoje, recarregar } = useDados()
  const [mes, setMes] = useState(mesDe(hoje))
  const [salvando, setSalvando] = useState<string | null>(null)

  const linhas = useMemo(
    () =>
      atendimentos
        .filter((a) => mesDe(a.atendimento.data) === mes)
        .flatMap((a) =>
          a.procedimentos.map((p) => ({
            atendimento: a.atendimento,
            paciente: a.paciente,
            procedimento: p,
            descricao: tabela.find((t) => t.codigo_tuss === p.codigo_tuss)?.descricao ?? '',
          })),
        )
        .sort((x, y) => (x.atendimento.data < y.atendimento.data ? -1 : 1)),
    [atendimentos, mes, tabela],
  )

  const meses = Array.from(new Set(atendimentos.map((a) => mesDe(a.atendimento.data)))).sort().reverse()
  const digitados = linhas.filter((l) => (l.procedimento.situacao ?? 'a_faturar') !== 'a_faturar')

  const marcar = async (id: string, digitado: boolean) => {
    setSalvando(id)
    try {
      await repositorio.atualizarSituacao(
        [id],
        digitado ? 'faturado' : 'a_faturar',
        new Date().toISOString(),
      )
      await recarregar()
    } finally {
      setSalvando(null)
    }
  }

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold">Digitacao no SAVI</h2>
      <p className="mb-3 text-xs leading-relaxed text-slate-400">
        Campos na ordem do formulario do portal. Marque "digitado" conforme o
        escritorio lanca — o que sobra desmarcado e exatamente o que pode virar
        glosa automatica no fim do mes.
      </p>

      <select className={classeInput} value={mes} onChange={(e) => setMes(e.target.value)}>
        {(meses.includes(mes) ? meses : [mes, ...meses]).map((m) => <option key={m}>{m}</option>)}
      </select>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Cartao titulo="Digitados" valor={`${digitados.length}/${linhas.length}`} />
        <Cartao titulo="Pendentes" valor={linhas.length - digitados.length}
          tom={linhas.length - digitados.length > 0 ? 'atencao' : 'ok'} />
      </div>

      <Secao titulo="Procedimentos">
        {linhas.length === 0 ? (
          <Vazio>Nada lancado nesta competencia.</Vazio>
        ) : (
          <ul className="space-y-3">
            {linhas.map((l) => {
              const p = l.procedimento
              const digitado = (p.situacao ?? 'a_faturar') !== 'a_faturar'
              const campos: Array<[string, string]> = [
                ['Data', formatarData(l.atendimento.data)],
                ['Carteira', l.paciente?.carteira ?? ''],
                ['Beneficiario', l.paciente?.nome ?? ''],
                ['Atendimento/guia', l.atendimento.numero],
                ['Senha', p.senha],
                ['Codigo', p.codigo_tuss],
                ['Descricao', l.descricao],
                ['Hora inicial', l.atendimento.hora_inicio ?? ''],
                ['Hora final', l.atendimento.hora_fim ?? ''],
                ['Grau de participacao', '00 (cirurgiao)'],
                ['Valor', formatarBRL(p.valor_cobrado)],
              ]
              return (
                <li key={p.id} className={`rounded-xl border p-3 ${digitado ? 'border-ok/40 bg-ok/5' : 'border-line bg-surface'}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {l.paciente?.nome} · {p.codigo_tuss}
                    </span>
                    <label className="flex shrink-0 items-center gap-2 text-xs">
                      <input type="checkbox" className="h-4 w-4 accent-brand"
                        checked={digitado}
                        disabled={salvando === p.id}
                        onChange={(e) => p.id && marcar(p.id, e.target.checked)} />
                      digitado
                    </label>
                  </div>
                  <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                    {campos.map(([rotulo, valor]) => (
                      <li key={rotulo} className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                        <span className="shrink-0 text-slate-500">{rotulo}</span>
                        <span className="min-w-0 flex-1 truncate text-right">{valor || '—'}</span>
                        <button
                          className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[11px] text-brand"
                          onClick={() => navigator.clipboard.writeText(valor)}
                        >
                          copiar
                        </button>
                      </li>
                    ))}
                  </ul>
                  {p.faturado_em && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      marcado em {new Date(p.faturado_em).toLocaleString('pt-BR')}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Secao>
    </div>
  )
}
