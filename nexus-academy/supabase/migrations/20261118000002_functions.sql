-- =============================================================================
-- NEXUS ACADEMY · Funciones de negocio y triggers
-- Las funciones SECURITY DEFINER fijan search_path = '' y validan permisos
-- explícitamente. Las que mueven dinero o accesos solo las puede ejecutar
-- service_role (backend), nunca un navegador.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Alta de usuarios: crea el perfil automáticamente.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(left(trim(new.raw_user_meta_data ->> 'full_name'), 120), ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Autorización
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.has_course_access(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.enrollments e
    where e.course_id = p_course_id
      and e.user_id = (select auth.uid())
      and e.revoked_at is null
  );
$$;

-- Una lección es visible si el alumno tiene acceso al curso o si es una
-- lección de vista previa gratuita de un curso publicado.
create or replace function public.can_view_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lessons l
    join public.courses c on c.id = l.course_id
    where l.id = p_lesson_id
      and (
        public.has_course_access(l.course_id)
        or (l.is_preview and c.status = 'published')
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Valores derivados de cursos
-- -----------------------------------------------------------------------------
create or replace function public.refresh_course_lesson_stats(p_course_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.courses c set
    lessons_count = s.cnt,
    duration_minutes = ceil(s.secs / 60.0)::int
  from (
    select count(*)::int as cnt, coalesce(sum(duration_seconds), 0) as secs
    from public.lessons where course_id = p_course_id
  ) s
  where c.id = p_course_id;
$$;

create or replace function public.on_lessons_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_course_lesson_stats(old.course_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_course_lesson_stats(new.course_id);
  end if;
  return null;
end;
$$;

create trigger lessons_stats after insert or update of duration_seconds, course_id or delete
  on public.lessons for each row execute function public.on_lessons_changed();

-- course_id de una lección siempre coincide con el de su módulo.
create or replace function public.lessons_sync_course()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select m.course_id into new.course_id from public.modules m where m.id = new.module_id;
  if new.course_id is null then
    raise exception 'module_not_found';
  end if;
  return new;
end;
$$;

create trigger lessons_sync_course before insert or update of module_id
  on public.lessons for each row execute function public.lessons_sync_course();

-- course_id redundante en tablas hijas de lecciones (simplifica RLS).
create or replace function public.sync_course_from_lesson()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select l.course_id into new.course_id from public.lessons l where l.id = new.lesson_id;
  if new.course_id is null then
    raise exception 'lesson_not_found';
  end if;
  return new;
end;
$$;

create trigger lesson_contents_sync before insert or update of lesson_id
  on public.lesson_contents for each row execute function public.sync_course_from_lesson();
create trigger lesson_resources_sync before insert or update of lesson_id
  on public.lesson_resources for each row execute function public.sync_course_from_lesson();
create trigger quiz_questions_sync before insert or update of lesson_id
  on public.quiz_questions for each row execute function public.sync_course_from_lesson();
create trigger lesson_progress_sync before insert or update of lesson_id
  on public.lesson_progress for each row execute function public.sync_course_from_lesson();

create or replace function public.on_enrollments_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid := coalesce(new.course_id, old.course_id);
begin
  update public.courses set students_count = (
    select count(*) from public.enrollments
    where course_id = v_course and revoked_at is null
  ) where id = v_course;
  return null;
end;
$$;

create trigger enrollments_stats after insert or update of revoked_at or delete
  on public.enrollments for each row execute function public.on_enrollments_changed();

create or replace function public.on_reviews_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course uuid := coalesce(new.course_id, old.course_id);
begin
  update public.courses c set
    rating_avg = coalesce(s.avg_rating, 0),
    rating_count = s.cnt
  from (
    select round(avg(rating)::numeric, 2) as avg_rating, count(*)::int as cnt
    from public.reviews where course_id = v_course and status = 'published'
  ) s
  where c.id = v_course;
  return null;
end;
$$;

create trigger reviews_stats after insert or update or delete
  on public.reviews for each row execute function public.on_reviews_changed();

create or replace function public.courses_set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger courses_published_at before insert or update of status
  on public.courses for each row execute function public.courses_set_published_at();

-- -----------------------------------------------------------------------------
-- Certificados
-- -----------------------------------------------------------------------------
create or replace function public.generate_certificate_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  -- Alfabeto sin caracteres ambiguos (0/O, 1/I/L).
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  bytes bytea := extensions.gen_random_bytes(10);
  result text := 'NX-';
  i int;
begin
  for i in 0..9 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
    if i = 4 then
      result := result || '-';
    end if;
  end loop;
  return result;
end;
$$;

create or replace function public.issue_certificate(p_user_id uuid, p_course_id uuid, p_completed_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_title text;
  v_instructor text;
  v_attempt int := 0;
begin
  select coalesce(nullif(trim(p.full_name), ''), split_part(p.email::text, '@', 1))
    into v_name from public.profiles p where p.id = p_user_id;
  select c.title, i.name into v_title, v_instructor
    from public.courses c left join public.instructors i on i.id = c.instructor_id
    where c.id = p_course_id;

  loop
    begin
      insert into public.certificates (code, user_id, course_id, student_name, course_title, instructor_name, completed_at)
      values (public.generate_certificate_code(), p_user_id, p_course_id, v_name, v_title, v_instructor, p_completed_at)
      on conflict (user_id, course_id) do nothing;
      return;
    exception when unique_violation then
      -- Colisión improbable del código: reintentar.
      v_attempt := v_attempt + 1;
      if v_attempt > 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

-- Recalcula el progreso de la inscripción y emite el certificado al llegar a 100 %.
create or replace function public.on_lesson_progress_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total int;
  v_done int;
  v_percent int;
  v_enrollment public.enrollments;
begin
  select * into v_enrollment from public.enrollments
    where user_id = new.user_id and course_id = new.course_id;
  if not found then
    return null;
  end if;

  select count(*) into v_total from public.lessons where course_id = new.course_id;
  select count(*) into v_done
    from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    where lp.user_id = new.user_id and lp.course_id = new.course_id and lp.completed_at is not null;

  v_percent := case when v_total = 0 then 0 else least(100, floor(v_done * 100.0 / v_total)::int) end;

  update public.enrollments set
    progress_percent = v_percent,
    last_lesson_id = new.lesson_id,
    last_activity_at = now(),
    completed_at = case when v_percent = 100 then coalesce(completed_at, now()) else completed_at end
  where id = v_enrollment.id;

  if v_percent = 100 and v_enrollment.revoked_at is null then
    perform public.issue_certificate(new.user_id, new.course_id, now());
  end if;
  return null;
end;
$$;

create trigger lesson_progress_after after insert or update
  on public.lesson_progress for each row execute function public.on_lesson_progress_changed();

create or replace function public.get_certificate_public(p_code text)
returns table (
  code text,
  student_name text,
  course_title text,
  course_slug text,
  instructor_name text,
  completed_at timestamptz,
  issued_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select ce.code, ce.student_name, ce.course_title, co.slug, ce.instructor_name,
         ce.completed_at, ce.issued_at, ce.revoked_at
  from public.certificates ce
  left join public.courses co on co.id = ce.course_id
  where ce.code = upper(trim(p_code));
$$;

-- -----------------------------------------------------------------------------
-- Cuestionarios (la respuesta correcta nunca sale del servidor antes de enviar)
-- -----------------------------------------------------------------------------
create or replace function public.get_quiz(p_lesson_id uuid)
returns table (id uuid, prompt text, options jsonb, "position" int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_view_lesson(p_lesson_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select q.id, q.prompt, q.options, q.position
    from public.quiz_questions q
    where q.lesson_id = p_lesson_id
    order by q.position, q.created_at;
end;
$$;

create or replace function public.submit_quiz_attempt(p_lesson_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_lesson public.lessons;
  v_total int := 0;
  v_score int := 0;
  v_passed boolean;
  v_results jsonb := '[]'::jsonb;
  v_q record;
  v_answer int;
  v_correct boolean;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found or v_lesson.type <> 'quiz' then
    raise exception 'quiz_not_found';
  end if;
  if not public.has_course_access(v_lesson.course_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'invalid_answers';
  end if;

  for v_q in
    select q.id, q.correct_index, q.explanation
    from public.quiz_questions q where q.lesson_id = p_lesson_id
    order by q.position, q.created_at
  loop
    v_total := v_total + 1;
    v_answer := case
      when jsonb_typeof(p_answers -> v_q.id::text) = 'number' then (p_answers ->> v_q.id::text)::int
      else null
    end;
    v_correct := v_answer is not null and v_answer = v_q.correct_index;
    if v_correct then
      v_score := v_score + 1;
    end if;
    v_results := v_results || jsonb_build_object(
      'question_id', v_q.id,
      'selected', v_answer,
      'correct', v_correct,
      'explanation', v_q.explanation,
      'correct_index', v_q.correct_index
    );
  end loop;

  if v_total = 0 then
    raise exception 'quiz_empty';
  end if;

  v_passed := (v_score * 100) >= (v_lesson.pass_percent * v_total);

  -- Si no aprobó, no revelamos la respuesta correcta (solo si acertó o no).
  if not v_passed then
    select coalesce(jsonb_agg(r - 'correct_index'), '[]'::jsonb) into v_results
    from jsonb_array_elements(v_results) r;
  end if;

  insert into public.quiz_attempts (user_id, lesson_id, course_id, answers, score, total, passed)
  values (v_user, p_lesson_id, v_lesson.course_id, p_answers, v_score, v_total, v_passed);

  if v_passed then
    insert into public.lesson_progress (user_id, lesson_id, course_id, completed_at)
    values (v_user, p_lesson_id, v_lesson.course_id, now())
    on conflict (user_id, lesson_id) do update set completed_at = coalesce(public.lesson_progress.completed_at, now()),
      updated_at = now();
  end if;

  return jsonb_build_object(
    'score', v_score,
    'total', v_total,
    'passed', v_passed,
    'pass_percent', v_lesson.pass_percent,
    'results', v_results
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Inscripción a cursos gratuitos
-- -----------------------------------------------------------------------------
create or replace function public.enroll_free_course(p_course_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.courses where id = p_course_id and status = 'published' and price_cents = 0
  ) then
    raise exception 'course_not_free';
  end if;

  insert into public.enrollments (user_id, course_id, source)
  values (v_user, p_course_id, 'free')
  on conflict (user_id, course_id) do update set revoked_at = null
    where public.enrollments.source = 'free'
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.enrollments where user_id = v_user and course_id = p_course_id;
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Carrito: crea la fila del carrito al añadir un artículo.
-- -----------------------------------------------------------------------------
create or replace function public.cart_items_touch_cart()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.carts (user_id, updated_at, reminder_sent_at)
  values (new.user_id, now(), null)
  on conflict (user_id) do update set updated_at = now(), reminder_sent_at = null;
  return new;
end;
$$;

create trigger cart_items_touch before insert on public.cart_items
  for each row execute function public.cart_items_touch_cart();

-- -----------------------------------------------------------------------------
-- Pagos: confirmación idempotente (solo backend / webhooks verificados)
-- -----------------------------------------------------------------------------
create or replace function public.grant_course_from_order(p_user_id uuid, p_course_id uuid, p_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.enrollments (user_id, course_id, source, order_id)
  values (p_user_id, p_course_id, 'purchase', p_order_id)
  on conflict (user_id, course_id) do update
    set revoked_at = null,
        source = 'purchase',
        order_id = excluded.order_id
    where public.enrollments.revoked_at is not null;
$$;

-- Devuelve true solo la primera vez que la orden pasa a pagada (para enviar
-- correos una única vez). Lanza excepción si el importe no coincide.
create or replace function public.fulfill_order(
  p_order_id uuid,
  p_provider_payment_id text,
  p_amount_cents int,
  p_currency text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_item record;
  v_course uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status in ('paid', 'refunded', 'partially_refunded') then
    return false;
  end if;

  -- La excepción revierte la transacción: el backend registra el motivo aparte.
  if p_amount_cents is distinct from v_order.total_cents
     or upper(p_currency) is distinct from upper(v_order.currency) then
    raise exception 'amount_mismatch';
  end if;

  update public.orders set
    status = 'paid',
    paid_at = now(),
    provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
    failure_reason = null
  where id = p_order_id;

  for v_item in select * from public.order_items where order_id = p_order_id loop
    if v_item.item_type = 'course' and v_item.course_id is not null then
      perform public.grant_course_from_order(v_order.user_id, v_item.course_id, p_order_id);
    elsif v_item.item_type = 'bundle' and v_item.bundle_id is not null then
      for v_course in select course_id from public.bundle_courses where bundle_id = v_item.bundle_id loop
        perform public.grant_course_from_order(v_order.user_id, v_course, p_order_id);
      end loop;
    end if;
  end loop;

  if v_order.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, order_id, user_id)
    values (v_order.coupon_id, p_order_id, v_order.user_id)
    on conflict (order_id) do nothing;
    update public.coupons set redemptions_count = redemptions_count + 1 where id = v_order.coupon_id;
  end if;

  delete from public.cart_items ci
  using public.order_items oi
  where oi.order_id = p_order_id
    and ci.user_id = v_order.user_id
    and (ci.course_id = oi.course_id or ci.bundle_id = oi.bundle_id);

  return true;
end;
$$;

create or replace function public.record_refund(
  p_order_id uuid,
  p_amount_cents int,
  p_provider_refund_id text,
  p_reason text,
  p_actor uuid
)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_refunded int;
  v_status public.order_status;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status not in ('paid', 'partially_refunded', 'refunded') then
    raise exception 'order_not_refundable';
  end if;

  insert into public.refunds (order_id, amount_cents, reason, provider_refund_id, created_by)
  values (p_order_id, p_amount_cents, p_reason, p_provider_refund_id, p_actor)
  on conflict (order_id, provider_refund_id) where provider_refund_id is not null do nothing;

  select coalesce(sum(amount_cents), 0) into v_refunded from public.refunds where order_id = p_order_id;
  v_refunded := least(v_refunded, v_order.total_cents);
  v_status := case when v_refunded >= v_order.total_cents then 'refunded' else 'partially_refunded' end;

  update public.orders set
    refunded_cents = v_refunded,
    status = v_status,
    refunded_at = now()
  where id = p_order_id;

  -- Un reembolso total retira el acceso a los cursos de esa compra.
  if v_status = 'refunded' then
    update public.enrollments set revoked_at = now()
    where order_id = p_order_id and revoked_at is null;
  end if;

  return v_status;
end;
$$;

-- -----------------------------------------------------------------------------
-- Catálogo: búsqueda y filtros (respeta RLS: security invoker)
-- -----------------------------------------------------------------------------
create or replace function public.search_courses(
  p_query text default null,
  p_category text default null,
  p_price text default null,      -- 'free' | 'paid' | null
  p_level public.course_level default null,
  p_max_price_cents int default null,
  p_sort text default 'popular'   -- 'popular' | 'newest' | 'rating' | 'price_asc' | 'price_desc'
)
returns setof public.courses
language sql
stable
set search_path = ''
as $$
  select c.*
  from public.courses c
  left join public.categories cat on cat.id = c.category_id
  where c.status = 'published'
    and (p_category is null or cat.slug = p_category)
    and (p_price is null or (p_price = 'free' and c.price_cents = 0) or (p_price = 'paid' and c.price_cents > 0))
    and (p_level is null or c.level = p_level)
    and (p_max_price_cents is null or c.price_cents <= p_max_price_cents)
    and (
      p_query is null or trim(p_query) = ''
      or c.title ilike '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or c.subtitle ilike '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      or to_tsvector('spanish', coalesce(c.title, '') || ' ' || coalesce(c.subtitle, ''))
         @@ plainto_tsquery('spanish', p_query)
    )
  order by
    case when p_sort = 'popular' then c.students_count end desc nulls last,
    case when p_sort = 'rating' then c.rating_avg end desc nulls last,
    case when p_sort = 'price_asc' then c.price_cents end asc nulls last,
    case when p_sort = 'price_desc' then c.price_cents end desc nulls last,
    c.published_at desc nulls last,
    c.created_at desc;
$$;

-- Estadísticas públicas reales de la academia (sin datos inventados).
create or replace function public.academy_public_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'courses', (select count(*) from public.courses where status = 'published'),
    'students', (select count(distinct user_id) from public.enrollments where revoked_at is null),
    'lessons', (select count(*) from public.lessons l join public.courses c on c.id = l.course_id where c.status = 'published'),
    'hours', (select coalesce(round(sum(duration_minutes) / 60.0), 0) from public.courses where status = 'published'),
    'certificates', (select count(*) from public.certificates where revoked_at is null),
    'instructors', (select count(*) from public.instructors where is_active)
  );
$$;

-- -----------------------------------------------------------------------------
-- Administración
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_change_own_role';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'set_role', 'profile', p_user_id::text, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.admin_grant_course(p_user_id uuid, p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.enrollments (user_id, course_id, source)
  values (p_user_id, p_course_id, 'admin_grant')
  on conflict (user_id, course_id) do update set revoked_at = null;
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'grant_course', 'enrollment', p_user_id::text, jsonb_build_object('course_id', p_course_id));
end;
$$;

create or replace function public.admin_revoke_course(p_user_id uuid, p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.enrollments set revoked_at = now()
  where user_id = p_user_id and course_id = p_course_id and revoked_at is null;
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'revoke_course', 'enrollment', p_user_id::text, jsonb_build_object('course_id', p_course_id));
end;
$$;

-- Métricas del panel. Todas se calculan a partir de órdenes reales.
-- Tasa de conversión = órdenes pagadas / checkouts iniciados en el periodo.
create or replace function public.admin_dashboard_stats(p_days int default 30, p_tz text default 'America/Mexico_City')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := date_trunc('day', now() at time zone p_tz) at time zone p_tz - make_interval(days => p_days - 1);
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with paid as (
    select o.*, (o.total_cents - o.refunded_cents) as net_cents
    from public.orders o
    where o.status in ('paid', 'partially_refunded', 'refunded') and o.paid_at is not null
  ),
  days as (
    select generate_series(
      date_trunc('day', v_from at time zone p_tz),
      date_trunc('day', now() at time zone p_tz),
      interval '1 day'
    )::date as day
  ),
  months as (
    select generate_series(
      date_trunc('month', now() at time zone p_tz) - interval '11 months',
      date_trunc('month', now() at time zone p_tz),
      interval '1 month'
    )::date as month
  )
  select jsonb_build_object(
    'currency', coalesce((select currency from public.orders order by created_at desc limit 1), 'MXN'),
    'total_revenue_cents', (select coalesce(sum(net_cents), 0) from paid),
    'period_revenue_cents', (select coalesce(sum(net_cents), 0) from paid where paid_at >= v_from),
    'paid_orders', (select count(*) from paid),
    'period_paid_orders', (select count(*) from paid where paid_at >= v_from),
    'period_checkouts', (select count(*) from public.orders where created_at >= v_from and provider <> 'free'),
    'conversion_rate', (
      select case when count(*) = 0 then 0
        else round(count(*) filter (where status in ('paid', 'partially_refunded', 'refunded')) * 100.0 / count(*), 1)
      end
      from public.orders where created_at >= v_from and provider <> 'free'
    ),
    'refunded_cents', (select coalesce(sum(refunded_cents), 0) from public.orders),
    'students_total', (select count(*) from public.profiles where role = 'student'),
    'students_new', (select count(*) from public.profiles where role = 'student' and created_at >= v_from),
    'active_learners', (select count(distinct user_id) from public.enrollments where last_activity_at >= v_from),
    'enrollments_total', (select count(*) from public.enrollments where revoked_at is null),
    'certificates_total', (select count(*) from public.certificates),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'revenue_cents', coalesce(x.rev, 0),
        'orders', coalesce(x.cnt, 0)
      ) order by d.day), '[]'::jsonb)
      from days d
      left join (
        select (paid_at at time zone p_tz)::date as day, sum(net_cents) as rev, count(*) as cnt
        from paid group by 1
      ) x on x.day = d.day
    ),
    'monthly', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', m.month,
        'revenue_cents', coalesce(x.rev, 0),
        'orders', coalesce(x.cnt, 0)
      ) order by m.month), '[]'::jsonb)
      from months m
      left join (
        select date_trunc('month', paid_at at time zone p_tz)::date as month, sum(net_cents) as rev, count(*) as cnt
        from paid group by 1
      ) x on x.month = m.month
    ),
    'students_monthly', (
      select coalesce(jsonb_agg(jsonb_build_object('month', m.month, 'students', coalesce(x.cnt, 0)) order by m.month), '[]'::jsonb)
      from months m
      left join (
        select date_trunc('month', created_at at time zone p_tz)::date as month, count(*) as cnt
        from public.profiles where role = 'student' group by 1
      ) x on x.month = m.month
    ),
    'top_courses', (
      select coalesce(jsonb_agg(t order by t.revenue_cents desc), '[]'::jsonb) from (
        select oi.course_id, max(oi.title) as title, count(*) as sales, sum(oi.total_cents) as revenue_cents
        from public.order_items oi
        join paid p on p.id = oi.order_id
        where oi.item_type = 'course' and p.status <> 'refunded'
        group by oi.course_id
        order by sum(oi.total_cents) desc
        limit 5
      ) t
    ),
    'providers', (
      select coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'orders', cnt, 'revenue_cents', rev)), '[]'::jsonb)
      from (select provider, count(*) as cnt, sum(net_cents) as rev from paid group by provider) s
    )
  ) into v_result;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.has_course_access(uuid) to anon, authenticated;
grant execute on function public.can_view_lesson(uuid) to anon, authenticated;
grant execute on function public.get_certificate_public(text) to anon, authenticated;
grant execute on function public.get_quiz(uuid) to anon, authenticated;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
grant execute on function public.enroll_free_course(uuid) to authenticated;
grant execute on function public.search_courses(text, text, text, public.course_level, int, text) to anon, authenticated;
grant execute on function public.academy_public_stats() to anon, authenticated;
grant execute on function public.admin_set_role(uuid, public.user_role) to authenticated;
grant execute on function public.admin_grant_course(uuid, uuid) to authenticated;
grant execute on function public.admin_revoke_course(uuid, uuid) to authenticated;
grant execute on function public.admin_dashboard_stats(int, text) to authenticated;

-- Dinero y accesos: exclusivamente backend.
grant execute on function public.fulfill_order(uuid, text, int, text) to service_role;
grant execute on function public.record_refund(uuid, int, text, text, uuid) to service_role;
grant execute on function public.grant_course_from_order(uuid, uuid, uuid) to service_role;
grant execute on function public.issue_certificate(uuid, uuid, timestamptz) to service_role;
grant execute on function public.refresh_course_lesson_stats(uuid) to service_role;
grant execute on function public.generate_certificate_code() to service_role;
