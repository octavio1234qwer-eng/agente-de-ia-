-- Reporte de ingresos por producto: solo admin, reparto exacto de reembolsos.
-- Ejecutar: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'rev.admin@test.dev', '{"full_name":"Admin Ingresos"}', 'authenticated', 'authenticated'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'rev.alumna@test.dev', '{"full_name":"Alumna Ingresos"}', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

create temp table ctx as
select (select id from public.courses where slug = 'javascript-moderno') as a,
       (select id from public.courses where slug = 'python-ciencia-de-datos') as b;
grant select on ctx to authenticated;

-- Pedido con dos cursos y cupón (descuento ya repartido por artículo): 79 900 + 44 900 = 124 800.
insert into public.orders (id, user_id, provider, currency, subtotal_cents, discount_cents, total_cents, customer_email)
values ('12121212-1212-4212-8212-121212121212', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'stripe', 'MXN', 139800, 15000, 124800, 'rev.alumna@test.dev'),
       ('13131313-1313-4313-8313-131313131313', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'paypal', 'MXN', 49900, 0, 49900, 'rev.alumna@test.dev');
insert into public.order_items (order_id, item_type, course_id, title, unit_price_cents, discount_cents, total_cents)
values ('12121212-1212-4212-8212-121212121212', 'course', (select a from ctx), 'JS', 89900, 10000, 79900),
       ('12121212-1212-4212-8212-121212121212', 'course', (select b from ctx), 'PY', 49900, 5000, 44900),
       ('13131313-1313-4313-8313-131313131313', 'course', (select b from ctx), 'PY', 49900, 0, 49900);
select public.fulfill_order('12121212-1212-4212-8212-121212121212', 'pi_rev', 124800, 'MXN');
-- El segundo queda pendiente: no debe contarse.
select public.record_refund('12121212-1212-4212-8212-121212121212', 20000, 're_rev', 'prueba', null);
-- Fecha de pago aislada para no mezclar con otros datos locales.
update public.orders set paid_at = '2001-01-15T18:00:00Z' where id = '12121212-1212-4212-8212-121212121212';

set local role authenticated;
set local request.jwt.claims to '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}';
create temp table rep as select * from public.admin_revenue_by_product('2001-01-01T00:00:00Z', '2001-02-01T00:00:00Z');

select is((select count(*)::int from rep), 2, 'Una fila por producto vendido en el periodo (el pedido pendiente no cuenta)');
select is((select sum(net_cents)::bigint from rep), 104800::bigint, 'El neto total cuadra: 124 800 cobrados − 20 000 reembolsados');
select is((select sum(refunded_cents)::bigint from rep), 20000::bigint, 'Los reembolsos repartidos suman exactamente el reembolso del pedido');
select is((select row(gross_cents, discount_cents, refunded_cents, net_cents)::text from rep where product_id = (select a from ctx)),
  row(89900::bigint, 10000::bigint, 12805::bigint, 67095::bigint)::text, 'Curso A: bruto, descuento, reembolso proporcional (+1 centavo de redondeo) y neto');
select is((select row(gross_cents, discount_cents, refunded_cents, net_cents)::text from rep where product_id = (select b from ctx)),
  row(49900::bigint, 5000::bigint, 7195::bigint, 37705::bigint)::text, 'Curso B: mismo reparto proporcional');
select is((select units from rep where product_id = (select a from ctx)), 1, 'Cuenta unidades vendidas');
select is((select count(*)::int from public.admin_revenue_by_product('2001-02-01T00:00:00Z', '2001-03-01T00:00:00Z')), 0, 'Fuera del periodo no hay ventas');

set local role authenticated;
set local request.jwt.claims to '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}';
select throws_ok($$select * from public.admin_revenue_by_product()$$, '42501', null, 'Un alumno no puede ver los ingresos');
set local request.jwt.claims to '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}';
select lives_ok($$select * from public.admin_revenue_by_product()$$, 'El administrador sí');

select * from finish();
rollback;
