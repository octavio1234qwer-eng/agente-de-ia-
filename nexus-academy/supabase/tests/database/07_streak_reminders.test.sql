-- Aviso de racha por perderse: a quién se le envía (y a quién no).
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Momento fijo: 2026-11-26 01:00 UTC = 25-nov 19:00 en Ciudad de México = 26-nov 02:00 en Madrid.
create temp table t as select '2026-11-26 01:00:00+00'::timestamptz as now_cdmx, '2026-11-25 18:00:00+00'::timestamptz as now_madrid;
grant select on t to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
select ('d0000000-0000-4000-8000-00000000000' || n)::uuid, name || '@racha.test', jsonb_build_object('full_name', initcap(name)), 'authenticated', 'authenticated'
from (values (1, 'ana'), (2, 'beto'), (3, 'caro'), (4, 'dani'), (5, 'eva'), (6, 'fede'), (7, 'gabi'), (8, 'hugo')) v(n, name);
update public.profiles set reminder_opt_in = true where email like '%@racha.test';
update public.profiles set reminder_opt_in = false where email = 'caro@racha.test';
update public.profiles set time_zone = 'Europe/Madrid' where email = 'fede@racha.test';
insert into public.enrollments (user_id, course_id, source)
select 'd0000000-0000-4000-8000-000000000001', id, 'free' from public.courses where slug = 'git-github-esencial';

create function pg_temp.uid(name text) returns uuid language sql as $$ select id from public.profiles where email = name || '@racha.test' $$;
insert into public.learning_activity (user_id, at_hour) values
  -- Ana: 23-nov y 24-nov 21:00 CDMX (que en UTC ya es 25-nov): racha de 2 que termina ayer
  (pg_temp.uid('ana'), '2026-11-23 18:00+00'), (pg_temp.uid('ana'), '2026-11-25 03:00+00'),
  -- Beto: igual, pero hoy ya estudió
  (pg_temp.uid('beto'), '2026-11-23 18:00+00'), (pg_temp.uid('beto'), '2026-11-24 18:00+00'), (pg_temp.uid('beto'), '2026-11-25 18:00+00'),
  -- Caro: racha de 2, pero desactivó los recordatorios
  (pg_temp.uid('caro'), '2026-11-23 18:00+00'), (pg_temp.uid('caro'), '2026-11-24 18:00+00'),
  -- Dani: solo ayer
  (pg_temp.uid('dani'), '2026-11-24 18:00+00'),
  -- Eva: 3 días que terminaron anteayer (la racha ya se perdió)
  (pg_temp.uid('eva'), '2026-11-21 18:00+00'), (pg_temp.uid('eva'), '2026-11-22 18:00+00'), (pg_temp.uid('eva'), '2026-11-23 18:00+00'),
  -- Fede (Madrid): 23 y 24-nov
  (pg_temp.uid('fede'), '2026-11-23 10:00+00'), (pg_temp.uid('fede'), '2026-11-24 10:00+00'),
  -- Gabi y Hugo: racha de 2 que termina ayer
  (pg_temp.uid('gabi'), '2026-11-23 18:00+00'), (pg_temp.uid('gabi'), '2026-11-24 18:00+00'),
  (pg_temp.uid('hugo'), '2026-11-23 18:00+00'), (pg_temp.uid('hugo'), '2026-11-24 18:00+00');
insert into public.email_log (to_email, user_id, template, subject, status, created_at) values
  ('gabi@racha.test', pg_temp.uid('gabi'), 'streak_reminder', 'x', 'sent', '2026-11-25 01:00+00'),
  ('hugo@racha.test', pg_temp.uid('hugo'), 'streak_reminder', 'x', 'sent', '2026-11-22 01:00+00');

create temp table c as select * from public.streak_reminder_candidates((select now_cdmx from t));
create function pg_temp.has(name text) returns boolean language sql as $$ select exists (select 1 from c where user_id = pg_temp.uid(name)) $$;

-- Permisos
set local role authenticated;
set local request.jwt.claims to '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select * from public.streak_reminder_candidates()$$, '42501', null, 'Un alumno no puede listar candidatos (correos de otros)');
reset role;
set local role anon;
select throws_ok($$select * from public.streak_reminder_candidates()$$, '42501', null, 'Un visitante tampoco');
reset role;

select is((select streak || ' ' || local_date || ' ' || course_slug || ' ' || full_name from c where user_id = pg_temp.uid('ana')),
  '2 2026-11-25 git-github-esencial Ana',
  'Ana: racha de 2 días hasta ayer, contados en su zona horaria, con el curso para continuar');
select ok(not pg_temp.has('beto'), 'Quien ya estudió hoy no recibe aviso');
select ok(not pg_temp.has('caro'), 'Respeta «Recordatorios de aprendizaje» desactivado');
select ok(not pg_temp.has('dani'), 'Una racha de un solo día no amerita aviso');
select ok(not pg_temp.has('eva'), 'Si la racha ya se perdió, no se avisa');
select ok(not pg_temp.has('fede'), 'En Madrid son las 2 a. m.: fuera del horario de aviso');
select ok(not pg_temp.has('gabi'), 'Máximo un aviso cada 3 días');
select ok(pg_temp.has('hugo'), 'Un aviso enviado hace 4 días ya no bloquea uno nuevo');
select ok(exists (select 1 from public.streak_reminder_candidates((select now_madrid from t)) where user_id = pg_temp.uid('fede')),
  'A las 19 h de Madrid, Fede sí recibe aviso');
select ok(exists (select 1 from public.streak_reminder_candidates((select now_cdmx from t), 1) where user_id = pg_temp.uid('dani')),
  'Con racha mínima de 1 día, Dani también entraría');

select * from finish();
rollback;
