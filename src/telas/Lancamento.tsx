import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  buscar, calcularAtendimento, formatarBRL, hojeISO, LOCAIS, PLANOS,
  resolverValor, rodarChecklist, vigentesEm,
  type Alerta, type Atendimento, type Paciente, type ProcedimentoRealizado,
} from '@/domain'
import { repositorio, useDados } from '@/dados/contexto'
import { Botao, Campo, classeInput, Secao, SeloConfianca, Vazio } from '@/componentes/ui'
import { ListaAlertas } from '@/componentes/ListaAlertas'
import { useAnaliseRisco } from '@/ai/hooks'

const ANESTESIAS = ['geral', 'raqui', 'local', 'local+sedacao']

type Rascunho = ProcedimentoRealizado & { chave: string }

let seq = 0
const novaChave = () => `s${++seq}`

const linhaVazia = (): Rascunho => ({
  chave: novaChave(),
  codigo_tuss: '',
  senha: '',
  valor_cobrado: 0,
  descricao_cirurgica: '',
  autorizado_na_guia: true,
  tela_autorizada: false,
  tela_utilizada: false,
  cirurgiao_principal: true,
  decisao_intraoperatoria: false,
  situacao: 'a_faturar',
  origem: 'manual',
})

/**
 * Lancamento manual rapido (§8.2). Campos na ordem do boletim.
 * O checklist roda a cada tecla - o alerta aparece ANTES de fechar a tela.
 */
export default function Lancamento() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { tabela, pacientes, atendimentos, hoje, recarregar } = useDados()
  const existente = atendimentos.find((a) => a.atendimento.id === id)

  const [at, setAt] = useState<Atendimento>(
    existente?.atendimento ?? {
      numero: '', data: hojeISO(), local: LOCAIS[0], classe: 'centro_cirurgico',
      plano: 'HAPVIDA', tipo_anestesia: 'raqui', acomodacao: 'enfermaria',
    },
  )
  const [nomePaciente, setNomePaciente] = useState(existente?.paciente?.nome ?? '')
  const [carteira, setCarteira] = useState(existente?.paciente?.carteira ?? '')
  const [linhas, setLinhas] = useState<Rascunho[]>(
    existente?.procedimentos.map((p) => ({ ...p, chave: novaChave() })) ?? [linhaVazia()],
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const ia = useAnaliseRisco()

  const vigentes = useMemo(() => vigentesEm(tabela, at.data), [tabela, at.data])

  const calculo = useMemo(
    () => calcularAtendimento(linhas, tabela, at.data),
    [linhas, tabela, at.data],
  )

  const alertas: Alerta[] = useMemo(
    () =>
      rodarChecklist({
        atendimento: at,
        procedimentos: linhas,
        tabela,
        hoje,
      }),
    [at, linhas, tabela, hoje],
  )

  const foraDaTabela = linhas.filter(
    (l) => l.codigo_tuss && !vigentes.some((v) => v.codigo_tuss === l.codigo_tuss),
  )

  const podeSalvar =
    at.numero.trim() !== '' &&
    nomePaciente.trim() !== '' &&
    linhas.length > 0 &&
    linhas.every((l) => l.codigo_tuss) &&
    foraDaTabela.length === 0

  const alterar = (chave: string, patch: Partial<Rascunho>) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...patch } : l)))

  const escolherCodigo = (chave: string, codigo: string) => {
    const r = resolverValor(tabela, codigo, at.data)
    if (!r.ok) {
      alterar(chave, { codigo_tuss: codigo, valor_cobrado: 0 })
      return
    }
    alterar(chave, {
      codigo_tuss: codigo,
      valor_cobrado: r.valor_cobrar,
      valor_previsto: r.valor_previsto,
      tela_autorizada: r.procedimento.exige_tela ?? false,
    })
  }

  /** Duplica a linha mantendo paciente e atendimento, mas EXIGINDO senha nova. */
  const outroSitio = () =>
    setLinhas((ls) => [
      ...ls,
      { ...linhaVazia(), descricao_cirurgica: '' },
    ])

  const salvar = async () => {
    setSalvando(true)
    setErro(null)
    try {
      const paciente: Paciente =
        pacientes.find((p) => p.nome.toUpperCase() === nomePaciente.trim().toUpperCase()) ?? {
          nome: nomePaciente.trim().toUpperCase(),
          carteira: carteira || null,
        }
      await repositorio.salvarAtendimento({
        atendimento: { ...at, numero: at.numero.trim() },
        paciente: { ...paciente, carteira: carteira || paciente.carteira || null },
        procedimentos: linhas.map(({ chave: _c, ...p }) => p),
        alertas,
      })
      await recarregar()
      navegar('/')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">
        {existente ? 'Editar atendimento' : 'Lancamento rapido'}
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data">
          <input type="date" className={classeInput} value={at.data}
            onChange={(e) => setAt({ ...at, data: e.target.value })} />
        </Campo>
        <Campo rotulo="Local">
          <select className={classeInput} value={at.local ?? ''}
            onChange={(e) => setAt({ ...at, local: e.target.value })}>
            {LOCAIS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Campo>
      </div>

      <Campo rotulo="Paciente" dica="Digite para buscar; nome novo e criado ao salvar.">
        <input className={classeInput} list="lista-pacientes" value={nomePaciente}
          placeholder="NOME COMPLETO"
          onChange={(e) => {
            const v = e.target.value
            setNomePaciente(v)
            const achado = pacientes.find((p) => p.nome === v)
            if (achado?.carteira) setCarteira(achado.carteira)
          }} />
        <datalist id="lista-pacientes">
          {pacientes.map((p) => <option key={p.id} value={p.nome} />)}
        </datalist>
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Carteira">
          <input className={classeInput} inputMode="numeric" value={carteira ?? ''}
            onChange={(e) => setCarteira(e.target.value)} />
        </Campo>
        <Campo rotulo="No do atendimento">
          <input className={classeInput} inputMode="numeric" value={at.numero}
            onChange={(e) => setAt({ ...at, numero: e.target.value })} />
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Hora inicio">
          <input type="time" className={classeInput} value={at.hora_inicio ?? ''}
            onChange={(e) => setAt({ ...at, hora_inicio: e.target.value })} />
        </Campo>
        <Campo rotulo="Hora fim">
          <input type="time" className={classeInput} value={at.hora_fim ?? ''}
            onChange={(e) => setAt({ ...at, hora_fim: e.target.value })} />
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Anestesia">
          <select className={classeInput} value={at.tipo_anestesia ?? ''}
            onChange={(e) => setAt({ ...at, tipo_anestesia: e.target.value })}>
            {ANESTESIAS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Sala">
          <select className={classeInput} value={at.classe ?? 'centro_cirurgico'}
            onChange={(e) => setAt({ ...at, classe: e.target.value as Atendimento['classe'] })}>
            <option value="centro_cirurgico">Centro cirurgico</option>
            <option value="pqa">Sala PQA</option>
          </select>
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Plano">
          <select className={classeInput} value={at.plano ?? 'HAPVIDA'}
            onChange={(e) => setAt({ ...at, plano: e.target.value })}>
            {PLANOS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Validade da autorizacao">
          <input type="date" className={classeInput} value={at.validade_autorizacao ?? ''}
            onChange={(e) => setAt({ ...at, validade_autorizacao: e.target.value || null })} />
        </Campo>
      </div>

      <Secao
        titulo={`Sitios / procedimentos (${linhas.length})`}
        acao={<Botao tipo="secundario" onClick={outroSitio}>+ outro sitio</Botao>}
      >
        <div className="space-y-4">
          {linhas.map((l, i) => (
            <LinhaProcedimento
              key={l.chave}
              linha={l}
              indice={i}
              vigentes={vigentes}
              tabela={tabela}
              data={at.data}
              aoAlterar={(patch) => alterar(l.chave, patch)}
              aoEscolherCodigo={(c) => escolherCodigo(l.chave, c)}
              aoRemover={linhas.length > 1 ? () => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave)) : undefined}
            />
          ))}
        </div>
      </Secao>

      {foraDaTabela.length > 0 && (
        <div className="rounded-lg border border-critico/50 bg-critico/10 p-3 text-sm text-critico">
          <strong>Salvamento bloqueado.</strong>{' '}
          {foraDaTabela.map((l) => l.codigo_tuss).join(', ')} nao consta na tabela de
          honorarios vigente. Cadastre o codigo e o valor em Tabela de honorarios -
          o app nao estima valor de procedimento.
        </div>
      )}

      <Secao titulo="Total do atendimento">
        <div className="rounded-xl border border-line bg-surface p-4">
          <Linha rotulo="A cobrar" valor={formatarBRL(calculo.total_cobrado)} destaque />
          <Linha rotulo="Previsto a receber" valor={formatarBRL(calculo.total_previsto)} />
          {calculo.total_glosa_recorrente > 0 && (
            <Linha rotulo="Historico de glosa" valor={formatarBRL(calculo.total_glosa_recorrente)} tom="atencao" />
          )}
          {calculo.sem_previsao.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Sem previsao para {calculo.sem_previsao.join(', ')} — a operadora ainda
              nao liquidou esse codigo.
            </p>
          )}
          {calculo.avisos.map((a) => (
            <p key={a} className="mt-2 text-xs text-atencao">{a}</p>
          ))}
        </div>
      </Secao>

      <Secao
        titulo={`Checklist antiglosa (${alertas.length + ia.alertas.length})`}
        acao={
          ia.disponivel ? (
            <button
              className="text-sm text-ia disabled:opacity-40"
              disabled={ia.rodando || linhas.every((l) => !l.codigo_tuss)}
              onClick={() => ia.analisar(linhas, tabela, at.data)}
            >
              {ia.rodando ? 'analisando…' : 'analisar com IA'}
            </button>
          ) : undefined
        }
      >
        {alertas.length + ia.alertas.length === 0 ? (
          <Vazio>Nenhum alerta. Pode faturar.</Vazio>
        ) : (
          <ListaAlertas alertas={[...alertas, ...ia.alertas]} />
        )}
        {ia.erro && <p className="mt-2 text-xs text-atencao">{ia.erro}</p>}
        <p className="mt-2 text-xs text-slate-500">
          As regras numeradas sao deterministicas. O que vier marcado como
          sugestao da IA e palpite de modelo e precisa do seu julgamento.
        </p>
      </Secao>

      {erro && <div className="rounded-lg border border-critico/40 bg-critico/10 p-3 text-sm text-critico">{erro}</div>}

      <div className="sticky bottom-16 flex gap-2 bg-base/90 py-3 backdrop-blur">
        <Botao onClick={salvar} desabilitado={!podeSalvar || salvando} className="flex-1">
          {salvando ? 'Salvando…' : 'Salvar atendimento'}
        </Botao>
        <Botao tipo="secundario" onClick={() => navegar(-1)}>Cancelar</Botao>
      </div>
    </div>
  )
}

function Linha({ rotulo, valor, destaque, tom }: {
  rotulo: string; valor: string; destaque?: boolean; tom?: 'atencao'
}) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-sm text-slate-400">{rotulo}</span>
      <span className={`tabular ${destaque ? 'text-xl font-semibold' : 'text-base'} ${tom === 'atencao' ? 'text-atencao' : ''}`}>
        {valor}
      </span>
    </div>
  )
}

function LinhaProcedimento({
  linha, indice, vigentes, tabela, data, aoAlterar, aoEscolherCodigo, aoRemover,
}: {
  linha: Rascunho
  indice: number
  vigentes: ReturnType<typeof vigentesEm>
  tabela: ReturnType<typeof vigentesEm>
  data: string
  aoAlterar: (p: Partial<Rascunho>) => void
  aoEscolherCodigo: (codigo: string) => void
  aoRemover?: () => void
}) {
  const [busca, setBusca] = useState('')
  const resolvido = linha.codigo_tuss ? resolverValor(tabela, linha.codigo_tuss, data) : null
  const ref = resolvido?.ok ? resolvido.procedimento : null
  const opcoes = busca ? buscar(vigentes, busca).slice(0, 8) : []

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Sitio {indice + 1}
        </span>
        {aoRemover && (
          <button onClick={aoRemover} className="text-xs text-critico">remover</button>
        )}
      </div>

      <Campo rotulo="Codigo TUSS ou descricao">
        <input
          className={classeInput}
          value={busca || linha.codigo_tuss}
          placeholder="31009115 ou hernioplastia"
          onChange={(e) => setBusca(e.target.value)}
        />
      </Campo>
      {opcoes.length > 0 && (
        <ul className="mt-1 divide-y divide-line overflow-hidden rounded-lg border border-line">
          {opcoes.map((o) => (
            <li key={o.codigo_tuss}>
              <button
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface2"
                onClick={() => { aoEscolherCodigo(o.codigo_tuss); setBusca('') }}
              >
                <span>
                  <span className="block font-mono text-xs text-slate-400">{o.codigo_tuss}</span>
                  <span className="block">{o.descricao}</span>
                </span>
                <span className="tabular shrink-0 text-sm">{formatarBRL(o.valor_cobrar)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {ref && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-surface2 p-2 text-xs">
          <SeloConfianca confianca={ref.confianca} />
          <span>Cobrar <strong className="tabular">{formatarBRL(ref.valor_cobrar)}</strong></span>
          <span className="text-slate-400">
            previsto <span className="tabular">{formatarBRL(ref.valor_pago)}</span>
          </span>
          {(ref.glosa_recorrente ?? 0) > 0 && (
            <span className="text-atencao">
              glosa historica <span className="tabular">{formatarBRL(ref.glosa_recorrente)}</span>
            </span>
          )}
        </div>
      )}

      <div className="mt-3">
        <Campo rotulo="Senha (propria deste sitio)">
          <input className={classeInput} inputMode="numeric" value={linha.senha}
            placeholder="cada sitio tem senha propria"
            onChange={(e) => aoAlterar({ senha: e.target.value })} />
        </Campo>
      </div>

      <div className="mt-3">
        <Campo rotulo="Descricao cirurgica">
          <textarea className={`${classeInput} min-h-24`} value={linha.descricao_cirurgica ?? ''}
            placeholder="texto do boletim, na integra"
            onChange={(e) => aoAlterar({ descricao_cirurgica: e.target.value })} />
        </Campo>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Marcar rotulo="Tela autorizada" valor={!!linha.tela_autorizada}
          aoMudar={(v) => aoAlterar({ tela_autorizada: v })} />
        <Marcar rotulo="Tela utilizada" valor={!!linha.tela_utilizada}
          aoMudar={(v) => aoAlterar({ tela_utilizada: v })} />
        <Marcar rotulo="Autorizado na guia" valor={linha.autorizado_na_guia !== false}
          aoMudar={(v) => aoAlterar({ autorizado_na_guia: v })} />
        <Marcar rotulo="Cirurgiao principal" valor={linha.cirurgiao_principal !== false}
          aoMudar={(v) => aoAlterar({ cirurgiao_principal: v })} />
        <Marcar rotulo="Decisao intraoperatoria" valor={!!linha.decisao_intraoperatoria}
          aoMudar={(v) => aoAlterar({ decisao_intraoperatoria: v })} />
      </div>
    </div>
  )
}

function Marcar({ rotulo, valor, aoMudar }: {
  rotulo: string; valor: boolean; aoMudar: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-line bg-surface2 px-2 py-2">
      <input type="checkbox" checked={valor} onChange={(e) => aoMudar(e.target.checked)}
        className="h-4 w-4 accent-brand" />
      <span className="text-xs text-slate-300">{rotulo}</span>
    </label>
  )
}
