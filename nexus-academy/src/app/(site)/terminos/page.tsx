import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function TermsPage() {
  return (
    <LegalPage title="Términos y condiciones" updated="23 de noviembre de 2026">
      <h2>1. Objeto</h2>
      <p>Estos términos regulan el uso de la plataforma {BRAND.name} y la compra de cursos digitales. Al crear una cuenta o realizar una compra aceptas estos términos.</p>
      <h2>2. Cuenta</h2>
      <p>Eres responsable de la confidencialidad de tu contraseña y de la actividad de tu cuenta. La cuenta es personal e intransferible; compartir el acceso a cursos de pago está prohibido.</p>
      <h2>3. Compras y acceso</h2>
      <p>Los precios se muestran en pesos mexicanos (MXN) con impuestos incluidos. El acceso a un curso se activa automáticamente cuando el proveedor de pagos (Stripe, Mercado Pago o PayPal) confirma la transacción. Los cursos adquiridos no tienen fecha de vencimiento mientras la plataforma esté en operación.</p>
      <h2>4. Pagos</h2>
      <p>Los pagos se procesan en las plataformas seguras de cada proveedor. {BRAND.name} no almacena los datos completos de tu tarjeta.</p>
      <h2>5. Reembolsos</h2>
      <p>Consulta la <a href="/reembolsos">política de reembolsos</a>. Un reembolso total retira el acceso al curso correspondiente.</p>
      <h2>6. Propiedad intelectual</h2>
      <p>El contenido de los cursos es propiedad de {BRAND.name} o de sus instructores. Se concede una licencia personal, no exclusiva y no transferible para uso educativo. No está permitido descargar, redistribuir ni revender el contenido salvo los materiales marcados como descargables.</p>
      <h2>7. {BRAND.aiName}</h2>
      <p>El asistente de inteligencia artificial es una herramienta de apoyo. Puede cometer errores y no sustituye el criterio profesional. Se aplica un límite de uso diario por alumno.</p>
      <h2>8. Certificados</h2>
      <p>Los certificados acreditan la finalización de un curso en la plataforma. No constituyen un título oficial con reconocimiento de validez oficial de estudios (RVOE).</p>
      <h2>9. Contacto</h2>
      <p>Para dudas sobre estos términos escribe al correo de contacto publicado en el aviso de privacidad.</p>
    </LegalPage>
  );
}
