-- Actividad de estudio agregada (dashboard admin): solo admin, solo conteos y en hora de CDMX.
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Momento fijo y aislado: jueves 2001-03-15 12:00 en CDMX (18:00 UTC).
create temp table t as select '2001-03-15 18:00:00+00'::timestamptz as now_;
grant select on t to authenticated;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
select ('e0000000-0000-4000-8000-00000000000' || n)::uuid, name || '@activo.test', jsonb_build_object('full_name', name), 'authenticated', 'authenticated'
from (values (1, 'uno'), (2, 'dos'), (3, 'tres'), (4, 'admin')) v(n, name);
update public.profiles set role = 'admin' where email = 'admin@activo.test';

create temp table lx as
select (select le.id from public.lessons le join public.courses co on co.id = le.course_id where co.slug = 'git-github-esencial' order by le.position limit 1) as a,
       (select le.id from public.lessons le join public.courses co on co.id = le.course_id where co.slug = 'git-github-esencial' order by le.position offset 1 limit 1) as b;

insert into public.learning_activity (user_id, at_hour) values
  ('e0000000-0000-4000-8000-000000000001', '2001-03-15 17:00+00'),  -- hoy
  ('e0000000-0000-4000-8000-000000000001', '2001-03-14 17:00+00'),  -- ayer
  ('e0000000-0000-4000-8000-000000000001', '2001-03-15 20:00+00'),  -- después de «ahora»: no cuenta
  ('e0000000-0000-4000-8000-000000000002', '2001-03-15 03:00+00'),  -- 14-mar 21:00 en CDMX (ayer, aunque en UTC ya sea 15)
  ('e0000000-0000-4000-8000-000000000003', '2001-03-05 17:00+00'),  -- hace 10 días (semana anterior)
  ('e0000000-0000-4000-8000-000000000004', '2001-03-15 17:00+00');  -- el admin no es alumno
insert into public.lesson_progress (user_id, lesson_id, course_id, completed_at) values
  ('e0000000-0000-4000-8000-000000000001', (select a from lx), (select id from public.courses where slug = 'git-github-esencial'), '2001-03-15 17:30+00'),
  ('e0000000-0000-4000-8000-000000000001', (select b from lx), (select id from public.courses where slug = 'git-github-esencial'), '2001-03-14 17:30+00');

-- Un alumno no puede verla
set local role authenticated;
set local request.jwt.claims to '{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.admin_learning_activity()$$, '42501', null, 'Un alumno no puede ver la actividad agregada');
reset role;
set local role anon;
select throws_ok($$select public.admin_learning_activity()$$, '42501', null, 'Un visitante tampoco');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"e0000000-0000-4000-8000-000000000004","role":"authenticated"}';
create temp table s7 as select public.admin_learning_activity(7, 'America/Mexico_City', (select now_ from t)) as s;
select is((select (s->>'active_today') || '/' || (s->>'active_7d') || '/' || (s->>'active_period') from s7), '1/2/2',
  'Hoy 1 alumno, 2 en 7 días (hora de CDMX; el admin y lo posterior a «ahora» no cuentan)');
select is((select (s->>'lessons_period')::int from s7), 2, 'Lecciones completadas en el periodo');
select is((select (s->>'avg_days')::numeric from s7), 1.5, 'Días de estudio promedio por alumno activo: (2 + 1) / 2');
select is((select jsonb_array_length(s->'daily') || ' ' || (s->'daily'->0->>'day') from s7), '7 2001-03-09', 'Un punto por día del periodo, empezando hace 6 días');
select is((select (s->'daily'->5->>'students') || '/' || (s->'daily'->5->>'lessons') || ' ' || (s->'daily'->6->>'students') || '/' || (s->'daily'->6->>'lessons') from s7),
  '2/1 1/1', 'Ayer: 2 alumnos y 1 lección; hoy: 1 alumno y 1 lección');
select is((select jsonb_array_length(s->'weekly') || ' ' || (s->'weekly'->11->>'week') || ' ' || (s->'weekly'->11->>'students') || ' ' || (s->'weekly'->10->>'students') from s7),
  '12 2001-03-12 2 1', '12 semanas (de lunes a domingo): esta semana 2 alumnos, la anterior 1');
select is((select (public.admin_learning_activity(30, 'America/Mexico_City', (select now_ from t))->>'active_period')::int), 3, 'En 30 días son 3 alumnos');
select throws_ok($$select public.admin_learning_activity(0)$$, '22023', null, 'Rechaza un periodo inválido');
select ok(not (select s::text like '%@activo.test%' or s::text like '%e0000000%' from s7), 'Solo devuelve conteos: ni correos ni identificadores de alumnos');

select * from finish();
rollback;
