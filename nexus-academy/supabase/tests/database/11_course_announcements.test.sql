-- Avisos del curso: solo alumnos con acceso los leen, solo el admin los escribe,
-- y cada alumno lleva su propio «visto».
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('c1000000-0000-4000-8000-000000000001', 'ana.av@test.dev', '{"full_name":"Ana Avisos"}', 'authenticated', 'authenticated'),
  ('c1000000-0000-4000-8000-000000000002', 'beto.av@test.dev', '{"full_name":"Beto Avisos"}', 'authenticated', 'authenticated'),
  ('c1000000-0000-4000-8000-000000000003', 'carla.av@test.dev', '{"full_name":"Carla Avisos"}', 'authenticated', 'authenticated'),
  ('c1000000-0000-4000-8000-000000000004', 'admin.av@test.dev', '{"full_name":"Admin Avisos"}', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = 'c1000000-0000-4000-8000-000000000004';

create temp table ctx as
select (select id from public.courses where slug = 'git-github-esencial') as course,
       (select id from public.courses where slug = 'javascript-moderno') as other_course;
grant select on ctx to anon, authenticated;

-- Ana y Beto se inscriben; Carla no.
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.enroll_free_course((select course from ctx))$$, 'Ana se inscribe');
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select public.enroll_free_course((select course from ctx))$$, 'Beto se inscribe');

-- Un alumno no puede publicar avisos
select throws_ok($$insert into public.course_announcements (course_id, author_id, title, body) values ((select course from ctx), auth.uid(), 'Falso aviso', 'hola')$$,
  '42501', null, 'Un alumno no puede publicar avisos');

-- El admin publica dos avisos
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000004","role":"authenticated"}';
select lives_ok($$insert into public.course_announcements (course_id, author_id, title, body) values ((select course from ctx), auth.uid(), 'Bienvenida', 'Hola a todos')$$,
  'El admin publica un aviso');
select throws_ok($$insert into public.course_announcements (course_id, author_id, title, body) values ((select course from ctx), 'c1000000-0000-4000-8000-000000000001', 'Suplantado', 'x')$$,
  '42501', null, 'El autor del aviso es siempre quien lo publica');
select throws_ok($$insert into public.course_announcements (course_id, author_id, title, body) values ((select course from ctx), auth.uid(), 'ab', 'x')$$,
  '23514', null, 'El título necesita al menos 3 caracteres');
reset role;
-- Se fecha el aviso en el pasado (como superusuario) para probar el «visto».
update public.course_announcements set created_at = now() - interval '2 days' where title = 'Bienvenida';
insert into public.course_announcements (course_id, author_id, title, body)
values ((select other_course from ctx), 'c1000000-0000-4000-8000-000000000004', 'Aviso de otro curso', 'No es para Ana');

-- Anónimo
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok('select * from public.course_announcements', '42501', null, 'Un visitante anónimo no lee avisos');
reset role;

-- Ana: ve solo los de su curso, todos como nuevos
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.course_announcements), 1, 'La alumna ve solo los avisos de su curso');
select is((select unseen from public.course_announcements_unseen() where course_id = (select course from ctx)), 1, 'Sin verlos nunca, todos cuentan como nuevos');
update public.course_announcements set title = 'Cambiado por alumna';
select is((select title from public.course_announcements limit 1), 'Bienvenida', 'Una alumna no puede editar avisos');
delete from public.course_announcements;
select is((select count(*)::int from public.course_announcements), 1, 'Una alumna no puede borrar avisos');
select lives_ok($$select public.mark_announcements_seen((select course from ctx))$$, 'Marca los avisos como vistos');
select is((select count(*)::int from public.course_announcements_unseen()), 0, 'Después de verlos ya no hay nuevos');

-- Carla, sin inscripción
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.course_announcements), 0, 'Sin inscripción no ve avisos');
select lives_ok($$select public.mark_announcements_seen((select course from ctx))$$, 'Marcar sin inscripción no falla');
select is((select count(*)::int from public.course_announcements_unseen()), 0, 'Sin inscripción no tiene avisos nuevos');

-- Un aviso nuevo: Beto (nunca los vio) tiene 2; Ana, 1 y con el título más reciente
reset role;
insert into public.course_announcements (course_id, author_id, title, body)
values ((select course from ctx), 'c1000000-0000-4000-8000-000000000004', 'Sesión en vivo el jueves', 'Nos vemos a las 7 pm');
update public.enrollments set announcements_seen_at = now() - interval '1 hour'
where user_id = 'c1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select unseen from public.course_announcements_unseen()), 2, 'Otro alumno lleva su propio conteo');
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select latest_title from public.course_announcements_unseen()), 'Sesión en vivo el jueves', 'Muestra el título del aviso nuevo más reciente');

-- Con el acceso revocado deja de verlos
reset role;
update public.enrollments set revoked_at = now() where user_id = 'c1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.course_announcements), 0, 'Con el acceso revocado ya no ve los avisos');

select * from finish();
rollback;
