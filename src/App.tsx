import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useDados } from './dados/contexto'
import { useSessao } from './dados/sessao'
import Login from './telas/Login'
import Painel from './telas/Painel'
import Lancamento from './telas/Lancamento'
import Captura from './telas/Captura'
import Revisao from './telas/Revisao'
import Glosas from './telas/Glosas'
import Inteligencia from './telas/Inteligencia'
import Ambulatorio from './telas/Ambulatorio'
import Honorarios from './telas/Honorarios'
import Conciliacao from './telas/Conciliacao'
import Faturamento from './telas/Faturamento'
import Savi from './telas/Savi'
import Configuracao from './telas/Configuracao'

const MENU = [
  { para: '/', rotulo: 'Painel', icone: '■' },
  { para: '/captura', rotulo: 'Capturar', icone: '◉' },
  { para: '/lancar', rotulo: 'Lancar', icone: '+' },
  { para: '/glosas', rotulo: 'Glosas', icone: '▲' },
  { para: '/mais', rotulo: 'Mais', icone: '≡' },
]

const MAIS = [
  { para: '/inteligencia', rotulo: 'Inteligencia de glosa', desc: 'Padroes, assinaturas e exposicao do mes' },
  { para: '/faturamento', rotulo: 'Faturamento e lote TISS', desc: 'Fechar o lote do mes e gerar o XML' },
  { para: '/savi', rotulo: 'Digitacao no SAVI', desc: 'Campos na ordem do portal, com copiar' },
  { para: '/conciliacao', rotulo: 'Conciliacao', desc: 'Cruzar o relatorio do Portal Medico' },
  { para: '/ambulatorio', rotulo: 'Ambulatorio', desc: 'Consultas e retornos por dia' },
  { para: '/honorarios', rotulo: 'Tabela de honorarios', desc: 'Valores, confianca e vigencias' },
  { para: '/configuracao', rotulo: 'Configuracao', desc: 'Dados do prestador, CNES e retencao' },
]

const PORTAIS = [
  ['SAVI', 'https://saviatendimento.com.br'],
  ['Portal do prestador', 'https://portalprestador.hapvidalabs.net'],
  ['Contabilidade', 'https://carmemcavalcanteapp.com.br'],
]

function Mais() {
  return (
    <div className="space-y-2">
      {MAIS.map((m) => (
        <NavLink
          key={m.para}
          to={m.para}
          className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 hover:border-brand"
        >
          <span>
            <span className="block text-sm font-medium">{m.rotulo}</span>
            <span className="block text-xs text-slate-400">{m.desc}</span>
          </span>
          <span className="text-slate-500">›</span>
        </NavLink>
      ))}
      <div className="pt-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Portais externos</div>
        <div className="space-y-2">
          {PORTAIS.map(([nome, url]) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl border border-line bg-surface/60 p-3 text-sm"
            >
              {nome}
              <span className="text-xs text-slate-500">abrir ↗</span>
            </a>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Sao apenas links. O app nao guarda credencial de operadora nem faz login
          automatizado - a cobranca sai daqui como lote TISS, que e o caminho
          oficial.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const { modo, carregando, erro } = useDados()
  const sessao = useSessao()

  if (sessao.carregando) {
    return <div className="py-24 text-center text-sm text-slate-500">Carregando…</div>
  }

  if (sessao.exigeLogin && !sessao.email) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4">
        <Login />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
      {modo === 'memoria' && (
        <div className="sticky top-0 z-20 bg-atencao/20 px-4 py-2 text-center text-xs text-atencao">
          MODO DEMONSTRACAO — Supabase nao configurado. Nada e salvo.
        </div>
      )}

      <header className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <h1 className="text-lg font-semibold">Faturamento HAPVIDA</h1>
        <span className="text-xs text-slate-500">Dr. Jefferson · CRM 11.153</span>
      </header>

      <main className="flex-1 px-4 pb-28">
        {erro && (
          <div className="mb-4 rounded-lg border border-critico/40 bg-critico/10 p-3 text-sm text-critico">
            {erro}
          </div>
        )}
        {carregando ? (
          <div className="py-16 text-center text-sm text-slate-500">Carregando…</div>
        ) : (
          <Routes>
            <Route path="/" element={<Painel />} />
            <Route path="/captura" element={<Captura />} />
            <Route path="/revisao/:id" element={<Revisao />} />
            <Route path="/lancar" element={<Lancamento />} />
            <Route path="/lancar/:id" element={<Lancamento />} />
            <Route path="/glosas" element={<Glosas />} />
            <Route path="/inteligencia" element={<Inteligencia />} />
            <Route path="/ambulatorio" element={<Ambulatorio />} />
            <Route path="/honorarios" element={<Honorarios />} />
            <Route path="/conciliacao" element={<Conciliacao />} />
            <Route path="/faturamento" element={<Faturamento />} />
            <Route path="/savi" element={<Savi />} />
            <Route path="/configuracao" element={<Configuracao />} />
            <Route path="/mais" element={<Mais />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl">
          {MENU.map((m) => (
            <NavLink
              key={m.para}
              to={m.para}
              end={m.para === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] ${
                  isActive ? 'text-brand' : 'text-slate-400'
                }`
              }
            >
              <span className="text-base leading-none">{m.icone}</span>
              {m.rotulo}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
