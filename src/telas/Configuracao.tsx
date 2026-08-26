import { useState } from 'react'
import type { Configuracao as Config } from '@/domain'
import { repositorio, useDados } from '@/dados/contexto'
import { useSessao } from '@/dados/sessao'
import { Botao, Campo, classeInput, Secao } from '@/componentes/ui'

export default function Configuracao() {
  const { config, modo, recarregar } = useDados()
  const sessao = useSessao()
  const [c, setC] = useState<Config>(config)
  const [salvo, setSalvo] = useState(false)

  const salvar = async () => {
    await repositorio.salvarConfiguracao(c)
    await recarregar()
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  const campo = (chave: keyof Config, rotulo: string, dica?: string) => (
    <Campo rotulo={rotulo} dica={dica}>
      <input className={classeInput} value={(c[chave] as string) ?? ''}
        onChange={(e) => setC({ ...c, [chave]: e.target.value })} />
    </Campo>
  )

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">Configuracao</h2>

      {!c.cnes && (
        <div className="mb-4 rounded-lg border border-atencao/50 bg-atencao/10 p-3 text-sm text-atencao">
          <strong>CNES pendente.</strong> A guia de honorario individual do TISS
          exige o CNES do estabelecimento. Enquanto estiver em branco, a geracao
          do lote XML fica bloqueada.
        </div>
      )}

      <Secao titulo="Prestador">
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          {campo('nome_prestador', 'Nome')}
          <div className="grid grid-cols-2 gap-3">
            {campo('crm', 'CRM')}
            {campo('rqe', 'RQE')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {campo('conselho_profissional', 'Conselho', '1 = CRM')}
            {campo('uf_conselho', 'UF do conselho', '23 = CE')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {campo('cbos', 'CBOS')}
            {campo('codigo_prestador_operadora', 'Codigo na operadora')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {campo('registro_ans', 'Registro ANS')}
            {campo('cnpj', 'CNPJ (nota fiscal)')}
          </div>
          {campo('cnes', 'CNES', 'Obrigatorio para gerar o XML TISS.')}
        </div>
      </Secao>

      <Secao titulo="Retencao de imagens">
        <div className="rounded-xl border border-line bg-surface p-4">
          <Campo rotulo="Meses ate o expurgo das imagens originais"
            dica="Depois do prazo, a imagem e apagada e o JSON extraido permanece.">
            <input type="number" min={1} className={classeInput}
              value={c.retencao_imagens_meses}
              onChange={(e) => setC({ ...c, retencao_imagens_meses: Number(e.target.value) })} />
          </Campo>
        </div>
      </Secao>

      <div className="mt-4 flex items-center gap-3">
        <Botao onClick={salvar}>Salvar</Botao>
        {salvo && <span className="text-sm text-ok">salvo ✓</span>}
      </div>

      {sessao.exigeLogin && (
        <Secao titulo="Sessao">
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-4">
            <span className="min-w-0 truncate text-sm">{sessao.email}</span>
            <Botao tipo="secundario" onClick={() => void sessao.sair()}>Sair</Botao>
          </div>
        </Secao>
      )}

      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        Armazenamento: {modo === 'supabase' ? 'Supabase (RLS ligada, Storage privado)' : 'memoria (modo demonstracao)'}.
        A chave da API de IA nunca fica no navegador — toda chamada passa por
        Edge Function autenticada.
      </p>
    </div>
  )
}
