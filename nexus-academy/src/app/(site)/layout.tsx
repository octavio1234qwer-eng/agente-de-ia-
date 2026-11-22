import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-electric-600 focus:px-4 focus:py-2 focus:text-white">
        Saltar al contenido
      </a>
      <Navbar />
      <main id="contenido" className="relative">{children}</main>
      <Footer />
    </>
  );
}
