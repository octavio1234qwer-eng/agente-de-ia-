-- =============================================================================
-- Aviso por correo cuando la racha de estudio está por perderse.
--
-- Candidatos: alumnos con «Recordatorios de aprendizaje» activados, cuya racha
-- (días consecutivos con actividad real) termina AYER en su zona horaria, que
-- hoy aún no estudian y para quienes ahora es tarde-noche (por omisión de 16 a
-- 22 h locales). Como máximo un aviso enviado cada 3 días por alumno.
-- Solo la llama el servidor con la clave de servicio (tarea programada).
-- =============================================================================

create index if not exists email_log_user_template_idx on public.email_log (user_id, template, created_at desc);

create or replace function public.streak_reminder_candidates(
  p_now timestamptz default now(),
  p_min_streak int default 2,
  p_from_hour int default 16,
  p_to_hour int default 22,
  p_limit int default 500
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  time_zone text,
  local_date date,
  streak int,
  course_slug text,
  course_title text
)
language sql
stable
security definer
set search_path = ''
as $$
  with eligible as (
    select p.id, p.email, p.full_name, p.time_zone,
           (p_now at time zone p.time_zone)::date as today
    from public.profiles p
    where p.reminder_opt_in
      and extract(hour from (p_now at time zone p.time_zone)) between p_from_hour and p_to_hour
      and not exists (
        select 1 from public.email_log l
        where l.user_id = p.id and l.template = 'streak_reminder' and l.status = 'sent'
          and l.created_at > p_now - interval '3 days')
  ),
  days as (
    select distinct e.id, (a.at_hour at time zone e.time_zone)::date as d
    from eligible e
    join public.learning_activity a on a.user_id = e.id
    where a.at_hour <= p_now
  ),
  runs as (
    select id, max(d) as last_d, count(*)::int as len
    from (select id, d, d - (row_number() over (partition by id order by d))::int as grp from days) x
    group by id, grp
  )
  select e.id, e.email, e.full_name, e.time_zone, e.today, r.len, c.slug, c.title
  from eligible e
  -- La racha que termina ayer: si hubiera actividad hoy, esa misma racha terminaría hoy.
  join runs r on r.id = e.id and r.last_d = e.today - 1 and r.len >= p_min_streak
  left join lateral (
    select co.slug, co.title
    from public.enrollments en
    join public.courses co on co.id = en.course_id
    where en.user_id = e.id and en.revoked_at is null and en.completed_at is null
    order by en.last_activity_at desc nulls last, en.created_at desc
    limit 1
  ) c on true
  order by r.len desc, e.id
  limit p_limit;
$$;

revoke all on function public.streak_reminder_candidates(timestamptz, int, int, int, int) from public, anon, authenticated;
grant execute on function public.streak_reminder_candidates(timestamptz, int, int, int, int) to service_role;
