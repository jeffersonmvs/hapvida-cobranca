import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  formatarBRL, mesmoNome, apenasDigitos, resolverValor, rodarChecklist,
  type Atendimento, type ProcedimentoRealizado,
} from '@/domain'
import { repositorio, useDados } from '@/dados/contexto'
import { esquemaExtracao, type CampoExtraido, type Extracao } from '@/ai/esquemas'
import { Botao, Campo, classeInput, Etiqueta, Secao, Vazio } from '@/componentes/ui'
import { ListaAlertas } from '@/componentes/ListaAlertas'

const LIMIAR_BAIXA_CONFIANCA = 0.7

/**
 * Revisao lado a lado (§8.1, passo 5).
 *
 * Imagem de um lado, campos extraidos do outro, cada campo com indicador de
 * confianca. Campo de confianca baixa vem destacado e recebe o foco inicial.
 * So depois da confirmacao os dados viram atendimento + procedimentos e o
 * checklist roda.
 */
export default function Revisao() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { documentos, tabela, pacientes, hoje, recarregar } = useDados()
  const doc = documentos.find((d) => d.id === id)

  const [url, setUrl] = useState<string>('')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [procs, setProcs] = useState<Array<{ codigo: string; senha: string; descricao: string }>>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const extracao: Extracao | null = useMemo(() => {
    if (!doc?.extracao_json) return null
    const r = esquemaExtracao.safeParse(doc.extracao_json)
    return r.success ? r.data : null
  }, [doc])

  useEffect(() => {
    if (!doc) return
    void repositorio.urlDocumento(doc.storage_path).then(setUrl).catch(() => setUrl(''))
  }, [doc])

  useEffect(() => {
    if (!extracao) return
    setCampos({
      data: extracao.data.valor ?? '',
      hora_inicio: extracao.hora_inicio.valor ?? '',
      hora_fim: extracao.hora_fim.valor ?? '',
      paciente_nome: extracao.paciente_nome.valor ?? '',
      carteira: extracao.carteira.valor ?? '',
      numero_atendimento: extracao.numero_atendimento.valor ?? '',
      tipo_anestesia: extracao.tipo_anestesia.valor ?? '',
      acomodacao: extracao.acomodacao.valor ?? '',
      plano: extracao.plano.valor ?? '',
      descricao_cirurgica: extracao.descricao_cirurgica.valor ?? '',
    })
    setProcs(
      extracao.procedimentos.map((p) => ({
        codigo: p.codigo_tuss.valor ?? '',
        senha: p.senha.valor ?? '',
        descricao: p.descricao.valor ?? '',
      })),
    )
  }, [extracao])

  /** Cruzamento boletim x ficha do mesmo paciente (regra 8). */
  const par = useMemo(() => {
    if (!extracao || !doc) return null
    for (const outro of documentos) {
      if (outro.id === doc.id || !outro.extracao_json) continue
      const r = esquemaExtracao.safeParse(outro.extracao_json)
      if (!r.success) continue
      const e = r.data
      if (e.tipo_documento === extracao.tipo_documento) continue
      const mesmoAtendimento =
        apenasDigitos(e.numero_atendimento.valor ?? '') ===
        apenasDigitos(extracao.numero_atendimento.valor ?? '')
      const nomeIgual = mesmoNome(e.paciente_nome.valor, extracao.paciente_nome.valor)
      if (mesmoAtendimento || nomeIgual) return e
    }
    return null
  }, [documentos, doc, extracao])

  const procedimentos: ProcedimentoRealizado[] = procs
    .filter((p) => p.codigo)
    .map((p) => {
      const r = resolverValor(tabela, p.codigo, campos.data || hoje)
      return {
        codigo_tuss: p.codigo,
        senha: p.senha,
        valor_cobrado: r.ok ? r.valor_cobrar : 0,
        valor_previsto: r.ok ? r.valor_previsto : null,
        descricao_cirurgica: campos.descricao_cirurgica || p.descricao,
        tela_autorizada: extracao?.materiais.some((m) => /tela/i.test(m.nome)) ?? false,
        tela_utilizada: extracao?.tela_utilizada.valor ?? false,
        autorizado_na_guia: true,
        cirurgiao_principal: true,
        situacao: 'a_faturar' as const,
        origem: 'ocr' as const,
        rascunho: false,
      }
    })

  const atendimento: Atendimento = {
    numero: campos.numero_atendimento ?? '',
    data: campos.data || hoje,
    hora_inicio: campos.hora_inicio || null,
    hora_fim: campos.hora_fim || null,
    acomodacao: campos.acomodacao || null,
    tipo_anestesia: campos.tipo_anestesia || null,
    plano: campos.plano || null,
    classe: 'centro_cirurgico',
  }

  const alertas = useMemo(
    () =>
      rodarChecklist({
        atendimento,
        procedimentos,
        tabela,
        hoje,
        dadosBoletim: {
          nome: campos.paciente_nome,
          carteira: campos.carteira,
          numero_atendimento: campos.numero_atendimento,
        },
        dadosFicha: par
          ? {
              nome: par.paciente_nome.valor,
              carteira: par.carteira.valor,
              numero_atendimento: par.numero_atendimento.valor,
            }
          : null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campos, procs, tabela, hoje, par],
  )

  const foraDaTabela = procs.filter(
    (p) => p.codigo && !resolverValor(tabela, p.codigo, campos.data || hoje).ok,
  )

  const confirmar = async () => {
    if (!doc) return
    setSalvando(true)
    setErro(null)
    try {
      const nome = (campos.paciente_nome ?? '').trim().toUpperCase()
      const paciente =
        pacientes.find((p) => p.nome.toUpperCase() === nome) ?? {
          nome,
          carteira: campos.carteira || null,
        }
      const salvo = await repositorio.salvarAtendimento({
        atendimento,
        paciente,
        procedimentos,
        alertas,
      })
      await repositorio.atualizarDocumento({
        ...doc,
        atendimento_id: salvo.atendimento.id,
        extracao_status: 'revisado',
        revisado_em: new Date().toISOString(),
      })
      await recarregar()
      navegar('/captura')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao confirmar.')
    } finally {
      setSalvando(false)
    }
  }

  if (!doc) return <Vazio>Documento nao encontrado.</Vazio>

  if (!extracao) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Revisao</h2>
        <Vazio>
          Este documento ainda nao tem extracao valida
          {doc.erro ? `: ${doc.erro}` : '.'} Lance manualmente e depois confirme aqui.
        </Vazio>
        {url && <img src={url} alt="documento" className="w-full rounded-xl border border-line" />}
        <Botao tipo="secundario" onClick={() => navegar('/lancar')}>Lancar manualmente</Botao>
      </div>
    )
  }

  const baixas = Object.entries(extracao)
    .filter(([, v]) => ehCampo(v) && ((v as CampoExtraido).confianca < LIMIAR_BAIXA_CONFIANCA || (v as CampoExtraido).ilegivel))
    .map(([k]) => k)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Revisar extracao</h2>
        <Etiqueta tom="ia">
          confianca geral {(extracao.confianca_geral * 100).toFixed(0)}%
        </Etiqueta>
      </div>

      <p className="rounded-lg border border-ia/40 bg-ia/10 p-2 text-xs text-slate-300">
        Campos abaixo foram lidos por IA e sao <strong>sugestao</strong>. Nada vira
        registro faturavel sem a sua confirmacao.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:sticky md:top-4 md:self-start">
          {url ? (
            <img src={url} alt="documento" className="w-full rounded-xl border border-line" />
          ) : (
            <div className="rounded-xl border border-dashed border-line p-8 text-center text-xs text-slate-500">
              Imagem indisponivel.
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Etiqueta tom="neutro">{extracao.tipo_documento}</Etiqueta>
            {baixas.length > 0 && (
              <Etiqueta tom="atencao">{baixas.length} campo(s) de confianca baixa</Etiqueta>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <CampoRevisao rotulo="Data" campo={extracao.data} valor={campos.data}
            tipo="date" primeiroFoco={baixas[0] === 'data'}
            aoMudar={(v) => setCampos({ ...campos, data: v })} />
          <div className="grid grid-cols-2 gap-3">
            <CampoRevisao rotulo="Hora inicio" campo={extracao.hora_inicio} valor={campos.hora_inicio}
              tipo="time" aoMudar={(v) => setCampos({ ...campos, hora_inicio: v })} />
            <CampoRevisao rotulo="Hora fim" campo={extracao.hora_fim} valor={campos.hora_fim}
              tipo="time" aoMudar={(v) => setCampos({ ...campos, hora_fim: v })} />
          </div>
          <CampoRevisao rotulo="Paciente" campo={extracao.paciente_nome} valor={campos.paciente_nome}
            aoMudar={(v) => setCampos({ ...campos, paciente_nome: v })} />
          <div className="grid grid-cols-2 gap-3">
            <CampoRevisao rotulo="Carteira" campo={extracao.carteira} valor={campos.carteira}
              aoMudar={(v) => setCampos({ ...campos, carteira: v })} />
            <CampoRevisao rotulo="No atendimento" campo={extracao.numero_atendimento}
              valor={campos.numero_atendimento}
              aoMudar={(v) => setCampos({ ...campos, numero_atendimento: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CampoRevisao rotulo="Anestesia" campo={extracao.tipo_anestesia} valor={campos.tipo_anestesia}
              aoMudar={(v) => setCampos({ ...campos, tipo_anestesia: v })} />
            <CampoRevisao rotulo="Acomodacao" campo={extracao.acomodacao} valor={campos.acomodacao}
              aoMudar={(v) => setCampos({ ...campos, acomodacao: v })} />
          </div>

          <Secao titulo={`Procedimentos (${procs.length})`}>
            <div className="space-y-3">
              {procs.map((p, i) => {
                const orig = extracao.procedimentos[i]
                const r = p.codigo ? resolverValor(tabela, p.codigo, campos.data || hoje) : null
                return (
                  <div key={i} className="rounded-xl border border-line bg-surface p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <CampoRevisao rotulo="Codigo TUSS" campo={orig?.codigo_tuss} valor={p.codigo}
                        aoMudar={(v) => setProcs(procs.map((x, k) => (k === i ? { ...x, codigo: v } : x)))} />
                      <CampoRevisao rotulo="Senha" campo={orig?.senha} valor={p.senha}
                        aoMudar={(v) => setProcs(procs.map((x, k) => (k === i ? { ...x, senha: v } : x)))} />
                    </div>
                    <div className="mt-2 text-xs">
                      {r?.ok ? (
                        <span>
                          {r.procedimento.descricao} ·{' '}
                          <strong>{formatarBRL(r.valor_cobrar)}</strong> · previsto{' '}
                          {formatarBRL(r.valor_previsto)}
                        </span>
                      ) : p.codigo ? (
                        <span className="text-critico">{r?.ok === false ? r.motivo : ''}</span>
                      ) : (
                        <span className="text-slate-500">informe o codigo</span>
                      )}
                    </div>
                  </div>
                )
              })}
              <Botao tipo="secundario"
                onClick={() => setProcs([...procs, { codigo: '', senha: '', descricao: '' }])}>
                + outro sitio
              </Botao>
            </div>
          </Secao>

          <Campo rotulo="Descricao cirurgica (transcricao literal)">
            <textarea className={`${classeInput} min-h-40 text-sm`}
              value={campos.descricao_cirurgica ?? ''}
              onChange={(e) => setCampos({ ...campos, descricao_cirurgica: e.target.value })} />
          </Campo>
          <Confianca campo={extracao.descricao_cirurgica} />
        </div>
      </div>

      {extracao.campos_ilegiveis.length > 0 && (
        <div className="rounded-lg border border-atencao/40 bg-atencao/10 p-3 text-xs text-atencao">
          Campos que a IA marcou como ilegiveis (em branco de proposito, nao chutados):{' '}
          {extracao.campos_ilegiveis.join(', ')}.
        </div>
      )}

      {par && (
        <div className="rounded-lg border border-line bg-surface p-3 text-xs text-slate-400">
          Cruzando com {par.tipo_documento} do mesmo paciente.
        </div>
      )}

      <Secao titulo={`Checklist antiglosa (${alertas.length})`}>
        {alertas.length === 0 ? <Vazio>Nenhum alerta.</Vazio> : <ListaAlertas alertas={alertas} />}
      </Secao>

      {foraDaTabela.length > 0 && (
        <div className="rounded-lg border border-critico/50 bg-critico/10 p-3 text-sm text-critico">
          {foraDaTabela.map((p) => p.codigo).join(', ')} fora da tabela de honorarios.
          Cadastre o codigo e o valor antes de confirmar.
        </div>
      )}

      {erro && <div className="rounded-lg border border-critico/40 bg-critico/10 p-3 text-sm text-critico">{erro}</div>}

      <div className="sticky bottom-16 flex gap-2 bg-base/90 py-3 backdrop-blur">
        <Botao onClick={confirmar} className="flex-1"
          desabilitado={
            salvando || foraDaTabela.length > 0 || procedimentos.length === 0 ||
            !campos.paciente_nome || !campos.numero_atendimento
          }>
          {salvando ? 'Confirmando…' : 'Confirmar e lancar'}
        </Botao>
        <Botao tipo="secundario" onClick={() => navegar('/captura')}>Voltar</Botao>
      </div>
    </div>
  )
}

function ehCampo(v: unknown): boolean {
  return typeof v === 'object' && v != null && 'confianca' in (v as Record<string, unknown>)
}

function Confianca({ campo }: { campo?: CampoExtraido | null }) {
  if (!campo) return null
  const pct = Math.round(campo.confianca * 100)
  const baixa = campo.confianca < LIMIAR_BAIXA_CONFIANCA || campo.ilegivel
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded bg-surface2">
        <div className={`h-full ${baixa ? 'bg-atencao' : 'bg-ok'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] ${baixa ? 'text-atencao' : 'text-slate-500'}`}>
        {campo.ilegivel ? 'ilegivel' : `${pct}%`}
      </span>
    </div>
  )
}

function CampoRevisao({
  rotulo, campo, valor, tipo = 'text', primeiroFoco, aoMudar,
}: {
  rotulo: string
  campo?: CampoExtraido | null
  valor: string
  tipo?: string
  primeiroFoco?: boolean
  aoMudar: (v: string) => void
}) {
  const baixa = !!campo && (campo.confianca < LIMIAR_BAIXA_CONFIANCA || campo.ilegivel)
  return (
    <div>
      <Campo rotulo={rotulo}>
        <input
          type={tipo}
          autoFocus={primeiroFoco}
          className={`${classeInput} ${baixa ? 'border-atencao bg-atencao/10' : ''}`}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
        />
      </Campo>
      <Confianca campo={campo} />
    </div>
  )
}
