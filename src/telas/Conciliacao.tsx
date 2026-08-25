import { useMemo, useState } from 'react'
import { conciliar, formatarBRL, formatarData, parsearRelatorio } from '@/domain'
import { useDados, useProcedimentos } from '@/dados/contexto'
import { Botao, Cartao, Secao, Vazio, classeInput } from '@/componentes/ui'

/**
 * Conciliacao (§8.8). Cruza o relatorio do Portal Medico com o banco por
 * senha. A terceira lista e a que paga o app: producao que nunca foi faturada.
 */
export default function Conciliacao() {
  const todos = useProcedimentos()
  const { tabela } = useDados()
  const [texto, setTexto] = useState('')
  const [tolerancia, setTolerancia] = useState(0)

  const linhas = useMemo(() => parsearRelatorio(texto), [texto])
  const resultado = useMemo(
    () => conciliar(linhas, todos.map((t) => t.procedimento), { tolerancia }),
    [linhas, todos, tolerancia],
  )

  const contexto = (senha: string) =>
    todos.find((t) => t.procedimento.senha === senha)

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold">Conciliacao</h2>
      <p className="mb-3 text-xs leading-relaxed text-slate-400">
        Cole o relatorio do Portal Medico (CSV, texto colado ou linhas soltas).
        O cruzamento e por senha.
      </p>

      <textarea
        className={`${classeInput} min-h-40 font-mono text-xs`}
        placeholder={'Senha;Codigo;Paciente;Data;Valor Apresentado;Valor Pago\n444555;31009115;...;10/03/2026;280,00;192,00'}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />

      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <span>Tolerancia de valor:</span>
        <input type="number" step="0.01" min="0" className={`${classeInput} w-28`}
          value={tolerancia} onChange={(e) => setTolerancia(Number(e.target.value))} />
        <Botao tipo="fantasma" onClick={() => setTexto('')}>limpar</Botao>
      </div>

      {linhas.length === 0 ? (
        <div className="mt-4"><Vazio>Nenhuma linha reconhecida ainda.</Vazio></div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Cartao titulo="Linhas lidas" valor={linhas.length}
              detalhe={formatarBRL(resultado.total_relatorio)} />
            <Cartao titulo="No banco" valor={todos.length}
              detalhe={formatarBRL(resultado.total_banco)} />
            <Cartao titulo="Conferem" valor={resultado.conferem.length} tom="ok" />
            <Cartao titulo="Divergem" valor={resultado.divergem.length}
              tom={resultado.divergem.length > 0 ? 'atencao' : 'neutro'} />
          </div>

          <Secao titulo={`Divergem no valor (${resultado.divergem.length})`}>
            {resultado.divergem.length === 0 ? <Vazio>Nada divergente.</Vazio> : (
              <ul className="space-y-2">
                {resultado.divergem.map((d) => (
                  <li key={d.senha} className="rounded-xl border border-atencao/40 bg-atencao/10 p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="font-mono text-xs">senha {d.senha} · {d.banco.codigo_tuss}</span>
                      <span className="tabular text-atencao">{formatarBRL(d.diferenca)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-300">
                      banco {formatarBRL(d.banco.valor_cobrado)} · relatorio{' '}
                      {formatarBRL(d.relatorio.valor_apresentado ?? d.relatorio.valor_pago)}
                      {d.relatorio.justificativa && ` · ${d.relatorio.justificativa}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao titulo={`Nao encontrados no relatorio (${resultado.nao_encontrados_no_relatorio.length})`}>
            <p className="mb-2 text-xs text-slate-400">
              Producao lancada aqui que a operadora nao mostra. E aqui que aparece o
              que nunca foi faturado.
            </p>
            {resultado.nao_encontrados_no_relatorio.length === 0 ? <Vazio>Nada faltando.</Vazio> : (
              <ul className="space-y-2">
                {resultado.nao_encontrados_no_relatorio.map((p) => {
                  const ctx = contexto(p.senha)
                  return (
                    <li key={p.id ?? p.senha} className="rounded-xl border border-critico/40 bg-critico/10 p-3 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate">{ctx?.paciente?.nome ?? ''}</span>
                          <span className="block font-mono text-xs text-slate-400">
                            senha {p.senha} · {p.codigo_tuss} ·{' '}
                            {ctx ? formatarData(ctx.atendimento.data) : ''}
                          </span>
                          <span className="block text-xs text-slate-400">
                            {tabela.find((t) => t.codigo_tuss === p.codigo_tuss)?.descricao}
                          </span>
                        </span>
                        <span className="tabular shrink-0">{formatarBRL(p.valor_cobrado)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Secao>

          <Secao titulo={`Nao encontrados no banco (${resultado.nao_encontrados_no_banco.length})`}>
            <p className="mb-2 text-xs text-slate-400">
              Linhas do relatorio sem correspondencia aqui — producao paga que nao
              foi lancada no app.
            </p>
            {resultado.nao_encontrados_no_banco.length === 0 ? <Vazio>Nada sobrando.</Vazio> : (
              <ul className="space-y-2">
                {resultado.nao_encontrados_no_banco.map((l, i) => (
                  <li key={i} className="rounded-xl border border-line bg-surface p-3 text-xs">
                    <div className="font-mono">senha {l.senha} · {l.codigo_tuss ?? '—'}</div>
                    <div className="mt-0.5 text-slate-400">{l.linha_original}</div>
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao titulo={`Conferem (${resultado.conferem.length})`}>
            {resultado.conferem.length === 0 ? <Vazio>Nada conferido.</Vazio> : (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-ok/30 bg-surface">
                {resultado.conferem.map((d) => (
                  <li key={d.senha} className="flex justify-between px-4 py-2 text-xs">
                    <span className="font-mono">senha {d.senha} · {d.banco.codigo_tuss}</span>
                    <span className="tabular">{formatarBRL(d.banco.valor_cobrado)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </>
      )}
    </div>
  )
}
