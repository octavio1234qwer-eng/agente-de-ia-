-- Candidatos al aviso «se liberó un módulo»: solo módulos programados que se
-- liberaron dentro de la ventana, alumnos con acceso y avisos activados.
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('f1000000-0000-4000-8000-000000000001', 'hoy.unlock@test.dev', '{"full_name":"Hoy Libera"}', 'authenticated', 'authenticated'),
  ('f1000000-0000-4000-8000-000000000002', 'pronto.unlock@test.dev', '{"full_name":"Aún No"}', 'authenticated', 'authenticated'),
  ('f1000000-0000-4000-8000-000000000003', 'viejo.unlock@test.dev', '{"full_name":"Hace Mucho"}', 'authenticated', 'authenticated'),
  ('f1000000-0000-4000-8000-000000000004', 'baja.unlock@test.dev', '{"full_name":"Sin Avisos"}', 'authenticated', 'authenticated'),
  ('f1000000-0000-4000-8000-000000000005', 'revocado.unlock@test.dev', '{"full_name":"Revocado"}', 'authenticated', 'authenticated');
update public.profiles set reminder_opt_in = false where id = 'f1000000-0000-4000-8000-000000000004';

create temp table ctx as
select c.id as course,
       (select m.id from public.modules m where m.course_id = c.id order by m.position desc limit 1) as m2
from public.courses c where c.slug = 'fundamentos-html-css';
update public.modules set release_after_days = 7 where id = (select m2 from ctx);

-- Inscritos hace 7 días y 2 horas (se liberó hace 2 h), hace 3 días (aún no),
-- hace 20 días (fuera de la ventana), sin avisos y revocado (ambos en ventana).
insert into public.enrollments (user_id, course_id, source, created_at, revoked_at) values
  ('f1000000-0000-4000-8000-000000000001', (select course from ctx), 'free', now() - interval '7 days 2 hours', null),
  ('f1000000-0000-4000-8000-000000000002', (select course from ctx), 'free', now() - interval '3 days', null),
  ('f1000000-0000-4000-8000-000000000003', (select course from ctx), 'free', now() - interval '20 days', null),
  ('f1000000-0000-4000-8000-000000000004', (select course from ctx), 'free', now() - interval '7 days 2 hours', null),
  ('f1000000-0000-4000-8000-000000000005', (select course from ctx), 'free', now() - interval '7 days 2 hours', now());

create temp table res as select * from public.module_unlock_candidates() where user_id::text like 'f1000000%';
select is((select count(*)::int from res), 1, 'Un solo candidato');
select is((select user_id from res), 'f1000000-0000-4000-8000-000000000001'::uuid, 'Quien se inscribió hace 7 días recibe el aviso');
select is((select module_id from res), (select m2 from ctx), 'Del módulo programado (no del que estaba abierto desde el inicio)');
select ok((select first_lesson_id from res) is not null, 'Incluye la primera lección del módulo para el enlace');
select is((select course_slug from res), 'fundamentos-html-css', 'Con el curso para armar el enlace');
select ok((select released_at from res) between now() - interval '2 hours 1 minute' and now() - interval '1 hour 59 minutes', 'Con la fecha real de liberación');
select is((select count(*)::int from public.module_unlock_candidates(now() + interval '5 days') where user_id = 'f1000000-0000-4000-8000-000000000002'), 1,
  'Quien se inscribió hace 3 días aparecerá cuando le toque');

set local role authenticated;
set local request.jwt.claims to '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select * from public.module_unlock_candidates()$$, '42501', null, 'Un usuario no puede listar candidatos');
reset role;
set local role anon;
select throws_ok($$select * from public.module_unlock_candidates()$$, '42501', null, 'Un visitante tampoco');
reset role;

select * from finish();
rollback;
