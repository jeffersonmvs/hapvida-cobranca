import { useMemo, useState } from 'react'
import {
  formatarBRL, formatarData, porPrazo, ROTULO_MOTIVO, totalizar,
  type Glosa,
} from '@/domain'
import { repositorio, useDados } from '@/dados/contexto'
import { Botao, Cartao, Etiqueta, Secao, Vazio, classeInput } from '@/componentes/ui'
import { PainelRecurso } from '@/componentes/PainelRecurso'

/** Glosas (§8.4): prazo vencendo primeiro, sempre. */
export default function Glosas() {
  const { glosas, hoje, recarregar } = useDados()
  const [competencia, setCompetencia] = useState('todas')
  const [situacao, setSituacao] = useState<'todas' | 'abertas' | 'recursadas'>('abertas')
  const [recursoDe, setRecursoDe] = useState<Glosa | null>(null)

  const competencias = useMemo(
    () => Array.from(new Set(glosas.map((g) => g.competencia))).sort().reverse(),
    [glosas],
  )

  const filtradas = glosas.filter((g) => {
    if (competencia !== 'todas' && g.competencia !== competencia) return false
    if (situacao === 'abertas') return !g.recursada
    if (situacao === 'recursadas') return !!g.recursada
    return true
  })

  const totais = totalizar(glosas, hoje)
  const comPrazo = porPrazo(filtradas, hoje)

  const marcarRecursada = async (g: Glosa) => {
    await repositorio.atualizarGlosa({ ...g, recursada: true, valor_recurso: g.valor_glosado })
    await recarregar()
  }

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">Glosas</h2>

      <div className="grid grid-cols-2 gap-3">
        <Cartao titulo="Glosado" valor={formatarBRL(totais.glosado)} />
        <Cartao titulo="Em recurso" valor={formatarBRL(totais.em_recurso)} />
        <Cartao titulo="Recuperado" valor={formatarBRL(totais.recuperado)} tom="ok" />
        <Cartao titulo="Perdido" valor={formatarBRL(totais.perdido)} tom="critico"
          detalhe="indeferido ou prazo vencido sem recurso" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <select className={classeInput} value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}>
          <option value="todas">todas as competencias</option>
          {competencias.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={classeInput} value={situacao}
          onChange={(e) => setSituacao(e.target.value as typeof situacao)}>
          <option value="abertas">nao recursadas</option>
          <option value="recursadas">recursadas</option>
          <option value="todas">todas</option>
        </select>
      </div>

      {recursoDe && (
        <PainelRecurso glosa={recursoDe} aoFechar={() => setRecursoDe(null)} />
      )}

      <Secao titulo={`${comPrazo.length} glosa(s) — prazo vencendo primeiro`}>
        {comPrazo.length === 0 ? (
          <Vazio>Nenhuma glosa neste filtro.</Vazio>
        ) : (
          <ul className="space-y-2">
            {comPrazo.map(({ glosa: g, prazo, dias_restantes, vencido }) => (
              <li key={g.id} className={`rounded-xl border p-3 ${
                vencido ? 'border-critico/50 bg-critico/10'
                  : (dias_restantes ?? 99) <= 7 ? 'border-atencao/50 bg-atencao/10'
                  : 'border-line bg-surface'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs text-slate-400">{g.codigo_tuss}</span>
                      <Etiqueta tom="neutro">{g.competencia}</Etiqueta>
                      {g.justificativa_normalizada && (
                        <Etiqueta tom="ia">{ROTULO_MOTIVO[g.justificativa_normalizada]}</Etiqueta>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-300">{g.justificativa}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      demonstrativo {formatarData(g.data_demonstrativo)} · prazo{' '}
                      {prazo ? formatarData(prazo) : '—'}
                      {dias_restantes != null && (
                        <> · {vencido ? `venceu ha ${-dias_restantes} dia(s)` : `${dias_restantes} dia(s)`}</>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="tabular text-base font-semibold">{formatarBRL(g.valor_glosado)}</div>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Botao tipo="secundario" onClick={() => setRecursoDe(g)}>Gerar recurso</Botao>
                  {!g.recursada && (
                    <Botao tipo="fantasma" onClick={() => marcarRecursada(g)}>marcar recursada</Botao>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  )
}
