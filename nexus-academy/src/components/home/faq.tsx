import { ChevronDown } from "lucide-react";
import { BRAND } from "@/lib/brand";

const faqs = [
  { q: "¿Cómo accedo a un curso después de pagar?", a: "En cuanto el proveedor de pagos confirma la transacción, el acceso se activa automáticamente y recibes un correo de confirmación. El curso aparece en «Mis cursos» y puedes empezar de inmediato." },
  { q: "¿Qué métodos de pago aceptan?", a: `Tarjetas de crédito y débito mediante Stripe, Mercado Pago (tarjetas y otros medios disponibles en México) y PayPal. Los pagos se procesan en las páginas seguras de cada proveedor: ${BRAND.name} nunca almacena los datos de tu tarjeta.` },
  { q: "¿El acceso a los cursos caduca?", a: "No. Los cursos que compras quedan disponibles en tu cuenta sin fecha de vencimiento, incluidas las actualizaciones de contenido." },
  { q: "¿Puedo pedir un reembolso?", a: "Sí. Consulta nuestra política de reembolsos: puedes solicitarlo dentro de los 14 días posteriores a la compra si no has completado más del 30 % del curso." },
  { q: "¿Los certificados tienen validez?", a: `Cada certificado incluye un identificador único y un código QR. Cualquier persona puede verificar su autenticidad en la página de verificación de ${BRAND.name}.` },
  { q: `¿Qué es ${BRAND.aiName}?`, a: "Es el tutor con inteligencia artificial integrado en el aula. Responde preguntas sobre la lección que estás viendo, explica conceptos, crea resúmenes, genera preguntas de práctica y te ayuda a armar tu ruta de aprendizaje." },
  { q: "¿Puedo solicitar factura?", a: "Sí. Durante el checkout puedes registrar tu RFC y razón social; quedan asociados a tu pedido para emitir el comprobante fiscal correspondiente." },
];

export function Faq() {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {faqs.map((f) => (
        <details key={f.q} className="group glass rounded-2xl px-5 py-1 open:bg-white/[0.05]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[15px] font-medium text-white [&::-webkit-details-marker]:hidden">
            {f.q}
            <ChevronDown className="size-5 shrink-0 text-mist-400 transition group-open:rotate-180" aria-hidden />
          </summary>
          <p className="pb-5 text-sm leading-relaxed text-mist-300">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
