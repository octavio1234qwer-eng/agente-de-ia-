-- =============================================================================
-- NEXUS ACADEMY · Row Level Security
-- Principio: denegar por defecto. Cada tabla tiene RLS activado y solo las
-- políticas explícitas abren acceso. Los privilegios por columna impiden que un
-- alumno cambie su propio rol o el estado de moderación de una reseña.
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.instructors enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_contents enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.bundles enable row level security;
alter table public.bundle_courses enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.favorites enable row level security;
alter table public.reviews enable row level security;
alter table public.certificates enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.email_log enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.admin_audit_log enable row level security;

-- Los privilegios de tabla se conceden de forma mínima. Supabase concede ALL
-- por defecto a anon/authenticated; los retiramos y otorgamos lo necesario.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Perfiles
-- -----------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, headline, bio, marketing_opt_in, reminder_opt_in, last_seen_at)
  on public.profiles to authenticated;

create policy "profiles: el usuario ve su perfil" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "profiles: el usuario edita su perfil" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Catálogo público
-- -----------------------------------------------------------------------------
grant select on public.categories, public.instructors, public.courses, public.modules,
  public.lessons, public.bundles, public.bundle_courses to anon, authenticated;
grant insert, update, delete on public.categories, public.instructors, public.courses,
  public.modules, public.lessons, public.bundles, public.bundle_courses to authenticated;

create policy "categories: lectura pública" on public.categories for select using (true);
create policy "categories: admin escribe" on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "instructors: lectura pública" on public.instructors for select using (is_active or public.is_admin());
create policy "instructors: admin escribe" on public.instructors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "courses: publicados o admin" on public.courses for select
  using (status = 'published' or public.is_admin() or public.has_course_access(id));
create policy "courses: admin escribe" on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "modules: temario visible" on public.modules for select
  using (exists (select 1 from public.courses c where c.id = course_id
    and (c.status = 'published' or public.is_admin() or public.has_course_access(c.id))));
create policy "modules: admin escribe" on public.modules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- El temario (títulos, duración, tipo) es público; el contenido no.
create policy "lessons: temario visible" on public.lessons for select
  using (exists (select 1 from public.courses c where c.id = course_id
    and (c.status = 'published' or public.is_admin() or public.has_course_access(c.id))));
create policy "lessons: admin escribe" on public.lessons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "bundles: publicados o admin" on public.bundles for select
  using (status = 'published' or public.is_admin());
create policy "bundles: admin escribe" on public.bundles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "bundle_courses: lectura pública" on public.bundle_courses for select using (true);
create policy "bundle_courses: admin escribe" on public.bundle_courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Contenido protegido (solo con acceso al curso o lección de vista previa)
-- -----------------------------------------------------------------------------
grant select on public.lesson_contents, public.lesson_resources to anon, authenticated;
grant insert, update, delete on public.lesson_contents, public.lesson_resources, public.quiz_questions to authenticated;
grant select on public.quiz_questions to authenticated;

create policy "lesson_contents: con acceso" on public.lesson_contents for select
  using (public.can_view_lesson(lesson_id));
create policy "lesson_contents: admin escribe" on public.lesson_contents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "lesson_resources: con acceso" on public.lesson_resources for select
  using (public.can_view_lesson(lesson_id));
create policy "lesson_resources: admin escribe" on public.lesson_resources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Las respuestas correctas solo las ve el administrador.
create policy "quiz_questions: solo admin" on public.quiz_questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Comercio
-- -----------------------------------------------------------------------------
grant select on public.coupons to authenticated;
grant insert, update, delete on public.coupons to authenticated;
create policy "coupons: solo admin" on public.coupons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Las órdenes se crean y actualizan exclusivamente desde el backend
-- (service_role). El alumno solo puede leer las suyas.
grant select on public.orders, public.order_items, public.refunds, public.coupon_redemptions to authenticated;
create policy "orders: propias o admin" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
create policy "order_items: de órdenes propias" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
    and (o.user_id = (select auth.uid()) or public.is_admin())));
create policy "refunds: propias o admin" on public.refunds for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
    and (o.user_id = (select auth.uid()) or public.is_admin())));
create policy "coupon_redemptions: admin" on public.coupon_redemptions for select to authenticated
  using (public.is_admin());

grant select on public.payment_events to authenticated;
create policy "payment_events: admin" on public.payment_events for select to authenticated
  using (public.is_admin());

grant select, delete on public.carts to authenticated;
grant select, delete on public.cart_items to authenticated;
grant insert (user_id, item_type, course_id, bundle_id) on public.cart_items to authenticated;
create policy "carts: propio" on public.carts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "carts: borrar propio" on public.carts for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "cart_items: propios" on public.cart_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy "cart_items: añadir publicados" on public.cart_items for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (course_id is not null and exists (
        select 1 from public.courses c where c.id = course_id and c.status = 'published' and c.price_cents > 0))
      or (bundle_id is not null and exists (
        select 1 from public.bundles b where b.id = bundle_id and b.status = 'published'))
    )
  );
create policy "cart_items: borrar propios" on public.cart_items for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Aprendizaje
-- -----------------------------------------------------------------------------
-- Las inscripciones solo se crean vía funciones seguras (pago confirmado,
-- curso gratuito o concesión de admin).
grant select on public.enrollments to authenticated;
create policy "enrollments: propias o admin" on public.enrollments for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

grant select on public.lesson_progress to authenticated;
grant insert (user_id, lesson_id, course_id, completed_at, last_position_seconds) on public.lesson_progress to authenticated;
grant update (completed_at, last_position_seconds) on public.lesson_progress to authenticated;
create policy "lesson_progress: propio" on public.lesson_progress for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
-- Un cuestionario solo se completa aprobándolo (submit_quiz_attempt).
create policy "lesson_progress: registrar con acceso" on public.lesson_progress for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_course_access(course_id)
    and (completed_at is null or exists (
      select 1 from public.lessons l where l.id = lesson_id and l.type <> 'quiz'))
  );
create policy "lesson_progress: actualizar con acceso" on public.lesson_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.has_course_access(course_id)
    and (completed_at is null or exists (
      select 1 from public.lessons l where l.id = lesson_id and l.type <> 'quiz'))
  );

grant select on public.quiz_attempts to authenticated;
create policy "quiz_attempts: propios" on public.quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

grant select, delete on public.favorites to authenticated;
grant insert (user_id, course_id) on public.favorites to authenticated;
create policy "favorites: propios" on public.favorites for select to authenticated
  using (user_id = (select auth.uid()));
create policy "favorites: añadir" on public.favorites for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "favorites: quitar" on public.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

grant select on public.reviews to anon, authenticated;
grant insert (user_id, course_id, rating, comment) on public.reviews to authenticated;
grant update (rating, comment) on public.reviews to authenticated;
grant update (status) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;
create policy "reviews: publicadas, propias o admin" on public.reviews for select
  using (status = 'published' or user_id = (select auth.uid()) or public.is_admin());
-- Solo quien tiene acceso al curso puede opinar.
create policy "reviews: alumno con acceso" on public.reviews for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_course_access(course_id));
create policy "reviews: editar propia" on public.reviews for update to authenticated
  using (user_id = (select auth.uid()) or public.is_admin())
  with check (user_id = (select auth.uid()) or public.is_admin());
create policy "reviews: borrar propia o admin" on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- El estado de moderación solo lo cambia un admin.
create or replace function public.reviews_guard_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not public.is_admin()
     and current_setting('role', true) <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger reviews_guard_status before update on public.reviews
  for each row execute function public.reviews_guard_status();

grant select on public.certificates to authenticated;
create policy "certificates: propios o admin" on public.certificates for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- -----------------------------------------------------------------------------
-- Comunicación, IA, auditoría (solo lectura admin / propietario)
-- -----------------------------------------------------------------------------
grant select on public.newsletter_subscribers, public.email_log, public.admin_audit_log to authenticated;
create policy "newsletter: admin" on public.newsletter_subscribers for select to authenticated
  using (public.is_admin());
create policy "email_log: admin" on public.email_log for select to authenticated
  using (public.is_admin());
create policy "audit: admin" on public.admin_audit_log for select to authenticated
  using (public.is_admin());

grant select, delete on public.ai_conversations, public.ai_messages to authenticated;
create policy "ai_conversations: propias" on public.ai_conversations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "ai_conversations: borrar propias" on public.ai_conversations for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "ai_messages: propios" on public.ai_messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy "ai_messages: borrar propios" on public.ai_messages for delete to authenticated
  using (user_id = (select auth.uid()));

grant execute on function public.reviews_guard_status() to authenticated;
