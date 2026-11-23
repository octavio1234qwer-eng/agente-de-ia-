-- Notas personales por lección: privadas y solo en lecciones visibles.
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('88888888-8888-4888-8888-888888888888', 'nora@test.dev', '{"full_name":"Nora Notas"}', 'authenticated', 'authenticated'),
  ('99999999-9999-4999-8999-999999999999', 'otto@test.dev', '{"full_name":"Otto Otro"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'admin.notas@test.dev', '{"full_name":"Admin"}', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

create temp table ctx as
select
  (select id from public.courses where slug = 'git-github-esencial') as free_course,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'git-github-esencial' and l.type = 'article' order by l.position limit 1) as free_lesson,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'javascript-moderno' and not l.is_preview and l.type = 'article' limit 1) as paid_lesson,
  (select id from public.courses where slug = 'javascript-moderno') as paid_course;
grant select on ctx to anon, authenticated;

-- Anónimo
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok('select * from public.lesson_notes', '42501', null, 'Un visitante anónimo no puede leer notas');
reset role;

-- Nora
set local role authenticated;
set local request.jwt.claims to '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}';
select throws_ok($$insert into public.lesson_notes (user_id, lesson_id, course_id, body) values (auth.uid(), (select paid_lesson from ctx), (select paid_course from ctx), 'mía')$$,
  '42501', null, 'No puede tomar notas en una lección de pago que no compró');
select lives_ok($$select public.enroll_free_course((select free_course from ctx))$$, 'Se inscribe al curso gratuito');
select lives_ok($$insert into public.lesson_notes (user_id, lesson_id, course_id, body) values (auth.uid(), (select free_lesson from ctx), (select paid_course from ctx), 'git add antes de commit')$$,
  'Toma una nota en una lección de su curso');
select is((select course_id from public.lesson_notes where lesson_id = (select free_lesson from ctx)), (select free_course from ctx),
  'El curso de la nota se toma de la lección, no del cliente');
select throws_ok($$insert into public.lesson_notes (user_id, lesson_id, course_id, body) values (auth.uid(), (select free_lesson from ctx), (select free_course from ctx), 'otra')$$,
  '23505', null, 'Una sola nota por lección');
select throws_ok($$insert into public.lesson_notes (user_id, lesson_id, course_id, body) values ('99999999-9999-4999-8999-999999999999', (select free_lesson from ctx), (select free_course from ctx), 'suplantación')$$,
  '42501', null, 'No puede crear notas a nombre de otro alumno');
select throws_ok($$update public.lesson_notes set lesson_id = (select paid_lesson from ctx) where user_id = auth.uid()$$,
  '42501', null, 'No puede mover su nota a otra lección');
select throws_ok($$update public.lesson_notes set body = repeat('x', 5001) where user_id = auth.uid()$$,
  '23514', null, 'Las notas tienen un máximo de 5000 caracteres');
select throws_ok($$update public.lesson_notes set body = '   ' where user_id = auth.uid()$$,
  '23514', null, 'Una nota no puede quedar vacía');

-- Otto no ve la nota de Nora
set local request.jwt.claims to '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}';
select is((select count(*)::int from public.lesson_notes), 0, 'Otro alumno no ve notas ajenas');
update public.lesson_notes set body = 'hackeado';

-- El administrador tampoco
set local request.jwt.claims to '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select is((select count(*)::int from public.lesson_notes), 0, 'Las notas son privadas también para el administrador');

-- Nora: su nota sigue intacta y la puede borrar
set local request.jwt.claims to '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}';
select is((select body from public.lesson_notes where lesson_id = (select free_lesson from ctx)), 'git add antes de commit',
  'Nadie más pudo modificar la nota');
delete from public.lesson_notes where lesson_id = (select free_lesson from ctx);
select is((select count(*)::int from public.lesson_notes), 0, 'La alumna borra su nota');

select * from finish();
rollback;
