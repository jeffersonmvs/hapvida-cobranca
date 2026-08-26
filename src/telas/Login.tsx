import { useState, type FormEvent } from 'react'
import { exigirSupabase } from '@/lib/supabase'
import { mensagemDeErro } from '@/lib/erros'
import { Botao, Campo, classeInput } from '@/componentes/ui'

/**
 * Entrada do app. O banco so responde a usuario autenticado E liberado em
 * faturamento.usuarios_permitidos - o login sozinho nao da acesso.
 */
export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setEntrando(true)
    setErro(null)
    setAviso(null)
    try {
      const { error } = await exigirSupabase().auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      })
      if (error) throw error
      // onAuthStateChange assume daqui; a tela troca sozinha.
    } catch (e) {
      setErro(mensagemDeErro(e, 'Nao foi possivel entrar.'))
    } finally {
      setEntrando(false)
    }
  }

  const recuperar = async () => {
    if (!email.trim()) {
      setErro('Informe o e-mail primeiro.')
      return
    }
    setErro(null)
    try {
      const { error } = await exigirSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      })
      if (error) throw error
      setAviso('Enviamos um link de redefinicao para o seu e-mail.')
    } catch (e) {
      setErro(mensagemDeErro(e, 'Nao foi possivel enviar o link.'))
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-1">
      <h1 className="text-xl font-semibold">Faturamento HAPVIDA</h1>
      <p className="mt-1 text-sm text-slate-400">
        Dr. Jefferson Menezes Viana Santos — CRM 11.153
      </p>

      <form onSubmit={entrar} className="mt-8 space-y-4">
        <Campo rotulo="E-mail">
          <input
            type="email"
            autoComplete="username"
            inputMode="email"
            className={classeInput}
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </Campo>

        <Campo rotulo="Senha">
          <input
            type="password"
            autoComplete="current-password"
            className={classeInput}
            value={senha}
            onChange={(ev) => setSenha(ev.target.value)}
            required
          />
        </Campo>

        {erro && (
          <div className="rounded-lg border border-critico/40 bg-critico/10 p-3 text-sm text-critico">
            {erro}
          </div>
        )}
        {aviso && (
          <div className="rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm text-ok">
            {aviso}
          </div>
        )}

        <Botao submit desabilitado={entrando} className="w-full">
          {entrando ? 'Entrando…' : 'Entrar'}
        </Botao>

        <button
          type="button"
          onClick={recuperar}
          className="w-full text-center text-xs text-slate-400 underline"
        >
          Esqueci a senha
        </button>
      </form>

      <p className="mt-8 text-xs leading-relaxed text-slate-500">
        Dado de paciente e dado pessoal sensivel. O acesso e restrito aos
        e-mails liberados; entrar com outra conta nao mostra nada.
      </p>
    </div>
  )
}
