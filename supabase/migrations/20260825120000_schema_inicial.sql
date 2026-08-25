-- =====================================================================
-- Faturamento HAPVIDA - schema inicial
-- Dr. Jefferson Menezes Viana Santos - CRM 11.153 / RQE 10.042
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Configuracao do prestador. Linha unica (id = 1).
-- CNES fica PENDENTE ate ser informado; a geracao do XML TISS e
-- bloqueada enquanto isso (ver src/domain/tiss.ts).
-- ---------------------------------------------------------------------
create table configuracao (
  id                     int primary key default 1 check (id = 1),
  nome_prestador         text not null default 'JEFFERSON MENEZES VIANA SANTOS',
  crm                    text not null default '11153',
  conselho_profissional  text not null default '1',
  uf_conselho            text not null default '23',
  rqe                    text not null default '10042',
  cbos                   text not null default '225265',
  codigo_prestador_operadora text not null default '6122248',
  registro_ans           text not null default '368253',
  cnpj                   text not null default '63554067000198',
  cnes                   text,                  -- null = PENDENTE
  retencao_imagens_meses int not null default 24,
  atualizado_em          timestamptz default now()
);

insert into configuracao (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- Tabela de referencia de honorarios. Versionada por vigencia:
-- editar valor_cobrar cria NOVA vigencia, nunca sobrescreve (regra 10).
-- ---------------------------------------------------------------------
create table procedimentos (
  id               uuid primary key default gen_random_uuid(),
  codigo_tuss      text not null,
  descricao        text not null,
  valor_cobrar     numeric(10,2) not null,
  valor_pago       numeric(10,2),          -- null = ainda sem pagamento liquidado
  glosa_recorrente numeric(10,2) default 0,
  confianca        text not null check (confianca in ('confirmado','provavel','a_confirmar')),
  exige_tela       boolean default false,
  exige_retalho    boolean default false,  -- dispara alerta antiglosa
  termos_exigidos  text[],                 -- termos que a descricao deve conter
  -- regra 6: pequenas cirurgias adicionais no mesmo ato remuneram apenas uma
  pequena_cirurgia boolean not null default false,
  observacao       text,
  -- true quando o procedimento ainda nao tem codigo TUSS oficial informado
  -- e usa um codigo interno provisorio (prefixo SEM-TUSS-).
  codigo_interno   boolean not null default false,
  equivalente_a    text,                   -- codigo TUSS equivalente (regra 4)
  vigencia_inicio  date not null,
  vigencia_fim     date,
  created_at       timestamptz default now()
);

create unique index procedimentos_codigo_vigencia_idx
  on procedimentos (codigo_tuss, vigencia_inicio);
create index procedimentos_codigo_idx on procedimentos (codigo_tuss);

create table pacientes (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  carteira     text,
  cpf          text,
  created_at   timestamptz default now()
);
create index pacientes_nome_idx on pacientes (lower(nome));

create table atendimentos (
  id              uuid primary key default gen_random_uuid(),
  paciente_id     uuid references pacientes(id),
  numero          text not null unique,   -- no do atendimento/guia, ex. 188912993
  data            date not null,
  hora_inicio     time,
  hora_fim        time,
  local           text,                   -- Aldeota | Sao Mateus | Hapclinica
  acomodacao      text,                   -- enfermaria | apartamento
  tipo_anestesia  text,                   -- geral | raqui | local | local+sedacao
  classe          text,                   -- 'centro_cirurgico' | 'pqa'
  plano           text,
  validade_autorizacao date,              -- regra 7 do checklist
  observacao      text,
  created_at      timestamptz default now()
);
create index atendimentos_data_idx on atendimentos (data);

create table procedimentos_realizados (
  id                  uuid primary key default gen_random_uuid(),
  atendimento_id      uuid references atendimentos(id) on delete cascade,
  codigo_tuss         text not null,
  senha               text not null,      -- CADA SITIO TEM SENHA PROPRIA
  valor_cobrado       numeric(10,2) not null,
  valor_previsto      numeric(10,2),
  descricao_cirurgica text,               -- texto do boletim, base do checklist
  autorizado_na_guia  boolean default true,   -- regra 4 do checklist
  tela_autorizada     boolean default false,
  tela_utilizada      boolean default false,
  cirurgiao_principal boolean not null default true,   -- regra 3
  decisao_intraoperatoria boolean not null default false, -- regra 5
  situacao            text default 'a_faturar'
                      check (situacao in ('a_faturar','faturado','pago',
                                          'glosado','em_recurso','recuperado')),
  origem              text default 'manual',  -- 'manual' | 'ocr'
  rascunho            boolean not null default false,  -- true enquanto vem de OCR nao revisado
  faturado_em         timestamptz,        -- marcado na tela de digitacao assistida (SAVI)
  created_at          timestamptz default now()
);
create index proc_realizados_atendimento_idx on procedimentos_realizados (atendimento_id);
create index proc_realizados_situacao_idx on procedimentos_realizados (situacao);
create index proc_realizados_senha_idx on procedimentos_realizados (senha);

create table glosas (
  id              uuid primary key default gen_random_uuid(),
  procedimento_realizado_id uuid references procedimentos_realizados(id) on delete set null,
  codigo_tuss     text,                   -- redundante de proposito: glosa importada
  competencia     text not null,          -- 'MEDISA 03/2026'
  valor_glosado   numeric(10,2) not null,
  valor_recurso   numeric(10,2) default 0,
  justificativa   text,
  justificativa_normalizada text,         -- preenchida pela IA, ver §11
  data_demonstrativo date,
  -- 30 dias apos o demonstrativo. date + int e imutavel (date + interval nao e,
  -- e generated columns exigem expressao imutavel).
  prazo_recurso   date generated always as (data_demonstrativo + 30) stored,
  recursada       boolean default false,
  resultado       text,
  created_at      timestamptz default now()
);
create index glosas_competencia_idx on glosas (competencia);
create index glosas_prazo_idx on glosas (prazo_recurso);

create table consultas (
  id            uuid primary key default gen_random_uuid(),
  data          date not null,
  unidade       text not null,
  qtd_consultas int not null default 0,
  qtd_retornos  int not null default 0,
  valor_unitario numeric(10,2) not null default 60.00,
  created_at    timestamptz default now()
);
create index consultas_data_idx on consultas (data);

create table documentos (
  id              uuid primary key default gen_random_uuid(),
  atendimento_id  uuid references atendimentos(id) on delete set null,
  tipo            text check (tipo in ('boletim','ficha','guia','outro')),
  storage_path    text not null,
  hash_arquivo    text,                   -- dedupe de foto repetida
  extracao_status text default 'pendente'
                  check (extracao_status in ('pendente','processando','extraido','revisado','falhou')),
  extracao_json   jsonb,                  -- campos + confianca por campo
  erro            text,
  revisado_em     timestamptz,
  expurgado_em    timestamptz,            -- imagem original apagada pela politica de retencao
  created_at      timestamptz default now()
);
create unique index documentos_hash_idx on documentos (hash_arquivo) where hash_arquivo is not null;
create index documentos_status_idx on documentos (extracao_status);

create table alertas (
  id              uuid primary key default gen_random_uuid(),
  procedimento_realizado_id uuid references procedimentos_realizados(id) on delete cascade,
  regra           text not null,
  severidade      text check (severidade in ('critico','atencao','info')),
  mensagem        text not null,
  sugestao        text,                   -- texto copiavel de blindagem
  origem          text default 'deterministica',  -- 'deterministica' | 'ia'
  resolvido       boolean default false,
  created_at      timestamptz default now()
);
create index alertas_proc_idx on alertas (procedimento_realizado_id);
create index alertas_abertos_idx on alertas (resolvido, severidade);

-- Trilha de auditoria de tudo que a IA produziu. Obrigatoria.
create table analises_ia (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('extracao','risco_glosa','padrao','recurso','redacao')),
  referencia_id uuid,                     -- documento, procedimento ou glosa
  modelo        text not null,
  prompt_versao text not null,
  entrada_resumo text,                    -- NUNCA a integra com dados de paciente
  saida         jsonb not null,
  confianca     numeric,
  aceita        boolean,                  -- o medico confirmou?
  editada       boolean,
  created_at    timestamptz default now()
);
create index analises_ia_ref_idx on analises_ia (tipo, referencia_id);

-- ---------------------------------------------------------------------
-- Lotes TISS: numeracao sequencial de lote e de guia controlada no banco.
-- ---------------------------------------------------------------------
create table lotes_tiss (
  id                uuid primary key default gen_random_uuid(),
  numero_lote       bigint not null unique,
  competencia       text not null,          -- 'MEDISA 08/2026'
  guia_inicial      bigint not null,
  guia_final        bigint not null,
  qtd_guias         int not null,
  valor_total       numeric(12,2) not null,
  xml_path          text,
  hash_documento    text,
  gerado_em         timestamptz default now(),
  enviado_em        timestamptz,
  observacao        text
);

create table lote_guias (
  id             uuid primary key default gen_random_uuid(),
  lote_id        uuid references lotes_tiss(id) on delete cascade,
  atendimento_id uuid references atendimentos(id) on delete set null,
  numero_guia    bigint not null,
  valor          numeric(10,2) not null
);
create index lote_guias_lote_idx on lote_guias (lote_id);

-- Sequencias de numeracao. Consumidas por rpc proximo_numero().
create table contadores (
  chave  text primary key,   -- 'lote' | 'guia'
  valor  bigint not null default 0
);
insert into contadores (chave, valor) values ('lote', 0), ('guia', 0)
  on conflict do nothing;

create or replace function proximo_numero(p_chave text, p_quantidade int default 1)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novo bigint;
begin
  update contadores set valor = valor + p_quantidade
   where chave = p_chave
   returning valor into v_novo;
  if v_novo is null then
    raise exception 'contador % inexistente', p_chave;
  end if;
  -- devolve o PRIMEIRO numero do intervalo reservado
  return v_novo - p_quantidade + 1;
end;
$$;
