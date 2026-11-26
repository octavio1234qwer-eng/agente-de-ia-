import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/legal-page";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Aviso de privacidad" updated="23 de noviembre de 2026">
      <p>En cumplimiento de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, {BRAND.name} informa cómo trata tus datos personales.</p>
      <h2>Datos que recabamos</h2>
      <ul>
        <li>Identificación y contacto: nombre, correo electrónico y fotografía de perfil (opcional).</li>
        <li>Datos académicos: cursos inscritos, progreso, evaluaciones, certificados y reseñas.</li>
        <li>Datos de compra: productos, importes, método de pago utilizado y, si lo solicitas, RFC y razón social para facturación. No almacenamos números de tarjeta.</li>
        <li>Conversaciones con {BRAND.aiName}, para darte continuidad y controlar el uso.</li>
      </ul>
      <h2>Finalidades</h2>
      <ul>
        <li>Primarias: crear y administrar tu cuenta, dar acceso a los cursos, procesar pagos, emitir certificados y facturas, y brindarte soporte.</li>
        <li>Secundarias (puedes oponerte en <a href="/cuenta/ajustes">Configuración</a>): recordatorios de aprendizaje, avisos de nuevos cursos y promociones.</li>
      </ul>
      <h2>Transferencias y encargados</h2>
      <p>Compartimos los datos estrictamente necesarios con proveedores que actúan como encargados: Supabase (base de datos y autenticación), Stripe, Mercado Pago y PayPal (pagos), Resend (correo) y Anthropic (procesamiento de las consultas a {BRAND.aiName}).</p>
      <h2>Derechos ARCO</h2>
      <p>Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición, así como revocar tu consentimiento, escribiendo al correo de contacto del responsable. Responderemos en los plazos que marca la ley.</p>
      <h2>Seguridad</h2>
      <p>Aplicamos controles de acceso por usuario en la base de datos, cifrado en tránsito, verificación de firmas en los pagos y principio de mínimo privilegio.</p>
    </LegalPage>
  );
}
