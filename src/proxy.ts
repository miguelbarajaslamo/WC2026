import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/env";

// Routes reachable without a session. Everything else requires the user to be
// signed in; unauthenticated visitors are redirected to /login.
const PUBLIC_PREFIXES = ["/login", "/auth", "/invite"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  // Keep request/response cookies in sync so Supabase can rotate the session
  // token on the way through. supabaseResponse is rebuilt whenever cookies are
  // written so the refreshed token reaches the browser.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    requireEnv("supabaseUrl"),
    requireEnv("supabaseAnonKey"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Do not run code between creating the client and getUser(): it revalidates
  // the auth token and refreshes the cookie when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);

    const redirect = NextResponse.redirect(loginUrl);
    // Preserve any cookies Supabase set above so the redirect stays in sync.
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    return redirect;
  }

  // Already signed in but sitting on the login page — send them into the app.
  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";

    const redirect = NextResponse.redirect(homeUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });
    return redirect;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match every path except:
     * - api routes (they handle auth and return JSON, not redirects)
     * - _next/static and _next/image (build assets)
     * - the PWA manifest and common static file extensions
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)",
  ],
};
