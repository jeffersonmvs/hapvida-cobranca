import { describe, expect, it } from 'vitest'
import { explicarErro, mensagemDeErro } from './erros'

describe('mensagemDeErro', () => {
  it('le o objeto simples que o supabase-js rejeita (nao e Error)', () => {
    // Foi exatamente este caso que virou "Falha ao carregar os dados" na tela,
    // escondendo que era permissao negada.
    const erroSupabase = {
      message: 'permission denied for table configuracao',
      code: '42501',
      details: null,
      hint: null,
    }
    expect(mensagemDeErro(erroSupabase)).toContain('permission denied')
    expect(mensagemDeErro(erroSupabase)).toContain('42501')
  })

  it('le Error normal', () => {
    expect(mensagemDeErro(new Error('deu ruim'))).toBe('deu ruim')
  })

  it('le string solta', () => {
    expect(mensagemDeErro('texto')).toBe('texto')
  })

  it('cai no padrao quando nao ha nada legivel', () => {
    expect(mensagemDeErro({}, 'padrao')).toBe('padrao')
    expect(mensagemDeErro(null, 'padrao')).toBe('padrao')
  })
})

describe('explicarErro', () => {
  it('explica schema nao exposto em vez de repetir jargao', () => {
    const m = explicarErro({ code: 'PGRST106', message: 'The schema must be one of the following: public' })
    expect(m).toContain('Exposed schemas')
    expect(m).toContain('faturamento')
  })

  it('explica permissao negada apontando usuarios_permitidos', () => {
    const m = explicarErro({ code: '42501', message: 'permission denied for table pacientes' })
    expect(m).toContain('usuarios_permitidos')
  })

  it('explica credencial invalida', () => {
    expect(explicarErro({ message: 'Invalid API key' })).toContain('Credenciais')
  })

  it('preserva a mensagem tecnica junto da explicacao', () => {
    const m = explicarErro({ code: '42501', message: 'permission denied for table pacientes' })
    expect(m).toContain('permission denied for table pacientes')
  })

  it('devolve a mensagem crua quando nao reconhece o caso', () => {
    expect(explicarErro({ message: 'timeout' })).toBe('timeout')
  })
})
