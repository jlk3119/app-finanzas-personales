import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse } = updateSession(request);
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // Rutas públicas: login y todo el flujo de auth (callback, reset-password).
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  // Excluir assets estáticos y las rutas /api (cada API valida su propia sesión
  // y responde 401; redirigirlas a /login rompería las respuestas JSON).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.svg).*)",
  ],
};
