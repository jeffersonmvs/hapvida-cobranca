import { useState } from 'react'
import { calcularConsultas, formatarBRL, formatarData, hojeISO, LOCAIS, mesDe } from '@/domain'
import { repositorio, useDados } from '@/dados/contexto'
import { Botao, Campo, classeInput, Cartao, Secao, Vazio } from '@/componentes/ui'

/** Ambulatorio (§8.6): retorno conta na producao, nao no valor. */
export default function Ambulatorio() {
  const { consultas, hoje, recarregar } = useDados()
  const [data, setData] = useState(hojeISO())
  const [unidade, setUnidade] = useState<string>(LOCAIS[2])
  const [qtdConsultas, setQtdConsultas] = useState(0)
  const [qtdRetornos, setQtdRetornos] = useState(0)
  const [salvando, setSalvando] = useState(false)

  const doMes = consultas.filter((c) => mesDe(c.data) === mesDe(hoje))
  const resumo = calcularConsultas(doMes)

  const salvar = async () => {
    setSalvando(true)
    try {
      await repositorio.salvarConsulta({
        data, unidade, qtd_consultas: qtdConsultas, qtd_retornos: qtdRetornos,
        valor_unitario: 60,
      })
      setQtdConsultas(0)
      setQtdRetornos(0)
      await recarregar()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">Ambulatorio</h2>

      <div className="grid grid-cols-3 gap-3">
        <Cartao titulo="Consultas" valor={resumo.qtd_consultas} />
        <Cartao titulo="Retornos" valor={resumo.qtd_retornos} detalhe="sem remuneracao" />
        <Cartao titulo="Valor" valor={formatarBRL(resumo.valor)} />
      </div>

      <Secao titulo="Lancar dia">
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Data">
              <input type="date" className={classeInput} value={data}
                onChange={(e) => setData(e.target.value)} />
            </Campo>
            <Campo rotulo="Unidade">
              <select className={classeInput} value={unidade}
                onChange={(e) => setUnidade(e.target.value)}>
                {LOCAIS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Consultas">
              <input type="number" min={0} inputMode="numeric" className={classeInput}
                value={qtdConsultas} onChange={(e) => setQtdConsultas(Number(e.target.value))} />
            </Campo>
            <Campo rotulo="Retornos" dica="Registrados, sem remuneracao.">
              <input type="number" min={0} inputMode="numeric" className={classeInput}
                value={qtdRetornos} onChange={(e) => setQtdRetornos(Number(e.target.value))} />
            </Campo>
          </div>
          <Botao onClick={salvar} desabilitado={salvando || (qtdConsultas === 0 && qtdRetornos === 0)}>
            {salvando ? 'Salvando…' : `Lancar (${formatarBRL(qtdConsultas * 60)})`}
          </Botao>
        </div>
      </Secao>

      <Secao titulo="Lancamentos">
        {consultas.length === 0 ? (
          <Vazio>Nenhum dia lancado.</Vazio>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {consultas.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="block">{formatarData(c.data)}</span>
                  <span className="block text-xs text-slate-400">{c.unidade}</span>
                </span>
                <span className="text-right">
                  <span className="block tabular">{formatarBRL(c.qtd_consultas * c.valor_unitario)}</span>
                  <span className="block text-xs text-slate-400">
                    {c.qtd_consultas} consultas · {c.qtd_retornos} retornos
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  )
}
