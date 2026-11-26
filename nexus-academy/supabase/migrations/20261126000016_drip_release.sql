-- =============================================================================
-- Liberación programada de contenido («drip»).
--
-- Cada módulo puede liberarse N días después de la inscripción del alumno
-- (modules.release_after_days; vacío o 0 = disponible desde el primer día).
-- La regla vive en la base: can_view_lesson() la aplica, y de ella dependen la
-- RLS del contenido y los recursos (y con ello videos firmados, subtítulos,
-- búsqueda y tutor IA), el cuestionario, el progreso y las notas.
-- · Las lecciones de vista previa gratuita siguen abiertas.
-- · El administrador ve todo sin esperar.
-- =============================================================================

alter table public.modules
  add column if not exists release_after_days int check (release_after_days between 0 and 730);

comment on column public.modules.release_after_days is
  'Días después de la inscripción en que se libera el módulo (null/0 = de inmediato).';

-- Momento en que el alumno actual puede ver un módulo (null = ya disponible o sin inscripción).
create or replace function public.module_release_at(p_module_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(m.release_after_days, 0) = 0 or public.is_admin() then null
    else (
      select e.created_at + make_interval(days => m.release_after_days)
      from public.enrollments e
      where e.user_id = (select auth.uid()) and e.course_id = m.course_id and e.revoked_at is null
    )
  end
  from public.modules m
  where m.id = p_module_id;
$$;

create or replace function public.module_released(p_module_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.modules m
    where m.id = p_module_id
      and (
        coalesce(m.release_after_days, 0) = 0
        or public.is_admin()
        or exists (
          select 1 from public.enrollments e
          where e.user_id = (select auth.uid()) and e.course_id = m.course_id and e.revoked_at is null
            and e.created_at + make_interval(days => m.release_after_days) <= now()
        )
      )
  );
$$;

-- Una lección es visible con acceso al curso Y su módulo ya liberado, o si es
-- vista previa gratuita de un curso publicado.
create or replace function public.can_view_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lessons l
    join public.courses c on c.id = l.course_id
    where l.id = p_lesson_id
      and (
        (public.has_course_access(l.course_id) and public.module_released(l.module_id))
        or (l.is_preview and c.status = 'published')
      )
  );
$$;

-- El progreso solo se registra en lecciones que el alumno ya puede ver.
drop policy if exists "lesson_progress: registrar con acceso" on public.lesson_progress;
create policy "lesson_progress: registrar con acceso" on public.lesson_progress for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_course_access(course_id)
    and public.can_view_lesson(lesson_id)
    and (completed_at is null or exists (
      select 1 from public.lessons l where l.id = lesson_id and l.type <> 'quiz'))
  );
drop policy if exists "lesson_progress: actualizar con acceso" on public.lesson_progress;
create policy "lesson_progress: actualizar con acceso" on public.lesson_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.has_course_access(course_id)
    and public.can_view_lesson(lesson_id)
    and (completed_at is null or exists (
      select 1 from public.lessons l where l.id = lesson_id and l.type <> 'quiz'))
  );

-- Preguntas: solo en lecciones visibles para quien pregunta.
drop policy if exists "lesson_questions: preguntar con acceso al curso" on public.lesson_questions;
create policy "lesson_questions: preguntar con acceso al curso" on public.lesson_questions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_course_access(course_id) and public.can_view_lesson(lesson_id));

revoke all on function public.module_release_at(uuid) from public, anon;
grant execute on function public.module_release_at(uuid) to authenticated;
revoke all on function public.module_released(uuid) from public, anon;
grant execute on function public.module_released(uuid) to authenticated;

-- submit_quiz_attempt() es security definer (no pasa por la RLS): este trigger
-- impide registrar un intento en una lección que el alumno aún no puede ver.
create or replace function public.quiz_attempts_require_visible()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.can_view_lesson(new.lesson_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.quiz_attempts_require_visible() from public, anon, authenticated;
drop trigger if exists quiz_attempts_require_visible on public.quiz_attempts;
create trigger quiz_attempts_require_visible before insert on public.quiz_attempts
  for each row execute function public.quiz_attempts_require_visible();
