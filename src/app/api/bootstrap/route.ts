import { NextResponse } from "next/server";
import {
  BootstrapAccessError,
  buildSupabaseBootstrapData,
} from "@/lib/api/bootstrap-server";
import { buildMockBootstrapData } from "@/lib/data/mock";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(buildMockBootstrapData(), {
        headers: noStoreHeaders,
      });
    }

    return NextResponse.json(
      { error: "Not authenticated" },
      { headers: noStoreHeaders, status: 401 },
    );
  }

  try {
    return NextResponse.json(
      await buildSupabaseBootstrapData({
        supabase,
        userEmail: user.email,
        userId: user.id,
      }),
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (!(error instanceof BootstrapAccessError)) {
      console.error("[bootstrap] failed to build data", error);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load WORLD CUP PICKS data",
        code:
          error instanceof BootstrapAccessError ? error.code : undefined,
      },
      {
        headers: noStoreHeaders,
        status: error instanceof BootstrapAccessError ? error.status : 500,
      },
    );
  }
}
