-- =============================================================================
-- Actividad de estudio agregada para el dashboard del administrador.
--
-- Solo conteos (nunca qué estudió cada quien): alumnos que estudiaron por día
-- y por semana, lecciones completadas y días de estudio promedio. Sale de
-- learning_activity (actividad real registrada por triggers) y de
-- lesson_progress.completed_at. Cuenta solo perfiles con rol de alumno y usa
-- la hora de la plataforma (CDMX), igual que el resto del dashboard.
-- =============================================================================

create or replace function public.admin_learning_activity(
  p_days int default 30,
  p_tz text default 'America/Mexico_City',
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_from date;
  v_week date;
  v_start date;
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 366 then
    raise exception 'invalid_days' using errcode = '22023';
  end if;

  v_today := (p_now at time zone p_tz)::date;
  v_from := v_today - (p_days - 1);
  v_week := date_trunc('week', v_today)::date;             -- lunes de esta semana
  v_start := least(v_from, v_week - 7 * 11);                -- 12 semanas completas

  with act as (
    select distinct a.user_id, (a.at_hour at time zone p_tz)::date as d
    from public.learning_activity a
    join public.profiles p on p.id = a.user_id and p.role = 'student'
    where a.at_hour >= (v_start::timestamp at time zone p_tz) and a.at_hour <= p_now
  ),
  done as (
    select distinct lp.user_id, lp.lesson_id, (lp.completed_at at time zone p_tz)::date as d
    from public.lesson_progress lp
    join public.profiles p on p.id = lp.user_id and p.role = 'student'
    where lp.completed_at >= (v_from::timestamp at time zone p_tz) and lp.completed_at <= p_now
  ),
  days as (
    select (v_from + i)::date as d from generate_series(0, p_days - 1) i
  ),
  weeks as (
    select (v_week - 7 * i)::date as w from generate_series(0, 11) i
  )
  select jsonb_build_object(
    'time_zone', p_tz,
    'today', v_today,
    'active_today', (select count(distinct user_id) from act where d = v_today),
    'active_7d', (select count(distinct user_id) from act where d > v_today - 7),
    'active_period', (select count(distinct user_id) from act where d >= v_from),
    'lessons_period', (select count(*) from done),
    'avg_days', (select coalesce(round(count(*)::numeric / nullif(count(distinct user_id), 0), 1), 0) from act where d >= v_from),
    'daily', (
      select jsonb_agg(jsonb_build_object(
        'day', x.d,
        'students', (select count(distinct a.user_id) from act a where a.d = x.d),
        'lessons', (select count(*) from done c where c.d = x.d)
      ) order by x.d)
      from days x
    ),
    'weekly', (
      select jsonb_agg(jsonb_build_object(
        'week', w.w,
        'students', (select count(distinct a.user_id) from act a where a.d >= w.w and a.d < w.w + 7)
      ) order by w.w)
      from weeks w
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_learning_activity(int, text, timestamptz) from public, anon;
grant execute on function public.admin_learning_activity(int, text, timestamptz) to authenticated;
