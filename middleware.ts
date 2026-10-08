import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/setup", request.url));
    }
    return NextResponse.next();
  }
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });
  const { data } = await supabase.auth.getUser();
  if (request.nextUrl.pathname.startsWith("/dashboard") && !data.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = { matcher: ["/dashboard/:path*"] };
