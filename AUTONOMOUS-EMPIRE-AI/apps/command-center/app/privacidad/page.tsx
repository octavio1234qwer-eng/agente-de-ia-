import { PRIVACY_VERSION } from "@empire/businesses/cotizafacil-mx/leads";
export const metadata = { title: "Aviso de privacidad" };
export default function Privacidad() {
  return (
    <main className="public prose">
      <h1>Aviso de privacidad simplificado</h1>
      <p className="muted">Versión {PRIVACY_VERSION}. Borrador operativo: debe revisarlo el responsable legal antes del lanzamiento público (acción ROJA “aceptar obligaciones legales”).</p>
      <p><strong>Responsable:</strong> el titular del proyecto CotizaFácil MX. Contacto para ejercer derechos ARCO: el correo indicado en la respuesta a tu registro.</p>
      <p><strong>Datos que recabamos:</strong> nombre, correo, teléfono (opcional), negocio y giro (opcionales) y tus respuestas sobre cómo cotizas.</p>
      <p><strong>Finalidades primarias:</strong> contactarte sobre el piloto, entender tus necesidades y darte acceso a la herramienta. <strong>Secundarias (solo si las aceptas):</strong> enviarte consejos y novedades.</p>
      <p><strong>Transferencias:</strong> no vendemos ni compartimos tus datos. Se almacenan con proveedores de infraestructura (base de datos y alojamiento) bajo contrato.</p>
      <p><strong>Medición:</strong> contamos visitas de forma anónima (hash irreversible de IP y navegador, sin cookies propias de seguimiento).</p>
      <p><strong>Derechos ARCO y revocación:</strong> puedes acceder, rectificar, cancelar u oponerte respondiendo “BAJA” o escribiendo al correo de contacto. Atendemos en un máximo de 20 días hábiles.</p>
      <p>Con fundamento en la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.</p>
    </main>
  );
}
