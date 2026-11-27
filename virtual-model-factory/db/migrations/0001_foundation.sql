-- =============================================================================
-- Virtual Model Factory AI — migración 0001: fundación
--
-- Esquema `vmf` (no expuesto por la Data API de Supabase), rol de ejecución
-- `vmf_runtime` sujeto a RLS, funciones de contexto, auditoría automática y las
-- tablas de los ocho subsistemas.
--
-- El ejecutor (`npm run db:migrate`) envuelve cada migración en una transacción.
-- Compatible con PostgreSQL 15+ (Supabase) y PGlite (desarrollo y pruebas).
-- =============================================================================

create schema if not exists vmf;
revoke all on schema vmf from public;

-- -----------------------------------------------------------------------------
-- Rol de ejecución: la aplicación hace `SET LOCAL ROLE vmf_runtime` en cada
-- petición autenticada, de modo que las políticas RLS se aplican siempre.
-- Las tareas de servicio (autenticación, worker) se ejecutan como propietario.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'vmf_runtime') then
    create role vmf_runtime nologin nobypassrls;
  end if;
end
$$;

grant vmf_runtime to current_user;
grant usage on schema vmf to vmf_runtime;

-- -----------------------------------------------------------------------------
-- Funciones utilitarias
-- -----------------------------------------------------------------------------
create or replace function vmf.tg_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create or replace function vmf.role_rank(p_role text) returns integer
language sql immutable as $$
  select case p_role
    when 'owner' then 40
    when 'admin' then 30
    when 'operator' then 20
    when 'viewer' then 10
    else 0
  end
$$;

create or replace function vmf.current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('vmf.user_id', true), '')::uuid
$$;

create or replace function vmf.current_actor() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('vmf.actor', true), ''), 'system')
$$;

-- =============================================================================
-- 1. users — administradores del panel
-- =============================================================================
create table vmf.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  role text not null default 'viewer' check (role in ('owner', 'admin', 'operator', 'viewer')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  password_hash text not null,
  password_changed_at timestamptz not null default now(),
  failed_login_count integer not null default 0 check (failed_login_count >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  telegram_user_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_normalized check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
create unique index users_email_key on vmf.users (email);
create trigger users_updated_at before update on vmf.users
  for each row execute function vmf.tg_set_updated_at();

-- Siempre debe quedar al menos un propietario activo.
create or replace function vmf.tg_ensure_active_owner() returns trigger
language plpgsql security definer set search_path = vmf, pg_temp as $$
begin
  if exists (select 1 from vmf.users)
     and not exists (select 1 from vmf.users where role = 'owner' and status = 'active') then
    raise exception 'Debe existir al menos un propietario (owner) activo'
      using errcode = 'check_violation';
  end if;
  return null;
end
$$;
create constraint trigger users_ensure_active_owner
  after update or delete on vmf.users
  deferrable initially deferred
  for each row execute function vmf.tg_ensure_active_owner();

-- Sesiones del panel (solo el hash SHA-256 del token, nunca el token).
create table vmf.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references vmf.users (id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  ip text,
  user_agent text
);
create index sessions_user_active_idx on vmf.sessions (user_id) where revoked_at is null;
create index sessions_expires_idx on vmf.sessions (expires_at);

-- Funciones de autorización (SECURITY DEFINER: leen users/accesos sin RLS).
create or replace function vmf.current_user_role() returns text
language sql stable security definer set search_path = vmf, pg_temp as $$
  select u.role from vmf.users u
  where u.id = vmf.current_user_id() and u.status = 'active'
$$;

create or replace function vmf.has_min_role(p_min_role text) returns boolean
language sql stable security definer set search_path = vmf, pg_temp as $$
  select coalesce(vmf.role_rank(vmf.current_user_role()) >= vmf.role_rank(p_min_role), false)
$$;

-- =============================================================================
-- 2. models — identidades virtuales (siempre personajes ficticios adultos)
-- =============================================================================
create table vmf.models (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  stage_name text not null check (length(trim(stage_name)) between 2 and 80),
  bio text not null default '' check (length(bio) <= 2000),
  fictional_age integer not null check (fictional_age between 25 and 99),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  is_virtual boolean not null default true check (is_virtual),
  is_demo boolean not null default false,
  ai_disclosure text not null check (length(trim(ai_disclosure)) between 10 and 500),
  likeness_attestation boolean not null default false,
  likeness_attested_by uuid references vmf.users (id) on delete set null,
  likeness_attested_at timestamptz,
  content_rating text not null default 'sfw' check (content_rating in ('sfw', 'suggestive', 'adult')),
  target_audience text not null default '' check (length(target_audience) <= 1000),
  commercial_positioning text not null default '' check (length(commercial_positioning) <= 1000),
  languages text[] not null default array['es'] check (cardinality(languages) between 1 and 10),
  visual_identity jsonb not null default '{}'::jsonb check (jsonb_typeof(visual_identity) = 'object'),
  timezone text not null default 'UTC',
  created_by uuid references vmf.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un modelo solo puede activarse con la declaración de que no reproduce a una persona real.
  constraint models_active_requires_attestation check (status <> 'active' or likeness_attestation),
  constraint models_attestation_complete check (
    not likeness_attestation or (likeness_attested_at is not null)
  )
);
create index models_status_idx on vmf.models (status);
create trigger models_updated_at before update on vmf.models
  for each row execute function vmf.tg_set_updated_at();

-- Asignación de modelos a usuarios con rol operator/viewer.
create table vmf.user_model_access (
  user_id uuid not null references vmf.users (id) on delete cascade,
  model_id uuid not null references vmf.models (id) on delete cascade,
  granted_by uuid references vmf.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, model_id)
);
create index user_model_access_model_idx on vmf.user_model_access (model_id);

create or replace function vmf.can_read_model(p_model_id uuid) returns boolean
language sql stable security definer set search_path = vmf, pg_temp as $$
  select case
    when vmf.current_user_role() is null then false
    when vmf.has_min_role('admin') then true
    else exists (
      select 1 from vmf.user_model_access a
      where a.user_id = vmf.current_user_id() and a.model_id = p_model_id
    )
  end
$$;

create or replace function vmf.can_write_model(p_model_id uuid) returns boolean
language sql stable security definer set search_path = vmf, pg_temp as $$
  select case
    when vmf.has_min_role('admin') then true
    when vmf.has_min_role('operator') then exists (
      select 1 from vmf.user_model_access a
      where a.user_id = vmf.current_user_id() and a.model_id = p_model_id
    )
    else false
  end
$$;

-- =============================================================================
-- 3. model_personalities — personalidad versionada (una activa por modelo)
-- =============================================================================
create table vmf.model_personalities (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vmf.models (id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  is_active boolean not null default true,
  traits text[] not null default '{}',
  tone text not null default '' check (length(tone) <= 500),
  communication_style text not null default '' check (length(communication_style) <= 2000),
  backstory text not null default '' check (length(backstory) <= 4000),
  interests text[] not null default '{}',
  boundaries text[] not null default '{}',
  sample_phrases text[] not null default '{}',
  conversation_history_limit integer not null default 20 check (conversation_history_limit between 0 and 200),
  escalation_keywords text[] not null default '{}',
  created_by uuid references vmf.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (model_id, version)
);
create unique index model_personalities_one_active on vmf.model_personalities (model_id) where is_active;

-- =============================================================================
-- 4. model_assets — referencias de identidad visual con procedencia
-- =============================================================================
create table vmf.model_assets (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vmf.models (id) on delete cascade,
  kind text not null check (kind in ('reference_image', 'style_guide', 'logo', 'voice_sample', 'other')),
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text not null check (length(sha256) = 64),
  provenance text not null check (provenance in ('ai_generated', 'licensed', 'owned', 'commissioned')),
  provider text,
  license_notes text not null default '',
  authorization_ref text,
  created_by uuid references vmf.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (model_id, sha256)
);
create index model_assets_model_idx on vmf.model_assets (model_id);

-- =============================================================================
-- 5. content_campaigns
-- =============================================================================
create table vmf.content_campaigns (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vmf.models (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  objective text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed', 'cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references vmf.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index content_campaigns_model_idx on vmf.content_campaigns (model_id, status);
create trigger content_campaigns_updated_at before update on vmf.content_campaigns
  for each row execute function vmf.tg_set_updated_at();

-- =============================================================================
-- 6. content_library — piezas con versiones, calidad y procedencia
-- =============================================================================
create table vmf.content_library (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vmf.models (id) on delete cascade,
  campaign_id uuid references vmf.content_campaigns (id) on delete set null,
  parent_id uuid references vmf.content_library (id) on delete set null,
  version integer not null default 1 check (version >= 1),
  type text not null check (type in ('image', 'video', 'caption', 'story', 'promo_text', 'script')),
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null default '',
  storage_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  sha256 text check (sha256 is null or length(sha256) = 64),
  perceptual_hash text,
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  content_rating text not null default 'sfw' check (content_rating in ('sfw', 'suggestive', 'adult')),
  provider text,
  generation_prompt text,
  provenance jsonb not null default '{}'::jsonb,
  quality_score numeric(5, 2) check (quality_score is null or quality_score between 0 and 100),
  policy_check jsonb not null default '{}'::jsonb,
  created_by uuid references vmf.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_library_model_idx on vmf.content_library (model_id, status, created_at desc);
create index content_library_tags_idx on vmf.content_library using gin (tags);
-- Detección de duplicados exactos por modelo.
create unique index content_library_model_sha_key on vmf.content_library (model_id, sha256) where sha256 is not null;
create trigger content_library_updated_at before update on vmf.content_library
  for each row execute function vmf.tg_set_updated_at();

-- =============================================================================
-- 7. social_accounts / social_connections
-- =============================================================================
create table vmf.social_accounts (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vmf.models (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'facebook', 'telegram', 'fanvue', 'onlyfans', 'other')),
  handle text not null check (length(trim(handle)) between 1 and 120),
  display_name text,
  profile_url text,
  status text not null default 'not_connected' check (status in ('not_connected', 'connected', 'error', 'disabled')),
  is_enabled boolean not null default false,
  disabled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, handle),
  -- OnlyFans permanece desactivado: no admite perfiles totalmente sintéticos.
  constraint social_accounts_onlyfans_disabled check (platform <> 'onlyfans' or (not is_enabled and status = 'disabled'))
);
create index social_accounts_model_idx on vmf.social_accounts (model_id);
create trigger social_accounts_updated_at before update on vmf.social_accounts
  for each row execute function vmf.tg_set_updated_at();

create table vmf.social_connections (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid not null unique references vmf.social_accounts (id) on delete cascade,
  provider text not null,
  scopes text[] not null default '{}',
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'revoked', 'error')),
  last_error text,
  connected_by uuid references vmf.users (id) on delete set null,
  connected_at timestamptz,
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger social_connections_updated_at before update on vmf.social_connections
  for each row execute function vmf.tg_set_updated_at();

-- =============================================================================
-- 8. approvals — aprobación humana de la versión exacta (hash del payload)
-- =============================================================================
create table vmf.approvals (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('publish_content', 'send_message', 'financial_operation', 'enable_connector', 'campaign_launch', 'other')),
  model_id uuid references vmf.models (id) on delete cascade,
  subject_type text not null,
  subject_id uuid,
  summary text not null check (length(trim(summary)) between 3 and 500),
  payload jsonb not null default '{}'::jsonb,
  payload_hash text not null check (length(payload_hash) = 64),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  requested_by_user uuid references vmf.users (id) on delete set null,
  requested_by_agent text,
  decided_by uuid references vmf.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  decision_channel text check (decision_channel is null or decision_channel in ('panel', 'telegram')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint approvals_decision_complete check (
    status not in ('approved', 'rejected') or (decided_by is not null and decided_at is not null and decision_channel is not null)
  ),
  constraint approvals_requester check (requested_by_user is not null or requested_by_agent is not null)
);
create index approvals_pending_idx on vmf.approvals (created_at) where status = 'pending';
create index approvals_model_idx on vmf.approvals (model_id);

-- =============================================================================
-- 9. publishing_calendar
-- =============================================================================
create table vmf.publishing_calendar (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vmf.models (id) on delete cascade,
  content_id uuid not null references vmf.content_library (id) on delete cascade,
  social_account_id uuid references vmf.social_accounts (id) on delete set null,
  platform text not null check (platform in ('instagram', 'tiktok', 'facebook', 'telegram', 'fanvue', 'onlyfans', 'other', 'manual_export')),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'awaiting_approval', 'publishing', 'published', 'failed', 'cancelled', 'exported_manual')),
  approval_id uuid references vmf.approvals (id) on delete set null,
  external_post_id text,
  external_url text,
  published_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  idempotency_key text not null unique,
  created_by uuid references vmf.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nunca marcar como publicado sin confirmación de la plataforma.
  constraint publishing_calendar_published_confirmed check (
    status <> 'published' or (external_post_id is not null and published_at is not null)
  )
);
create index publishing_calendar_model_time_idx on vmf.publishing_calendar (model_id, scheduled_at);
create index publishing_calendar_due_idx on vmf.publishing_calendar (scheduled_at) where status = 'scheduled';
create trigger publishing_calendar_updated_at before update on vmf.publishing_calendar
  for each row execute function vmf.tg_set_updated_at();

-- =============================================================================
-- 10. customers — datos mínimos (email cifrado + hash para búsqueda)
-- =============================================================================
create table vmf.customers (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vmf.models (id) on delete cascade,
  platform text not null,
  external_id text not null,
  display_name text,
  email_enc text,
  email_hash text check (email_hash is null or length(email_hash) = 64),
  age_verification_status text not null default 'unverified' check (age_verification_status in ('unverified', 'verified', 'failed')),
  age_verified_at timestamptz,
  age_verification_method text,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, platform, external_id),
  constraint customers_verified_has_date check (age_verification_status <> 'verified' or age_verified_at is not null)
);
create index customers_email_hash_idx on vmf.customers (email_hash) where email_hash is not null;
create trigger customers_updated_at before update on vmf.customers
  for each row execute function vmf.tg_set_updated_at();

-- =============================================================================
-- 11. conversations (+ mensajes)
-- =============================================================================
create table vmf.conversations (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vmf.models (id) on delete cascade,
  customer_id uuid references vmf.customers (id) on delete set null,
  social_account_id uuid references vmf.social_accounts (id) on delete set null,
  platform text not null,
  external_thread_id text,
  status text not null default 'open' check (status in ('open', 'needs_human', 'closed')),
  ai_enabled boolean not null default true,
  ai_disclosed_at timestamptz,
  escalation_reason text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_thread_id)
);
create index conversations_model_idx on vmf.conversations (model_id, status, last_message_at desc);
create trigger conversations_updated_at before update on vmf.conversations
  for each row execute function vmf.tg_set_updated_at();

create table vmf.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references vmf.conversations (id) on delete cascade,
  model_id uuid not null references vmf.models (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender text not null check (sender in ('customer', 'ai', 'human')),
  body text not null check (length(body) <= 8000),
  flags jsonb not null default '{}'::jsonb,
  external_message_id text,
  created_at timestamptz not null default now()
);
create index conversation_messages_conv_idx on vmf.conversation_messages (conversation_id, created_at);

-- =============================================================================
-- 12. products / subscriptions / transactions / expenses (importes en céntimos)
-- =============================================================================
create table vmf.products (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vmf.models (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  description text not null default '',
  type text not null check (type in ('digital_download', 'subscription', 'bundle', 'custom')),
  price_cents bigint not null check (price_cents >= 0),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  billing_interval text check (billing_interval is null or billing_interval in ('month', 'year')),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  payment_provider text,
  external_product_id text,
  created_by uuid references vmf.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_subscription_interval check ((type = 'subscription') = (billing_interval is not null))
);
create index products_model_idx on vmf.products (model_id, status);
create trigger products_updated_at before update on vmf.products
  for each row execute function vmf.tg_set_updated_at();

create table vmf.subscriptions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vmf.models (id) on delete cascade,
  customer_id uuid not null references vmf.customers (id) on delete cascade,
  product_id uuid not null references vmf.products (id) on delete restrict,
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  started_at timestamptz not null,
  current_period_end timestamptz,
  canceled_at timestamptz,
  provider text not null,
  external_subscription_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_subscription_id)
);
create index subscriptions_model_idx on vmf.subscriptions (model_id, status);
create trigger subscriptions_updated_at before update on vmf.subscriptions
  for each row execute function vmf.tg_set_updated_at();

create table vmf.transactions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vmf.models (id) on delete cascade,
  customer_id uuid references vmf.customers (id) on delete set null,
  product_id uuid references vmf.products (id) on delete set null,
  subscription_id uuid references vmf.subscriptions (id) on delete set null,
  type text not null check (type in ('sale', 'renewal', 'tip', 'refund', 'chargeback')),
  gross_cents bigint not null,
  fee_cents bigint not null default 0 check (fee_cents >= 0),
  net_cents bigint generated always as (gross_cents - fee_cents) stored,
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  provider text not null,
  external_id text not null,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, external_id),
  constraint transactions_sign check (
    (type in ('sale', 'renewal', 'tip') and gross_cents >= 0) or (type in ('refund', 'chargeback') and gross_cents <= 0)
  )
);
create index transactions_model_time_idx on vmf.transactions (model_id, occurred_at desc);

create table vmf.expenses (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references vmf.models (id) on delete cascade,
  category text not null check (category in ('ai_generation', 'hosting', 'software', 'advertising', 'payment_fees', 'services', 'other')),
  description text not null check (length(trim(description)) between 2 and 300),
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  incurred_at timestamptz not null,
  created_by uuid references vmf.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index expenses_model_time_idx on vmf.expenses (model_id, incurred_at desc);

-- =============================================================================
-- 13. analytics — solo datos con fuente declarada (nunca inventados)
-- =============================================================================
create table vmf.analytics (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references vmf.models (id) on delete cascade,
  platform text not null,
  social_account_id uuid references vmf.social_accounts (id) on delete set null,
  content_id uuid references vmf.content_library (id) on delete set null,
  metric text not null check (metric in ('followers', 'reach', 'impressions', 'interactions', 'profile_visits', 'link_clicks', 'conversions', 'subscribers', 'messages')),
  value numeric(18, 2) not null check (value >= 0),
  granularity text not null check (granularity in ('day', 'week', 'month', 'post', 'lifetime')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  source text not null check (source in ('platform_api', 'payment_provider', 'manual_entry', 'internal')),
  collected_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create unique index analytics_unique_point on vmf.analytics (
  model_id, platform, metric, granularity, period_start,
  coalesce(content_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
create index analytics_model_time_idx on vmf.analytics (model_id, period_start desc);

-- =============================================================================
-- 14. automation_jobs — cola desacoplada con idempotencia y reintentos
-- =============================================================================
create table vmf.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type ~ '^[a-z][a-z0-9_.]{2,80}$'),
  model_id uuid references vmf.models (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'waiting_approval', 'cancelled', 'dead')),
  priority integer not null default 100,
  run_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  last_error text,
  result jsonb,
  locked_by text,
  locked_at timestamptz,
  idempotency_key text unique,
  approval_id uuid references vmf.approvals (id) on delete set null,
  created_by uuid references vmf.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index automation_jobs_ready_idx on vmf.automation_jobs (priority, run_at) where status = 'queued';
create index automation_jobs_status_idx on vmf.automation_jobs (status, updated_at desc);
create trigger automation_jobs_updated_at before update on vmf.automation_jobs
  for each row execute function vmf.tg_set_updated_at();

-- =============================================================================
-- 15. agent_logs
-- =============================================================================
create table vmf.agent_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  agent text not null check (agent in ('orchestrator', 'model_manager', 'content_studio', 'social', 'conversation', 'revenue', 'analytics', 'telegram', 'system')),
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  model_id uuid references vmf.models (id) on delete set null,
  job_id uuid references vmf.automation_jobs (id) on delete set null,
  message text not null check (length(message) <= 2000),
  data jsonb not null default '{}'::jsonb
);
create index agent_logs_time_idx on vmf.agent_logs (created_at desc);
create index agent_logs_errors_idx on vmf.agent_logs (created_at desc) where level = 'error';

-- =============================================================================
-- 16. security_events
-- =============================================================================
create table vmf.security_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type text not null check (type ~ '^[a-z][a-z0-9_.]{2,60}$'),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  user_id uuid references vmf.users (id) on delete set null,
  ip text,
  user_agent text,
  details jsonb not null default '{}'::jsonb
);
create index security_events_time_idx on vmf.security_events (created_at desc);
create index security_events_user_idx on vmf.security_events (user_id, created_at desc);

-- =============================================================================
-- Infraestructura: ajustes del sistema, límites de solicitudes, auditoría
-- =============================================================================
create table vmf.system_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{2,60}$'),
  value jsonb not null,
  updated_by uuid references vmf.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger system_settings_updated_at before update on vmf.system_settings
  for each row execute function vmf.tg_set_updated_at();

insert into vmf.system_settings (key, value) values
  ('emergency_stop', '{"active": false, "reason": null, "changed_at": null}'::jsonb),
  ('operations_paused', '{"active": false, "reason": null, "changed_at": null}'::jsonb);

create table vmf.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0
);

create table vmf.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_source text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  record_id text,
  changes jsonb not null default '{}'::jsonb
);
create index audit_log_time_idx on vmf.audit_log (occurred_at desc);
create index audit_log_record_idx on vmf.audit_log (table_name, record_id);

-- Auditoría automática: registra quién (vmf.user_id) y desde dónde (vmf.actor)
-- cambió cada fila. Las columnas secretas nunca se copian, solo se indica el cambio.
create or replace function vmf.tg_audit() returns trigger
language plpgsql security definer set search_path = vmf, pg_temp as $$
declare
  sensitive constant text[] := array['password_hash', 'access_token_enc', 'refresh_token_enc', 'token_hash', 'email_enc'];
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb;
  v_key text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(e.key, jsonb_build_object('old', v_old -> e.key, 'new', e.value)), '{}'::jsonb)
      into v_changes
      from jsonb_each(v_new - sensitive) e
     where (v_old -> e.key) is distinct from e.value and e.key <> 'updated_at';
    foreach v_key in array sensitive loop
      if (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_changes := v_changes || jsonb_build_object(v_key, '[redactado: modificado]');
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    v_changes := v_new - sensitive;
  else
    v_changes := v_old - sensitive;
  end if;

  insert into vmf.audit_log (actor_user_id, actor_source, action, table_name, record_id, changes)
  values (
    vmf.current_user_id(),
    vmf.current_actor(),
    tg_op,
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'key', v_old ->> 'key'),
    v_changes
  );
  return coalesce(new, old);
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'models', 'user_model_access', 'model_personalities', 'model_assets',
    'content_campaigns', 'content_library', 'social_accounts', 'social_connections',
    'approvals', 'publishing_calendar', 'customers', 'products', 'subscriptions',
    'transactions', 'expenses', 'system_settings'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on vmf.%I for each row execute function vmf.tg_audit()',
      t || '_audit', t
    );
  end loop;
end
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'sessions', 'models', 'user_model_access', 'model_personalities', 'model_assets',
    'content_campaigns', 'content_library', 'social_accounts', 'social_connections', 'approvals',
    'publishing_calendar', 'customers', 'conversations', 'conversation_messages', 'products',
    'subscriptions', 'transactions', 'expenses', 'analytics', 'automation_jobs', 'agent_logs',
    'security_events', 'system_settings', 'rate_limits', 'audit_log'
  ] loop
    execute format('alter table vmf.%I enable row level security', t);
  end loop;
end
$$;

-- users: cada usuario se ve a sí mismo; admin+ ve a todos; solo owner los modifica.
create policy users_select on vmf.users for select to vmf_runtime
  using (id = vmf.current_user_id() or vmf.has_min_role('admin'));
create policy users_update on vmf.users for update to vmf_runtime
  using (vmf.has_min_role('owner')) with check (vmf.has_min_role('owner'));

-- models
create policy models_select on vmf.models for select to vmf_runtime
  using (vmf.can_read_model(id));
create policy models_insert on vmf.models for insert to vmf_runtime
  with check (vmf.has_min_role('admin'));
create policy models_update on vmf.models for update to vmf_runtime
  using (vmf.can_write_model(id)) with check (vmf.can_write_model(id));
create policy models_delete on vmf.models for delete to vmf_runtime
  using (vmf.has_min_role('owner'));

-- user_model_access
create policy uma_select on vmf.user_model_access for select to vmf_runtime
  using (user_id = vmf.current_user_id() or vmf.has_min_role('admin'));
create policy uma_write on vmf.user_model_access for all to vmf_runtime
  using (vmf.has_min_role('admin')) with check (vmf.has_min_role('admin'));

-- Tablas separadas por modelo: lectura con acceso al modelo, escritura con permiso de escritura.
do $$
declare
  t text;
begin
  foreach t in array array[
    'model_personalities', 'model_assets', 'content_campaigns', 'content_library',
    'social_accounts', 'publishing_calendar', 'customers', 'conversations',
    'conversation_messages', 'products', 'analytics'
  ] loop
    execute format(
      'create policy %I on vmf.%I for select to vmf_runtime using (vmf.can_read_model(model_id))',
      t || '_select', t
    );
    execute format(
      'create policy %I on vmf.%I for insert to vmf_runtime with check (vmf.can_write_model(model_id))',
      t || '_insert', t
    );
    execute format(
      'create policy %I on vmf.%I for update to vmf_runtime using (vmf.can_write_model(model_id)) with check (vmf.can_write_model(model_id))',
      t || '_update', t
    );
    execute format(
      'create policy %I on vmf.%I for delete to vmf_runtime using (vmf.can_write_model(model_id))',
      t || '_delete', t
    );
  end loop;
end
$$;

-- social_connections: solo admin+ (contienen referencias a credenciales cifradas).
create policy social_connections_admin on vmf.social_connections for all to vmf_runtime
  using (vmf.has_min_role('admin')) with check (vmf.has_min_role('admin'));

-- Datos financieros: lectura con acceso al modelo; escritura solo admin+.
do $$
declare
  t text;
begin
  foreach t in array array['subscriptions', 'transactions'] loop
    execute format(
      'create policy %I on vmf.%I for select to vmf_runtime using (vmf.can_read_model(model_id))',
      t || '_select', t
    );
    execute format(
      'create policy %I on vmf.%I for all to vmf_runtime using (vmf.has_min_role(''admin'')) with check (vmf.has_min_role(''admin''))',
      t || '_admin_write', t
    );
  end loop;
end
$$;

create policy expenses_select on vmf.expenses for select to vmf_runtime
  using (case when model_id is null then vmf.has_min_role('admin') else vmf.can_read_model(model_id) end);
create policy expenses_admin_write on vmf.expenses for all to vmf_runtime
  using (vmf.has_min_role('admin')) with check (vmf.has_min_role('admin'));

-- approvals: lectura por acceso al modelo; solicitar con permiso de escritura; decidir solo admin+.
create policy approvals_select on vmf.approvals for select to vmf_runtime
  using (case when model_id is null then vmf.has_min_role('admin') else vmf.can_read_model(model_id) end);
create policy approvals_insert on vmf.approvals for insert to vmf_runtime
  with check (
    status = 'pending'
    and (case when model_id is null then vmf.has_min_role('admin') else vmf.can_write_model(model_id) end)
  );
create policy approvals_decide on vmf.approvals for update to vmf_runtime
  using (vmf.has_min_role('admin')) with check (vmf.has_min_role('admin'));

-- automation_jobs y agent_logs: lectura por acceso al modelo (o admin+ si son globales).
create policy automation_jobs_select on vmf.automation_jobs for select to vmf_runtime
  using (case when model_id is null then vmf.has_min_role('admin') else vmf.can_read_model(model_id) end);
create policy automation_jobs_insert on vmf.automation_jobs for insert to vmf_runtime
  with check (
    status = 'queued'
    and (case when model_id is null then vmf.has_min_role('admin') else vmf.can_write_model(model_id) end)
  );
create policy automation_jobs_cancel on vmf.automation_jobs for update to vmf_runtime
  using (vmf.has_min_role('admin')) with check (vmf.has_min_role('admin'));
create policy agent_logs_select on vmf.agent_logs for select to vmf_runtime
  using (case when model_id is null then vmf.has_min_role('admin') else vmf.can_read_model(model_id) end);

-- Registros de seguridad y auditoría: solo lectura para admin+.
create policy security_events_select on vmf.security_events for select to vmf_runtime
  using (vmf.has_min_role('admin') or user_id = vmf.current_user_id());
create policy audit_log_select on vmf.audit_log for select to vmf_runtime
  using (vmf.has_min_role('admin'));

-- system_settings: lectura para cualquier usuario activo; cambios solo admin+.
create policy system_settings_select on vmf.system_settings for select to vmf_runtime
  using (vmf.current_user_role() is not null);
create policy system_settings_update on vmf.system_settings for update to vmf_runtime
  using (vmf.has_min_role('admin')) with check (vmf.has_min_role('admin'));

-- sessions y rate_limits: sin políticas para vmf_runtime => acceso denegado.

-- =============================================================================
-- Privilegios del rol de ejecución (defensa en profundidad además de RLS)
-- =============================================================================
grant select (id, email, display_name, role, status, last_login_at, telegram_user_id, created_at, updated_at)
  on vmf.users to vmf_runtime;
grant update (display_name, role, status, telegram_user_id) on vmf.users to vmf_runtime;

grant select, insert, update, delete on
  vmf.models, vmf.user_model_access, vmf.model_personalities, vmf.model_assets,
  vmf.content_campaigns, vmf.content_library, vmf.social_accounts, vmf.publishing_calendar,
  vmf.conversations, vmf.conversation_messages, vmf.products,
  vmf.subscriptions, vmf.transactions, vmf.expenses, vmf.analytics
  to vmf_runtime;

-- Columnas no secretas de social_connections y customers.
grant select (id, social_account_id, provider, scopes, token_expires_at, status, last_error,
              connected_by, connected_at, last_refreshed_at, created_at, updated_at)
  on vmf.social_connections to vmf_runtime;
grant select (id, model_id, platform, external_id, display_name, email_hash, age_verification_status,
              age_verified_at, age_verification_method, marketing_consent, marketing_consent_at, notes,
              created_at, updated_at)
  on vmf.customers to vmf_runtime;
grant insert, update, delete on vmf.customers to vmf_runtime;

grant select, insert on vmf.approvals to vmf_runtime;
grant update (status, decided_by, decided_at, decision_note, decision_channel) on vmf.approvals to vmf_runtime;
grant select, insert on vmf.automation_jobs to vmf_runtime;
grant update (status, last_error, finished_at) on vmf.automation_jobs to vmf_runtime;
grant select on vmf.agent_logs, vmf.security_events, vmf.audit_log to vmf_runtime;
grant select on vmf.system_settings to vmf_runtime;
grant update (value, updated_by) on vmf.system_settings to vmf_runtime;

revoke all on all functions in schema vmf from public;
grant execute on all functions in schema vmf to vmf_runtime;
