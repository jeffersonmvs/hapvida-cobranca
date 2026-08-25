import { useMemo, useState } from 'react'
import {
  competencia, formatarBRL, formatarData, formatarMes, gerarLote, mesDe,
  paraLatin1, PendenciasDoLote, somar, validarLote,
  type LoteEntrada, type Pendencia,
} from '@/domain'
import { repositorio, useDados } from '@/dados/contexto'
import { alertasDeTodos } from '@/dados/alertas'
import { Botao, Cartao, Etiqueta, Secao, Vazio, classeInput } from '@/componentes/ui'

/**
 * Faturamento (§10, nivel 1). O canal legitimo de automacao com a operadora e
 * o lote XML TISS - e so isso que este app gera. Nada de login automatizado
 * nem scraping de portal.
 */
export default function Faturamento() {
  const { atendimentos, tabela, config, lotes, glosas, consultas, hoje, recarregar } = useDados()
  const [mes, setMes] = useState(mesDe(hoje))
  const [erro, setErro] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)

  const doMes = useMemo(
    () => atendimentos.filter((a) => mesDe(a.atendimento.data) === mes),
    [atendimentos, mes],
  )

  const aFaturar = doMes.filter((a) =>
    a.procedimentos.some((p) => (p.situacao ?? 'a_faturar') !== 'pago'),
  )

  const criticosAbertos = alertasDeTodos(doMes, tabela, hoje).filter(
    (x) => x.severidade === 'critico' && !x.resolvido,
  )

  const entradaPrevia: LoteEntrada = {
    config,
    tabela,
    numero_lote: 0,
    sequencial_transacao: 0,
    data_registro: hoje,
    hora_registro: '00:00',
    guias: aFaturar.map((a, i) => ({
      atendimento: a.atendimento,
      paciente: a.paciente ?? { nome: '' },
      procedimentos: a.procedimentos,
      numero_guia: i + 1,
    })),
  }

  const pendencias: Pendencia[] = useMemo(
    () => [
      ...validarLote(entradaPrevia),
      ...criticosAbertos.map((a) => ({
        campo: 'alerta',
        mensagem: `Alerta critico aberto (${a.regra}): ${a.mensagem}`,
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aFaturar, config, tabela, criticosAbertos],
  )

  const valorTotal = somar(
    ...aFaturar.flatMap((a) => a.procedimentos.map((p) => p.valor_cobrado)),
  )

  const meses = Array.from(new Set(atendimentos.map((a) => mesDe(a.atendimento.data)))).sort().reverse()

  const gerar = async () => {
    setGerando(true)
    setErro(null)
    try {
      const numeroLote = await repositorio.proximoNumero('lote', 1)
      const primeiraGuia = await repositorio.proximoNumero('guia', aFaturar.length)
      const entrada: LoteEntrada = {
        ...entradaPrevia,
        numero_lote: numeroLote,
        sequencial_transacao: numeroLote,
        hora_registro: new Date().toTimeString().slice(0, 8),
        guias: aFaturar.map((a, i) => ({
          atendimento: a.atendimento,
          paciente: a.paciente ?? { nome: '' },
          procedimentos: a.procedimentos,
          numero_guia: primeiraGuia + i,
        })),
      }
      const lote = gerarLote(entrada)
      const bytes = paraLatin1(lote.xml)
      const { baixarBlob } = await import('@/exportar/pdf')
      baixarBlob(
        new Blob([bytes as unknown as BlobPart], { type: 'application/xml' }),
        `TISS_040300_lote_${lote.numero_lote}_${mes}.xml`,
      )
      await repositorio.registrarLote(
        {
          numero_lote: lote.numero_lote,
          competencia: competencia(mes),
          guia_inicial: primeiraGuia,
          guia_final: primeiraGuia + aFaturar.length - 1,
          qtd_guias: lote.qtd_guias,
          valor_total: lote.valor_total,
          hash_documento: lote.hash,
          gerado_em: new Date().toISOString(),
        },
        aFaturar.map((a) => a.atendimento.id ?? '').filter(Boolean),
      )
      await recarregar()
    } catch (e) {
      setErro(e instanceof PendenciasDoLote ? e.message : e instanceof Error ? e.message : 'Falha ao gerar o lote.')
    } finally {
      setGerando(false)
    }
  }

  const pdfDoDia = async (data: string) => {
    const { gerarPdfProducao } = await import('@/exportar/pdfProducao')
    await gerarPdfProducao({
      data,
      atendimentos: atendimentos.filter((a) => a.atendimento.data === data),
      acumuladoDoMes: atendimentos,
      tabela,
      config,
    })
  }

  const dias = Array.from(new Set(doMes.map((a) => a.atendimento.data))).sort().reverse()

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">Faturamento</h2>

      <select className={classeInput} value={mes} onChange={(e) => setMes(e.target.value)}>
        {(meses.includes(mes) ? meses : [mes, ...meses]).map((m) => (
          <option key={m} value={m}>{formatarMes(m)}</option>
        ))}
      </select>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Cartao titulo="Guias no lote" valor={aFaturar.length} />
        <Cartao titulo="Valor total" valor={formatarBRL(valorTotal)} />
        <Cartao titulo="Pendencias" valor={pendencias.length}
          tom={pendencias.length > 0 ? 'critico' : 'ok'} />
        <Cartao titulo="Proximo lote"
          valor={lotes.length > 0 ? lotes[0].numero_lote + 1 : '—'}
          detalhe={`${lotes.length} lote(s) gerado(s)`} />
      </div>

      <Secao titulo="Pendencias que impedem o fechamento">
        {pendencias.length === 0 ? (
          <div className="rounded-xl border border-ok/40 bg-ok/10 p-4 text-sm text-ok">
            Lote pronto para fechar.
          </div>
        ) : (
          <ul className="space-y-2">
            {pendencias.map((p, i) => (
              <li key={i} className="rounded-lg border border-critico/40 bg-critico/10 p-3 text-sm">
                <Etiqueta tom="critico">{p.campo}</Etiqueta>
                <p className="mt-1 text-slate-200">{p.mensagem}</p>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {erro && (
        <div className="mt-3 rounded-lg border border-critico/40 bg-critico/10 p-3 text-sm text-critico">
          {erro}
        </div>
      )}

      <Secao titulo="Gerar">
        <div className="flex flex-wrap gap-2">
          <Botao onClick={gerar} desabilitado={pendencias.length > 0 || gerando || aFaturar.length === 0}>
            {gerando ? 'Gerando…' : 'Gerar lote TISS 04.03.00'}
          </Botao>
          <Botao tipo="secundario"
            onClick={async () => {
              const { gerarPlanilha } = await import('@/exportar/planilha')
              gerarPlanilha({ atendimentos: doMes, tabela, glosas, consultas, config, mes })
            }}>
            Planilha XLSX
          </Botao>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          O XML sai pronto para upload manual em portalprestador.hapvidalabs.net.
          O app nao faz login nem envia sozinho: portal de operadora costuma
          proibir acesso automatizado em contrato e a cobranca enviada e
          responsabilidade do CRM que assina.
        </p>
      </Secao>

      <Secao titulo="PDF de producao por dia">
        {dias.length === 0 ? (
          <Vazio>Nenhum dia de cirurgia neste mes.</Vazio>
        ) : (
          <ul className="space-y-2">
            {dias.map((d) => (
              <li key={d} className="flex items-center justify-between rounded-xl border border-line bg-surface p-3 text-sm">
                <span>
                  {formatarData(d)}
                  <span className="ml-2 text-xs text-slate-400">
                    {doMes.filter((a) => a.atendimento.data === d).length} atendimento(s)
                  </span>
                </span>
                <Botao tipo="secundario" onClick={() => pdfDoDia(d)}>PDF</Botao>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Historico de lotes">
        {lotes.length === 0 ? (
          <Vazio>Nenhum lote gerado ainda.</Vazio>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {lotes.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="block">Lote {l.numero_lote} · {l.competencia}</span>
                  <span className="block text-xs text-slate-400">
                    guias {l.guia_inicial}–{l.guia_final} · {l.qtd_guias} guia(s)
                  </span>
                </span>
                <span className="tabular">{formatarBRL(l.valor_total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  )
}
