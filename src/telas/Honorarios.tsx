import { useMemo, useState } from 'react'
import {
  buscar, formatarBRL, formatarData, hojeISO, novaVigencia, parseBRL, vigentesEm,
  type Procedimento,
} from '@/domain'
import { repositorio, useDados } from '@/dados/contexto'
import { Botao, Campo, classeInput, Etiqueta, Secao, SeloConfianca, Vazio } from '@/componentes/ui'

/**
 * Tabela de honorarios (§8.7). Editar valor_cobrar cria NOVA vigencia em vez
 * de sobrescrever - o historico importa para auditar faturamento antigo.
 */
export default function Honorarios() {
  const { tabela, hoje, recarregar } = useDados()
  const [termo, setTermo] = useState('')
  const [editando, setEditando] = useState<Procedimento | null>(null)
  const [novo, setNovo] = useState(false)

  const vigentes = useMemo(() => vigentesEm(tabela, hoje), [tabela, hoje])
  const lista = useMemo(() => buscar(vigentes, termo), [vigentes, termo])

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Tabela de honorarios</h2>
        <Botao tipo="secundario" onClick={() => setNovo(true)}>+ codigo</Botao>
      </div>

      <input className={classeInput} placeholder="buscar por codigo ou descricao"
        value={termo} onChange={(e) => setTermo(e.target.value)} />

      {novo && (
        <FormularioProcedimento
          inicial={{
            codigo_tuss: '', descricao: '', valor_cobrar: 0, valor_pago: null,
            glosa_recorrente: 0, confianca: 'a_confirmar', vigencia_inicio: hojeISO(),
          }}
          titulo="Novo codigo"
          aoFechar={() => setNovo(false)}
          aoSalvar={async (p) => {
            await repositorio.criarProcedimento(p)
            await recarregar()
            setNovo(false)
          }}
        />
      )}

      {editando && (
        <FormularioProcedimento
          inicial={editando}
          titulo={`Editar ${editando.codigo_tuss}`}
          avisoVigencia
          aoFechar={() => setEditando(null)}
          aoSalvar={async (p) => {
            const mudouValor = p.valor_cobrar !== editando.valor_cobrar
            if (mudouValor && editando.vigencia_inicio !== hojeISO()) {
              const { fechada, nova } = novaVigencia(editando, p, hojeISO())
              await repositorio.atualizarProcedimento(fechada)
              await repositorio.criarProcedimento(nova)
            } else {
              await repositorio.atualizarProcedimento({ ...editando, ...p })
            }
            await recarregar()
            setEditando(null)
          }}
        />
      )}

      <Secao titulo={`${lista.length} codigo(s) vigente(s)`}>
        {lista.length === 0 ? (
          <Vazio>Nenhum codigo encontrado.</Vazio>
        ) : (
          <ul className="space-y-2">
            {lista.map((p) => (
              <li key={p.codigo_tuss}>
                <button onClick={() => setEditando(p)}
                  className="w-full rounded-xl border border-line bg-surface p-3 text-left hover:border-brand">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">{p.codigo_tuss}</span>
                        <SeloConfianca confianca={p.confianca} />
                        {p.codigo_interno && <Etiqueta tom="atencao">sem TUSS oficial</Etiqueta>}
                        {p.exige_retalho && <Etiqueta tom="neutro">exige retalho</Etiqueta>}
                        {p.exige_tela && <Etiqueta tom="neutro">tela</Etiqueta>}
                      </div>
                      <div className="mt-0.5 truncate text-sm">{p.descricao}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        vigencia desde {formatarData(p.vigencia_inicio)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="tabular text-sm font-semibold">{formatarBRL(p.valor_cobrar)}</div>
                      <div className="tabular text-xs text-slate-400">
                        pago {formatarBRL(p.valor_pago)}
                      </div>
                      {(p.glosa_recorrente ?? 0) > 0 && (
                        <div className="tabular text-xs text-atencao">
                          glosa {formatarBRL(p.glosa_recorrente)}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  )
}

function FormularioProcedimento({
  inicial, titulo, avisoVigencia, aoFechar, aoSalvar,
}: {
  inicial: Procedimento
  titulo: string
  avisoVigencia?: boolean
  aoFechar: () => void
  aoSalvar: (p: Procedimento) => Promise<void>
}) {
  const [p, setP] = useState<Procedimento>(inicial)
  const [salvando, setSalvando] = useState(false)

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-brand/40 bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <button onClick={aoFechar} className="text-xs text-slate-400">fechar</button>
      </div>

      {avisoVigencia && (
        <p className="rounded-lg border border-line bg-surface2 p-2 text-xs text-slate-400">
          Mudar o valor a cobrar cria uma nova vigencia a partir de hoje. O valor
          antigo continua valendo para o que ja foi faturado.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Codigo TUSS">
          <input className={classeInput} value={p.codigo_tuss}
            onChange={(e) => setP({ ...p, codigo_tuss: e.target.value })} />
        </Campo>
        <Campo rotulo="Confianca">
          <select className={classeInput} value={p.confianca}
            onChange={(e) => setP({ ...p, confianca: e.target.value as Procedimento['confianca'] })}>
            <option value="confirmado">confirmado</option>
            <option value="provavel">provavel</option>
            <option value="a_confirmar">a confirmar</option>
          </select>
        </Campo>
      </div>

      <Campo rotulo="Descricao">
        <input className={classeInput} value={p.descricao}
          onChange={(e) => setP({ ...p, descricao: e.target.value })} />
      </Campo>

      <div className="grid grid-cols-3 gap-2">
        <Campo rotulo="A cobrar">
          <input className={classeInput} inputMode="decimal"
            defaultValue={p.valor_cobrar ? String(p.valor_cobrar).replace('.', ',') : ''}
            onChange={(e) => setP({ ...p, valor_cobrar: parseBRL(e.target.value) ?? 0 })} />
        </Campo>
        <Campo rotulo="Pago">
          <input className={classeInput} inputMode="decimal"
            defaultValue={p.valor_pago != null ? String(p.valor_pago).replace('.', ',') : ''}
            onChange={(e) => setP({ ...p, valor_pago: parseBRL(e.target.value) })} />
        </Campo>
        <Campo rotulo="Glosa">
          <input className={classeInput} inputMode="decimal"
            defaultValue={p.glosa_recorrente != null ? String(p.glosa_recorrente).replace('.', ',') : ''}
            onChange={(e) => setP({ ...p, glosa_recorrente: parseBRL(e.target.value) })} />
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {([
          ['exige_tela', 'Exige tela'],
          ['exige_retalho', 'Exige retalho'],
          ['pequena_cirurgia', 'Pequena cirurgia'],
          ['codigo_interno', 'Sem TUSS oficial'],
        ] as const).map(([campo, rotulo]) => (
          <label key={campo} className="flex items-center gap-2 rounded-lg border border-line bg-surface2 px-2 py-2">
            <input type="checkbox" className="h-4 w-4 accent-brand"
              checked={!!p[campo]}
              onChange={(e) => setP({ ...p, [campo]: e.target.checked })} />
            {rotulo}
          </label>
        ))}
      </div>

      <Campo rotulo="Observacao">
        <input className={classeInput} value={p.observacao ?? ''}
          onChange={(e) => setP({ ...p, observacao: e.target.value })} />
      </Campo>

      <Botao
        desabilitado={salvando || !p.codigo_tuss || !p.descricao || p.valor_cobrar <= 0}
        onClick={async () => { setSalvando(true); await aoSalvar(p); setSalvando(false) }}
      >
        {salvando ? 'Salvando…' : 'Salvar'}
      </Botao>
    </div>
  )
}
