import { NextResponse } from "next/server";
import {
  BootstrapAccessError,
  buildSupabaseBootstrapData,
} from "@/lib/api/bootstrap-server";
import { buildMockBootstrapData } from "@/lib/data/mock";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(buildMockBootstrapData());
    }

    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    return NextResponse.json(
      await buildSupabaseBootstrapData({ supabase, userId: user.id }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load WORLD CUP PICKS data",
      },
      { status: error instanceof BootstrapAccessError ? error.status : 500 },
    );
  }
}
