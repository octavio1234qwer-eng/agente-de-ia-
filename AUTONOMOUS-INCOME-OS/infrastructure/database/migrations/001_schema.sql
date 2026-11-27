-- AUTO-INCOME AI: esquema inicial.
-- Importes en centavos (bigint). Monedas ISO 4217. Fechas en timestamptz (UTC).
-- Todas las tablas tienen RLS activado sin políticas: solo el dueño de la base
-- (la app) puede leerlas. Esto bloquea el acceso por APIs automáticas (p. ej. PostgREST).

-- ───────────── Identidad y acceso ─────────────
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'operator', 'viewer')),
  totp_secret_enc text,
  disabled boolean NOT NULL DEFAULT false,
  failed_logins int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE sessions (
  id text PRIMARY KEY, -- sha256 del token; el token solo vive en la cookie
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  revoked_at timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- ───────────── Negocios y productos ─────────────
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,60}$'),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'validating'
    CHECK (status IN ('research', 'building', 'validating', 'active', 'paused', 'retired')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]{2,60}$'),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('free_tool', 'one_time', 'subscription', 'digital_download')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'published', 'retired')),
  price_cents bigint NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency char(3) NOT NULL DEFAULT 'MXN',
  billing_interval text CHECK (billing_interval IN ('month', 'year')),
  feature text, -- permiso que otorga la compra (p. ej. cotizafacil_pro)
  description text,
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, slug),
  CHECK ((kind = 'subscription') = (billing_interval IS NOT NULL)),
  CHECK (kind = 'free_tool' OR price_cents > 0)
);

CREATE TABLE product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version int NOT NULL CHECK (version > 0),
  changelog text,
  qa_status text NOT NULL DEFAULT 'pending' CHECK (qa_status IN ('pending', 'passed', 'failed')),
  qa_report jsonb,
  rights_review jsonb,
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, version),
  CHECK (approved_at IS NULL OR qa_status = 'passed')
);
ALTER TABLE products ADD CONSTRAINT products_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES product_versions(id);

-- ───────────── Aprobaciones humanas ─────────────
CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  title text NOT NULL,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}',
  risk text NOT NULL DEFAULT 'medium' CHECK (risk IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'executed', 'failed')),
  requested_by text NOT NULL,
  decided_by uuid REFERENCES users(id),
  decided_at timestamptz,
  decision_note text,
  executed_at timestamptz,
  execution_result jsonb,
  dedupe_key text UNIQUE,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('pending', 'expired') OR decided_at IS NOT NULL)
);
CREATE INDEX approvals_status_idx ON approvals (status, created_at DESC);

-- ───────────── Clientes y prospectos ─────────────
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  name text,
  marketing_consent boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  consent_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (marketing_consent = false OR consent_at IS NOT NULL)
);
CREATE UNIQUE INDEX customers_email_key ON customers (lower(email));

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  name text,
  source text,
  segment text,
  consent boolean NOT NULL CHECK (consent = true), -- solo se guardan prospectos que aceptaron
  consent_text text NOT NULL,
  consent_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'nurturing', 'converted', 'unsubscribed', 'bounced')),
  sequence_step int NOT NULL DEFAULT 0,
  next_contact_at timestamptz,
  unsubscribe_token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX leads_business_email_key ON leads (business_id, lower(email));
CREATE INDEX leads_next_contact_idx ON leads (status, next_contact_at);

-- ───────────── Pedidos, pagos y suscripciones ─────────────
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  product_id uuid NOT NULL REFERENCES products(id),
  product_version_id uuid REFERENCES product_versions(id),
  customer_id uuid REFERENCES customers(id),
  buyer_email text NOT NULL CHECK (length(buyer_email) BETWEEN 3 AND 254),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'paid', 'fulfilled', 'refunded', 'partially_refunded',
                      'cancelled', 'expired', 'failed')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency char(3) NOT NULL,
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_reference text, -- id de preferencia o de preapproval
  checkout_url text,
  checkout_token_hash text NOT NULL,
  live_mode boolean,
  marketing_consent boolean NOT NULL DEFAULT false,
  idempotency_key text UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  fulfilled_at timestamptz,
  CHECK (status NOT IN ('paid', 'fulfilled') OR paid_at IS NOT NULL)
);
CREATE INDEX orders_status_idx ON orders (status, created_at DESC);
CREATE INDEX orders_customer_idx ON orders (customer_id);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  product_id uuid NOT NULL REFERENCES products(id),
  customer_id uuid REFERENCES customers(id),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id),
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_subscription_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'paused', 'cancelled')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency char(3) NOT NULL,
  billing_interval text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  next_payment_at timestamptz,
  live_mode boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  UNIQUE (provider, provider_subscription_id)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id),
  subscription_id uuid REFERENCES subscriptions(id),
  provider text NOT NULL,
  provider_payment_id text NOT NULL,
  status text NOT NULL,
  status_detail text,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency char(3) NOT NULL,
  fee_cents bigint NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  net_cents bigint,
  refunded_cents bigint NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  money_release_date timestamptz,
  money_release_status text,
  payment_method text,
  live_mode boolean NOT NULL,
  approved_at timestamptz,
  verified_at timestamptz NOT NULL, -- solo existe después de consultar al proveedor
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_payment_id),
  CHECK (order_id IS NOT NULL OR subscription_id IS NOT NULL)
);
CREATE INDEX payments_order_idx ON payments (order_id);

-- ───────────── Entrega y acceso ─────────────
CREATE TABLE entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  product_id uuid NOT NULL REFERENCES products(id),
  feature text NOT NULL,
  order_id uuid REFERENCES orders(id),
  subscription_id uuid REFERENCES subscriptions(id),
  license_key_hash text NOT NULL UNIQUE,
  license_key_hint text NOT NULL,
  key_version int NOT NULL DEFAULT 1 CHECK (key_version > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
  public_slug text UNIQUE CHECK (public_slug IS NULL OR public_slug ~ '^[a-z0-9-]{3,40}$'),
  public_profile jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (order_id IS NOT NULL OR subscription_id IS NOT NULL)
);
CREATE UNIQUE INDEX entitlements_order_key ON entitlements (order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX entitlements_subscription_key ON entitlements (subscription_id) WHERE subscription_id IS NOT NULL;

CREATE TABLE deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id),
  entitlement_id uuid REFERENCES entitlements(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  channel text NOT NULL DEFAULT 'portal',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  CHECK (status <> 'delivered' OR (delivered_at IS NOT NULL AND entitlement_id IS NOT NULL))
);

CREATE TABLE access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  purpose text NOT NULL CHECK (purpose IN ('portal_link', 'portal_session')),
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX access_tokens_customer_idx ON access_tokens (customer_id);

-- ───────────── Finanzas ─────────────
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  vendor text NOT NULL,
  description text NOT NULL,
  category text NOT NULL
    CHECK (category IN ('hosting', 'database', 'email', 'domain', 'ads', 'software', 'llm', 'payments', 'other')),
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency char(3) NOT NULL DEFAULT 'MXN',
  recurring text CHECK (recurring IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected', 'paid', 'cancelled')),
  approval_id uuid REFERENCES approvals(id),
  incurred_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('approved', 'paid') OR amount_cents = 0 OR approval_id IS NOT NULL)
);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  kind text NOT NULL CHECK (kind IN ('sale', 'subscription_charge', 'provider_fee', 'refund', 'chargeback',
                                     'expense', 'tax_reserve', 'adjustment')),
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency char(3) NOT NULL,
  state text NOT NULL CHECK (state IN ('collected', 'settled', 'pending', 'reserved', 'void')),
  order_id uuid REFERENCES orders(id),
  payment_id uuid REFERENCES payments(id),
  expense_id uuid REFERENCES expenses(id),
  live_mode boolean NOT NULL,
  description text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dedupe_key text NOT NULL UNIQUE
);
CREATE INDEX transactions_period_idx ON transactions (live_mode, occurred_at);

-- ───────────── Marketing y ventas ─────────────
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]{2,60}$'),
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('seo', 'social', 'email', 'community', 'referral', 'ads')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  budget_cents bigint NOT NULL DEFAULT 0 CHECK (budget_cents >= 0),
  approval_id uuid REFERENCES approvals(id),
  notes text,
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, slug),
  CHECK (budget_cents = 0 OR approval_id IS NOT NULL),
  CHECK (channel <> 'ads' OR status <> 'active' OR approval_id IS NOT NULL)
);

CREATE TABLE content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id),
  campaign_id uuid REFERENCES campaigns(id),
  kind text NOT NULL CHECK (kind IN ('article', 'social_post', 'video_script', 'email', 'product_description', 'landing_copy')),
  channel text,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'scheduled', 'published', 'rejected', 'archived')),
  scheduled_for timestamptz,
  published_at timestamptz,
  external_ref text,
  created_by text NOT NULL,
  approved_by uuid REFERENCES users(id),
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('approved', 'scheduled', 'published') OR approved_by IS NOT NULL)
);
CREATE INDEX content_status_idx ON content (business_id, status);

-- ───────────── Investigación ─────────────
CREATE TABLE opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id),
  title text NOT NULL,
  problem text NOT NULL,
  target_customer text,
  demand_score numeric(4,2) CHECK (demand_score BETWEEN 0 AND 10),
  competition_score numeric(4,2) CHECK (competition_score BETWEEN 0 AND 10),
  difficulty_score numeric(4,2) CHECK (difficulty_score BETWEEN 0 AND 10),
  margin_score numeric(4,2) CHECK (margin_score BETWEEN 0 AND 10),
  total_score numeric(4,2) CHECK (total_score BETWEEN 0 AND 10),
  confidence text NOT NULL DEFAULT 'none' CHECK (confidence IN ('none', 'low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'researching', 'scored', 'approved', 'rejected', 'launched')),
  scoring_notes jsonb,
  scored_at timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('demand', 'competition', 'pricing', 'customer_problem', 'difficulty', 'channel')),
  source_url text NOT NULL CHECK (source_url ~ '^https?://'),
  source_title text,
  summary text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  observed_on date NOT NULL,
  collected_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evidence_opportunity_idx ON evidence (opportunity_id);

-- ───────────── Analítica propia (sin cookies, sin IP) ─────────────
CREATE TABLE analytics_events (
  id bigserial PRIMARY KEY,
  business_id uuid REFERENCES businesses(id),
  name text NOT NULL CHECK (name ~ '^[a-z_]{2,40}$'),
  path text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  visitor_hash text NOT NULL,
  device text,
  props jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analytics_events_idx ON analytics_events (business_id, name, created_at);

-- ───────────── Orquestación de agentes ─────────────
CREATE TABLE automations (
  key text PRIMARY KEY CHECK (key ~ '^[a-z0-9_.-]{2,60}$'),
  name text NOT NULL,
  description text,
  task_type text NOT NULL,
  agent text,
  interval_minutes int NOT NULL CHECK (interval_minutes >= 5),
  enabled boolean NOT NULL DEFAULT true,
  last_enqueued_at timestamptz,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  agent text,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead', 'cancelled')),
  priority int NOT NULL DEFAULT 100,
  run_after timestamptz NOT NULL DEFAULT now(),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  depth int NOT NULL DEFAULT 0 CHECK (depth BETWEEN 0 AND 3), -- evita cadenas infinitas de agentes
  parent_task_id uuid REFERENCES tasks(id),
  idempotency_key text UNIQUE,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  CHECK (attempts <= max_attempts)
);
CREATE INDEX tasks_ready_idx ON tasks (status, run_after, priority);

CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent text NOT NULL,
  task_id uuid REFERENCES tasks(id),
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'blocked')),
  summary text,
  output jsonb,
  error text,
  actions jsonb NOT NULL DEFAULT '[]',
  llm_provider text,
  llm_tokens int NOT NULL DEFAULT 0,
  cost_cents bigint NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX agent_runs_agent_idx ON agent_runs (agent, started_at DESC);

CREATE TABLE agent_controls (
  agent text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

-- ───────────── Auditoría (solo anexado, encadenado por hash) ─────────────
CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'agent', 'system', 'webhook', 'customer', 'anonymous')),
  actor_id text,
  action text NOT NULL,
  target_type text,
  target_id text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  metadata jsonb NOT NULL DEFAULT '{}',
  ip_hash text,
  prev_hash text NOT NULL,
  hash text NOT NULL UNIQUE
);
CREATE INDEX audit_logs_action_idx ON audit_logs (action, at DESC);

CREATE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs es de solo anexado';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_mutation
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

-- ───────────── Notificaciones, ajustes, webhooks y límites ─────────────
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email', 'telegram', 'dashboard')),
  audience text NOT NULL CHECK (audience IN ('admin', 'customer', 'lead')),
  recipient text,
  subject text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  dedupe_key text UNIQUE,
  related_type text,
  related_id text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX notifications_status_idx ON notifications (status, created_at);

CREATE TABLE system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_key text NOT NULL,
  topic text,
  resource_id text,
  signature_valid boolean NOT NULL,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed', 'rejected')),
  attempts int NOT NULL DEFAULT 1,
  error text,
  payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, event_key)
);

CREATE TABLE rate_limits (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  hits int NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

-- ───────────── CotizaFácil Nube ─────────────
CREATE TABLE shared_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id uuid NOT NULL REFERENCES entitlements(id) ON DELETE CASCADE,
  public_id text NOT NULL UNIQUE CHECK (length(public_id) >= 20),
  folio text NOT NULL,
  snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'viewed', 'accepted', 'rejected', 'withdrawn')),
  view_count int NOT NULL DEFAULT 0,
  first_viewed_at timestamptz,
  decided_at timestamptz,
  decision_name text,
  decision_note text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shared_quotes_entitlement_idx ON shared_quotes (entitlement_id, created_at DESC);

CREATE TABLE quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id uuid NOT NULL REFERENCES entitlements(id) ON DELETE CASCADE,
  requester_name text NOT NULL,
  requester_email text,
  requester_phone text,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'quoted', 'closed', 'spam')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_email IS NOT NULL OR requester_phone IS NOT NULL)
);
CREATE INDEX quote_requests_entitlement_idx ON quote_requests (entitlement_id, created_at DESC);

CREATE TABLE cloud_backups (
  entitlement_id uuid PRIMARY KEY REFERENCES entitlements(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  size_bytes int NOT NULL CHECK (size_bytes <= 2000000),
  version int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ───────────── Seguridad a nivel de fila ─────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> 'schema_migrations' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
