-- =============================================================================
-- Aviso por correo cuando se libera un módulo programado («drip»).
--
-- module_unlock_candidates(): alumnos con acceso vigente y «Recordatorios y
-- avisos» activados, cuyo módulo programado se liberó en las últimas
-- p_window_hours horas (por omisión 48, para que una tarea diaria con retraso
-- no se salte a nadie). El servidor deduplica el envío por alumno y módulo.
-- Solo la llama el servidor con la clave de servicio (tarea programada).
-- =============================================================================

create or replace function public.module_unlock_candidates(
  p_now timestamptz default now(),
  p_window_hours int default 48,
  p_limit int default 500
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  course_slug text,
  course_title text,
  module_id uuid,
  module_title text,
  first_lesson_id uuid,
  released_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.user_id, p.email::text, p.full_name, c.slug, c.title, m.id, m.title,
         (select l.id from public.lessons l where l.module_id = m.id order by l.position, l.created_at limit 1),
         e.created_at + make_interval(days => m.release_after_days)
  from public.enrollments e
  join public.profiles p on p.id = e.user_id and p.reminder_opt_in
  join public.courses c on c.id = e.course_id
  join public.modules m on m.course_id = e.course_id and coalesce(m.release_after_days, 0) > 0
  where e.revoked_at is null
    and e.created_at + make_interval(days => m.release_after_days) <= p_now
    and e.created_at + make_interval(days => m.release_after_days) > p_now - make_interval(hours => greatest(coalesce(p_window_hours, 48), 1))
    and exists (select 1 from public.lessons l where l.module_id = m.id)
  order by 9, e.user_id
  limit least(greatest(coalesce(p_limit, 500), 1), 2000);
$$;

revoke all on function public.module_unlock_candidates(timestamptz, int, int) from public, anon, authenticated;
grant execute on function public.module_unlock_candidates(timestamptz, int, int) to service_role;
