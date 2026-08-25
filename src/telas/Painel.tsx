import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  alertaDigitacaoSavi, alertasDeRecurso, alertaXml, calcularConsultas,
  calendarioEm, criticosAbertos, diffDias, exposicaoDoMes, formatarBRL,
  formatarData, formatarMes, mesDe, somar, ultimoDiaDoMes,
} from '@/domain'
import { repositorio, useDados } from '@/dados/contexto'
import { alertasDeTodos } from '@/dados/alertas'
import { Cartao, Etiqueta, Secao, Vazio } from '@/componentes/ui'
import { ListaAlertas } from '@/componentes/ListaAlertas'

/** Painel do mes (§8.3). */
export default function Painel() {
  const { atendimentos, consultas, glosas, documentos, tabela, hoje, recarregar } = useDados()
  const mes = mesDe(hoje)

  const doMes = useMemo(
    () => atendimentos.filter((a) => mesDe(a.atendimento.data) === mes),
    [atendimentos, mes],
  )

  const procs = doMes.flatMap((a) => a.procedimentos)
  const aFaturar = procs.filter((p) => (p.situacao ?? 'a_faturar') === 'a_faturar')

  const totalCobrar = somar(...procs.map((p) => p.valor_cobrado))
  const totalPrevisto = somar(...procs.map((p) => p.valor_previsto ?? 0))
  const consultasDoMes = consultas.filter((c) => mesDe(c.data) === mes)
  const resumoConsultas = calcularConsultas(consultasDoMes)

  const exposicao = exposicaoDoMes(aFaturar, tabela, hoje)

  const criticos = criticosAbertos(alertasDeTodos(doMes, tabela, hoje))
  const aguardandoRevisao = documentos.filter(
    (d) => d.extracao_status !== 'revisado' && d.extracao_status !== 'falhou',
  )

  const datas = new Map(
    doMes.flatMap((a) => a.procedimentos.map((p) => [p.id ?? '', a.atendimento.data] as const)),
  )
  const alertaSavi = alertaDigitacaoSavi(aFaturar, datas, hoje)
  const alertaLote = alertaXml(mes, aFaturar.length, hoje)
  const recursos = alertasDeRecurso(glosas, hoje)
  const diasRestantes = diffDias(hoje, ultimoDiaDoMes(mes))

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Competencia {formatarMes(mes)}</h2>
        <span className="text-xs text-slate-500">
          {diasRestantes >= 0 ? `${diasRestantes} dia(s) para o fim do mes` : ''}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Cartao titulo="Procedimentos" valor={procs.length}
          detalhe={`${aFaturar.length} ainda a faturar`}
          tom={aFaturar.length > 0 && diasRestantes <= 6 ? 'atencao' : 'neutro'} />
        <Cartao titulo="A cobrar" valor={formatarBRL(totalCobrar)} />
        <Cartao titulo="Previsto a receber" valor={formatarBRL(totalPrevisto)}
          detalhe={exposicao.exposto > 0 ? `exposicao de glosa ${formatarBRL(exposicao.exposto)}` : undefined}
          tom={exposicao.exposto > 0 ? 'atencao' : 'neutro'} />
        <Cartao titulo="Ambulatorio" valor={formatarBRL(resumoConsultas.valor)}
          detalhe={`${resumoConsultas.qtd_consultas} consultas · ${resumoConsultas.qtd_retornos} retornos`} />
      </div>

      {(alertaSavi || alertaLote || recursos.length > 0) && (
        <Secao titulo="Prazos">
          <div className="space-y-2">
            {[alertaSavi, alertaLote, ...recursos].filter(Boolean).map((a, i) => (
              <div key={i}
                className={`rounded-lg border p-3 ${
                  a!.severidade === 'critico'
                    ? 'border-critico/50 bg-critico/10'
                    : a!.severidade === 'atencao'
                      ? 'border-atencao/40 bg-atencao/10'
                      : 'border-line bg-surface'
                }`}>
                <div className="text-sm font-medium">{a!.titulo}</div>
                <div className="text-xs text-slate-300">{a!.mensagem}</div>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {aguardandoRevisao.length > 0 && (
        <Secao titulo="Documentos aguardando revisao">
          <Link to="/captura"
            className="block rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm">
            {aguardandoRevisao.length} documento(s) extraido(s) e nao confirmado(s).
            Nada vira faturavel sem sua confirmacao. ›
          </Link>
        </Secao>
      )}

      <Secao titulo={`Alertas criticos abertos (${criticos.length})`}>
        {criticos.length === 0
          ? <Vazio>Nenhum alerta critico no mes.</Vazio>
          : (
            <ListaAlertas
              alertas={criticos.slice(0, 6)}
              aoResolver={async (a) => {
                await repositorio.resolverAlerta(a, !a.resolvido)
                await recarregar()
              }}
            />
          )}
      </Secao>

      <Secao titulo="Calendario da competencia">
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {calendarioEm(mes, hoje).map((e) => (
            <li key={e.etapa} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{e.etapa}</span>
              <span className="flex items-center gap-2">
                <span className="tabular text-slate-400">{formatarData(e.vence_em)}</span>
                {e.dias_restantes < 0
                  ? <Etiqueta tom="neutro">passou</Etiqueta>
                  : e.dias_restantes <= 3
                    ? <Etiqueta tom="critico">{e.dias_restantes}d</Etiqueta>
                    : <Etiqueta tom="neutro">{e.dias_restantes}d</Etiqueta>}
              </span>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao titulo={`Atendimentos do mes (${doMes.length})`}
        acao={<Link to="/lancar" className="text-sm text-brand">+ lancar</Link>}>
        {doMes.length === 0 ? (
          <Vazio>Nenhum atendimento lancado neste mes.</Vazio>
        ) : (
          <ul className="space-y-2">
            {doMes.map((a) => {
              const criticosDoAt = criticosAbertos(alertasDeTodos([a], tabela, hoje))
              return (
                <li key={a.atendimento.id}>
                  <Link to={`/lancar/${a.atendimento.id}`}
                    className="flex items-center justify-between rounded-xl border border-line bg-surface p-3 hover:border-brand">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {a.paciente?.nome ?? 'sem paciente'}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {formatarData(a.atendimento.data)} · {a.atendimento.local} ·{' '}
                        {a.procedimentos.length} sitio(s)
                        {a.atendimento.classe === 'pqa' ? ' · PQA' : ''}
                      </span>
                    </span>
                    <span className="ml-2 flex shrink-0 items-center gap-2">
                      {criticosDoAt.length > 0 && (
                        <Etiqueta tom="critico">{criticosDoAt.length}</Etiqueta>
                      )}
                      <span className="tabular text-sm">
                        {formatarBRL(somar(...a.procedimentos.map((p) => p.valor_cobrado)))}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Secao>
    </div>
  )
}
