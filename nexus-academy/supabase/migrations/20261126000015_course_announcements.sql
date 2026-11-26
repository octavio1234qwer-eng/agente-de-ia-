-- =============================================================================
-- Avisos del curso: el administrador publica novedades para los alumnos de un
-- curso (material nuevo, cambios de fecha, sesiones en vivo…).
--
-- · Los leen solo quienes tienen acceso vigente al curso (y el admin).
-- · Solo el admin los crea, edita o borra.
-- · Cada alumno marca como vistos los avisos de SU inscripción con
--   mark_announcements_seen(); course_announcements_unseen() cuenta los nuevos
--   por curso para «Mis cursos» y el aula.
-- · El envío por correo lo hace el servidor (solo a alumnos con acceso y con
--   «Recordatorios y avisos» activados) y guarda aquí solo los conteos.
-- =============================================================================

create table if not exists public.course_announcements (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 140),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  emailed_at timestamptz,
  email_sent int not null default 0 check (email_sent >= 0),
  email_skipped int not null default 0 check (email_skipped >= 0),
  email_failed int not null default 0 check (email_failed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists course_announcements_course_idx on public.course_announcements (course_id, created_at desc);

drop trigger if exists course_announcements_updated_at on public.course_announcements;
create trigger course_announcements_updated_at before update on public.course_announcements
  for each row execute function public.set_updated_at();

alter table public.enrollments add column if not exists announcements_seen_at timestamptz;

alter table public.course_announcements enable row level security;
revoke all on public.course_announcements from anon, authenticated;
grant select on public.course_announcements to authenticated;
grant insert (course_id, author_id, title, body), update (title, body), delete on public.course_announcements to authenticated;

create policy "course_announcements: leer con acceso al curso" on public.course_announcements for select to authenticated
  using (public.has_course_access(course_id));
create policy "course_announcements: admin crea" on public.course_announcements for insert to authenticated
  with check (public.is_admin() and author_id = (select auth.uid()));
create policy "course_announcements: admin edita" on public.course_announcements for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "course_announcements: admin borra" on public.course_announcements for delete to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- El alumno marca como vistos los avisos de un curso (solo su inscripción).
-- -----------------------------------------------------------------------------
create or replace function public.mark_announcements_seen(p_course_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.enrollments
  set announcements_seen_at = now()
  where user_id = (select auth.uid()) and course_id = p_course_id and revoked_at is null;
$$;

revoke all on function public.mark_announcements_seen(uuid) from public, anon;
grant execute on function public.mark_announcements_seen(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Avisos nuevos por curso para el alumno actual: publicados después de la última
-- vez que los vio (todos, si nunca los ha visto). Solo cursos con acceso vigente.
-- -----------------------------------------------------------------------------
create or replace function public.course_announcements_unseen()
returns table (course_id uuid, unseen int, latest_title text, latest_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.course_id,
         count(a.id)::int,
         (array_agg(a.title order by a.created_at desc))[1],
         max(a.created_at)
  from public.enrollments e
  join public.course_announcements a
    on a.course_id = e.course_id
   and a.created_at > coalesce(e.announcements_seen_at, '-infinity'::timestamptz)
  where e.user_id = (select auth.uid()) and e.revoked_at is null
  group by e.course_id;
$$;

revoke all on function public.course_announcements_unseen() from public, anon;
grant execute on function public.course_announcements_unseen() to authenticated;
