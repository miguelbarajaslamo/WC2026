import { NextResponse, type NextRequest } from "next/server";
import { safeRelativeRedirect } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRelativeRedirect(requestUrl.searchParams.get("next"));
  const invite = requestUrl.searchParams.get("invite");

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const redirectUrl = new URL(next, request.url);
  if (invite) {
    redirectUrl.searchParams.set("invite", invite);
  }

  return NextResponse.redirect(redirectUrl);
}
