-- =====================================================================
-- Controle de acesso do faturamento.
--
-- O projeto Supabase e compartilhado com outros sistemas e ja tem varias
-- contas cadastradas. A policy original dizia "qualquer usuario
-- autenticado pode tudo", o que na pratica daria a todas essas contas
-- acesso ao faturamento. Aqui a permissao passa a ser por e-mail
-- explicitamente liberado.
-- =====================================================================

create table if not exists faturamento.usuarios_permitidos (
  email      text primary key,
  papel      text not null default 'medico' check (papel in ('medico','contabilidade')),
  criado_em  timestamptz default now()
);

alter table faturamento.usuarios_permitidos enable row level security;

grant all on faturamento.usuarios_permitidos to authenticated, service_role;

-- O titular. Novos acessos (contabilidade, por exemplo) entram aqui.
insert into faturamento.usuarios_permitidos (email, papel)
values ('jeffersonmvs@gmail.com', 'medico')
on conflict (email) do nothing;

/**
 * security definer para poder ler usuarios_permitidos sem cair na propria
 * RLS - senao a checagem de permissao dependeria da permissao.
 */
create or replace function faturamento.tem_acesso()
returns boolean
language sql
stable
security definer
set search_path = faturamento
as $$
  select exists (
    select 1 from faturamento.usuarios_permitidos
     where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function faturamento.tem_acesso() from public, anon;
grant execute on function faturamento.tem_acesso() to authenticated;

-- Troca as policies permissivas pelas restritas.
do $$
declare t text;
begin
  foreach t in array array[
    'configuracao','procedimentos','pacientes','atendimentos',
    'procedimentos_realizados','glosas','consultas','documentos',
    'alertas','analises_ia','lotes_tiss','lote_guias','contadores',
    'usuarios_permitidos'
  ] loop
    execute format('drop policy if exists %I on faturamento.%I',
                   'acesso_autenticado_' || t, t);
    execute format(
      'create policy %I on faturamento.%I for all to authenticated '
      || 'using (faturamento.tem_acesso()) with check (faturamento.tem_acesso())',
      'acesso_permitido_' || t, t);
  end loop;
end $$;

-- Mesma regra no Storage: bucket privado so para quem esta liberado.
drop policy if exists "faturamento_documentos_select_autenticado" on storage.objects;
drop policy if exists "faturamento_documentos_insert_autenticado" on storage.objects;
drop policy if exists "faturamento_documentos_update_autenticado" on storage.objects;
drop policy if exists "faturamento_documentos_delete_autenticado" on storage.objects;

create policy "faturamento_documentos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'faturamento-documentos' and faturamento.tem_acesso());
create policy "faturamento_documentos_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'faturamento-documentos' and faturamento.tem_acesso());
create policy "faturamento_documentos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'faturamento-documentos' and faturamento.tem_acesso());
create policy "faturamento_documentos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'faturamento-documentos' and faturamento.tem_acesso());
