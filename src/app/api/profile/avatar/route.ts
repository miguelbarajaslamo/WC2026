import { NextResponse } from "next/server";
import sharp from "sharp";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// sharp is a native module, so this handler must run on the Node runtime.
export const runtime = "nodejs";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
// Generous input cap — phone photos are large and we downscale them anyway.
const maxUploadBytes = 12 * 1024 * 1024;
// Square output side. 512 stays crisp on retina while keeping files tiny.
const avatarSize = 512;

// A pool admin may set a photo for any member of a pool they run.
async function canManage(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  requesterId: string,
  targetId: string,
) {
  const { data: adminPools } = await admin
    .from("pool_members")
    .select("pool_id")
    .eq("user_id", requesterId)
    .eq("role", "admin");
  const poolIds = (adminPools ?? []).map((row) => row.pool_id);

  if (poolIds.length === 0) {
    return false;
  }

  const { data: shared } = await admin
    .from("pool_members")
    .select("pool_id")
    .eq("user_id", targetId)
    .in("pool_id", poolIds)
    .limit(1);

  return (shared?.length ?? 0) > 0;
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
  const requestedUserId = formData.get("userId");
  const targetUserId =
    typeof requestedUserId === "string" && requestedUserId
      ? requestedUserId
      : user.id;

  const admin = createSupabaseAdminClient();

  if (targetUserId !== user.id && !(await canManage(admin, user.id, targetUserId))) {
    return NextResponse.json(
      { error: "You can only change photos for members of a pool you run." },
      { status: 403 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Avatar file is required" }, { status: 400 });
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json(
      { error: "Avatar must be JPG, PNG, or WebP." },
      { status: 400 },
    );
  }

  if (file.size > maxUploadBytes) {
    return NextResponse.json(
      { error: "Image must be 12 MB or smaller." },
      { status: 400 },
    );
  }

  // Auto-orient from EXIF, center-crop to a square, downscale, and re-encode as
  // WebP. This normalizes phone photos and keeps the stored file well under the
  // bucket's size limit regardless of the original.
  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(avatarSize, avatarSize, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "Could not process that image. Try a different file." },
      { status: 400 },
    );
  }

  // Service role for the storage write: the bucket's RLS only lets users write
  // their own folder, so an admin setting another member's photo needs it.
  const path = `${targetUserId}/avatar-${Date.now()}.webp`;
  const { error: uploadError } = await admin.storage
    .from("profile-avatars")
    .upload(path, webp, {
      cacheControl: "3600",
      contentType: "image/webp",
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
    .eq("id", targetUserId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl });
}
