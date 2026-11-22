export type CheckoutLine = { id: string; title: string; amountCents: number };

export type CheckoutRequest = {
  orderId: string;
  orderNumber: string;
  currency: string;
  totalCents: number;
  lines: CheckoutLine[];
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutRedirect = {
  /** URL a la que se redirige al alumno para pagar. */
  url: string;
  /** Identificador de la sesión en el proveedor (se guarda en la orden). */
  providerSessionId: string;
};

export function centsToDecimal(cents: number) {
  return (cents / 100).toFixed(2);
}

export function decimalToCents(value: string | number) {
  return Math.round(Number(value) * 100);
}
