import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";

export const metadata: Metadata = { title: "Política de reembolsos" };

export default function RefundsPage() {
  return (
    <LegalPage title="Política de reembolsos" updated="23 de noviembre de 2026">
      <h2>Plazo</h2>
      <p>Puedes solicitar el reembolso de un curso dentro de los 14 días naturales posteriores a la compra, siempre que no hayas completado más del 30 % del curso ni descargado su certificado.</p>
      <h2>Cómo solicitarlo</h2>
      <p>Escribe al correo de contacto indicando tu número de pedido (por ejemplo NX-1001), que encontrarás en <a href="/cuenta/compras">Mis compras</a>.</p>
      <h2>Procesamiento</h2>
      <p>El reembolso se hace al mismo método de pago a través de Stripe, Mercado Pago o PayPal. El tiempo en que se refleja depende de tu banco o del proveedor. Un reembolso total retira el acceso al curso.</p>
      <h2>Paquetes y cupones</h2>
      <p>Los paquetes se reembolsan completos. Los descuentos aplicados con cupón no generan saldo a favor.</p>
    </LegalPage>
  );
}
