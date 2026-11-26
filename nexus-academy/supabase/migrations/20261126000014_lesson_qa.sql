-- =============================================================================
-- Preguntas y respuestas por lección.
--
-- · Solo quien tiene acceso vigente al curso (o el admin) lee, pregunta y
--   responde. La vista previa gratuita no da acceso a las preguntas.
-- · Los demás alumnos ven el nombre y la inicial del apellido del autor
--   («Ana G.»), nunca su correo ni su nombre completo.
-- · Las respuestas de administradores e instructores se marcan como «equipo»
--   (lo decide la base según el rol, no el cliente).
-- · Moderación: el admin oculta o muestra con admin_moderate_qa(); el autor
--   sigue viendo lo suyo oculto y ya no puede editarlo. Al ocultar una
--   pregunta se ocultan también sus respuestas para los demás.
-- · Límite anti-spam: 20 preguntas y 60 respuestas por alumno cada 24 h.
-- =============================================================================

create table if not exists public.lesson_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 5 and 2000),
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lesson_questions_lesson_idx on public.lesson_questions (lesson_id, created_at desc);
create index if not exists lesson_questions_course_idx on public.lesson_questions (course_id, created_at desc);
create index if not exists lesson_questions_user_idx on public.lesson_questions (user_id, created_at desc);

create table if not exists public.lesson_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.lesson_questions (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  is_staff boolean not null default false,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lesson_answers_question_idx on public.lesson_answers (question_id, created_at);
create index if not exists lesson_answers_user_idx on public.lesson_answers (user_id, created_at desc);

-- course_id de la pregunta siempre sale de la lección (no se confía en el cliente).
drop trigger if exists lesson_questions_sync on public.lesson_questions;
create trigger lesson_questions_sync before insert or update of lesson_id
  on public.lesson_questions for each row execute function public.sync_course_from_lesson();
drop trigger if exists lesson_questions_updated_at on public.lesson_questions;
create trigger lesson_questions_updated_at before update on public.lesson_questions
  for each row execute function public.set_updated_at();
drop trigger if exists lesson_answers_updated_at on public.lesson_answers;
create trigger lesson_answers_updated_at before update on public.lesson_answers
  for each row execute function public.set_updated_at();

-- Antes de insertar una respuesta: curso de la pregunta y marca de «equipo» según el rol.
create or replace function public.lesson_answers_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select q.course_id into new.course_id from public.lesson_questions q where q.id = new.question_id;
  if new.course_id is null then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;
  new.is_staff := exists (
    select 1 from public.profiles p where p.id = new.user_id and p.role in ('admin', 'instructor')
  );
  new.hidden_at := null;
  return new;
end;
$$;
drop trigger if exists lesson_answers_before_insert on public.lesson_answers;
create trigger lesson_answers_before_insert before insert on public.lesson_answers
  for each row execute function public.lesson_answers_before_insert();

-- Límite anti-spam (no aplica al equipo).
create or replace function public.lesson_qa_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if exists (select 1 from public.profiles p where p.id = new.user_id and p.role in ('admin', 'instructor')) then
    return new;
  end if;
  if tg_table_name = 'lesson_questions' then
    select count(*) into v_count from public.lesson_questions
    where user_id = new.user_id and created_at > now() - interval '24 hours';
    if v_count >= 20 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  else
    select count(*) into v_count from public.lesson_answers
    where user_id = new.user_id and created_at > now() - interval '24 hours';
    if v_count >= 60 then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists lesson_questions_rate_limit on public.lesson_questions;
create trigger lesson_questions_rate_limit before insert on public.lesson_questions
  for each row execute function public.lesson_qa_rate_limit();
drop trigger if exists lesson_answers_rate_limit on public.lesson_answers;
create trigger lesson_answers_rate_limit before insert on public.lesson_answers
  for each row execute function public.lesson_qa_rate_limit();

revoke execute on function public.lesson_answers_before_insert() from public, anon, authenticated;
revoke execute on function public.lesson_qa_rate_limit() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Permisos y RLS
-- -----------------------------------------------------------------------------
alter table public.lesson_questions enable row level security;
alter table public.lesson_answers enable row level security;

revoke all on public.lesson_questions, public.lesson_answers from anon, authenticated;
grant select, delete on public.lesson_questions, public.lesson_answers to authenticated;
grant insert (lesson_id, course_id, user_id, body) on public.lesson_questions to authenticated;
grant insert (question_id, course_id, user_id, body) on public.lesson_answers to authenticated;
grant update (body) on public.lesson_questions, public.lesson_answers to authenticated;

create policy "lesson_questions: leer con acceso al curso" on public.lesson_questions for select to authenticated
  using (
    public.has_course_access(course_id)
    and (hidden_at is null or user_id = (select auth.uid()) or public.is_admin())
  );
create policy "lesson_questions: preguntar con acceso al curso" on public.lesson_questions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_course_access(course_id));
create policy "lesson_questions: editar las propias visibles" on public.lesson_questions for update to authenticated
  using (user_id = (select auth.uid()) and hidden_at is null)
  with check (user_id = (select auth.uid()) and hidden_at is null and public.has_course_access(course_id));
create policy "lesson_questions: borrar las propias o admin" on public.lesson_questions for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- Las respuestas se ven solo si la pregunta se ve (la subconsulta aplica la RLS de preguntas).
create policy "lesson_answers: leer con acceso al curso" on public.lesson_answers for select to authenticated
  using (
    public.has_course_access(course_id)
    and (hidden_at is null or user_id = (select auth.uid()) or public.is_admin())
    and exists (select 1 from public.lesson_questions q where q.id = question_id)
  );
create policy "lesson_answers: responder preguntas visibles" on public.lesson_answers for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_course_access(course_id)
    and exists (select 1 from public.lesson_questions q where q.id = question_id and q.hidden_at is null)
  );
create policy "lesson_answers: editar las propias visibles" on public.lesson_answers for update to authenticated
  using (user_id = (select auth.uid()) and hidden_at is null)
  with check (user_id = (select auth.uid()) and hidden_at is null and public.has_course_access(course_id));
create policy "lesson_answers: borrar las propias o admin" on public.lesson_answers for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- -----------------------------------------------------------------------------
-- Nombre público: «Ana G.» (nombre e inicial del apellido), «Alumno» si no hay nombre.
-- -----------------------------------------------------------------------------
create or replace function public.public_display_name(p_full_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  with n as (select regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g') as v)
  select case
    when v = '' then 'Alumno'
    when split_part(v, ' ', 2) = '' then split_part(v, ' ', 1)
    else split_part(v, ' ', 1) || ' ' || upper(left(split_part(v, ' ', 2), 1)) || '.'
  end
  from n;
$$;

-- -----------------------------------------------------------------------------
-- Hilo de preguntas de una lección para el aula.
-- -----------------------------------------------------------------------------
create or replace function public.lesson_qa(p_lesson_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_course uuid;
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_admin();
begin
  select l.course_id into v_course from public.lessons l where l.id = p_lesson_id;
  if v_course is null then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;
  if v_uid is null or not public.has_course_access(v_course) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id,
      'body', q.body,
      'created_at', q.created_at,
      'edited', q.updated_at > q.created_at + interval '1 second',
      'is_mine', q.user_id = v_uid,
      'author', public.public_display_name(pq.full_name),
      'author_is_staff', pq.role in ('admin', 'instructor'),
      'hidden', q.hidden_at is not null,
      'answered', exists (select 1 from public.lesson_answers a where a.question_id = q.id and a.is_staff and a.hidden_at is null),
      'answers', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id,
          'body', a.body,
          'created_at', a.created_at,
          'edited', a.updated_at > a.created_at + interval '1 second',
          'is_mine', a.user_id = v_uid,
          'author', public.public_display_name(pa.full_name),
          'is_staff', a.is_staff,
          'hidden', a.hidden_at is not null
        ) order by a.created_at, a.id)
        from public.lesson_answers a
        join public.profiles pa on pa.id = a.user_id
        where a.question_id = q.id
          and (a.hidden_at is null or a.user_id = v_uid or v_admin)
      ), '[]'::jsonb)
    ) order by q.created_at desc, q.id)
    from public.lesson_questions q
    join public.profiles pq on pq.id = q.user_id
    where q.lesson_id = p_lesson_id
      and (q.hidden_at is null or q.user_id = v_uid or v_admin)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.lesson_qa(uuid) from public, anon;
grant execute on function public.lesson_qa(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Admin: bandeja de preguntas y moderación.
-- p_filter: 'unanswered' (sin respuesta visible del equipo y no ocultas), 'all', 'hidden'.
-- -----------------------------------------------------------------------------
create or replace function public.admin_lesson_questions(p_filter text default 'unanswered', p_limit int default 100)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  hidden boolean,
  answered boolean,
  answers int,
  lesson_id uuid,
  lesson_title text,
  course_id uuid,
  course_title text,
  course_slug text,
  author_name text,
  author_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_filter not in ('unanswered', 'all', 'hidden') then
    raise exception 'invalid_filter' using errcode = '22023';
  end if;
  return query
  select q.id, q.body, q.created_at, q.hidden_at is not null,
         exists (select 1 from public.lesson_answers a where a.question_id = q.id and a.is_staff and a.hidden_at is null),
         (select count(*)::int from public.lesson_answers a where a.question_id = q.id),
         l.id, l.title, c.id, c.title, c.slug,
         p.full_name, p.email::text
  from public.lesson_questions q
  join public.lessons l on l.id = q.lesson_id
  join public.courses c on c.id = q.course_id
  join public.profiles p on p.id = q.user_id
  where case p_filter
    when 'hidden' then q.hidden_at is not null
    when 'unanswered' then q.hidden_at is null and not exists (
      select 1 from public.lesson_answers a where a.question_id = q.id and a.is_staff and a.hidden_at is null)
    else true
  end
  order by q.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke all on function public.admin_lesson_questions(text, int) from public, anon;
grant execute on function public.admin_lesson_questions(text, int) to authenticated;

create or replace function public.admin_moderate_qa(p_kind text, p_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_kind = 'question' then
    update public.lesson_questions set hidden_at = case when p_hidden then coalesce(hidden_at, now()) end where id = p_id;
  elsif p_kind = 'answer' then
    update public.lesson_answers set hidden_at = case when p_hidden then coalesce(hidden_at, now()) end where id = p_id;
  else
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_moderate_qa(text, uuid, boolean) from public, anon;
grant execute on function public.admin_moderate_qa(text, uuid, boolean) to authenticated;
