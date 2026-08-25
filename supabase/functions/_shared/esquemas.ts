/** Schemas JSON enviados ao modelo como input_schema da ferramenta. */

const campo = (descricao: string) => ({
  type: 'object',
  properties: {
    valor: { type: ['string', 'null'], description: descricao },
    confianca: { type: 'number', minimum: 0, maximum: 1 },
    ilegivel: { type: 'boolean' },
  },
  required: ['valor', 'confianca'],
})

export const ESQUEMA_EXTRACAO = {
  type: 'object',
  properties: {
    tipo_documento: { type: 'string', enum: ['boletim', 'ficha', 'guia', 'outro'] },
    confianca_geral: { type: 'number', minimum: 0, maximum: 1 },
    data: campo('data do procedimento em AAAA-MM-DD'),
    hora_inicio: campo('HH:MM'),
    hora_fim: campo('HH:MM'),
    paciente_nome: campo('nome do paciente como escrito'),
    carteira: campo('numero da carteira'),
    numero_atendimento: campo('numero do atendimento ou guia'),
    data_internacao: campo('AAAA-MM-DD'),
    acomodacao: campo('enfermaria ou apartamento'),
    plano: campo('nome do plano'),
    tipo_anestesia: campo('geral, raqui, local ou local+sedacao'),
    cirurgiao_principal: campo('nome do cirurgiao principal'),
    procedimentos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          codigo_tuss: campo('codigo do procedimento, so se constar na lista de codigos vigentes'),
          senha: campo('senha propria deste sitio; null se ilegivel - nunca inferir'),
          descricao: campo('descricao do procedimento como escrita'),
        },
        required: ['codigo_tuss', 'senha', 'descricao'],
      },
    },
    materiais: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nome: { type: 'string' },
          utilizado: { type: ['boolean', 'null'] },
        },
        required: ['nome', 'utilizado'],
      },
    },
    tela_utilizada: {
      type: 'object',
      properties: {
        valor: { type: ['boolean', 'null'] },
        confianca: { type: 'number' },
        ilegivel: { type: 'boolean' },
      },
      required: ['valor', 'confianca'],
    },
    descricao_cirurgica: campo('TRANSCRICAO LITERAL E COMPLETA, sem resumir'),
    campos_ilegiveis: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'tipo_documento', 'confianca_geral', 'data', 'hora_inicio', 'hora_fim',
    'paciente_nome', 'carteira', 'numero_atendimento', 'data_internacao',
    'acomodacao', 'plano', 'tipo_anestesia', 'cirurgiao_principal',
    'procedimentos', 'materiais', 'tela_utilizada', 'descricao_cirurgica',
    'campos_ilegiveis',
  ],
} as const

export const ESQUEMA_RISCO = {
  type: 'object',
  properties: {
    compativel: { type: 'boolean' },
    risco: { type: 'string', enum: ['baixo', 'medio', 'alto'] },
    achados: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string' },
          explicacao: { type: 'string' },
          sugestao_de_redacao: { type: ['string', 'null'] },
        },
        required: ['tipo', 'explicacao', 'sugestao_de_redacao'],
      },
    },
    confianca: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['compativel', 'risco', 'achados', 'confianca'],
} as const

export const MOTIVOS = [
  'nao_incluso_contrato', 'abaixo_tabela', 'duplicidade', 'senha_cancelada',
  'usuario_inativo', 'mudanca_codigo', 'autorizacao_pendente',
  'documentacao_insuficiente', 'outro',
]

export const ESQUEMA_NORMALIZACAO = {
  type: 'object',
  properties: {
    itens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          motivo: { type: 'string', enum: MOTIVOS },
          confianca: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['id', 'motivo', 'confianca'],
      },
    },
  },
  required: ['itens'],
} as const

export const ESQUEMA_RECURSO = {
  type: 'object',
  properties: {
    fundamentacao: { type: 'array', items: { type: 'string' } },
    texto: { type: 'string' },
    confianca: { type: 'number', minimum: 0, maximum: 1 },
    fatos_usados: {
      type: 'array',
      items: { type: 'string' },
      description: 'fatos do contexto efetivamente usados; nada fora desta lista pode aparecer no texto',
    },
  },
  required: ['fundamentacao', 'texto', 'confianca', 'fatos_usados'],
} as const
