-- Liberación programada: un módulo con release_after_days no se ve (ni su
-- contenido, recursos, cuestionario o progreso) hasta que pasan esos días
-- desde la inscripción. Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('d1000000-0000-4000-8000-000000000001', 'ana.drip@test.dev', '{"full_name":"Ana Drip"}', 'authenticated', 'authenticated'),
  ('d1000000-0000-4000-8000-000000000002', 'admin.drip@test.dev', '{"full_name":"Admin Drip"}', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = 'd1000000-0000-4000-8000-000000000002';

create temp table ctx as
select c.id as course,
       (select m.id from public.modules m where m.course_id = c.id order by m.position limit 1) as m1,
       (select m.id from public.modules m where m.course_id = c.id order by m.position desc limit 1) as m2
from public.courses c where c.slug = 'fundamentos-html-css';
alter table ctx add column l1 uuid, add column l2 uuid, add column quiz uuid;
update ctx set
  l1 = (select id from public.lessons where module_id = ctx.m1 and not is_preview order by position limit 1),
  l2 = (select id from public.lessons where module_id = ctx.m2 and type = 'article' order by position limit 1),
  quiz = (select id from public.lessons where module_id = ctx.m2 and type = 'quiz' limit 1);
grant select on ctx to anon, authenticated;

-- El segundo módulo se libera 7 días después de la inscripción; uno de sus
-- artículos queda como vista previa gratuita para comprobar que sigue abierto.
update public.modules set release_after_days = 7 where id = (select m2 from ctx);
create temp table preview as
select id from public.lessons where module_id = (select m2 from ctx) and type = 'article' order by position desc limit 1;
update public.lessons set is_preview = true where id = (select id from preview);
grant select on preview to anon, authenticated;
select throws_ok($$update public.modules set release_after_days = 731 where id = (select m2 from ctx)$$, '23514', null, 'Máximo 730 días');

set local role authenticated;
set local request.jwt.claims to '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.enroll_free_course((select course from ctx))$$, 'La alumna se inscribe hoy');
select ok(public.can_view_lesson((select l1 from ctx)), 'El primer módulo está disponible desde el primer día');
select ok(not public.can_view_lesson((select l2 from ctx)), 'El módulo programado aún no se ve');
select ok(public.module_release_at((select m2 from ctx)) between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days' + interval '1 minute',
  'Sabe cuándo se libera: 7 días después de inscribirse');
select is(public.module_release_at((select m1 from ctx)), null, 'Un módulo sin programación no tiene fecha');
select is((select count(*)::int from public.lesson_contents where lesson_id = (select l2 from ctx)), 0, 'No puede leer el contenido de una lección aún no liberada');
select ok(public.can_view_lesson((select id from preview)), 'La vista previa gratuita sigue abierta aunque su módulo esté programado');
select throws_ok($$select * from public.get_quiz((select quiz from ctx))$$, '42501', null, 'No puede abrir la evaluación de un módulo no liberado');
select throws_ok($$select public.submit_quiz_attempt((select quiz from ctx), '{}'::jsonb)$$, '42501', null, 'Tampoco puede presentar la evaluación');
select throws_ok($$insert into public.lesson_progress (user_id, lesson_id, course_id, completed_at) values (auth.uid(), (select l2 from ctx), (select course from ctx), now())$$,
  '42501', null, 'No puede marcar como completada una lección no liberada');
select throws_ok($$insert into public.lesson_notes (user_id, lesson_id, course_id, body) values (auth.uid(), (select l2 from ctx), (select course from ctx), 'nota')$$,
  '42501', null, 'No puede tomar notas en una lección no liberada');
select throws_ok($$insert into public.lesson_questions (user_id, lesson_id, course_id, body) values (auth.uid(), (select l2 from ctx), (select course from ctx), '¿Cuándo se abre esto?')$$,
  '42501', null, 'No puede preguntar en una lección no liberada');
select ok(not exists (select 1 from public.search_lessons('etiquetas', (select course from ctx), 50) s where s.lesson_id = (select l2 from ctx)),
  'La búsqueda no devuelve lecciones aún no liberadas');
update public.modules set release_after_days = 0 where id = (select m2 from ctx);
select ok(not public.can_view_lesson((select l2 from ctx)), 'Una alumna no puede cambiar la programación');

-- El administrador ve todo
set local request.jwt.claims to '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated"}';
select ok(public.can_view_lesson((select l2 from ctx)), 'El administrador ve el módulo programado');

-- Pasan 8 días desde la inscripción
reset role;
update public.enrollments set created_at = now() - interval '8 days'
where user_id = 'd1000000-0000-4000-8000-000000000001' and course_id = (select course from ctx);
set local role authenticated;
set local request.jwt.claims to '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(public.can_view_lesson((select l2 from ctx)), 'A los 8 días el módulo ya está liberado');
select ok((select count(*)::int from public.lesson_contents where lesson_id = (select l2 from ctx)) = 1, 'Y su contenido ya se puede leer');
select lives_ok($$insert into public.lesson_progress (user_id, lesson_id, course_id, completed_at) values (auth.uid(), (select l2 from ctx), (select course from ctx), now())$$,
  'Y puede completar la lección');

-- Con el acceso revocado, nada
reset role;
update public.enrollments set revoked_at = now() where user_id = 'd1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims to '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated"}';
select ok(not public.can_view_lesson((select l1 from ctx)), 'Sin acceso vigente no ve ningún módulo');

select * from finish();
rollback;
