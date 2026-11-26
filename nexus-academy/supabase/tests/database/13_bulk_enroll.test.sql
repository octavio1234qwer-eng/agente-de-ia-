-- Inscripción masiva por correos: solo admin, estados por correo y auditoría.
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('e1000000-0000-4000-8000-000000000001', 'ana.bulk@test.dev', '{"full_name":"Ana Bulk"}', 'authenticated', 'authenticated'),
  ('e1000000-0000-4000-8000-000000000002', 'beto.bulk@test.dev', '{"full_name":"Beto Bulk"}', 'authenticated', 'authenticated'),
  ('e1000000-0000-4000-8000-000000000003', 'carla.bulk@test.dev', '{"full_name":"Carla Bulk"}', 'authenticated', 'authenticated'),
  ('e1000000-0000-4000-8000-000000000004', 'admin.bulk@test.dev', '{"full_name":"Admin Bulk"}', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = 'e1000000-0000-4000-8000-000000000004';

create temp table ctx as select id as course from public.courses where slug = 'javascript-moderno';
grant select on ctx to authenticated;
-- Beto ya tiene acceso; Carla lo tuvo y se le revocó.
insert into public.enrollments (user_id, course_id, source) values
  ('e1000000-0000-4000-8000-000000000002', (select course from ctx), 'admin_grant'),
  ('e1000000-0000-4000-8000-000000000003', (select course from ctx), 'admin_grant');
update public.enrollments set revoked_at = now() where user_id = 'e1000000-0000-4000-8000-000000000003';

set local role authenticated;
set local request.jwt.claims to '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select * from public.admin_bulk_enroll((select course from ctx), array['ana.bulk@test.dev'])$$, '42501', null, 'Un alumno no puede inscribir a nadie');
select ok(not public.has_course_access((select course from ctx)), 'Y no obtuvo acceso al intentarlo');

set local request.jwt.claims to '{"sub":"e1000000-0000-4000-8000-000000000004","role":"authenticated"}';
create temp table res as
select * from public.admin_bulk_enroll((select course from ctx), array[
  ' Ana.Bulk@Test.dev ', 'ana.bulk@test.dev', 'beto.bulk@test.dev', 'CARLA.bulk@test.dev', 'nuevo.bulk@test.dev', 'esto no es correo', ''
]);
select is((select count(*)::int from res), 5, 'Un resultado por correo distinto (sin vacíos ni repetidos)');
select is((select status from res where email = 'ana.bulk@test.dev'), 'enrolled', 'Con cuenta y sin acceso: inscrita (sin importar mayúsculas ni espacios)');
select is((select user_id from res where email = 'ana.bulk@test.dev'), 'e1000000-0000-4000-8000-000000000001'::uuid, 'Devuelve el usuario inscrito');
select is((select status from res where email = 'beto.bulk@test.dev'), 'already', 'Con acceso vigente: no se toca');
select is((select status from res where email = 'carla.bulk@test.dev'), 'restored', 'Con acceso revocado: se le devuelve');
select is((select status from res where email = 'nuevo.bulk@test.dev'), 'not_found', 'Sin cuenta: queda para invitar');
select is((select status from res where email = 'esto no es correo'), 'invalid', 'Texto que no es correo: inválido');

reset role;
select is((select count(*)::int from public.enrollments where course_id = (select course from ctx) and user_id::text like 'e1000000%' and revoked_at is null), 3,
  'Ana, Beto y Carla quedan con acceso vigente');
select is((select source::text from public.enrollments where user_id = 'e1000000-0000-4000-8000-000000000001' and course_id = (select course from ctx)), 'admin_grant',
  'La inscripción queda como otorgada por el admin');
select is((select details from public.admin_audit_log where action = 'bulk_enroll' and actor_id = 'e1000000-0000-4000-8000-000000000004'),
  '{"enrolled": 1, "already": 1, "restored": 1, "not_found": 1, "invalid": 1}'::jsonb, 'La auditoría guarda solo los conteos');

set local role authenticated;
set local request.jwt.claims to '{"sub":"e1000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select * from public.admin_bulk_enroll((select course from ctx), array_fill('x@y.co'::text, array[501]))$$, '22023', null, 'Máximo 500 correos por envío');
select throws_ok($$select * from public.admin_bulk_enroll(gen_random_uuid(), array['ana.bulk@test.dev'])$$, 'P0002', null, 'Curso inexistente');

select * from finish();
rollback;
