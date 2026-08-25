import type { Procedimento } from '../tipos'

/** Recorte da tabela de honorarios real, usado nos testes de dominio. */
export const TABELA: Procedimento[] = [
  {
    codigo_tuss: '31005497',
    descricao: 'Colecistectomia videolaparoscopica sem colangiografia',
    valor_cobrar: 1056.78, valor_pago: 1056.78, glosa_recorrente: 0,
    confianca: 'confirmado', equivalente_a: '43050200', vigencia_inicio: '2026-01-01',
  },
  {
    codigo_tuss: '43050200',
    descricao: 'Colecistectomia videolaparoscopica (equivalente ao 31005497)',
    valor_cobrar: 1056.78, valor_pago: 1056.78, glosa_recorrente: 0,
    confianca: 'confirmado', equivalente_a: '31005497', vigencia_inicio: '2026-01-01',
  },
  {
    codigo_tuss: '31009115',
    descricao: 'Hernioplastia inguinal unilateral',
    valor_cobrar: 280.0, valor_pago: 192.0, glosa_recorrente: 88.0,
    confianca: 'confirmado', vigencia_inicio: '2026-01-01',
  },
  {
    codigo_tuss: '31009166',
    descricao: 'Hernioplastia umbilical',
    valor_cobrar: 148.0, valor_pago: 148.0, glosa_recorrente: 0,
    confianca: 'confirmado', exige_tela: true, vigencia_inicio: '2026-01-01',
  },
  {
    codigo_tuss: '31009093',
    descricao: 'Hernioplastia epigastrica',
    valor_cobrar: 148.0, valor_pago: 148.0, glosa_recorrente: 0,
    confianca: 'confirmado', vigencia_inicio: '2026-01-01',
  },
  {
    codigo_tuss: '30101450',
    descricao: 'Exerese lesoes circulares com rotacao de retalho',
    valor_cobrar: 184.0, valor_pago: null, glosa_recorrente: null,
    confianca: 'a_confirmar', exige_retalho: true, termos_exigidos: ['retalho'],
    vigencia_inicio: '2026-01-01',
  },
  {
    codigo_tuss: '30101522',
    descricao: 'Extensos ferimentos/cicatrizes - excisao e retalhos',
    valor_cobrar: 476.0, valor_pago: null, glosa_recorrente: null,
    confianca: 'a_confirmar', exige_retalho: true, termos_exigidos: ['retalho'],
    vigencia_inicio: '2026-01-01',
  },
  {
    codigo_tuss: '31305016',
    descricao: 'Ooforectomia laparoscopica uni/bilateral',
    valor_cobrar: 1056.78, valor_pago: 697.6, glosa_recorrente: 359.18,
    confianca: 'confirmado', vigencia_inicio: '2026-01-01',
  },
  {
    codigo_tuss: '30101913',
    descricao: 'TU partes moles - exerese',
    valor_cobrar: 100.0, valor_pago: 100.0, glosa_recorrente: 0,
    confianca: 'confirmado', pequena_cirurgia: true, vigencia_inicio: '2026-01-01',
  },
  {
    codigo_tuss: '42030153',
    descricao: 'Exerese de tumor de pele e mucosas',
    valor_cobrar: 120.0, valor_pago: 100.0, glosa_recorrente: 20.0,
    confianca: 'confirmado', pequena_cirurgia: true, vigencia_inicio: '2026-01-01',
  },
]

export const ATENDIMENTO_BASE = {
  numero: '188912993',
  data: '2026-08-10',
  local: 'Hospital Aldeota',
  classe: 'centro_cirurgico' as const,
}
