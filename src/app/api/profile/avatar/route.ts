import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxAvatarBytes = 2 * 1024 * 1024;

function extensionForType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("avatar");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Avatar file is required" }, { status: 400 });
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json(
      { error: "Avatar must be JPG, PNG, or WebP." },
      { status: 400 },
    );
  }

  if (file.size > maxAvatarBytes) {
    return NextResponse.json(
      { error: "Avatar must be 2 MB or smaller." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const path = `${user.id}/avatar-${Date.now()}.${extensionForType(file.type)}`;
  const { error: uploadError } = await admin.storage
    .from("profile-avatars")
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = admin.storage.from("profile-avatars").getPublicUrl(path);
  const avatarUrl = data.publicUrl;
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl });
}
