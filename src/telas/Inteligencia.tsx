import { useMemo } from 'react'
import {
  agruparPorAssinatura, exposicaoDoMes, formatarBRL, formatarData, formatarMes,
  mesDe, padroesNovos, rankingPorCodigo, ROTULO_MOTIVO, serieTemporal,
} from '@/domain'
import { useDados, useProcedimentos } from '@/dados/contexto'
import { Cartao, Etiqueta, Secao, Vazio } from '@/componentes/ui'

/**
 * Inteligencia de glosa (§8.5 / §11.3).
 * Tudo nesta tela e estatistica deterministica sobre o banco. A IA so entra
 * para preencher a justificativa normalizada (etiqueta roxa) - o agrupamento
 * e por assinatura e nao depende do texto da operadora.
 */
export default function Inteligencia() {
  const { glosas, tabela, hoje } = useDados()
  const todos = useProcedimentos()

  const realizados = todos.map((t) => t.procedimento)
  const grupos = useMemo(() => agruparPorAssinatura(glosas), [glosas])
  const novos = useMemo(() => padroesNovos(grupos, hoje), [grupos, hoje])
  const ranking = useMemo(() => rankingPorCodigo(glosas, realizados), [glosas, realizados])

  const aFaturarDoMes = todos
    .filter((t) => mesDe(t.atendimento.data) === mesDe(hoje))
    .map((t) => t.procedimento)
    .filter((p) => (p.situacao ?? 'a_faturar') === 'a_faturar')
  const exposicao = exposicaoDoMes(aFaturarDoMes, tabela, hoje)

  const naoNormalizadas = glosas.filter((g) => !g.justificativa_normalizada).length

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">Inteligencia de glosa</h2>

      <div className="grid grid-cols-2 gap-3">
        <Cartao titulo="Assinaturas" valor={grupos.length}
          detalhe="agrupadas por codigo + valor, nao por texto" />
        <Cartao titulo="Padroes novos" valor={novos.length}
          tom={novos.length > 0 ? 'critico' : 'neutro'}
          detalhe="3+ em 60 dias sem recurso" />
        <Cartao titulo="Exposicao do mes" valor={formatarBRL(exposicao.exposto)}
          tom={exposicao.exposto > 0 ? 'atencao' : 'neutro'}
          detalhe={`de ${formatarBRL(exposicao.total_a_faturar)} a faturar`} />
        <Cartao titulo="Sem taxonomia" valor={naoNormalizadas}
          detalhe="justificativas ainda nao normalizadas" />
      </div>

      {novos.length > 0 && (
        <Secao titulo="Padrao novo — atencao">
          <ul className="space-y-2">
            {novos.map((g) => (
              <li key={g.assinatura} className="rounded-xl border border-critico/50 bg-critico/10 p-3">
                <div className="text-sm">
                  <strong className="font-mono">{g.codigo_tuss}</strong> glosado{' '}
                  {g.ocorrencias}x em {formatarBRL(g.valor_glosado)} —{' '}
                  {g.nao_recursadas} sem recurso.
                </div>
                <div className="mt-1 text-xs text-slate-300">
                  Exposicao acumulada {formatarBRL(g.valor_total)}.
                </div>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao titulo="Assinaturas de glosa">
        {grupos.length === 0 ? (
          <Vazio>Nenhuma glosa registrada.</Vazio>
        ) : (
          <ul className="space-y-3">
            {grupos.map((g) => {
              const serie = serieTemporal(g)
              const maximo = Math.max(...serie.map((s) => s.ocorrencias), 1)
              return (
                <li key={g.assinatura} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-sm">{g.codigo_tuss}</span>
                        <Etiqueta tom="neutro">{formatarBRL(g.valor_glosado)} por caso</Etiqueta>
                        {g.motivos.map((m) => (
                          <Etiqueta key={m} tom="ia">{ROTULO_MOTIVO[m]}</Etiqueta>
                        ))}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {g.ocorrencias} ocorrencia(s) · {g.nao_recursadas} sem recurso ·{' '}
                        {g.competencias.length} competencia(s)
                      </div>
                    </div>
                    <div className="tabular shrink-0 text-right text-base font-semibold">
                      {formatarBRL(g.valor_total)}
                    </div>
                  </div>

                  <div className="mt-3 flex items-end gap-1">
                    {serie.map((s) => (
                      <div key={s.mes} className="flex flex-1 flex-col items-center gap-1">
                        <div className="w-full rounded-t bg-brand/70"
                          style={{ height: `${8 + (s.ocorrencias / maximo) * 40}px` }} />
                        <span className="text-[10px] text-slate-500">{formatarMes(s.mes).slice(0, 2)}</span>
                      </div>
                    ))}
                  </div>

                  {g.textos.length > 1 && (
                    <div className="mt-3 rounded-lg border border-atencao/40 bg-atencao/10 p-2 text-xs">
                      <strong>A operadora mudou o texto, a glosa e a mesma.</strong>
                      {g.mudancas_de_texto.map((m, i) => (
                        <div key={i} className="mt-1 text-slate-300">
                          "{m.de}" → "{m.para}" em {m.competencia}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-slate-500">
                    de {formatarData(g.primeira)} a {formatarData(g.ultima)}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Secao>

      <Secao titulo="Ranking por codigo">
        {ranking.length === 0 ? (
          <Vazio>Sem dados.</Vazio>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {ranking.map((l) => (
              <li key={l.codigo_tuss} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="block font-mono text-xs text-slate-400">{l.codigo_tuss}</span>
                  <span className="block text-xs text-slate-400">
                    {l.ocorrencias} glosa(s) · {l.nao_recursadas} sem recurso
                    {l.taxa_glosa != null
                      ? ` · taxa ${(l.taxa_glosa * 100).toFixed(0)}%`
                      : ` · ${l.producao_conhecida} lancamento(s) no app`}
                  </span>
                </span>
                <span className="tabular font-semibold">{formatarBRL(l.valor_total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {exposicao.itens.length > 0 && (
        <Secao titulo="Exposicao do mes corrente">
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-atencao/40 bg-surface">
            {exposicao.itens.map((i) => (
              <li key={i.codigo_tuss} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-mono text-xs">{i.codigo_tuss} × {i.quantidade}</span>
                <span className="tabular text-atencao">{formatarBRL(i.exposto)}</span>
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </div>
  )
}
