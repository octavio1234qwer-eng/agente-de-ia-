-- Embudo por curso (admin): dónde se detienen los alumnos, solo con conteos.
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
select ('f0000000-0000-4000-8000-00000000000' || n)::uuid, 'e' || n || '@embudo.test', jsonb_build_object('full_name', 'Alumno ' || n), 'authenticated', 'authenticated'
from generate_series(1, 7) n;
update public.profiles set role = 'admin' where email = 'e7@embudo.test';

-- Curso aislado: M1 = A, B · M2 = C
insert into public.courses (id, slug, title) values ('f1000000-0000-4000-8000-000000000001', 'embudo-prueba', 'Curso de prueba del embudo');
insert into public.modules (id, course_id, title, position) values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'Módulo 1', 0),
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'Módulo 2', 1);
insert into public.lessons (id, module_id, course_id, title, type, position) values
  ('f3000000-0000-4000-8000-00000000000a', 'f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'A', 'article', 0),
  ('f3000000-0000-4000-8000-00000000000b', 'f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'B', 'article', 1),
  ('f3000000-0000-4000-8000-00000000000c', 'f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'C', 'article', 0);

create function pg_temp.u(n int) returns uuid language sql as $$ select ('f0000000-0000-4000-8000-00000000000' || n)::uuid $$;
create function pg_temp.l(x text) returns uuid language sql as $$ select ('f3000000-0000-4000-8000-00000000000' || x)::uuid $$;
-- Progreso (antes de las inscripciones, para no disparar certificados)
insert into public.lesson_progress (user_id, lesson_id, course_id, completed_at, last_position_seconds) values
  (pg_temp.u(1), pg_temp.l('a'), 'f1000000-0000-4000-8000-000000000001', now(), 0),  -- 1: terminó todo
  (pg_temp.u(1), pg_temp.l('b'), 'f1000000-0000-4000-8000-000000000001', now(), 0),
  (pg_temp.u(1), pg_temp.l('c'), 'f1000000-0000-4000-8000-000000000001', now(), 0),
  (pg_temp.u(2), pg_temp.l('a'), 'f1000000-0000-4000-8000-000000000001', now(), 0),  -- 2: detenido en B
  (pg_temp.u(3), pg_temp.l('a'), 'f1000000-0000-4000-8000-000000000001', now(), 0),  -- 3: detenido en C (la ve, no la termina)
  (pg_temp.u(3), pg_temp.l('b'), 'f1000000-0000-4000-8000-000000000001', now(), 0),
  (pg_temp.u(3), pg_temp.l('c'), 'f1000000-0000-4000-8000-000000000001', null, 90),
  (pg_temp.u(5), pg_temp.l('a'), 'f1000000-0000-4000-8000-000000000001', now(), 0),  -- 5: saltó B → detenido en B
  (pg_temp.u(5), pg_temp.l('c'), 'f1000000-0000-4000-8000-000000000001', now(), 0),
  (pg_temp.u(6), pg_temp.l('a'), 'f1000000-0000-4000-8000-000000000001', now(), 0),  -- 6: acceso revocado
  (pg_temp.u(7), pg_temp.l('a'), 'f1000000-0000-4000-8000-000000000001', now(), 0);  -- 7: admin
insert into public.enrollments (user_id, course_id, source, completed_at, revoked_at)
select pg_temp.u(n), 'f1000000-0000-4000-8000-000000000001', 'admin_grant',
       case when n = 1 then now() end, case when n = 6 then now() end
from generate_series(1, 7) n;  -- 4: inscrito sin empezar

set local role authenticated;
set local request.jwt.claims to '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.admin_course_funnel('f1000000-0000-4000-8000-000000000001')$$, '42501', null, 'Un alumno no puede ver el embudo');
reset role;
set local role anon;
select throws_ok($$select public.admin_course_funnel('f1000000-0000-4000-8000-000000000001')$$, '42501', null, 'Un visitante tampoco');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"f0000000-0000-4000-8000-000000000007","role":"authenticated"}';
create temp table f as select public.admin_course_funnel('f1000000-0000-4000-8000-000000000001') as j;
select is((select format('%s/%s/%s/%s', j->>'enrolled', j->>'started', j->>'not_started', j->>'completed') from f), '5/4/1/1',
  'Inscritos 5 (sin revocados ni admin), empezaron 4, sin empezar 1, terminaron 1');
select is((select (j->>'completion_rate')::numeric from f), 20.0, 'Tasa de finalización 20 %');
select is((select string_agg(x->>'idx' || ':' || (x->>'title') || '@' || (x->>'module_title'), ' ' order by (x->>'idx')::int) from f, jsonb_array_elements(j->'lessons') x),
  '1:A@Módulo 1 2:B@Módulo 1 3:C@Módulo 2', 'Lecciones en el orden del temario (módulo y posición)');
select is((select string_agg(x->>'completed', ',' order by (x->>'idx')::int) from f, jsonb_array_elements(j->'lessons') x), '4,2,2',
  'Cuántos completaron cada lección');
select is((select string_agg(x->>'stuck', ',' order by (x->>'idx')::int) from f, jsonb_array_elements(j->'lessons') x), '0,2,1',
  'Detenidos: 2 en B (uno se la saltó) y 1 en C (la vio sin terminarla)');
select throws_ok($$select public.admin_course_funnel('f1000000-0000-4000-8000-0000000000ff')$$, 'P0002', null, 'Curso inexistente');
select ok((select j::text not like '%f0000000%' and j::text not like '%embudo.test%' from f), 'Solo conteos: ni identificadores ni correos de alumnos');

select * from finish();
rollback;
