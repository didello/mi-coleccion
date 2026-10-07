-- Mi Colección · esquema de Supabase
-- Se ejecuta una sola vez en el SQL Editor del proyecto. Es seguro volver a ejecutarlo.
--
-- Los datos se guardan como documentos JSON agrupados por colección
-- (items, media, wishlist, topps, meta), igual que en la primera versión de la app.
-- Cada fila pertenece a un usuario y las políticas RLS hacen que cada uno
-- solo vea y modifique sus propios datos.

create table if not exists public.documents (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null check (collection ~ '^[a-z_]{1,40}$'),
  id         text        not null check (char_length(id) between 1 and 200),
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

alter table public.documents enable row level security;

drop policy if exists "documents: leer los míos"      on public.documents;
drop policy if exists "documents: crear los míos"     on public.documents;
drop policy if exists "documents: modificar los míos" on public.documents;
drop policy if exists "documents: borrar los míos"    on public.documents;

create policy "documents: leer los míos"      on public.documents for select to authenticated using (user_id = auth.uid());
create policy "documents: crear los míos"     on public.documents for insert to authenticated with check (user_id = auth.uid());
create policy "documents: modificar los míos" on public.documents for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "documents: borrar los míos"    on public.documents for delete to authenticated using (user_id = auth.uid());

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

-- Fusiona campos en un documento (como "update" en la versión anterior) sin pisar el resto.
create or replace function public.doc_merge(p_collection text, p_id text, p_patch jsonb)
returns void
language sql security invoker set search_path = '' as $$
  insert into public.documents (user_id, collection, id, data)
  values (auth.uid(), p_collection, p_id, p_patch)
  on conflict (user_id, collection, id)
  do update set data = public.documents.data || excluded.data;
$$;

grant execute on function public.doc_merge(text, text, jsonb) to authenticated;

-- Cambios en tiempo real (para ver en el móvil lo que cambias en el ordenador).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents'
  ) then
    alter publication supabase_realtime add table public.documents;
  end if;
end $$;

-- ---------- Imágenes ----------
-- "fotos": fotos de tus copias. Privado; cada usuario solo accede a su carpeta (<user_id>/...).
-- "catalogo": imágenes oficiales, hojas del álbum Topps y su catálogo. Lectura pública.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('fotos',    'fotos',    false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('catalogo', 'catalogo', true,  10485760, array['image/jpeg','image/png','image/webp','application/json'])
on conflict (id) do nothing;

drop policy if exists "fotos: leer las mías"      on storage.objects;
drop policy if exists "fotos: subir las mías"     on storage.objects;
drop policy if exists "fotos: cambiar las mías"   on storage.objects;
drop policy if exists "fotos: borrar las mías"    on storage.objects;
drop policy if exists "catalogo: subir"           on storage.objects;
drop policy if exists "catalogo: cambiar"         on storage.objects;

create policy "fotos: leer las mías"    on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos: subir las mías"   on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos: cambiar las mías" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos: borrar las mías"  on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- El catálogo lo sube la importación inicial desde la app (con sesión iniciada).
drop policy if exists "catalogo: leer" on storage.objects;
create policy "catalogo: leer"    on storage.objects for select to authenticated using (bucket_id = 'catalogo');
create policy "catalogo: subir"   on storage.objects for insert to authenticated with check (bucket_id = 'catalogo');
create policy "catalogo: cambiar" on storage.objects for update to authenticated using (bucket_id = 'catalogo');
