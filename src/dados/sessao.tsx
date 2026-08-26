import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase, supabaseConfigurado } from '@/lib/supabase'

export interface Sessao {
  carregando: boolean
  /** null = ninguem logado. Em modo demonstracao vem sempre preenchido. */
  email: string | null
  /** false quando nao ha Supabase: o app roda aberto, em memoria */
  exigeLogin: boolean
  sair: () => Promise<void>
}

const Contexto = createContext<Sessao | null>(null)

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(supabaseConfigurado)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setCarregando(false)
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setEmail(sessao?.user?.email ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const valor = useMemo<Sessao>(
    () => ({
      carregando,
      email,
      exigeLogin: supabaseConfigurado,
      sair: async () => {
        await supabase?.auth.signOut()
      },
    }),
    [carregando, email],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSessao(): Sessao {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useSessao fora do ProvedorSessao')
  return ctx
}
