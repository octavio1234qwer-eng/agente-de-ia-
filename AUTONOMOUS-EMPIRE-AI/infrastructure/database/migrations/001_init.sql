-- AUTONOMOUS EMPIRE AI — esquema inicial (PostgreSQL 15+ / Supabase / PGlite)
-- Dinero siempre en centavos enteros (bigint). Nunca flotantes.

-- ── Identidad y acceso ──────────────────────────────────────────────
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  role text not null check (role in ('owner','operator','viewer')),
  password_hash text not null,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  ip_hash text
);
create index if not exists sessions_user_idx on sessions(user_id);

create table if not exists login_attempts (
  id bigserial primary key,
  email text not null,
  ip_hash text,
  success boolean not null,
  at timestamptz not null default now()
);
create index if not exists login_attempts_email_at on login_attempts(email, at);

-- ── Organización ───────────────────────────────────────────────────
create table if not exists business_units (
  id text primary key,
  name text not null,
  status text not null check (status in ('research','validating','active','paused','killed')),
  description text not null default '',
  phase int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists agents (
  id text primary key,
  name text not null,
  status text not null default 'idle' check (status in ('idle','running','disabled','error')),
  allowed_actions jsonb not null default '[]',
  last_run_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references agents(id),
  type text not null,
  status text not null check (status in ('queued','running','succeeded','failed','blocked','awaiting_approval')),
  input jsonb not null default '{}',
  output jsonb,
  error text,
  idempotency_key text unique,
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_after timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_status_idx on tasks(status, run_after);

create table if not exists job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  period_key text not null,
  status text not null check (status in ('running','succeeded','failed','skipped')),
  attempts int not null default 1,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text,
  summary jsonb,
  unique (job_name, period_key)
);

create table if not exists events (
  id bigserial primary key,
  type text not null,
  source text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists events_type_idx on events(type, created_at);

-- Registro de auditoría encadenado por hash (append-only).
create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  level text not null check (level in ('green','yellow','red','blocked','system')),
  target text,
  result text not null,
  detail jsonb not null default '{}',
  prev_hash text not null,
  hash text not null unique
);

-- Autorizaciones de acciones NIVEL ROJO.
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  requested_by text not null,
  reason text not null,
  payload jsonb not null default '{}',
  amount_cents bigint check (amount_cents is null or amount_cents > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','executed','expired')),
  decided_by text,
  decided_at timestamptz,
  result text,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  made_by text not null,
  title text not null,
  rationale text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('info','warning','critical')),
  source text not null,
  message text not null,
  dedupe_key text unique,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  period_key text not null,
  agent_id text not null,
  body_md text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (kind, period_key, agent_id)
);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

-- ── Finanzas ───────────────────────────────────────────────────────
create table if not exists budgets (
  id text primary key,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'MXN',
  approved_by text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- kind: income (cobro real), expense (gasto discrecional: requiere aprobación),
-- fee (comisión de plataforma descontada de una venta), commission (comisión de afiliado).
-- nature: real (dinero verificado) | estimated (proyección o pendiente de confirmar).
create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null,
  kind text not null check (kind in ('income','expense','fee','commission')),
  nature text not null check (nature in ('real','estimated')),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'MXN',
  business_unit_id text not null references business_units(id),
  source text not null,
  external_id text,
  description text not null default '',
  approval_id uuid references approvals(id),
  verified boolean not null default false,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (source, external_id),
  -- Ningún gasto real sin autorización registrada.
  constraint expense_needs_approval check (kind <> 'expense' or nature <> 'real' or approval_id is not null),
  -- Dinero "real" de ingresos debe estar verificado contra la fuente.
  constraint real_income_verified check (kind not in ('income','commission') or nature <> 'real' or verified)
);
create index if not exists ledger_unit_idx on ledger_entries(business_unit_id, occurred_at);

-- ── Comercial ──────────────────────────────────────────────────────
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  business_unit_id text not null references business_units(id),
  name text not null,
  email text not null,
  phone text,
  company text,
  trade text,
  quotes_per_month int,
  willingness_to_pay_cents bigint,
  need text not null default '',
  source text not null default 'web',
  utm jsonb not null default '{}',
  status text not null default 'new' check (status in ('new','contacted','qualified','proposal','won','lost')),
  score int not null default 0,
  consent_contact boolean not null,
  consent_marketing boolean not null default false,
  consent_at timestamptz not null default now(),
  privacy_version text not null,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_requires_contact_consent check (consent_contact)
);
create index if not exists leads_unit_status on leads(business_unit_id, status);
create unique index if not exists leads_unit_email on leads(business_unit_id, lower(email));

create table if not exists lead_activities (
  id bigserial primary key,
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null,
  detail text not null default '',
  actor text not null,
  created_at timestamptz not null default now()
);

create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  to_email text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft','approved','sent','failed','blocked')),
  error text,
  created_by text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists page_views (
  id bigserial primary key,
  path text not null,
  referrer text,
  utm_source text,
  visitor_hash text,
  at timestamptz not null default now()
);
create index if not exists page_views_path_at on page_views(path, at);

create table if not exists rate_limits (
  key text primary key,
  count int not null,
  window_start timestamptz not null
);

-- ── Afiliados ──────────────────────────────────────────────────────
create table if not exists affiliate_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,64}$'),
  title text not null,
  destination_url text not null,
  program text not null default 'mercadolibre',
  -- Solo se llena con la tasa confirmada en el panel del programa (puntos base). NULL = desconocida.
  commission_rate_bps int check (commission_rate_bps is null or commission_rate_bps between 0 and 10000),
  status text not null default 'active' check (status in ('active','broken','paused')),
  last_checked_at timestamptz,
  last_http_status int,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists affiliate_clicks (
  id bigserial primary key,
  link_id uuid not null references affiliate_links(id) on delete cascade,
  at timestamptz not null default now(),
  referrer text,
  visitor_hash text
);
create index if not exists affiliate_clicks_link_at on affiliate_clicks(link_id, at);

-- ── Productos, contenido, oportunidades ───────────────────────────
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  business_unit_id text not null references business_units(id),
  name text not null,
  kind text not null,
  price_cents bigint,
  currency text not null default 'MXN',
  status text not null default 'draft' check (status in ('idea','draft','published','retired')),
  source text,
  external_id text,
  url text,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  business_unit_id text not null references business_units(id),
  channel text not null,
  title text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft','approved','scheduled','published','rejected')),
  scheduled_for timestamptz,
  published_url text,
  created_by text not null,
  approved_by text,
  created_at timestamptz not null default now()
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  business_unit_id text not null references business_units(id),
  title text not null,
  demand int not null check (demand between 1 and 5),
  pain int not null check (pain between 1 and 5),
  competition int not null check (competition between 1 and 5),
  feasibility int not null check (feasibility between 1 and 5),
  monthly_cost_cents bigint not null default 0,
  evidence jsonb not null default '[]',
  score numeric not null,
  status text not null default 'new' check (status in ('new','validating','validated','rejected')),
  created_by text not null,
  created_at timestamptz not null default now()
);
