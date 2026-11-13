-- Esquema inicial de la plataforma.
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  business_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  email_verified_at TIMESTAMPTZ,
  plan_id TEXT NOT NULL DEFAULT 'free',
  plan_source TEXT NOT NULL DEFAULT 'default' CHECK (plan_source IN ('default', 'stripe', 'manual')),
  plan_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT UNIQUE,
  failed_logins INT NOT NULL DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  terms_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX users_created_at_idx ON users (created_at);
CREATE INDEX users_plan_idx ON users (plan_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_idx ON auth_tokens (user_id, purpose);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_subscription_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_cents INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'mxn',
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_idx ON subscriptions (user_id);
CREATE INDEX subscriptions_status_idx ON subscriptions (status);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_invoice_id TEXT NOT NULL UNIQUE,
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_paid_at_idx ON payments (paid_at);

CREATE TABLE billing_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usage_counters (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  used INT NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY (user_id, period)
);

CREATE TABLE generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  title TEXT,
  input JSONB NOT NULL,
  output TEXT,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
  credits INT NOT NULL DEFAULT 0,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  error_code TEXT,
  purged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX generations_user_created_idx ON generations (user_id, created_at DESC);
CREATE INDEX generations_created_idx ON generations (created_at);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_user_id UUID,
  target_email TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX rate_limits_window_idx ON rate_limits (window_start);
