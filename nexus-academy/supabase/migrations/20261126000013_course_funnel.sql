-- =============================================================================
-- Embudo por curso para el administrador: en qué lección se detienen los alumnos.
--
-- Con alumnos inscritos (acceso vigente, rol de alumno):
-- · inscritos, empezaron (al menos una lección con progreso), sin empezar,
--   terminaron el curso y tasa de finalización.
-- · Por lección, en el orden del temario: cuántos la completaron y cuántos
--   están «detenidos» en ella, es decir, empezaron el curso, no lo han
--   terminado y esa es la primera lección que les falta.
-- Solo conteos: no dice quién es cada alumno.
-- =============================================================================

create or replace function public.admin_course_funnel(p_course_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.courses where id = p_course_id) then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  with lessons as (
    select l.id, l.title, l.type::text as type, m.title as module_title,
           row_number() over (order by m.position, l.position, l.created_at)::int as idx
    from public.lessons l
    join public.modules m on m.id = l.module_id
    where l.course_id = p_course_id
  ),
  students as (
    select e.user_id, e.completed_at is not null as finished
    from public.enrollments e
    join public.profiles p on p.id = e.user_id and p.role = 'student'
    where e.course_id = p_course_id and e.revoked_at is null
  ),
  progress as (
    select lp.user_id, lp.lesson_id, lp.completed_at is not null as done
    from public.lesson_progress lp
    join students s on s.user_id = lp.user_id
    where lp.course_id = p_course_id
  ),
  started as (
    select distinct user_id from progress
  ),
  -- Primera lección que le falta a cada alumno que empezó y no terminó.
  stuck as (
    select s.user_id, (
      select min(le.idx) from lessons le
      where not exists (select 1 from progress pr where pr.user_id = s.user_id and pr.lesson_id = le.id and pr.done)
    ) as idx
    from students s
    join started st on st.user_id = s.user_id
    where not s.finished
  )
  select jsonb_build_object(
    'enrolled', (select count(*) from students),
    'started', (select count(*) from started),
    'not_started', (select count(*) from students s where not exists (select 1 from started st where st.user_id = s.user_id)),
    'completed', (select count(*) from students where finished),
    'completion_rate', (select case when count(*) = 0 then 0 else round(count(*) filter (where finished) * 100.0 / count(*), 1) end from students),
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'lesson_id', le.id,
        'idx', le.idx,
        'title', le.title,
        'type', le.type,
        'module_title', le.module_title,
        'completed', (select count(distinct pr.user_id) from progress pr where pr.lesson_id = le.id and pr.done),
        'stuck', (select count(*) from stuck sk where sk.idx = le.idx)
      ) order by le.idx)
      from lessons le
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_course_funnel(uuid) from public, anon;
grant execute on function public.admin_course_funnel(uuid) to authenticated;
