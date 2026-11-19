/**
 * Infraestructura de monetización independiente del proveedor.
 *
 * - PaymentProvider: interfaz común (checkout + parseo de webhooks verificados).
 * - DemoPaymentProvider: modo de DEMOSTRACIÓN claramente identificado. No cobra dinero real;
 *   sus transacciones se guardan con source='demo' y se excluyen de todas las métricas reales.
 * - Proveedores reales compatibles con México (Mercado Pago, Stripe MX, Conekta, Gumroad…) se
 *   implementan con esta misma interfaz cuando el propietario aporte credenciales. Ver docs.
 *
 * Una venta solo se marca 'confirmed' cuando llega un webhook con firma válida del proveedor.
 */
import { randomUUID } from 'node:crypto';
import { get, run, transaction, audit, notify, type DB } from '../../database/src/index.ts';
import { verifyWebhookSignature } from '../../security/src/index.ts';

export interface CheckoutRequest {
  businessId: string;
  productId: string;
  amountCents: number;
  currency: string;
  customerId?: string | null;
  channel?: string;
}

export interface CheckoutSession {
  transactionId: string;
  provider: string;
  providerRef: string;
  checkoutUrl: string | null;
  isDemo: boolean;
  instructions: string;
}

export interface PaymentWebhookEvent {
  eventId: string;
  type: 'payment.succeeded' | 'payment.failed' | 'payment.refunded';
  providerRef: string;
  amountCents: number;
  currency: string;
  feeCents?: number;
}

export interface PaymentProvider {
  readonly id: string;
  readonly isDemo: boolean;
  isConfigured(): boolean;
  createCheckout(req: CheckoutRequest, transactionId: string): Promise<{ providerRef: string; checkoutUrl: string | null; instructions: string }>;
  /** Verifica firma y devuelve el evento normalizado, o null si la firma es inválida. */
  parseWebhook(rawBody: string, headers: Record<string, string | undefined>): PaymentWebhookEvent | null;
}

export class DemoPaymentProvider implements PaymentProvider {
  readonly id = 'demo';
  readonly isDemo = true;
  isConfigured() { return true; }
  async createCheckout(_req: CheckoutRequest, transactionId: string) {
    return {
      providerRef: `demo_${transactionId}`,
      checkoutUrl: null,
      instructions: 'MODO DEMOSTRACIÓN: no se cobra dinero real. Usa "Simular pago" para probar el flujo; la venta no cuenta en métricas.',
    };
  }
  parseWebhook(): PaymentWebhookEvent | null {
    return null; // el modo demo no recibe webhooks externos
  }
}

/**
 * Proveedor genérico HMAC: para pasarelas o automatizaciones (p. ej. un relay propio) que firmen
 * con HMAC-SHA256 `timestamp.body` en cabeceras x-signature / x-timestamp.
 */
export class HmacWebhookProvider implements PaymentProvider {
  readonly id: string;
  readonly isDemo = false;
  private secret: string;
  private now: () => number;
  constructor(id: string, secret: string | undefined, now: () => number = Date.now) {
    this.id = id;
    this.secret = secret ?? '';
    this.now = now;
  }
  isConfigured() { return this.secret.length >= 32; }
  async createCheckout(_req: CheckoutRequest, transactionId: string) {
    return { providerRef: `ext_${transactionId}`, checkoutUrl: null, instructions: 'Cobro externo: el pago se confirmará al recibir el webhook firmado del proveedor.' };
  }
  parseWebhook(rawBody: string, headers: Record<string, string | undefined>): PaymentWebhookEvent | null {
    if (!this.isConfigured()) return null;
    if (!verifyWebhookSignature({ secret: this.secret, rawBody, signature: headers['x-signature'], timestamp: headers['x-timestamp'], now: this.now() })) return null;
    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody); } catch { return null; }
    const type = body.type;
    if (type !== 'payment.succeeded' && type !== 'payment.failed' && type !== 'payment.refunded') return null;
    if (typeof body.eventId !== 'string' || typeof body.providerRef !== 'string' || !Number.isInteger(body.amountCents) || typeof body.currency !== 'string') return null;
    return {
      eventId: body.eventId,
      type,
      providerRef: body.providerRef,
      amountCents: body.amountCents as number,
      currency: body.currency,
      feeCents: Number.isInteger(body.feeCents) ? (body.feeCents as number) : undefined,
    };
  }
}

export async function startCheckout(db: DB, provider: PaymentProvider, req: CheckoutRequest): Promise<CheckoutSession> {
  if (!provider.isConfigured()) throw new Error(`el proveedor ${provider.id} no está configurado`);
  if (!Number.isInteger(req.amountCents) || req.amountCents <= 0) throw new Error('monto inválido');
  const transactionId = `txn_${randomUUID().replace(/-/g, '')}`;
  const session = await provider.createCheckout(req, transactionId);
  const now = new Date().toISOString();
  run(db, `INSERT INTO transactions (id, business_id, kind, amount_cents, currency, category, description, status, source, provider, provider_ref, product_id, customer_id, channel, occurred_at, created_at)
    VALUES (?, ?, 'income', ?, ?, 'venta', ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
    transactionId, req.businessId, req.amountCents, req.currency, provider.isDemo ? 'Venta de DEMOSTRACIÓN' : 'Venta', provider.isDemo ? 'demo' : 'payment_provider',
    provider.id, session.providerRef, req.productId, req.customerId ?? null, req.channel ?? 'direct', now, now);
  return { transactionId, provider: provider.id, providerRef: session.providerRef, checkoutUrl: session.checkoutUrl, isDemo: provider.isDemo, instructions: session.instructions };
}

/** Aplica un evento ya verificado. Idempotente por (provider, eventId). */
export function applyPaymentEvent(db: DB, providerId: string, event: PaymentWebhookEvent, rawBody: string): { applied: boolean; reason?: string } {
  return transaction(db, () => {
    const dup = get(db, 'SELECT id FROM payment_events WHERE provider = ? AND event_id = ?', providerId, event.eventId);
    if (dup) return { applied: false, reason: 'evento duplicado (ya procesado)' };
    run(db, 'INSERT INTO payment_events (id, provider, event_id, type, payload, received_at) VALUES (?, ?, ?, ?, ?, ?)',
      `pev_${randomUUID().replace(/-/g, '')}`, providerId, event.eventId, event.type, rawBody.slice(0, 20_000), new Date().toISOString());
    const tx = get<{ id: string; business_id: string; amount_cents: number; currency: string; status: string }>(db, 'SELECT * FROM transactions WHERE provider = ? AND provider_ref = ?', providerId, event.providerRef);
    if (!tx) return { applied: false, reason: 'transacción desconocida' };
    if (event.type === 'payment.succeeded') {
      if (event.amountCents !== tx.amount_cents || event.currency !== tx.currency) {
        notify(db, { businessId: tx.business_id, level: 'error', title: 'Pago con monto distinto al esperado', body: `${event.providerRef}` });
        return { applied: false, reason: 'monto o moneda no coinciden' };
      }
      run(db, "UPDATE transactions SET status = 'confirmed', occurred_at = ? WHERE id = ?", new Date().toISOString(), tx.id);
      if (event.feeCents && event.feeCents > 0) {
        run(db, `INSERT INTO transactions (id, business_id, kind, amount_cents, currency, category, description, status, source, provider, provider_ref, occurred_at, created_at)
          VALUES (?, ?, 'fee', ?, ?, 'comision', 'Comisión del proveedor', 'confirmed', 'payment_provider', ?, ?, ?, ?)`,
          `txn_${randomUUID().replace(/-/g, '')}`, tx.business_id, event.feeCents, tx.currency, providerId, `${event.providerRef}:fee`, new Date().toISOString(), new Date().toISOString());
      }
      notify(db, { businessId: tx.business_id, level: 'info', title: 'Venta confirmada por el proveedor', body: `${(tx.amount_cents / 100).toFixed(2)} ${tx.currency}` });
    } else if (event.type === 'payment.failed') {
      run(db, "UPDATE transactions SET status = 'failed' WHERE id = ? AND status = 'pending'", tx.id);
    } else {
      run(db, `INSERT INTO transactions (id, business_id, kind, amount_cents, currency, category, description, status, source, provider, provider_ref, occurred_at, created_at)
        VALUES (?, ?, 'refund', ?, ?, 'reembolso', 'Reembolso confirmado por el proveedor', 'confirmed', 'payment_provider', ?, ?, ?, ?)`,
        `txn_${randomUUID().replace(/-/g, '')}`, tx.business_id, event.amountCents, tx.currency, providerId, `${event.providerRef}:refund:${event.eventId}`, new Date().toISOString(), new Date().toISOString());
    }
    audit(db, { actor: `provider:${providerId}`, action: event.type, entity: 'transaction', entityId: tx.id, businessId: tx.business_id });
    return { applied: true };
  });
}

/** Confirma una venta DEMO (solo source='demo'); nunca afecta métricas reales. */
export function simulateDemoPayment(db: DB, transactionId: string): void {
  const tx = get<{ source: string }>(db, 'SELECT source FROM transactions WHERE id = ?', transactionId);
  if (!tx) throw new Error('transacción no encontrada');
  if (tx.source !== 'demo') throw new Error('solo se pueden simular pagos de demostración');
  run(db, "UPDATE transactions SET status = 'confirmed' WHERE id = ?", transactionId);
}
