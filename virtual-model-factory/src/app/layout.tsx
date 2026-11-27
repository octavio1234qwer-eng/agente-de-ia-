import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Virtual Model Factory AI", template: "%s · VMF AI" },
  description: "Panel de gestión de modelos virtuales con IA.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#06050c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
