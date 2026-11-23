-- Subtítulos: mismas reglas de acceso que el contenido y búsqueda dentro del video.
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'subs.admin@test.dev', '{"full_name":"Admin Subs"}', 'authenticated', 'authenticated'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'subs.alumna@test.dev', '{"full_name":"Alumna Subs"}', 'authenticated', 'authenticated'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'subs.otro@test.dev', '{"full_name":"Otro Subs"}', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

create temp table ctx as
select
  (select id from public.courses where slug = 'git-github-esencial') as free_course,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'git-github-esencial' and l.type = 'article' order by l.position limit 1) as free_lesson,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'javascript-moderno' and not l.is_preview and l.type = 'article' limit 1) as paid_lesson;
grant select on ctx to authenticated;

-- Administrador
set local role authenticated;
set local request.jwt.claims to '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
select throws_ok($$update public.lesson_contents set captions_vtt = '1\n00:00:01,000 --> 00:00:02,000\nhola' where lesson_id = (select free_lesson from ctx)$$,
  '23514', null, 'Solo se guardan subtítulos en formato WebVTT');
select throws_ok($$update public.lesson_contents set captions_lang = 'xx' where lesson_id = (select free_lesson from ctx)$$,
  '23514', null, 'El idioma de los subtítulos debe ser uno permitido');
select lives_ok($$update public.lesson_contents set captions_vtt = E'WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nHoy explicamos el <i>ornitorrinco</i> del control de versiones'
  where lesson_id = (select free_lesson from ctx)$$, 'El administrador carga subtítulos en una lección gratuita');
select lives_ok($$update public.lesson_contents set captions_vtt = E'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nSecreto del curso de pago: quetzalcoatl'
  where lesson_id = (select paid_lesson from ctx)$$, 'Y en una lección de pago');
select ok((select has_captions from public.lesson_contents where lesson_id = (select free_lesson from ctx)), 'has_captions se calcula solo');

-- Alumna inscrita en el curso gratuito
set local request.jwt.claims to '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';
select lives_ok($$select public.enroll_free_course((select free_course from ctx))$$, 'Se inscribe al curso gratuito');
select ok(exists (select 1 from public.search_lessons('ornitorrinco') where lesson_id = (select free_lesson from ctx) and snippet like '%⟦ornitorrinco⟧%'),
  'Encuentra la lección por lo que se dice en el video, con fragmento resaltado');
select is((select count(*)::int from public.lesson_contents where lesson_id = (select paid_lesson from ctx)), 0,
  'No puede leer los subtítulos de una lección de pago');
select is((select count(*)::int from public.search_lessons('quetzalcoatl')), 0,
  'Ni encontrarlos con la búsqueda');

-- Alguien sin inscripción
set local request.jwt.claims to '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}';
select is((select count(*)::int from public.search_lessons('ornitorrinco')), 0, 'Sin inscripción no se encuentran subtítulos');

-- Cambiar el título conserva los subtítulos en el índice
reset role;
update public.lessons set title = title || ' (v2)' where id = (select free_lesson from ctx);
select ok((select search_vector @@ public.lesson_search_query('ornitorrinco') from public.lesson_contents where lesson_id = (select free_lesson from ctx)),
  'Reindexar por cambio de título conserva el texto de los subtítulos');

select * from finish();
rollback;
