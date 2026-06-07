import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const { email, invite, next } = (await request.json()) as {
    email?: string;
    invite?: string;
    next?: string;
  };

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const origin = new URL(request.url).origin;
  const redirectUrl = new URL("/auth/callback", origin);
  redirectUrl.searchParams.set("next", next ?? "/");

  if (invite) {
    redirectUrl.searchParams.set("invite", invite);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl.toString(),
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
