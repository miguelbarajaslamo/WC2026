import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  BootstrapAccessError,
  buildSupabaseBootstrapData,
} from "@/lib/api/bootstrap-server";
import {
  DEMO_COOKIE,
  isDemoRequest,
  resolveDemoUserId,
  toDemoData,
} from "@/lib/api/demo";
import { buildMockBootstrapData } from "@/lib/data/mock";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
    // Read-only tour: build the real pool from the seat named by DEMO_USER_ID,
    // then strip identities. Uses the admin client because the visitor has no
    // session for RLS to work from — which is also why this branch is
    // read-only and never echoes anything user-supplied back into a query.
    const cookieStore = await cookies();

    if (isDemoRequest(cookieStore.get(DEMO_COOKIE)?.value)) {
      try {
        const admin = createSupabaseAdminClient();
        const demoUserId = await resolveDemoUserId(admin);

        if (!demoUserId) {
          return NextResponse.json(
            { error: "Demo is not configured" },
            { headers: noStoreHeaders, status: 503 },
          );
        }

        const data = await buildSupabaseBootstrapData({
          supabase: admin,
          userId: demoUserId,
        });

        return NextResponse.json(toDemoData(data, demoUserId), {
          headers: noStoreHeaders,
        });
      } catch (error) {
        console.error("[bootstrap] demo build failed", error);
        return NextResponse.json(
          { error: "Demo is unavailable right now" },
          { headers: noStoreHeaders, status: 503 },
        );
      }
    }

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
