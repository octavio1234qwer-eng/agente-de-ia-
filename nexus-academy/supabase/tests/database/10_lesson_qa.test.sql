-- Preguntas y respuestas por lección: acceso, privacidad del autor, equipo y moderación.
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('b1000000-0000-4000-8000-000000000001', 'ana.qa@test.dev', '{"full_name":"Ana  gómez Pérez"}', 'authenticated', 'authenticated'),
  ('b1000000-0000-4000-8000-000000000002', 'beto.qa@test.dev', '{"full_name":"Beto"}', 'authenticated', 'authenticated'),
  ('b1000000-0000-4000-8000-000000000003', 'carla.qa@test.dev', '{"full_name":"Carla Curiosa"}', 'authenticated', 'authenticated'),
  ('b1000000-0000-4000-8000-000000000004', 'admin.qa@test.dev', '{"full_name":"Equipo Admin"}', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = 'b1000000-0000-4000-8000-000000000004';

create temp table ctx as
select
  (select id from public.courses where slug = 'git-github-esencial') as course,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'git-github-esencial' order by l.position limit 1) as lesson,
  (select id from public.courses where slug = 'javascript-moderno') as other_course,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'javascript-moderno' and l.is_preview limit 1) as preview_lesson;
create temp table ids (k text primary key, v uuid);
grant select on ctx to anon, authenticated;
grant all on ids to anon, authenticated;

select is(public.public_display_name('Ana  gómez Pérez'), 'Ana G.', 'Nombre público: nombre e inicial del apellido');
select is(public.public_display_name('   '), 'Alumno', 'Sin nombre: «Alumno»');

-- Anónimo
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok('select * from public.lesson_questions', '42501', null, 'Un visitante anónimo no puede leer preguntas');
select throws_ok($$select public.lesson_qa((select lesson from ctx))$$, '42501', null, 'Un visitante anónimo no puede pedir el hilo');
reset role;

-- Ana: se inscribe y pregunta
set local role authenticated;
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$insert into public.lesson_questions (lesson_id, course_id, user_id, body) values ((select lesson from ctx), (select course from ctx), auth.uid(), '¿Qué hace git add?')$$,
  '42501', null, 'Sin inscripción no puede preguntar');
select lives_ok($$select public.enroll_free_course((select course from ctx))$$, 'Ana se inscribe al curso gratuito');
select lives_ok($$insert into public.lesson_questions (lesson_id, course_id, user_id, body) values ((select lesson from ctx), (select other_course from ctx), auth.uid(), '¿Qué hace git add exactamente?') returning id$$,
  'Inscrita, pregunta en la lección');
insert into ids select 'q1', id from public.lesson_questions where user_id = auth.uid();
select is((select course_id from public.lesson_questions where id = (select v from ids where k = 'q1')), (select course from ctx),
  'El curso de la pregunta sale de la lección, no del cliente');
select throws_ok($$insert into public.lesson_questions (lesson_id, course_id, user_id, body) values ((select lesson from ctx), (select course from ctx), 'b1000000-0000-4000-8000-000000000002', 'Suplantación de Beto')$$,
  '42501', null, 'No puede preguntar a nombre de otro alumno');
select throws_ok($$insert into public.lesson_questions (lesson_id, course_id, user_id, body) values ((select lesson from ctx), (select course from ctx), auth.uid(), 'abc')$$,
  '23514', null, 'Una pregunta necesita al menos 5 caracteres');
select throws_ok($$insert into public.lesson_answers (question_id, course_id, user_id, body, is_staff) values ((select v from ids where k = 'q1'), (select course from ctx), auth.uid(), 'Me respondo como equipo', true)$$,
  '42501', null, 'El cliente no puede marcar su respuesta como del equipo');
select throws_ok($$update public.lesson_questions set hidden_at = now() where id = (select v from ids where k = 'q1')$$,
  '42501', null, 'Un alumno no puede cambiar la moderación');
select throws_ok($$select public.admin_moderate_qa('question', (select v from ids where k = 'q1'), true)$$,
  '42501', null, 'Un alumno no puede moderar');
select throws_ok($$select * from public.admin_lesson_questions()$$, '42501', null, 'Un alumno no ve la bandeja del admin');

-- Carla, sin inscripción, no ve nada
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.lesson_questions), 0, 'Sin inscripción no ve preguntas');
select throws_ok($$select public.lesson_qa((select lesson from ctx))$$, '42501', null, 'Sin inscripción no recibe el hilo');
select throws_ok($$select public.lesson_qa((select preview_lesson from ctx))$$, '42501', null, 'La vista previa gratuita no abre las preguntas');

-- Beto, inscrito, ve la pregunta con nombre corto y responde
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select public.enroll_free_course((select course from ctx))$$, 'Beto se inscribe');
select is((select public.lesson_qa((select lesson from ctx)) -> 0 ->> 'author'), 'Ana G.', 'Otro alumno ve «Ana G.», no su nombre completo');
select ok(position('ana.qa@test.dev' in public.lesson_qa((select lesson from ctx))::text) = 0, 'El hilo nunca incluye correos');
insert into public.lesson_answers (question_id, course_id, user_id, body) values ((select v from ids where k = 'q1'), (select other_course from ctx), auth.uid(), 'Agrega cambios al área de preparación');
select is((select is_staff from public.lesson_answers where user_id = auth.uid()), false, 'La respuesta de un alumno no es del equipo');
update public.lesson_questions set body = 'Beto editó la pregunta de Ana';
select is((select body from public.lesson_questions where id = (select v from ids where k = 'q1')), '¿Qué hace git add exactamente?', 'No puede editar preguntas ajenas');

-- Admin responde (equipo) y modera
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select count(*)::int from public.admin_lesson_questions('unanswered')), 1, 'La pregunta aparece como sin responder');
insert into public.lesson_answers (question_id, course_id, user_id, body) values ((select v from ids where k = 'q1'), (select course from ctx), auth.uid(), 'Exacto: prepara los cambios para el siguiente commit.');
select is((select is_staff from public.lesson_answers where user_id = auth.uid()), true, 'La respuesta del admin queda marcada como del equipo');
select is((select count(*)::int from public.admin_lesson_questions('unanswered')), 0, 'Con respuesta del equipo deja de estar pendiente');
select lives_ok($$select public.admin_moderate_qa('question', (select v from ids where k = 'q1'), true)$$, 'El admin oculta la pregunta');

-- Beto ya no ve la pregunta ni sus respuestas; no puede responderla
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(jsonb_array_length(public.lesson_qa((select lesson from ctx))), 0, 'Pregunta oculta: los demás no la ven');
select is((select count(*)::int from public.lesson_answers), 0, 'Al ocultar la pregunta se ocultan sus respuestas para los demás');
select throws_ok($$insert into public.lesson_answers (question_id, course_id, user_id, body) values ((select v from ids where k = 'q1'), (select course from ctx), auth.uid(), 'otra')$$,
  '42501', null, 'No se puede responder una pregunta oculta');

-- Ana sigue viendo su pregunta oculta, pero ya no puede editarla
set local request.jwt.claims to '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select (public.lesson_qa((select lesson from ctx)) -> 0 ->> 'hidden')::boolean), true, 'La autora ve su pregunta marcada como oculta');
update public.lesson_questions set body = 'Edito lo moderado' where id = (select v from ids where k = 'q1');
select is((select body from public.lesson_questions where id = (select v from ids where k = 'q1')), '¿Qué hace git add exactamente?', 'No puede editar una pregunta oculta');

select * from finish();
rollback;
