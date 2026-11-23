import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Áreas privadas o transaccionales fuera del índice. Los certificados NO se
 * bloquean aquí: llevan `noindex` en la página y deben poder leerlos LinkedIn y
 * otras redes para mostrar la vista previa al compartirlos.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/cuenta", "/aprender", "/nexus-ai", "/api/", "/checkout", "/carrito", "/login", "/registro", "/recuperar", "/restablecer", "/baja", "/auth/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
