import { useCallback, useState } from 'react'
import type { Alerta, Procedimento, ProcedimentoRealizado } from '@/domain'
import { vigenteEm } from '@/domain'
import { analisarRisco, iaDisponivel } from './cliente'

/**
 * Analise semantica de risco (§11.2) sobre os procedimentos ja lancados.
 * O resultado vira alerta com origem 'ia' - visualmente distinto do
 * deterministico na lista.
 */
export function useAnaliseRisco() {
  const [rodando, setRodando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>([])

  const analisar = useCallback(
    async (
      procedimentos: ProcedimentoRealizado[],
      tabela: Procedimento[],
      data: string,
    ) => {
      setRodando(true)
      setErro(null)
      try {
        const saida: Alerta[] = []
        for (let i = 0; i < procedimentos.length; i++) {
          const pr = procedimentos[i]
          if (!pr.codigo_tuss) continue
          const ref = vigenteEm(tabela, pr.codigo_tuss, data)
          const r = await analisarRisco({
            referencia_id: pr.id ?? '',
            codigo_tuss: pr.codigo_tuss,
            descricao_codigo: ref?.descricao ?? '',
            descricao_cirurgica: pr.descricao_cirurgica ?? '',
            materiais_autorizados: pr.tela_autorizada ? ['tela'] : [],
          })
          if (r.compativel && r.risco === 'baixo' && r.achados.length === 0) continue
          for (const a of r.achados) {
            saida.push({
              regra: `IA:${a.tipo}`,
              severidade: r.risco === 'alto' ? 'critico' : r.risco === 'medio' ? 'atencao' : 'info',
              mensagem: a.explicacao,
              sugestao: a.sugestao_de_redacao,
              origem: 'ia',
              indice: i,
              procedimento_realizado_id: pr.id ?? null,
              resolvido: false,
            })
          }
        }
        setAlertas(saida)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha na analise.')
      } finally {
        setRodando(false)
      }
    },
    [],
  )

  return { analisar, alertas, rodando, erro, disponivel: iaDisponivel }
}
