import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    scheduler: "supabase-cron",
    status: "ok",
    vercelCron: "daily-health-only",
  });
}
