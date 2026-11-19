-- =============================================================================
-- NEXUS ACADEMY · Almacenamiento y lecturas públicas seguras
-- =============================================================================

-- Buckets ---------------------------------------------------------------------
-- avatars y course-covers son públicos (imágenes). Los videos y materiales son
-- privados: el servidor comprueba el acceso y entrega URLs firmadas de corta
-- duración.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('course-covers', 'course-covers', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('course-videos', 'course-videos', false, null, array['video/mp4', 'video/webm', 'video/quicktime']),
  ('course-materials', 'course-materials', false, 104857600, array[
    'application/pdf', 'application/zip', 'application/x-zip-compressed', 'text/plain', 'text/markdown',
    'text/csv', 'application/json', 'image/png', 'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ])
on conflict (id) do nothing;

-- Avatares: cada usuario escribe solo en su carpeta {user_id}/...
create policy "avatars: lectura pública" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars: subir propio" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: actualizar propio" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: borrar propio" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Portadas: lectura pública, escritura admin.
create policy "covers: lectura pública" on storage.objects for select
  using (bucket_id = 'course-covers');
create policy "covers: admin escribe" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-covers' and public.is_admin());
create policy "covers: admin actualiza" on storage.objects for update to authenticated
  using (bucket_id = 'course-covers' and public.is_admin());
create policy "covers: admin borra" on storage.objects for delete to authenticated
  using (bucket_id = 'course-covers' and public.is_admin());

-- Videos y materiales privados: solo admin directamente. Los alumnos los
-- reciben mediante URLs firmadas emitidas por el servidor tras validar acceso.
create policy "privados: admin lee" on storage.objects for select to authenticated
  using (bucket_id in ('course-videos', 'course-materials') and public.is_admin());
create policy "privados: admin sube" on storage.objects for insert to authenticated
  with check (bucket_id in ('course-videos', 'course-materials') and public.is_admin());
create policy "privados: admin actualiza" on storage.objects for update to authenticated
  using (bucket_id in ('course-videos', 'course-materials') and public.is_admin());
create policy "privados: admin borra" on storage.objects for delete to authenticated
  using (bucket_id in ('course-videos', 'course-materials') and public.is_admin());

-- -----------------------------------------------------------------------------
-- Reseñas públicas sin exponer datos personales (solo nombre de pila + inicial)
-- -----------------------------------------------------------------------------
create or replace function public.display_name(p_full_name text, p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(trim(p_full_name), '') = '' then 'Alumno NEXUS'
    when position(' ' in trim(p_full_name)) = 0 then trim(p_full_name)
    else split_part(trim(p_full_name), ' ', 1) || ' ' || left(split_part(trim(p_full_name), ' ', 2), 1) || '.'
  end;
$$;

create or replace function public.course_reviews(p_course_id uuid, p_limit int default 20, p_offset int default 0)
returns table (
  id uuid,
  rating int,
  comment text,
  created_at timestamptz,
  author_name text,
  author_avatar text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.rating, r.comment, r.created_at,
         public.display_name(p.full_name, p.email::text), p.avatar_url
  from public.reviews r
  join public.profiles p on p.id = r.user_id
  join public.courses c on c.id = r.course_id
  where r.course_id = p_course_id and r.status = 'published' and c.status = 'published'
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
$$;

-- Opiniones destacadas reales para la portada (4+ estrellas con comentario).
create or replace function public.featured_reviews(p_limit int default 6)
returns table (
  id uuid,
  rating int,
  comment text,
  created_at timestamptz,
  author_name text,
  author_avatar text,
  course_title text,
  course_slug text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.rating, r.comment, r.created_at,
         public.display_name(p.full_name, p.email::text), p.avatar_url,
         c.title, c.slug
  from public.reviews r
  join public.profiles p on p.id = r.user_id
  join public.courses c on c.id = r.course_id
  where r.status = 'published' and c.status = 'published'
    and r.rating >= 4 and coalesce(trim(r.comment), '') <> ''
  order by r.rating desc, r.created_at desc
  limit least(greatest(p_limit, 1), 24);
$$;

grant execute on function public.display_name(text, text) to anon, authenticated;
grant execute on function public.course_reviews(uuid, int, int) to anon, authenticated;
grant execute on function public.featured_reviews(int) to anon, authenticated;
