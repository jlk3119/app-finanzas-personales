import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { supabase, supabaseResponse } = updateSession(request);
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");
  const isCompanySetup = pathname === "/company-setup";

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Verify company membership for authenticated users on protected routes
  if (user && !isAuthRoute && !isCompanySetup) {
    const hasCo = request.cookies.get("has_company")?.value;
    if (!hasCo) {
      const { data } = await supabase
        .from("company_members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!data) {
        return NextResponse.redirect(new URL("/company-setup", request.url));
      }

      const res = NextResponse.next();
      res.cookies.set("has_company", "1", { path: "/", maxAge: 60 * 60 * 24 * 30 });
      return res;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
};
