-- Pruebas de seguridad y reglas de negocio (pgTAP).
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

-- ---------------------------------------------------------------------------
-- Datos de prueba
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('11111111-1111-4111-8111-111111111111', 'ana@test.dev', '{"full_name":"Ana Pruebas"}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'beto@test.dev', '{"full_name":"Beto Pruebas"}', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'admin@test.dev', '{"full_name":"Admin"}', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = '33333333-3333-4333-8333-333333333333';

create temp table ctx as
select
  (select id from public.courses where slug = 'git-github-esencial') as free_course,
  (select id from public.courses where slug = 'javascript-moderno') as paid_course,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'javascript-moderno' and not l.is_preview and l.type = 'article' limit 1) as paid_lesson,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'javascript-moderno' and l.is_preview limit 1) as preview_lesson,
  (select l.id from public.lessons l join public.courses c on c.id = l.course_id
    where c.slug = 'git-github-esencial' and l.type = 'quiz' limit 1) as free_quiz,
  (select count(*) from public.courses where status = 'published') as published_count;
grant select on ctx to anon, authenticated, service_role;

select ok(exists (select 1 from public.profiles where email = 'ana@test.dev' and full_name = 'Ana Pruebas'),
  'El trigger crea el perfil al registrarse');

-- ---------------------------------------------------------------------------
-- Visitante anónimo
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select ok((select count(*) from public.courses) = (select published_count from ctx) and (select published_count from ctx) >= 10,
  'anon ve exactamente los cursos publicados');
select is((select count(*)::int from public.lesson_contents where lesson_id = (select paid_lesson from ctx)), 0,
  'anon NO ve el contenido de una lección de pago');
select is((select count(*)::int from public.lesson_contents where lesson_id = (select preview_lesson from ctx)), 1,
  'anon ve el contenido de una lección de vista previa');
select throws_ok('select * from public.quiz_questions', '42501', null, 'anon no puede leer preguntas (respuestas)');
select throws_ok('select * from public.orders', '42501', null, 'anon no puede leer órdenes');
select throws_ok($$select public.fulfill_order(gen_random_uuid(), 'x', 1, 'MXN')$$, '42501', null,
  'anon no puede confirmar pagos');

-- ---------------------------------------------------------------------------
-- Alumna Ana
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok($$update public.profiles set role = 'admin' where id = auth.uid()$$, '42501', null,
  'El alumno no puede ascenderse a admin');
select lives_ok($$update public.profiles set full_name = 'Ana María Pruebas' where id = auth.uid()$$,
  'El alumno puede editar su nombre');
select is((select count(*)::int from public.profiles), 1, 'El alumno solo ve su propio perfil');
select throws_ok($$insert into public.enrollments (user_id, course_id, source) values (auth.uid(), (select paid_course from ctx), 'purchase')$$,
  '42501', null, 'El alumno no puede auto-inscribirse a un curso de pago');
select is((select count(*)::int from public.lesson_contents where lesson_id = (select paid_lesson from ctx)), 0,
  'Sin compra no hay acceso al contenido de pago');
select throws_ok($$select public.enroll_free_course((select paid_course from ctx))$$, 'P0001', 'course_not_free',
  'enroll_free_course rechaza cursos de pago');
select throws_ok($$select public.fulfill_order(gen_random_uuid(), 'x', 1, 'MXN')$$, '42501', null,
  'Un alumno no puede confirmar pagos');
select throws_ok($$select public.admin_dashboard_stats(30)$$, '42501', null, 'Un alumno no ve métricas de admin');
select throws_ok($$insert into public.lesson_progress (user_id, lesson_id, completed_at) values (auth.uid(), (select paid_lesson from ctx), now())$$,
  '42501', null, 'No puede registrar progreso en un curso no comprado');
select throws_ok($$insert into public.reviews (user_id, course_id, rating) values (auth.uid(), (select paid_course from ctx), 5)$$,
  '42501', null, 'No puede reseñar un curso que no tiene');

-- Carrito
select lives_ok($$insert into public.cart_items (user_id, item_type, course_id) values (auth.uid(), 'course', (select paid_course from ctx))$$,
  'Puede añadir un curso de pago al carrito');
select throws_ok($$insert into public.cart_items (user_id, item_type, course_id) values (auth.uid(), 'course', (select free_course from ctx))$$,
  '42501', null, 'No puede añadir un curso gratuito al carrito');
select throws_ok($$insert into public.cart_items (user_id, item_type, course_id) values ('22222222-2222-4222-8222-222222222222', 'course', (select paid_course from ctx))$$,
  '42501', null, 'No puede escribir en el carrito de otro usuario');

-- Curso gratuito completo -> certificado
select lives_ok($$select public.enroll_free_course((select free_course from ctx))$$, 'Se inscribe a un curso gratuito');
select ok(public.has_course_access((select free_course from ctx)), 'Tiene acceso tras inscribirse gratis');
select throws_ok($$insert into public.lesson_progress (user_id, lesson_id, completed_at) values (auth.uid(), (select free_quiz from ctx), now())$$,
  '42501', null, 'Un cuestionario no se puede marcar como completado sin aprobarlo');
select lives_ok($$insert into public.lesson_progress (user_id, lesson_id, completed_at)
  select auth.uid(), l.id, now() from public.lessons l where l.course_id = (select free_course from ctx) and l.type <> 'quiz'$$,
  'Marca como completadas las lecciones no evaluadas');
select is((select count(*)::int from public.get_quiz((select free_quiz from ctx))), 2, 'get_quiz devuelve las preguntas');
select ok(not (select (public.submit_quiz_attempt((select free_quiz from ctx), '{}'::jsonb) ->> 'passed')::boolean),
  'Un intento vacío reprueba');
select ok(not exists (
    select 1 from jsonb_array_elements(public.submit_quiz_attempt((select free_quiz from ctx), '{}'::jsonb) -> 'results') r
    where r ? 'correct_index'),
  'Al reprobar no se revelan las respuestas correctas');
select is((select count(*)::int from public.certificates), 0, 'Sin aprobar la evaluación no hay certificado');
select is((select count(*)::int from public.quiz_questions), 0,
  'El alumno no puede leer las respuestas correctas de la tabla');
reset role;

-- Ana aprueba con las respuestas correctas (calculadas como superusuario).
create temp table answers as
  select jsonb_object_agg(q.id::text, q.correct_index) as a from public.quiz_questions q
  where q.lesson_id = (select free_quiz from ctx);
grant select on answers to authenticated;
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select ok((public.submit_quiz_attempt((select free_quiz from ctx), (select a from answers)) ->> 'passed')::boolean,
  'Con las respuestas correctas aprueba');
select is((select progress_percent from public.enrollments where course_id = (select free_course from ctx)), 100,
  'El progreso llega a 100 %');
select is((select count(*)::int from public.certificates where course_id = (select free_course from ctx)), 1,
  'Se emite el certificado automáticamente');
select ok((select code ~ '^NX-[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$' from public.certificates limit 1),
  'El código del certificado tiene el formato esperado');
select lives_ok($$insert into public.reviews (user_id, course_id, rating, comment) values (auth.uid(), (select free_course from ctx), 5, 'Excelente')$$,
  'Puede reseñar un curso que tiene');
select throws_ok($$update public.reviews set status = 'hidden' where user_id = auth.uid()$$, '42501', null,
  'El alumno no puede cambiar la moderación de su reseña');

-- Beto no ve datos de Ana
set local request.jwt.claims to '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.certificates), 0, 'Otro alumno no ve certificados ajenos');
select is((select count(*)::int from public.cart_items), 0, 'Otro alumno no ve carritos ajenos');

-- ---------------------------------------------------------------------------
-- Backend (service_role): compra, idempotencia y reembolso
-- ---------------------------------------------------------------------------
reset role;
set local role service_role;
insert into public.orders (id, user_id, provider, currency, subtotal_cents, discount_cents, total_cents, customer_email)
values ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'stripe', 'MXN', 89900, 0, 89900, 'ana@test.dev');
insert into public.order_items (order_id, item_type, course_id, title, unit_price_cents, total_cents)
values ('44444444-4444-4444-8444-444444444444', 'course', (select paid_course from ctx), 'JavaScript', 89900, 89900);

select throws_ok($$select public.fulfill_order('44444444-4444-4444-8444-444444444444', 'pi_1', 100, 'MXN')$$,
  'P0001', 'amount_mismatch', 'Un importe distinto no confirma la orden');
select ok(public.fulfill_order('44444444-4444-4444-8444-444444444444', 'pi_1', 89900, 'mxn'), 'El pago correcto confirma la orden');
select ok(not public.fulfill_order('44444444-4444-4444-8444-444444444444', 'pi_1', 89900, 'MXN'), 'Confirmar dos veces es idempotente');
select is((select count(*)::int from public.cart_items where user_id = '11111111-1111-4111-8111-111111111111'), 0,
  'El curso comprado sale del carrito');

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*)::int from public.lesson_contents where lesson_id = (select paid_lesson from ctx)), 1,
  'Tras pagar, la alumna accede al contenido');

reset role;
set local role service_role;
select is(public.record_refund('44444444-4444-4444-8444-444444444444', 89900, 're_1', 'prueba', null)::text, 'refunded',
  'El reembolso total marca la orden como reembolsada');

reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*)::int from public.lesson_contents where lesson_id = (select paid_lesson from ctx)), 0,
  'Tras el reembolso total se retira el acceso');

-- ---------------------------------------------------------------------------
-- Administrador
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select ok(public.is_admin(), 'is_admin() reconoce al administrador');
select ok((public.admin_dashboard_stats(30) ->> 'paid_orders')::int >= 1 and public.admin_dashboard_stats(30) ? 'daily', 'El admin obtiene métricas reales');

select * from finish();
rollback;
