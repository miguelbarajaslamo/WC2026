import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function validHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export async function PATCH(request: Request) {
  const { avatarColor, displayName } = (await request.json()) as {
    avatarColor?: string;
    displayName?: string;
  };
  const name = displayName?.trim();
  const color = avatarColor?.trim();

  if (name !== undefined && (name.length < 2 || name.length > 40)) {
    return NextResponse.json(
      { error: "Display name must be 2-40 characters." },
      { status: 400 },
    );
  }

  if (color !== undefined && !validHexColor(color)) {
    return NextResponse.json(
      { error: "Avatar color must be a hex color." },
      { status: 400 },
    );
  }

  const update: { avatar_color?: string; display_name?: string; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    update.display_name = name;
  }

  if (color !== undefined) {
    update.avatar_color = color;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
