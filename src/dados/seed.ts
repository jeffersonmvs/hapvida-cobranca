import type { Consulta, Glosa, Paciente, Procedimento } from '@/domain'
import type { AtendimentoCompleto } from './repositorio'

/**
 * Espelho em TypeScript do seed de supabase/migrations/*_seed_honorarios.sql.
 * Usado pelo modo demonstracao e como referencia da tabela vigente.
 * Ao mudar valores, mudar NOS DOIS lugares - ou melhor, criar nova vigencia.
 */
export const TABELA_HONORARIOS: Procedimento[] = [
  { codigo_tuss: '31005497', descricao: 'Colecistectomia videolaparoscopica sem colangiografia', valor_cobrar: 1056.78, valor_pago: 1056.78, glosa_recorrente: 0, confianca: 'confirmado', equivalente_a: '43050200', vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '43050200', descricao: 'Colecistectomia videolaparoscopica (equivalente ao 31005497)', valor_cobrar: 1056.78, valor_pago: 1056.78, glosa_recorrente: 0, confianca: 'confirmado', equivalente_a: '31005497', vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '31005470', descricao: 'Colecistectomia COM colangiografia por video', valor_cobrar: 1056.78, valor_pago: 1056.78, glosa_recorrente: 0, confianca: 'confirmado', vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '31009115', descricao: 'Hernioplastia inguinal unilateral', valor_cobrar: 280, valor_pago: 192, glosa_recorrente: 88, confianca: 'confirmado', observacao: 'Glosa recorrente de R$ 88,00 desde fev/2026.', vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '31009166', descricao: 'Hernioplastia umbilical', valor_cobrar: 148, valor_pago: 148, glosa_recorrente: 0, confianca: 'confirmado', exige_tela: true, vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '31009093', descricao: 'Hernioplastia epigastrica', valor_cobrar: 148, valor_pago: 148, glosa_recorrente: 0, confianca: 'confirmado', vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '31009107', descricao: 'Herniorrafia incisional', valor_cobrar: 280, valor_pago: 208, glosa_recorrente: 72, confianca: 'provavel', vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '30101913', descricao: 'TU partes moles - exerese', valor_cobrar: 100, valor_pago: 100, glosa_recorrente: 0, confianca: 'confirmado', pequena_cirurgia: true, vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '42030153', descricao: 'Exerese de tumor de pele e mucosas', valor_cobrar: 120, valor_pago: 100, glosa_recorrente: 20, confianca: 'confirmado', pequena_cirurgia: true, vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '30101468', descricao: 'Exerese de tumor de pele e mucosas', valor_cobrar: 120, valor_pago: 100, glosa_recorrente: 20, confianca: 'provavel', pequena_cirurgia: true, vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '30101450', descricao: 'Exerese lesoes circulares com rotacao de retalho', valor_cobrar: 184, valor_pago: null, glosa_recorrente: null, confianca: 'a_confirmar', exige_retalho: true, termos_exigidos: ['retalho'], vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '30101522', descricao: 'Extensos ferimentos/cicatrizes - excisao e retalhos', valor_cobrar: 476, valor_pago: null, glosa_recorrente: null, confianca: 'a_confirmar', exige_retalho: true, termos_exigidos: ['retalho'], vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '31305016', descricao: 'Ooforectomia laparoscopica uni/bilateral', valor_cobrar: 1056.78, valor_pago: 697.6, glosa_recorrente: 359.18, confianca: 'confirmado', observacao: 'Cobrar 1.056,78. O 697,60 e valor pago com glosa embutida, nao e preco.', vigencia_inicio: '2026-01-01' },
  { codigo_tuss: '31009034', descricao: 'Cisto sacral - tratamento cirurgico', valor_cobrar: 148, valor_pago: null, glosa_recorrente: null, confianca: 'a_confirmar', vigencia_inicio: '2026-01-01' },
  { codigo_tuss: 'SEM-TUSS-01', descricao: 'Reconstrucao de parede abdominal com retalho muscular', valor_cobrar: 280, valor_pago: 280, glosa_recorrente: 0, confianca: 'confirmado', exige_retalho: true, termos_exigidos: ['retalho'], codigo_interno: true, observacao: 'Codigo TUSS oficial pendente.', vigencia_inicio: '2026-01-01' },
  { codigo_tuss: 'SEM-TUSS-02', descricao: 'Tratamento cirurgico da lipomatose cervical', valor_cobrar: 340, valor_pago: null, glosa_recorrente: null, confianca: 'a_confirmar', codigo_interno: true, observacao: 'Codigo TUSS oficial pendente.', vigencia_inicio: '2026-01-01' },
  { codigo_tuss: 'SEM-TUSS-03', descricao: 'Exerese e sutura de hemangioma/nevus (ate 5 lesoes)', valor_cobrar: 88, valor_pago: null, glosa_recorrente: null, confianca: 'a_confirmar', pequena_cirurgia: true, codigo_interno: true, observacao: 'Codigo TUSS oficial pendente.', vigencia_inicio: '2026-01-01' },
  { codigo_tuss: 'SEM-TUSS-04', descricao: 'Exerese de unha', valor_cobrar: 32, valor_pago: null, glosa_recorrente: null, confianca: 'a_confirmar', pequena_cirurgia: true, codigo_interno: true, observacao: 'Codigo TUSS oficial pendente.', vigencia_inicio: '2026-01-01' },
  { codigo_tuss: 'SEM-TUSS-05', descricao: 'Consulta ambulatorial', valor_cobrar: 60, valor_pago: 60, glosa_recorrente: 0, confianca: 'confirmado', codigo_interno: true, observacao: 'Codigo TUSS oficial pendente. Retorno nao remunera.', vigencia_inicio: '2026-01-01' },
]

// -------------------------------------------------------------------------
// Dados de demonstracao. So aparecem quando o Supabase nao esta configurado.
// Nomes ficticios.
// -------------------------------------------------------------------------

export const PACIENTES_DEMO: Paciente[] = [
  { id: 'p1', nome: 'MARIA JOSE DA CONCEICAO', carteira: '00123456789' },
  { id: 'p2', nome: 'ANTONIO CARLOS PEREIRA', carteira: '00987654321' },
  { id: 'p3', nome: 'FRANCISCA LIMA SOUZA', carteira: '00555444333' },
  { id: 'p4', nome: 'RAIMUNDO NONATO ALVES', carteira: '00111222333' },
]

export const ATENDIMENTOS_DEMO: AtendimentoCompleto[] = [
  {
    atendimento: { id: 'a1', paciente_id: 'p1', numero: '188912993', data: '2026-08-10', hora_inicio: '08:00', hora_fim: '09:10', local: 'Hospital Aldeota', acomodacao: 'enfermaria', tipo_anestesia: 'raqui', classe: 'centro_cirurgico', plano: 'HAPVIDA' },
    paciente: PACIENTES_DEMO[0],
    procedimentos: [
      { id: 'pr1', atendimento_id: 'a1', codigo_tuss: '31009166', senha: '444555', valor_cobrado: 148, valor_previsto: 148, tela_autorizada: true, tela_utilizada: false, descricao_cirurgica: 'Incisao infraumbilical de 3 cm. Herniorrafia com Prolene zero em dois planos.', situacao: 'a_faturar' },
      { id: 'pr2', atendimento_id: 'a1', codigo_tuss: '31009093', senha: '666777', valor_cobrado: 148, valor_previsto: 148, descricao_cirurgica: 'Incisao epigastrica propria de 3 cm, rafia do defeito com Prolene zero.', situacao: 'a_faturar' },
    ],
    alertas: [],
  },
  {
    atendimento: { id: 'a2', paciente_id: 'p2', numero: '188913004', data: '2026-08-10', hora_inicio: '09:30', hora_fim: '10:50', local: 'Hospital Aldeota', acomodacao: 'apartamento', tipo_anestesia: 'geral', classe: 'centro_cirurgico', plano: 'HAPVIDA' },
    paciente: PACIENTES_DEMO[1],
    procedimentos: [
      { id: 'pr3', atendimento_id: 'a2', codigo_tuss: '31005497', senha: '778899', valor_cobrado: 1056.78, valor_previsto: 1056.78, descricao_cirurgica: 'Colecistectomia videolaparoscopica por quatro portais, sem colangiografia.', situacao: 'a_faturar' },
    ],
    alertas: [],
  },
  {
    atendimento: { id: 'a3', paciente_id: 'p3', numero: '188913077', data: '2026-08-12', hora_inicio: '14:00', hora_fim: '14:35', local: 'Hapclinica Lobo Filho', tipo_anestesia: 'local', classe: 'pqa', plano: 'NOTRE SP' },
    paciente: PACIENTES_DEMO[2],
    procedimentos: [
      { id: 'pr4', atendimento_id: 'a3', codigo_tuss: '30101522', senha: '112233', valor_cobrado: 476, descricao_cirurgica: 'Excisao de cicatriz hipertrofica em dorso, sintese por planos com nylon 4-0.', situacao: 'a_faturar' },
    ],
    alertas: [],
  },
  {
    atendimento: { id: 'a4', paciente_id: 'p4', numero: '188913120', data: '2026-08-18', hora_inicio: '07:40', hora_fim: '08:30', local: 'Hospital Sao Mateus', acomodacao: 'enfermaria', tipo_anestesia: 'raqui', classe: 'centro_cirurgico', plano: 'HAPVIDA' },
    paciente: PACIENTES_DEMO[3],
    procedimentos: [
      { id: 'pr5', atendimento_id: 'a4', codigo_tuss: '31009115', senha: '334455', valor_cobrado: 280, valor_previsto: 192, descricao_cirurgica: 'Hernioplastia inguinal direita a Lichtenstein com tela de polipropileno.', tela_autorizada: true, tela_utilizada: true, situacao: 'a_faturar' },
    ],
    alertas: [],
  },
]

/** As 25 hernioplastias glosadas em R$ 88,00 entre fev e jun/2026. */
export const GLOSAS_DEMO: Glosa[] = (() => {
  const meses: Array<[string, number]> = [
    ['2026-02', 5], ['2026-03', 6], ['2026-04', 6], ['2026-05', 6], ['2026-06', 2],
  ]
  const saida: Glosa[] = []
  let n = 0
  for (const [mes, qtd] of meses) {
    for (let i = 0; i < qtd; i++) {
      n++
      saida.push({
        id: `g${n}`,
        codigo_tuss: '31009115',
        competencia: `MEDISA ${mes.slice(5)}/${mes.slice(0, 4)}`,
        valor_glosado: 88,
        valor_recurso: mes === '2026-02' && i < 3 ? 88 : 0,
        justificativa: mes === '2026-06'
          ? 'Pago abaixo da tabela contratual'
          : 'Procedimento nao incluso em contrato',
        justificativa_normalizada: null,
        data_demonstrativo: `${mes}-10`,
        recursada: mes === '2026-02' && i < 3,
        resultado: mes === '2026-02' && i < 3 ? 'deferido' : null,
      })
    }
  }
  saida.push({
    id: 'g26', codigo_tuss: '31305016', competencia: 'MEDISA 07/2026',
    valor_glosado: 359.18, valor_recurso: 0,
    justificativa: 'Pago abaixo da tabela contratual',
    data_demonstrativo: '2026-08-12', recursada: false,
  })
  return saida
})()

export const CONSULTAS_DEMO: Consulta[] = [
  { id: 'c1', data: '2026-08-05', unidade: 'Hapclinica Lobo Filho', qtd_consultas: 14, qtd_retornos: 6, valor_unitario: 60 },
  { id: 'c2', data: '2026-08-19', unidade: 'Hapclinica Lobo Filho', qtd_consultas: 11, qtd_retornos: 4, valor_unitario: 60 },
]
