"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart2, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { cn } from "@/lib/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { BootstrapData, Profile } from "@/lib/types";

type ChatMessage = {
  id: string;
  pool_id: string;
  user_id: string;
  body: string;
  mentions: string[];
  vote_question: string | null;
  vote_options: string[] | null;
  vote_closed_at: string | null;
  created_at: string;
};

type VoteResponse = {
  message_id: string;
  user_id: string;
  option_index: number;
};

function chatQueryKey(poolId: string) {
  return ["pool-chat", poolId];
}

function profileFor(data: BootstrapData, id: string): Profile | undefined {
  return data.profiles.find((profile) => profile.id === id);
}

function dayLabel(value: string) {
  return new Date(value).toLocaleDateString([], {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatView() {
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useBootstrap();
  const poolId = data?.pool.id ?? "";
  const isDemo = data?.authMode === "demo";

  const chatQuery = useQuery({
    enabled: Boolean(poolId) && !isDemo,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: messages, error: messagesError } = await supabase
        .from("pool_messages")
        .select(
          "id,pool_id,user_id,body,mentions,vote_question,vote_options,vote_closed_at,created_at",
        )
        .eq("pool_id", poolId)
        .order("created_at", { ascending: true })
        .limit(300)
        .returns<ChatMessage[]>();

      if (messagesError) {
        throw new Error(messagesError.message);
      }

      const voteIds = (messages ?? [])
        .filter((message) => message.vote_question)
        .map((message) => message.id);
      let responses: VoteResponse[] = [];
      if (voteIds.length > 0) {
        const { data: responseRows } = await supabase
          .from("pool_vote_responses")
          .select("message_id,user_id,option_index")
          .in("message_id", voteIds)
          .returns<VoteResponse[]>();
        responses = responseRows ?? [];
      }

      return { messages: messages ?? [], responses };
    },
    queryKey: chatQueryKey(poolId),
    refetchInterval: 30_000,
  });

  // Live updates: any chat change refreshes the thread.
  useEffect(() => {
    if (!poolId || isDemo) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`pool-chat-${poolId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pool_messages" },
        () => {
          void queryClient.invalidateQueries({ queryKey: chatQueryKey(poolId) });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pool_vote_responses" },
        () => {
          void queryClient.invalidateQueries({ queryKey: chatQueryKey(poolId) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [poolId, isDemo, queryClient]);

  const endRef = useRef<HTMLDivElement>(null);
  const messageCount = chatQuery.data?.messages.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount]);

  if (isLoading || !data) {
    return <LoadingState label="Loading chat" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  if (isDemo) {
    return (
      <div className="rounded-lg border border-black/10 bg-white p-4 text-sm font-bold text-stone-500">
        Chat needs a real account — it is not available in demo mode.
      </div>
    );
  }

  if (chatQuery.error) {
    return <ErrorState message={(chatQuery.error as Error).message} />;
  }

  const messages = chatQuery.data?.messages ?? [];
  const responses = chatQuery.data?.responses ?? [];
  const isOwner = data.currentMemberRole === "admin";

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {chatQuery.isLoading ? <LoadingState label="Loading messages" /> : null}
        {!chatQuery.isLoading && messages.length === 0 ? (
          <div className="rounded-lg border border-black/10 bg-white p-4 text-center text-sm font-bold text-stone-500">
            No messages yet. Say hi to the pool! 👋
          </div>
        ) : null}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const showDay =
            !previous ||
            new Date(previous.created_at).toDateString() !==
              new Date(message.created_at).toDateString();
          return (
            <div key={message.id}>
              {showDay ? (
                <p className="my-3 text-center text-[10px] font-black uppercase tracking-wide text-stone-400">
                  {dayLabel(message.created_at)}
                </p>
              ) : null}
              <MessageBubble
                data={data}
                isOwner={isOwner}
                message={message}
                responses={responses}
              />
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <Composer data={data} isOwner={isOwner} poolId={poolId} />
    </div>
  );
}

function MessageBubble({
  data,
  isOwner,
  message,
  responses,
}: {
  data: BootstrapData;
  isOwner: boolean;
  message: ChatMessage;
  responses: VoteResponse[];
}) {
  const profile = profileFor(data, message.user_id);
  const mine = message.user_id === data.currentUserId;
  const mentionsMe = message.mentions.includes(data.currentUserId);

  return (
    <div className={cn("flex gap-2", mine ? "flex-row-reverse" : "flex-row")}>
      <div className="shrink-0 pt-1">
        <Avatar
          color={profile?.avatarColor ?? "#064e3b"}
          imageUrl={profile?.avatarUrl}
          name={profile?.displayName ?? "?"}
        />
      </div>
      <div
        className={cn(
          "min-w-0 max-w-[85%] rounded-lg border p-3",
          mine
            ? "border-emerald-900/20 bg-emerald-950 text-white"
            : "border-black/10 bg-white",
          mentionsMe && !mine ? "ring-2 ring-amber-400" : "",
        )}
      >
        <p
          className={cn(
            "text-xs font-black",
            mine ? "text-emerald-200" : "text-stone-500",
          )}
        >
          {profile?.displayName ?? "Former member"}
          <span className="ml-2 font-bold opacity-70">
            {timeLabel(message.created_at)}
          </span>
        </p>
        {message.vote_question && message.vote_options ? (
          <VoteCard
            data={data}
            isOwner={isOwner}
            message={message}
            mine={mine}
            responses={responses}
          />
        ) : (
          <p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold">
            <MentionText data={data} text={message.body} mine={mine} />
          </p>
        )}
      </div>
    </div>
  );
}

// Highlight @DisplayName tokens for known pool members.
function MentionText({
  data,
  mine,
  text,
}: {
  data: BootstrapData;
  mine: boolean;
  text: string;
}) {
  const names = data.profiles
    .map((profile) => profile.displayName)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) {
    return <>{text}</>;
  }

  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`@(?:all\\b|${escaped.join("|")})`, "g");
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
    if (start > last) {
      parts.push(text.slice(last, start));
    }
    parts.push(
      <span
        className={cn(
          "rounded px-1 font-black",
          mine ? "bg-emerald-800 text-emerald-100" : "bg-amber-100 text-amber-900",
        )}
        key={`${start}-${match[0]}`}
      >
        {match[0]}
      </span>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return <>{parts}</>;
}

function VoteCard({
  data,
  isOwner,
  message,
  mine,
  responses,
}: {
  data: BootstrapData;
  isOwner: boolean;
  message: ChatMessage;
  mine: boolean;
  responses: VoteResponse[];
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const options = message.vote_options ?? [];
  const voteResponses = responses.filter(
    (response) => response.message_id === message.id,
  );
  const myResponse = voteResponses.find(
    (response) => response.user_id === data.currentUserId,
  );
  const closed = Boolean(message.vote_closed_at);
  const counts = options.map(
    (_, index) =>
      voteResponses.filter((response) => response.option_index === index).length,
  );
  const total = voteResponses.length;
  const leader = Math.max(...counts, 1);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: chatQueryKey(message.pool_id) });
  }

  async function castVote(optionIndex: number) {
    if (closed || busy) {
      return;
    }
    setBusy(true);
    await fetch("/api/chat/votes", {
      body: JSON.stringify({ messageId: message.id, optionIndex }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    await refresh();
    setBusy(false);
  }

  async function closeVote() {
    setBusy(true);
    await fetch("/api/chat/votes", {
      body: JSON.stringify({ messageId: message.id }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    await refresh();
    setBusy(false);
  }

  return (
    <div className="mt-1">
      <p className="flex items-center gap-1.5 text-sm font-black">
        <BarChart2 size={15} />
        {message.vote_question}
      </p>
      <div className="mt-2 space-y-1.5">
        {options.map((option, index) => {
          const count = counts[index];
          const isMyPick = myResponse?.option_index === index;
          return (
            <button
              className={cn(
                "relative block w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm font-bold",
                mine ? "border-white/20" : "border-black/10",
                isMyPick ? "ring-2 ring-amber-400" : "",
                closed ? "cursor-default opacity-90" : "",
              )}
              disabled={busy || closed}
              key={option}
              onClick={() => castVote(index)}
              type="button"
            >
              <span
                className={cn(
                  "absolute inset-y-0 left-0",
                  mine ? "bg-emerald-800" : "bg-emerald-100",
                )}
                style={{ width: `${(count / leader) * 100}%` }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span>
                  {option}
                  {isMyPick ? " ✓" : ""}
                </span>
                <span className="text-xs opacity-70">{count}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className={cn("mt-1.5 text-xs font-bold", mine ? "text-emerald-200" : "text-stone-500")}>
        {total} vote{total === 1 ? "" : "s"}
        {closed ? " · closed" : ""}
      </p>
      {isOwner && !closed ? (
        <button
          className={cn(
            "mt-1 text-xs font-black underline",
            mine ? "text-emerald-200" : "text-stone-500",
          )}
          disabled={busy}
          onClick={closeVote}
          type="button"
        >
          Close vote
        </button>
      ) : null}
    </div>
  );
}

function Composer({
  data,
  isOwner,
  poolId,
}: {
  data: BootstrapData;
  isOwner: boolean;
  poolId: string;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showVoteForm, setShowVoteForm] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const members = useMemo(
    () =>
      data.members
        .map((member) => profileFor(data, member.userId))
        .filter((profile): profile is Profile => Boolean(profile))
        .filter((profile) => profile.id !== data.currentUserId),
    [data],
  );

  const suggestions =
    mentionQuery === null
      ? []
      : members.filter((profile) =>
          profile.displayName.toLowerCase().startsWith(mentionQuery.toLowerCase()),
        );
  const suggestAll =
    isOwner &&
    mentionQuery !== null &&
    "all".startsWith(mentionQuery.toLowerCase());

  function handleChange(value: string, caret: number) {
    setText(value);
    const beforeCaret = value.slice(0, caret);
    const match = beforeCaret.match(/@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
  }

  function insertMentionToken(token: string) {
    const element = inputRef.current;
    const caret = element?.selectionStart ?? text.length;
    const beforeCaret = text.slice(0, caret).replace(/@[^\s@]*$/, `@${token} `);
    const next = beforeCaret + text.slice(caret);
    setText(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(beforeCaret.length, beforeCaret.length);
    });
  }

  function pickMention(profile: Profile) {
    insertMentionToken(profile.displayName);
    setMentionIds((current) =>
      current.includes(profile.id) ? current : [...current, profile.id],
    );
  }

  async function send(vote?: { question: string; options: string[] }) {
    const body = text.trim();
    if (!body || sending) {
      return;
    }

    setSending(true);
    setErrorMessage("");

    // Only keep mentions whose @Name is still present in the final text.
    const mentions = mentionIds.filter((id) => {
      const profile = profileFor(data, id);
      return profile && body.includes(`@${profile.displayName}`);
    });
    const mentionAll = isOwner && /(^|\s)@all\b/.test(body);

    const response = await fetch("/api/chat", {
      body: JSON.stringify({ body, mentionAll, mentions, poolId, vote }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setErrorMessage(payload.error ?? "Could not send message.");
      setSending(false);
      return;
    }

    setText("");
    setMentionIds([]);
    setMentionQuery(null);
    setShowVoteForm(false);
    await queryClient.invalidateQueries({ queryKey: chatQueryKey(poolId) });
    setSending(false);
  }

  return (
    <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 rounded-lg border border-black/10 bg-white p-2 shadow-lg md:bottom-4">
      {suggestions.length > 0 || suggestAll ? (
        <div className="mb-2 overflow-hidden rounded-md border border-black/10">
          {suggestAll ? (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold hover:bg-stone-100"
              onClick={() => insertMentionToken("all")}
              type="button"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-100 text-[11px] font-black text-amber-900">
                @
              </span>
              all
              <span className="font-bold text-stone-400">— notify everyone</span>
            </button>
          ) : null}
          {suggestions.slice(0, 4).map((profile) => (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold hover:bg-stone-100"
              key={profile.id}
              onClick={() => pickMention(profile)}
              type="button"
            >
              <Avatar
                color={profile.avatarColor}
                imageUrl={profile.avatarUrl}
                name={profile.displayName}
                size="sm"
              />
              {profile.displayName}
            </button>
          ))}
        </div>
      ) : null}

      {showVoteForm ? (
        <VoteForm
          onCancel={() => setShowVoteForm(false)}
          onSubmit={(question, options) => void sendVote(question, options)}
          sending={sending}
        />
      ) : (
        <div className="flex items-end gap-2">
          {isOwner ? (
            <button
              aria-label="Start a vote"
              className="grid size-11 shrink-0 place-items-center rounded-md bg-stone-100 text-stone-600"
              onClick={() => setShowVoteForm(true)}
              type="button"
            >
              <BarChart2 size={20} />
            </button>
          ) : null}
          <textarea
            className="max-h-32 min-h-[44px] w-full resize-none rounded-md border border-black/15 px-3 py-2.5 text-sm font-bold outline-none focus:border-emerald-700"
            onChange={(event) =>
              handleChange(event.target.value, event.target.selectionStart ?? 0)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="Message... @ to mention"
            ref={inputRef}
            rows={1}
            value={text}
          />
          <button
            aria-label="Send message"
            className="grid size-11 shrink-0 place-items-center rounded-md bg-emerald-950 text-white disabled:bg-stone-300"
            disabled={sending || !text.trim()}
            onClick={() => void send()}
            type="button"
          >
            <Send size={18} />
          </button>
        </div>
      )}
      {errorMessage ? (
        <p className="mt-1 px-1 text-xs font-bold text-red-700">{errorMessage}</p>
      ) : null}
    </div>
  );

  async function sendVote(question: string, options: string[]) {
    if (sending) {
      return;
    }
    setSending(true);
    setErrorMessage("");

    const response = await fetch("/api/chat", {
      body: JSON.stringify({
        body: question,
        mentions: [],
        poolId,
        vote: { options, question },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setErrorMessage(payload.error ?? "Could not start the vote.");
      setSending(false);
      return;
    }

    setText("");
    setShowVoteForm(false);
    await queryClient.invalidateQueries({ queryKey: chatQueryKey(poolId) });
    setSending(false);
  }
}

function VoteForm({
  onCancel,
  onSubmit,
  sending,
}: {
  onCancel: () => void;
  onSubmit: (question: string, options: string[]) => void;
  sending: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const cleaned = options.map((option) => option.trim()).filter(Boolean);
  const valid = question.trim().length >= 2 && cleaned.length >= 2;

  return (
    <div className="space-y-2 p-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black">Start a vote</p>
        <button
          aria-label="Cancel vote"
          className="grid size-8 place-items-center rounded-md text-stone-500 hover:bg-stone-100"
          onClick={onCancel}
          type="button"
        >
          <X size={16} />
        </button>
      </div>
      <input
        className="input"
        maxLength={200}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Question, e.g. Dinner at the final?"
        value={question}
      />
      {options.map((option, index) => (
        <input
          className="input"
          key={index}
          maxLength={80}
          onChange={(event) =>
            setOptions((current) =>
              current.map((value, i) => (i === index ? event.target.value : value)),
            )
          }
          placeholder={`Option ${index + 1}`}
          value={option}
        />
      ))}
      <div className="flex gap-2">
        {options.length < 4 ? (
          <button
            className="h-10 flex-1 rounded-md bg-stone-100 text-xs font-black uppercase text-stone-600"
            onClick={() => setOptions((current) => [...current, ""])}
            type="button"
          >
            Add option
          </button>
        ) : null}
        <button
          className="h-10 flex-1 rounded-md bg-emerald-950 text-xs font-black uppercase text-white disabled:bg-stone-300 disabled:text-stone-500"
          disabled={!valid || sending}
          onClick={() => onSubmit(question.trim(), cleaned)}
          type="button"
        >
          {sending ? "Posting..." : "Post vote"}
        </button>
      </div>
    </div>
  );
}
