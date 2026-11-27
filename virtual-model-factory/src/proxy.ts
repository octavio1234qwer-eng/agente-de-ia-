import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/setup", "/api/health"];
const COOKIE_NAMES = ["__Host-vmf_session", "vmf_session"];

/**
 * Comprobación optimista: sin cookie de sesión se redirige a /login. La
 * validación real (token, expiración, rol) ocurre en la DAL del servidor.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  const hasSession = COOKIE_NAMES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
