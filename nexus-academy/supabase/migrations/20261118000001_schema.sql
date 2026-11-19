-- =============================================================================
-- NEXUS ACADEMY · Esquema principal
-- Tablas, tipos y restricciones. Las políticas RLS viven en la migración 0003,
-- las funciones de negocio en la 0002 y el almacenamiento en la 0004.
-- Todos los importes se guardan en centavos (enteros) para evitar errores de
-- redondeo. La moneda por defecto es MXN.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('student', 'instructor', 'admin');
create type public.course_level as enum ('beginner', 'intermediate', 'advanced', 'all');
create type public.publish_status as enum ('draft', 'published', 'archived');
create type public.lesson_type as enum ('video', 'article', 'quiz', 'exercise');
create type public.video_provider as enum ('storage', 'youtube', 'vimeo', 'url');
create type public.order_status as enum (
  'pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded', 'partially_refunded'
);
create type public.payment_provider as enum ('stripe', 'mercadopago', 'paypal', 'free');
create type public.discount_type as enum ('percent', 'fixed');
create type public.enrollment_source as enum ('purchase', 'free', 'admin_grant');
create type public.review_status as enum ('published', 'hidden');
create type public.item_type as enum ('course', 'bundle');
create type public.email_status as enum ('sent', 'failed', 'skipped');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  avatar_url text,
  headline text check (char_length(headline) <= 160),
  bio text check (char_length(bio) <= 2000),
  role public.user_role not null default 'student',
  marketing_opt_in boolean not null default true,
  reminder_opt_in boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_created_at_idx on public.profiles (created_at);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Catálogo
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  description text,
  icon text not null default 'sparkles',
  color text not null default '#3b82f6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  headline text,
  bio text,
  avatar_url text,
  website_url text,
  linkedin_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger instructors_updated_at before update on public.instructors
  for each row execute function public.set_updated_at();

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 140),
  subtitle text check (char_length(subtitle) <= 240),
  description text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  instructor_id uuid references public.instructors (id) on delete set null,
  level public.course_level not null default 'beginner',
  language text not null default 'es',
  cover_url text,
  promo_video_url text,
  -- Precio vigente y precio de referencia (para mostrar el % de descuento).
  price_cents int not null default 0 check (price_cents >= 0),
  compare_at_price_cents int check (compare_at_price_cents is null or compare_at_price_cents > price_cents),
  currency text not null default 'MXN' check (currency ~ '^[A-Z]{3}$'),
  is_free boolean generated always as (price_cents = 0) stored,
  status public.publish_status not null default 'draft',
  is_featured boolean not null default false,
  what_you_will_learn text[] not null default '{}',
  requirements text[] not null default '{}',
  target_audience text[] not null default '{}',
  -- Valores derivados (los mantienen triggers; nunca se escriben desde la app).
  duration_minutes int not null default 0,
  lessons_count int not null default 0,
  students_count int not null default 0,
  rating_avg numeric(3, 2) not null default 0,
  rating_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index courses_status_idx on public.courses (status);
create index courses_category_idx on public.courses (category_id);
create index courses_instructor_idx on public.courses (instructor_id);
create index courses_published_at_idx on public.courses (published_at desc);
create index courses_students_idx on public.courses (students_count desc);
create index courses_search_idx on public.courses
  using gin (to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(subtitle, '')));
create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index modules_course_idx on public.modules (course_id, position);

-- Esquema público de la lección (temario). El contenido protegido vive en
-- lesson_contents para que RLS pueda ocultarlo a quien no compró el curso.
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  summary text,
  type public.lesson_type not null default 'video',
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  position int not null default 0,
  is_preview boolean not null default false,
  pass_percent int not null default 70 check (pass_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_module_idx on public.lessons (module_id, position);
create index lessons_course_idx on public.lessons (course_id);
create trigger lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();

create table public.lesson_contents (
  lesson_id uuid primary key references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  body text not null default '',
  video_provider public.video_provider,
  video_ref text,
  updated_at timestamptz not null default now()
);
create index lesson_contents_course_idx on public.lesson_contents (course_id);
create trigger lesson_contents_updated_at before update on public.lesson_contents
  for each row execute function public.set_updated_at();

create table public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  is_downloadable boolean not null default true,
  created_at timestamptz not null default now()
);
create index lesson_resources_lesson_idx on public.lesson_resources (lesson_id);

-- Preguntas de cuestionario. correct_index NUNCA se expone al alumno: la
-- tabla solo es legible por administradores y las funciones get_quiz /
-- submit_quiz_attempt hacen el trabajo del lado del servidor.
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  correct_index int not null check (correct_index >= 0),
  explanation text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  check (correct_index < jsonb_array_length(options))
);
create index quiz_questions_lesson_idx on public.quiz_questions (lesson_id, position);

-- Paquetes (bundles) de cursos
create table public.bundles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  description text not null default '',
  cover_url text,
  price_cents int not null check (price_cents > 0),
  compare_at_price_cents int check (compare_at_price_cents is null or compare_at_price_cents > price_cents),
  currency text not null default 'MXN',
  status public.publish_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger bundles_updated_at before update on public.bundles
  for each row execute function public.set_updated_at();

create table public.bundle_courses (
  bundle_id uuid not null references public.bundles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  position int not null default 0,
  primary key (bundle_id, course_id)
);
create index bundle_courses_course_idx on public.bundle_courses (course_id);

-- -----------------------------------------------------------------------------
-- Comercio
-- -----------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code extensions.citext not null unique check (code ~ '^[A-Za-z0-9_-]{3,40}$'),
  description text,
  discount_type public.discount_type not null,
  discount_value int not null check (discount_value > 0),
  currency text not null default 'MXN',
  max_redemptions int check (max_redemptions is null or max_redemptions > 0),
  redemptions_count int not null default 0,
  per_user_limit int not null default 1 check (per_user_limit > 0),
  min_subtotal_cents int not null default 0 check (min_subtotal_cents >= 0),
  course_ids uuid[],
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);
create trigger coupons_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();

create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('NX-' || nextval('public.order_number_seq')::text),
  user_id uuid not null references public.profiles (id) on delete restrict,
  status public.order_status not null default 'pending',
  provider public.payment_provider not null,
  currency text not null default 'MXN',
  subtotal_cents int not null check (subtotal_cents >= 0),
  discount_cents int not null default 0 check (discount_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  refunded_cents int not null default 0 check (refunded_cents >= 0),
  coupon_id uuid references public.coupons (id) on delete set null,
  coupon_code text,
  provider_session_id text,
  provider_payment_id text,
  customer_email text not null,
  customer_name text,
  -- Datos de facturación opcionales (p. ej. RFC y razón social en México).
  billing_details jsonb,
  failure_reason text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_cents = subtotal_cents - discount_cents),
  check (refunded_cents <= total_cents)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_paid_at_idx on public.orders (paid_at) where status in ('paid', 'partially_refunded');
create unique index orders_provider_session_uidx on public.orders (provider, provider_session_id)
  where provider_session_id is not null;
create unique index orders_provider_payment_uidx on public.orders (provider, provider_payment_id)
  where provider_payment_id is not null;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  item_type public.item_type not null,
  course_id uuid references public.courses (id) on delete set null,
  bundle_id uuid references public.bundles (id) on delete set null,
  title text not null,
  unit_price_cents int not null check (unit_price_cents >= 0),
  discount_cents int not null default 0 check (discount_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  check (
    (item_type = 'course' and bundle_id is null)
    or (item_type = 'bundle' and course_id is null)
  )
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_course_idx on public.order_items (course_id);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index coupon_redemptions_user_idx on public.coupon_redemptions (coupon_id, user_id);

-- Registro idempotente de webhooks: un evento se procesa una sola vez.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  event_id text not null,
  event_type text not null,
  order_id uuid references public.orders (id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  reason text,
  provider_refund_id text,
  status text not null default 'succeeded',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index refunds_provider_uidx on public.refunds (order_id, provider_refund_id)
  where provider_refund_id is not null;

-- Carrito persistente (permite la recuperación de carritos abandonados).
create table public.carts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reminder_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.carts (user_id) on delete cascade,
  item_type public.item_type not null,
  course_id uuid references public.courses (id) on delete cascade,
  bundle_id uuid references public.bundles (id) on delete cascade,
  added_at timestamptz not null default now(),
  check (
    (item_type = 'course' and course_id is not null and bundle_id is null)
    or (item_type = 'bundle' and bundle_id is not null and course_id is null)
  )
);
create unique index cart_items_course_uidx on public.cart_items (user_id, course_id) where course_id is not null;
create unique index cart_items_bundle_uidx on public.cart_items (user_id, bundle_id) where bundle_id is not null;

-- -----------------------------------------------------------------------------
-- Aprendizaje
-- -----------------------------------------------------------------------------
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  source public.enrollment_source not null,
  order_id uuid references public.orders (id) on delete set null,
  progress_percent int not null default 0 check (progress_percent between 0 and 100),
  last_lesson_id uuid references public.lessons (id) on delete set null,
  last_activity_at timestamptz,
  completed_at timestamptz,
  revoked_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index enrollments_course_idx on public.enrollments (course_id);
create index enrollments_order_idx on public.enrollments (order_id);

create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  completed_at timestamptz,
  last_position_seconds int not null default 0 check (last_position_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lesson_progress_course_idx on public.lesson_progress (user_id, course_id);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  answers jsonb not null,
  score int not null,
  total int not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, lesson_id, created_at desc);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  status public.review_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index reviews_course_idx on public.reviews (course_id, status, created_at desc);
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  student_name text not null,
  course_title text not null,
  instructor_name text,
  completed_at timestamptz not null,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, course_id)
);

-- -----------------------------------------------------------------------------
-- Comunicación, IA y auditoría
-- -----------------------------------------------------------------------------
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique,
  source text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  user_id uuid references public.profiles (id) on delete set null,
  template text not null,
  subject text not null,
  dedupe_key text unique,
  provider_message_id text,
  status public.email_status not null,
  error text,
  created_at timestamptz not null default now()
);
create index email_log_created_idx on public.email_log (created_at desc);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Nueva conversación',
  course_id uuid references public.courses (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);
create index ai_messages_user_day_idx on public.ai_messages (user_id, created_at desc);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
