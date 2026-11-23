-- Búsqueda de texto completo en lecciones: solo devuelve lecciones de cursos a
-- los que el alumno tiene acceso. Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('55555555-5555-4555-8555-555555555555', 'carla@test.dev', '{"full_name":"Carla Busca"}', 'authenticated', 'authenticated'),
  ('66666666-6666-4666-8666-666666666666', 'dani@test.dev', '{"full_name":"Dani Curioso"}', 'authenticated', 'authenticated');

create temp table ctx as
select
  (select id from public.courses where slug = 'git-github-esencial') as free_course,
  (select id from public.courses where slug = 'javascript-moderno') as paid_course,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'javascript-moderno' and l.title = 'El DOM y los eventos') as dom_lesson,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'git-github-esencial' and l.title = 'Ramas y pull requests') as branches_lesson;
grant select on ctx to authenticated, service_role;

-- Estructura -----------------------------------------------------------------
select is((select count(*)::int from public.lessons l where not exists (select 1 from public.lesson_contents lc where lc.lesson_id = l.id)), 0,
  'Toda lección (incluidos cuestionarios) tiene fila de contenido indexable');
select is((select count(*)::int from public.lesson_contents where search_vector = ''::tsvector), 0,
  'Todas las lecciones están indexadas');
select is(public.lesson_search_query('!!! & | :* ()'), null::tsquery,
  'Los operadores de tsquery escritos por el usuario se descartan');
select is(public.lesson_search_query('Función'), 'funcion:*'::tsquery,
  'La consulta ignora acentos y busca por prefijo');

select is(public.lesson_search_terms('Los eventos del DOM'), array['dom', 'event'],
  'Las raíces para resaltar salen del mismo analizador que el índice');
select is(public.lesson_search_terms('de la'), '{}'::text[], 'Solo palabras vacías: nada que resaltar');

-- Anónimo ----------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$select * from public.search_lessons('git')$$, '42501', null, 'Un visitante anónimo no puede buscar');
select throws_ok($$select public.lesson_search_terms('git')$$, '42501', null, 'Un visitante anónimo no usa el resaltado');
reset role;

-- Carla sin cursos ---------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';
select is((select count(*)::int from public.search_lessons('eventos')), 0,
  'Sin compra no encuentra lecciones de un curso de pago (ni por título)');
select is((select count(*)::int from public.search_lessons('ramas')), 0,
  'Sin inscribirse no encuentra lecciones de un curso gratuito');

-- Carla se inscribe al curso gratuito ---------------------------------------------
select lives_ok($$select public.enroll_free_course((select free_course from ctx))$$, 'Se inscribe al curso gratuito');
select ok(exists (select 1 from public.search_lessons('rama') where lesson_id = (select branches_lesson from ctx)),
  'Encuentra la lección por una palabra del contenido (con raíz: rama → ramas)');
select ok(not exists (select 1 from public.search_lessons('commit') where course_id <> (select free_course from ctx)),
  'Los resultados solo incluyen cursos a los que tiene acceso');
select ok((select bool_and(snippet like '%⟦%⟧%') from public.search_lessons('commit')),
  'Cada resultado trae un fragmento con la coincidencia resaltada');
select is((select count(*)::int from public.search_lessons('commit', (select paid_course from ctx))), 0,
  'El filtro por curso respeta el acceso');
reset role;

-- Compra del curso de pago (backend) ---------------------------------------------
set local role service_role;
insert into public.orders (id, user_id, provider, currency, subtotal_cents, discount_cents, total_cents, customer_email)
values ('77777777-7777-4777-8777-777777777777', '55555555-5555-4555-8555-555555555555', 'stripe', 'MXN', 89900, 0, 89900, 'carla@test.dev');
insert into public.order_items (order_id, item_type, course_id, title, unit_price_cents, total_cents)
values ('77777777-7777-4777-8777-777777777777', 'course', (select paid_course from ctx), 'JavaScript', 89900, 89900);
select ok(public.fulfill_order('77777777-7777-4777-8777-777777777777', 'pi_search', 89900, 'MXN'), 'Se confirma el pago');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';
select ok(exists (select 1 from public.search_lessons('addEventListener') where lesson_id = (select dom_lesson from ctx)),
  'Tras pagar encuentra contenido del curso comprado');

-- Otro alumno no ve nada de Carla --------------------------------------------------
set local request.jwt.claims to '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}';
select is((select count(*)::int from public.search_lessons('addEventListener')), 0,
  'Otro alumno sin compra no encuentra ese contenido');
reset role;

-- Cambiar el título reindexa la lección ---------------------------------------------
update public.lessons set title = 'Ramas, fusiones y pull requests' where id = (select branches_lesson from ctx);
select ok((select search_vector @@ public.lesson_search_query('fusiones') from public.lesson_contents where lesson_id = (select branches_lesson from ctx)),
  'Al cambiar el título se actualiza el índice');

select * from finish();
rollback;
