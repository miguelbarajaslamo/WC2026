import { NextResponse } from "next/server";
import webpush from "web-push";
import { nextAllowedTime } from "@/lib/notifications/quiet-hours";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// web-push relies on Node crypto, so this handler must not run on the edge.
export const runtime = "nodejs";

type Payload = {
  body?: string;
  mentionAll?: boolean;
  mentions?: string[];
  poolId?: string;
  vote?: { question?: string; options?: string[] };
};

type SubscriptionRow = {
  auth: string;
  endpoint: string;
  p256dh: string;
  user_id: string;
};

type QuietProfileRow = {
  id: string;
  display_name: string;
  quiet_hours_enabled: boolean | null;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  timezone: string | null;
};

type QueryResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

async function selectAllPaged<T>(
  buildQuery: (from: number, to: number) => QueryResult<T>,
) {
  const pageSize = 1000;
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...(data ?? []));

    if ((data ?? []).length < pageSize) {
      break;
    }
  }

  return rows;
}

async function selectAllInChunks<T>(
  values: string[],
  buildQuery: (
    chunk: string[],
    from: number,
    to: number,
  ) => QueryResult<T>,
) {
  const rows: T[] = [];

  for (const chunk of chunkRows([...new Set(values)], 500)) {
    rows.push(
      ...(await selectAllPaged<T>((from, to) => buildQuery(chunk, from, to))),
    );
  }

  return rows;
}

export async function POST(request: Request) {
  const { body, mentionAll, mentions, poolId, vote } =
    (await request.json()) as Payload;
  const text = body?.trim();

  if (!poolId || !text || text.length > 2000) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("pool_members")
    .select("role")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Not a pool member" }, { status: 403 });
  }

  let voteQuestion: string | null = null;
  let voteOptions: string[] | null = null;

  if (vote) {
    if (member.role !== "admin") {
      return NextResponse.json(
        { error: "Only the pool owner can start a vote." },
        { status: 403 },
      );
    }

    voteQuestion = vote.question?.trim() ?? "";
    voteOptions = (vote.options ?? [])
      .map((option) => option.trim())
      .filter(Boolean);

    if (
      !voteQuestion ||
      voteQuestion.length > 200 ||
      voteOptions.length < 2 ||
      voteOptions.length > 4
    ) {
      return NextResponse.json(
        { error: "A vote needs a question and 2-4 options." },
        { status: 400 },
      );
    }
  }

  const admin = createSupabaseAdminClient();

  // Only pool members (other than the sender) can be mentioned.
  // @all (pool owner only) expands to every other member.
  const wantsAll = Boolean(mentionAll) && member.role === "admin";
  let validMentions: string[] = [];
  if (wantsAll) {
    const allMembers = await selectAllPaged<{ user_id: string }>((from, to) =>
      admin
        .from("pool_members")
        .select("user_id")
        .eq("pool_id", poolId)
        .order("user_id", { ascending: true })
        .range(from, to),
    );
    validMentions = allMembers
      .map((row) => row.user_id)
      .filter((id) => id !== user.id);
  } else {
    const requestedMentions = [...new Set(mentions ?? [])].filter(
      (id) => id !== user.id,
    );
    if (requestedMentions.length > 0) {
      const { data: mentionedMembers } = await admin
        .from("pool_members")
        .select("user_id")
        .eq("pool_id", poolId)
        .in("user_id", requestedMentions);
      validMentions = (mentionedMembers ?? []).map((row) => row.user_id);
    }
  }

  const { data: message, error: insertError } = await admin
    .from("pool_messages")
    .insert({
      body: text,
      mentions: validMentions,
      pool_id: poolId,
      user_id: user.id,
      vote_options: voteOptions,
      vote_question: voteQuestion,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (validMentions.length > 0) {
    await notifyMentions(admin, user.id, validMentions, text, wantsAll);
  }

  return NextResponse.json({ id: message.id, ok: true });
}

export async function DELETE(request: Request) {
  const { messageId } = (await request.json()) as { messageId?: string };

  if (!messageId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: message } = await admin
    .from("pool_messages")
    .select("id,pool_id,user_id")
    .eq("id", messageId)
    .maybeSingle<{ id: string; pool_id: string; user_id: string }>();

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  // Authors can delete their own messages; the pool owner can delete any.
  if (message.user_id !== user.id) {
    const { data: member } = await supabase
      .from("pool_members")
      .select("role")
      .eq("pool_id", message.pool_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (member?.role !== "admin") {
      return NextResponse.json(
        { error: "You can only delete your own messages." },
        { status: 403 },
      );
    }
  }

  const { error } = await admin.from("pool_messages").delete().eq("id", messageId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// Push "X mentioned you" to each mentioned member — immediately when allowed,
// queued for the next quiet-hours window open otherwise (the notification cron
// delivers queued jobs and coalesces several into one).
async function notifyMentions(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  senderId: string,
  recipientIds: string[],
  text: string,
  mentionedEveryone: boolean,
) {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "mailto:notifications@worldcuppicks.app";

  if (!publicKey || !privateKey) {
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const [profiles, { data: senderProfile }, subscriptions] =
    await Promise.all([
      selectAllInChunks<QuietProfileRow>(recipientIds, (chunk, from, to) =>
        admin
          .from("profiles")
          .select(
            "id,display_name,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,timezone",
          )
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<QuietProfileRow[]>(),
      ),
      admin
        .from("profiles")
        .select("display_name")
        .eq("id", senderId)
        .single<Pick<QuietProfileRow, "display_name">>(),
      selectAllInChunks<SubscriptionRow>(recipientIds, (chunk, from, to) =>
        admin
          .from("push_subscriptions")
          .select("user_id,endpoint,p256dh,auth")
          .in("user_id", chunk)
          .order("user_id", { ascending: true })
          .range(from, to)
          .returns<SubscriptionRow[]>(),
      ),
    ]);

  const senderName = senderProfile?.display_name ?? "Someone";
  const preview = text.length > 120 ? `${text.slice(0, 117)}...` : text;
  const title = mentionedEveryone
    ? `${senderName} mentioned everyone`
    : `${senderName} mentioned you`;
  const now = new Date();
  const deferredJobs: Array<{
    body: string;
    notification_type: string;
    scheduled_for: string;
    title: string;
    url: string;
    user_id: string;
  }> = [];
  const staleEndpoints: string[] = [];

  await Promise.all(
    profiles.map(async (profile) => {
      const deferUntil = nextAllowedTime(
        {
          enabled: profile.quiet_hours_enabled ?? false,
          end: profile.quiet_hours_end ?? 23,
          start: profile.quiet_hours_start ?? 9,
          timeZone: profile.timezone,
        },
        now,
      );

      if (deferUntil) {
        deferredJobs.push({
          body: preview,
          notification_type: "chat_mention",
          scheduled_for: deferUntil.toISOString(),
          title,
          url: "/chat",
          user_id: profile.id,
        });
        return;
      }

      const userSubscriptions = subscriptions.filter(
        (subscription) => subscription.user_id === profile.id,
      );
      const payload = JSON.stringify({ body: preview, title, url: "/chat" });

      for (const subscription of userSubscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { auth: subscription.auth, p256dh: subscription.p256dh },
            },
            payload,
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            staleEndpoints.push(subscription.endpoint);
          }
        }
      }
    }),
  );

  if (deferredJobs.length > 0) {
    for (const chunk of chunkRows(deferredJobs, 1000)) {
      await admin.from("notification_jobs").insert(chunk);
    }
  }

  if (staleEndpoints.length > 0) {
    for (const chunk of chunkRows(staleEndpoints, 1000)) {
      await admin.from("push_subscriptions").delete().in("endpoint", chunk);
    }
  }
}
