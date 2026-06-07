import { NextResponse } from "next/server";
import { buildMockBootstrapData } from "@/lib/data/mock";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildMockBootstrapData());
}
