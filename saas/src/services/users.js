import { effectivePlanId, planName } from '../plans.js';
import { normalizeEmail } from '../lib/security.js';

export async function findUserById(db, id) {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function findUserByEmail(db, email) {
  const { rows } = await db.query('SELECT * FROM users WHERE email_normalized = $1', [normalizeEmail(email)]);
  return rows[0] ?? null;
}

export async function createUser(db, { name, email, passwordHash, businessName, role = 'user', locale = 'es', currency = 'mxn', country = null }) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, email_normalized, password_hash, business_name, role, locale, currency, country,
       terms_accepted_at, last_login_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
     ON CONFLICT (email_normalized) DO NOTHING
     RETURNING *`,
    [name, email.trim(), normalizeEmail(email), passwordHash, businessName ?? null, role, locale, currency, country],
  );
  return rows[0] ?? null;
}

export async function getActiveSubscription(db, userId) {
  const { rows } = await db.query(
    `SELECT * FROM subscriptions
     WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due', 'incomplete')
     ORDER BY updated_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export function userView(user, { plans, usage, subscription, billingEnabled, locale }) {
  const plan = plans.get(effectivePlanId(user));
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    businessName: user.business_name,
    role: user.role,
    emailVerified: Boolean(user.email_verified_at),
    createdAt: user.created_at,
    locale: user.locale,
    currency: user.currency,
    country: user.country,
    plan: {
      id: plan.id,
      name: planName(plan.id, locale ?? user.locale),
      prices: plan.prices,
      monthlyCredits: plan.monthlyCredits,
      maxInputChars: plan.maxInputChars,
      premiumTools: plan.premiumTools,
      historyDays: plan.historyDays,
      source: plan.id === 'free' ? 'default' : user.plan_source,
      expiresAt: plan.id === 'free' ? null : user.plan_expires_at,
    },
    usage,
    subscription: subscription ? {
      status: subscription.status,
      planId: subscription.plan_id,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscription.current_period_end,
    } : null,
    billingEnabled,
  };
}
