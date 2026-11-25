-- =============================================================================
-- Racha de estudio y meta semanal del alumno.
--
-- Todo sale del progreso real:
-- · Actividad: cada vez que el alumno avanza un video, marca una lección,
--   presenta una evaluación o guarda una nota, se registra la HORA (no el
--   detalle) en learning_activity. Lo escriben triggers con los datos del
--   propio alumno; nadie puede insertar actividad a mano desde la app.
-- · Días: se calculan al leer con la zona horaria del perfil, así cambiar de
--   zona no rompe el historial.
-- · Meta semanal: lecciones distintas completadas desde el lunes (zona del
--   alumno), leídas de lesson_progress.completed_at.
-- =============================================================================

-- Preferencias en el perfil ---------------------------------------------------
alter table public.profiles
  add column time_zone text not null default 'America/Mexico_City',
  add column weekly_lesson_goal smallint not null default 3
    constraint profiles_weekly_lesson_goal_range check (weekly_lesson_goal between 1 and 50);

create or replace function public.profiles_validate_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_time_zone_valid before insert or update of time_zone
  on public.profiles for each row execute function public.profiles_validate_time_zone();

grant update (time_zone, weekly_lesson_goal) on public.profiles to authenticated;

-- Registro de actividad (una fila por alumno y hora) --------------------------
create table public.learning_activity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  at_hour timestamptz not null,
  primary key (user_id, at_hour),
  constraint learning_activity_whole_hour check (at_hour = date_trunc('hour', at_hour))
);

alter table public.learning_activity enable row level security;
revoke all on public.learning_activity from anon, authenticated;
grant select on public.learning_activity to authenticated;
create policy "learning_activity: propia" on public.learning_activity
  for select to authenticated using (user_id = (select auth.uid()));

-- Solo cuenta lo que hace el propio alumno (no un admin ni un proceso interno).
create or replace function public.log_learning_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not distinct from auth.uid() then
    insert into public.learning_activity (user_id, at_hour)
    values (new.user_id, date_trunc('hour', now()))
    on conflict do nothing;
  end if;
  return null;
end;
$$;
revoke all on function public.log_learning_activity() from public, anon, authenticated;

create trigger lesson_progress_activity after insert or update of completed_at, last_position_seconds
  on public.lesson_progress for each row execute function public.log_learning_activity();
create trigger quiz_attempts_activity after insert
  on public.quiz_attempts for each row execute function public.log_learning_activity();
create trigger lesson_notes_activity after insert or update of body
  on public.lesson_notes for each row execute function public.log_learning_activity();

-- Historial previo: lo que ya consta en la base.
insert into public.learning_activity (user_id, at_hour)
select user_id, date_trunc('hour', at) from (
  select user_id, completed_at as at from public.lesson_progress where completed_at is not null
  union all select user_id, updated_at from public.lesson_progress
  union all select user_id, created_at from public.quiz_attempts
  union all select user_id, updated_at from public.lesson_notes
) s
on conflict do nothing;

-- Estadísticas del alumno que llama --------------------------------------------
create or replace function public.get_learning_stats()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_goal int;
  v_today date;
  v_week_start date;
  v_current int := 0;
  v_longest int := 0;
  v_active_today boolean;
  v_week_lessons int;
  v_days jsonb;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select time_zone, weekly_lesson_goal into v_tz, v_goal from public.profiles where id = v_user;
  v_tz := coalesce(v_tz, 'America/Mexico_City');
  v_goal := coalesce(v_goal, 3);
  v_today := (now() at time zone v_tz)::date;
  v_week_start := v_today - (extract(isodow from v_today)::int - 1);

  -- Rachas: días consecutivos con actividad (islas de fechas).
  with days as (
    select distinct (at_hour at time zone v_tz)::date as d
    from public.learning_activity where user_id = v_user
  ),
  islands as (
    select d, d - (row_number() over (order by d))::int as grp from days
  ),
  runs as (
    select min(d) as first_day, max(d) as last_day, count(*)::int as len from islands group by grp
  )
  select
    coalesce(max(len), 0),
    -- La racha sigue viva si la última actividad fue hoy o ayer.
    coalesce(max(len) filter (where last_day >= v_today - 1), 0),
    coalesce(bool_or(last_day = v_today), false)
  into v_longest, v_current, v_active_today
  from runs;

  select count(distinct lesson_id)::int into v_week_lessons
  from public.lesson_progress
  where user_id = v_user
    and completed_at is not null
    and (completed_at at time zone v_tz)::date >= v_week_start;

  -- Lunes a domingo de la semana en curso.
  select jsonb_agg(jsonb_build_object(
      'date', g.d,
      'active', exists (
        select 1 from public.learning_activity a
        where a.user_id = v_user and (a.at_hour at time zone v_tz)::date = g.d),
      'lessons', (
        select count(distinct lp.lesson_id)::int from public.lesson_progress lp
        where lp.user_id = v_user and lp.completed_at is not null
          and (lp.completed_at at time zone v_tz)::date = g.d)
    ) order by g.d)
  into v_days
  from (select (v_week_start + i)::date as d from generate_series(0, 6) i) g;

  return jsonb_build_object(
    'time_zone', v_tz,
    'today', v_today,
    'week_start', v_week_start,
    'current_streak', v_current,
    'longest_streak', v_longest,
    'active_today', v_active_today,
    'weekly_goal', v_goal,
    'week_lessons', v_week_lessons,
    'week', v_days
  );
end;
$$;

revoke all on function public.get_learning_stats() from public, anon;
grant execute on function public.get_learning_stats() to authenticated;
