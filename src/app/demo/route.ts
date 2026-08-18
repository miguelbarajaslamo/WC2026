import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE } from "@/lib/api/demo";

// Entry point for the read-only tour. Sets the demo cookie and drops the
// visitor on the home screen; from there the app behaves normally except that
// every write is rejected for lack of a session.
export async function GET(request: NextRequest) {
  const home = request.nextUrl.clone();
  home.pathname = "/";
  home.search = "";

  const response = NextResponse.redirect(home);
  response.cookies.set(DEMO_COOKIE, "1", {
    httpOnly: true,
    maxAge: 60 * 60 * 4,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
