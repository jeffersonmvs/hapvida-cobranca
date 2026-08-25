-- =====================================================================
-- RLS. Usuario unico, mas a politica fica ligada: dado de saude e dado
-- pessoal sensivel (LGPD art. 5, II). Nada de acesso anonimo.
-- =====================================================================

alter table faturamento.configuracao              enable row level security;
alter table faturamento.procedimentos             enable row level security;
alter table faturamento.pacientes                 enable row level security;
alter table faturamento.atendimentos              enable row level security;
alter table faturamento.procedimentos_realizados  enable row level security;
alter table faturamento.glosas                    enable row level security;
alter table faturamento.consultas                 enable row level security;
alter table faturamento.documentos                enable row level security;
alter table faturamento.alertas                   enable row level security;
alter table faturamento.analises_ia               enable row level security;
alter table faturamento.lotes_tiss                enable row level security;
alter table faturamento.lote_guias                enable row level security;
alter table faturamento.contadores                enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'configuracao','procedimentos','pacientes','atendimentos',
    'procedimentos_realizados','glosas','consultas','documentos',
    'alertas','analises_ia','lotes_tiss','lote_guias','contadores'
  ] loop
    execute format(
      'create policy %I on faturamento.%I for all to authenticated using (true) with check (true)',
      'acesso_autenticado_' || t, t);
  end loop;
end $$;

revoke all on function faturamento.proximo_numero(text, int) from public, anon;
grant execute on function faturamento.proximo_numero(text, int) to authenticated;

-- ---------------------------------------------------------------------
-- Storage privado. URL assinada de validade curta, nunca bucket publico.
-- O Storage e global ao projeto, entao o bucket tambem leva nome proprio.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'faturamento-documentos', 'faturamento-documentos', false, 20971520,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "faturamento_documentos_select_autenticado" on storage.objects
  for select to authenticated using (bucket_id = 'faturamento-documentos');
create policy "faturamento_documentos_insert_autenticado" on storage.objects
  for insert to authenticated with check (bucket_id = 'faturamento-documentos');
create policy "faturamento_documentos_update_autenticado" on storage.objects
  for update to authenticated using (bucket_id = 'faturamento-documentos');
create policy "faturamento_documentos_delete_autenticado" on storage.objects
  for delete to authenticated using (bucket_id = 'faturamento-documentos');
