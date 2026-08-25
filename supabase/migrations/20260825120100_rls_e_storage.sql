-- =====================================================================
-- RLS. Usuario unico, mas a politica fica ligada: dado de saude e dado
-- pessoal sensivel (LGPD art. 5, II). Nada de acesso anonimo.
-- =====================================================================

alter table configuracao              enable row level security;
alter table procedimentos             enable row level security;
alter table pacientes                 enable row level security;
alter table atendimentos              enable row level security;
alter table procedimentos_realizados  enable row level security;
alter table glosas                    enable row level security;
alter table consultas                 enable row level security;
alter table documentos                enable row level security;
alter table alertas                   enable row level security;
alter table analises_ia               enable row level security;
alter table lotes_tiss                enable row level security;
alter table lote_guias                enable row level security;
alter table contadores                enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'configuracao','procedimentos','pacientes','atendimentos',
    'procedimentos_realizados','glosas','consultas','documentos',
    'alertas','analises_ia','lotes_tiss','lote_guias','contadores'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true)',
      'acesso_autenticado_' || t, t);
  end loop;
end $$;

revoke all on function proximo_numero(text, int) from public, anon;
grant execute on function proximo_numero(text, int) to authenticated;

-- ---------------------------------------------------------------------
-- Storage privado. URL assinada de validade curta, nunca bucket publico.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos', 'documentos', false, 20971520,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "documentos_select_autenticado" on storage.objects
  for select to authenticated using (bucket_id = 'documentos');
create policy "documentos_insert_autenticado" on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos');
create policy "documentos_update_autenticado" on storage.objects
  for update to authenticated using (bucket_id = 'documentos');
create policy "documentos_delete_autenticado" on storage.objects
  for delete to authenticated using (bucket_id = 'documentos');
