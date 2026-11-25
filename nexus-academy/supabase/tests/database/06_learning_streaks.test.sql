-- Racha de estudio y meta semanal: solo con actividad real y privada del alumno.
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'lola@test.dev', '{"full_name":"Lola Racha"}', 'authenticated', 'authenticated'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'paco@test.dev', '{"full_name":"Paco Otro"}', 'authenticated', 'authenticated');

create temp table ctx as
select
  (select id from public.courses where slug = 'git-github-esencial') as course,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'git-github-esencial' and l.type = 'article' order by l.position limit 1) as lesson1,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'git-github-esencial' and l.type = 'article' order by l.position offset 1 limit 1) as lesson2,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'git-github-esencial' and l.type = 'quiz' order by l.position limit 1) as lesson3;
grant select on ctx to anon, authenticated;

-- Anónimo
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok('select public.get_learning_stats()', '42501', null, 'Un visitante no puede pedir estadísticas');
select throws_ok('select * from public.learning_activity', '42501', null, 'Un visitante no puede leer actividad');
reset role;

-- Lola: preferencias
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
select is((select time_zone || '/' || weekly_lesson_goal from public.profiles where id = auth.uid()), 'America/Mexico_City/3',
  'Por omisión: hora del centro de México y 3 lecciones por semana');
select throws_ok($$update public.profiles set time_zone = 'Marte/Olympus' where id = auth.uid()$$, '22023', null,
  'Rechaza una zona horaria que no existe');
select lives_ok($$update public.profiles set time_zone = 'America/Bogota' where id = auth.uid()$$, 'Acepta una zona horaria válida');
select throws_ok($$update public.profiles set weekly_lesson_goal = 0 where id = auth.uid()$$, '23514', null, 'La meta mínima es 1 lección');
select throws_ok($$update public.profiles set weekly_lesson_goal = 51 where id = auth.uid()$$, '23514', null, 'La meta máxima es 50 lecciones');
select lives_ok($$update public.profiles set weekly_lesson_goal = 5 where id = auth.uid()$$, 'Cambia su meta semanal');
update public.profiles set weekly_lesson_goal = 40 where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select throws_ok($$insert into public.learning_activity (user_id, at_hour) values (auth.uid(), date_trunc('hour', now()))$$,
  '42501', null, 'No puede inventarse actividad insertándola a mano');

-- La actividad la registran los triggers a partir del progreso real
select lives_ok($$select public.enroll_free_course((select course from ctx))$$, 'Se inscribe al curso gratuito');
select is((select count(*)::int from public.learning_activity), 0, 'Inscribirse no cuenta como estudiar');
insert into public.lesson_progress (user_id, lesson_id, course_id, last_position_seconds)
values (auth.uid(), (select lesson1 from ctx), (select course from ctx), 42);
select is((select count(*)::int from public.learning_activity where at_hour = date_trunc('hour', now())), 1,
  'Avanzar en una lección registra la hora de actividad');
insert into public.lesson_notes (user_id, lesson_id, course_id, body) values (auth.uid(), (select lesson1 from ctx), (select course from ctx), 'nota');
update public.lesson_progress set completed_at = now() where lesson_id = (select lesson1 from ctx);
select is((select count(*)::int from public.learning_activity), 1, 'Varias acciones en la misma hora no duplican el registro');
reset role;

-- Paco (otro alumno) no ve nada de Lola; su meta no cambió por el intento de Lola
set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';
select is((select count(*)::int from public.learning_activity), 0, 'Otro alumno no ve la actividad ajena');
select is((public.get_learning_stats()->>'current_streak')::int, 0, 'Sin actividad, la racha es 0');
select is((select weekly_lesson_goal::int from public.profiles where id = auth.uid()), 3, 'Nadie puede cambiar la meta de otro alumno');
reset role;

-- Cambios hechos sin sesión del alumno (procesos internos o admin) no cuentan
set local request.jwt.claims to '{}';
insert into public.lesson_progress (user_id, lesson_id, course_id, completed_at)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', (select lesson2 from ctx), (select course from ctx), now());
select is((select count(*)::int from public.learning_activity where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 0,
  'El progreso que no hizo el alumno no suma a su racha');

-- Historial de Lola: hoy (trigger), ayer, anteayer y una racha de 4 días hace 10-13 días
update public.profiles set time_zone = 'America/Mexico_City' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
insert into public.learning_activity (user_id, at_hour)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date_trunc('hour', now()) - make_interval(days => n)
from unnest(array[1, 2, 10, 11, 12, 13]) n;
-- Una lección completada hace 8 días (semana pasada) no cuenta para la meta de esta semana
insert into public.lesson_progress (user_id, lesson_id, course_id, completed_at)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', (select lesson3 from ctx), (select course from ctx), now() - interval '8 days');

set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
create temp table s1 as select public.get_learning_stats() as s;
select is((select (s->>'current_streak')::int || '/' || (s->>'longest_streak')::int || '/' || (s->>'active_today') from s1), '3/4/true',
  'Racha actual de 3 días (hoy, ayer, anteayer) y mejor racha de 4');
select is((select (s->>'week_lessons')::int || ' de ' || (s->>'weekly_goal')::int from s1), '1 de 5',
  'Meta semanal: solo cuenta la lección completada esta semana');
select is((select jsonb_array_length(s->'week') || ':' || extract(isodow from (s->'week'->0->>'date')::date) from s1), '7:1',
  'La semana va de lunes a domingo');
reset role;

-- Si hoy aún no estudia, la racha de ayer sigue viva; si tampoco ayer, se reinicia
delete from public.learning_activity where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and at_hour = date_trunc('hour', now());
set local role authenticated;
select is((select (s->>'current_streak')::int || '/' || (s->>'active_today') from (select public.get_learning_stats() s) x), '2/false',
  'Sin actividad hoy, la racha de 2 días sigue vigente');
reset role;
delete from public.learning_activity where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and at_hour = date_trunc('hour', now()) - interval '1 day';
set local role authenticated;
select is((select (s->>'current_streak')::int || '/' || (s->>'longest_streak')::int from (select public.get_learning_stats() s) x), '0/4',
  'Un día sin estudiar reinicia la racha actual; la mejor se conserva');
reset role;

select * from finish();
rollback;
