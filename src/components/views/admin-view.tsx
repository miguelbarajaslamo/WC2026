"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Check,
  ClipboardList,
  Copy,
  Goal,
  KeyRound,
  PlusCircle,
  RotateCw,
  Save,
  Shield,
  Ticket,
  Trash2,
  UserMinus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { MemberAdminCard } from "@/components/views/member-admin-card";
import { ScoringStagesCard } from "@/components/views/scoring-stages-card";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { Flag } from "@/components/ui/flag";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import {
  getMatchEvents,
  getProfile,
  getTeam,
  getVisibleMatches,
} from "@/lib/data/selectors";
import { scoreText } from "@/lib/format";
import { formatMatchTiming } from "@/lib/time";
import { specialLabels } from "@/lib/specials";
import type { BonusPickType, EventType, MatchStatus } from "@/lib/types";

type MatchFormState = {
  awayPenaltyScore: string;
  awayScore: string;
  awayTeamId: string;
  city: string;
  elapsedMinutes: string;
  homeTeamId: string;
  homePenaltyScore: string;
  homeScore: string;
  kickoffAt: string;
  lockAt: string;
  providerStatusCode: string;
  status: MatchStatus;
  venue: string;
};

type EventFormState = {
  assistName: string;
  detail: string;
  eventType: EventType;
  minute: string;
  playerName: string;
  stoppageMinute: string;
  teamId: string;
};

type PlayerStatFormState = {
  assists: string;
  goals: string;
  minutes: string;
  playerName: string;
  redCards: string;
  saves: string;
  teamId: string;
  yellowCards: string;
};

type BonusWinnerFormState = {
  optionId: string;
  slot: string;
  type: BonusPickType;
};

type InviteRow = {
  code: string;
  created_at: string;
  expires_at: string | null;
  id: string;
  max_uses: number | null;
  revoked_at: string | null;
  use_count: number;
};

const matchStatuses: MatchStatus[] = [
  "scheduled",
  "live",
  "halftime",
  "finished",
  "postponed",
  "cancelled",
];

const eventTypes: EventType[] = ["goal", "yellow_card", "red_card", "substitution"];

const bonusTypes: BonusPickType[] = [
  "champion",
  "finalist",
  "top_scorer",
  "most_assists",
  "most_cards_country",
];

function toInputDateTime(iso?: string) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromInputDateTime(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function nullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrZero(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchFormFromMatch(match: {
  awayPenaltyScore?: number;
  awayScore?: number;
  awayTeamId: string;
  city: string;
  elapsedMinutes?: number;
  homeTeamId: string;
  homePenaltyScore?: number;
  homeScore?: number;
  kickoffAt: string;
  predictionLockAt: string;
  providerStatusCode: string;
  status: MatchStatus;
  venue: string;
}): MatchFormState {
  return {
    awayPenaltyScore:
      match.awayPenaltyScore === undefined ? "" : String(match.awayPenaltyScore),
    awayScore: match.awayScore === undefined ? "" : String(match.awayScore),
    awayTeamId: match.awayTeamId,
    city: match.city,
    elapsedMinutes:
      match.elapsedMinutes === undefined ? "" : String(match.elapsedMinutes),
    homeTeamId: match.homeTeamId,
    homePenaltyScore:
      match.homePenaltyScore === undefined ? "" : String(match.homePenaltyScore),
    homeScore: match.homeScore === undefined ? "" : String(match.homeScore),
    kickoffAt: toInputDateTime(match.kickoffAt),
    lockAt: toInputDateTime(match.predictionLockAt),
    providerStatusCode: match.providerStatusCode,
    status: match.status,
    venue: match.venue,
  };
}

function emptyMatchForm(): MatchFormState {
  return {
    awayPenaltyScore: "",
    awayScore: "",
    awayTeamId: "",
    city: "",
    elapsedMinutes: "",
    homeTeamId: "",
    homePenaltyScore: "",
    homeScore: "",
    kickoffAt: "",
    lockAt: "",
    providerStatusCode: "",
    status: "scheduled",
    venue: "",
  };
}

function jsonPreview(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AdminView() {
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useBootstrap();
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [matchEdits, setMatchEdits] = useState<Record<string, Partial<MatchFormState>>>({});
  const [eventForm, setEventForm] = useState<EventFormState>({
    assistName: "",
    detail: "",
    eventType: "goal",
    minute: "",
    playerName: "",
    stoppageMinute: "",
    teamId: "",
  });
  const [playerStatForm, setPlayerStatForm] = useState<PlayerStatFormState>({
    assists: "0",
    goals: "0",
    minutes: "0",
    playerName: "",
    redCards: "0",
    saves: "0",
    teamId: "",
    yellowCards: "0",
  });
  const [bonusForm, setBonusForm] = useState<BonusWinnerFormState>({
    optionId: "",
    slot: "1",
    type: "champion",
  });
  const [reason, setReason] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "ok" } | null>(
    null,
  );
  const invitesQuery = useQuery({
    enabled: Boolean(data?.pool.id && data.currentMemberRole === "admin"),
    queryFn: async () => {
      const poolId = data?.pool.id ?? "";
      const response = await fetch(`/api/admin/invites?poolId=${poolId}`);
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        invites?: InviteRow[];
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not load invites");
      }

      return body.invites ?? [];
    },
    queryKey: ["admin-invites", data?.pool.id],
  });

  const matches = useMemo(() => (data ? getVisibleMatches(data) : []), [data]);
  const effectiveSelectedMatchId = selectedMatchId || matches[0]?.id || "";
  const selectedMatch = matches.find((match) => match.id === effectiveSelectedMatchId);
  const matchEvents =
    data && selectedMatch ? getMatchEvents(data, selectedMatch.id) : [];
  const currentUserIsAdmin = data?.currentMemberRole === "admin";

  if (isLoading || !data) {
    return <LoadingState label="Loading admin" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const bootstrap = data;

  if (!currentUserIsAdmin) {
    return (
      <ErrorState message="Admin access is required for correction tools." />
    );
  }

  const selectedTeams = selectedMatch
    ? [getTeam(data, selectedMatch.homeTeamId), getTeam(data, selectedMatch.awayTeamId)]
    : [];
  const selectedTeamIds = new Set(selectedTeams.map((team) => team.id));
  const teamPlayers = data.squadMembers
    .flatMap((member) => {
      if (!selectedTeamIds.has(member.teamId)) {
        return [];
      }

      const player = data.players.find((item) => item.id === member.playerId);
      const team = data.teams.find((item) => item.id === member.teamId);
      return player && team ? [{ player, team }] : [];
    });
  const bonusOptions = data.bonusPickOptions.filter(
    (option) => option.type === bonusForm.type,
  );
  const matchForm = selectedMatch
    ? { ...matchFormFromMatch(selectedMatch), ...(matchEdits[selectedMatch.id] ?? {}) }
    : emptyMatchForm();
  const eventTeamId =
    selectedMatch &&
    (eventForm.teamId === selectedMatch.homeTeamId ||
      eventForm.teamId === selectedMatch.awayTeamId)
      ? eventForm.teamId
      : selectedMatch?.homeTeamId ?? "";
  const playerStatTeamId =
    selectedMatch &&
    (playerStatForm.teamId === selectedMatch.homeTeamId ||
      playerStatForm.teamId === selectedMatch.awayTeamId)
      ? playerStatForm.teamId
      : selectedMatch?.homeTeamId ?? "";
  const effectiveBonusOptionId = bonusOptions.some(
    (option) => option.id === bonusForm.optionId,
  )
    ? bonusForm.optionId
    : bonusOptions[0]?.id ?? "";

  function updateMatchForm(patch: Partial<MatchFormState>) {
    if (!selectedMatch) {
      return;
    }

    setMatchEdits((current) => ({
      ...current,
      [selectedMatch.id]: {
        ...(current[selectedMatch.id] ?? {}),
        ...patch,
      },
    }));
  }

  async function submitOverride({
    actionLabel,
    matchId = selectedMatch?.id,
    overrideType,
    payload,
  }: {
    actionLabel: string;
    matchId?: string;
    overrideType:
      | "bonus_winner"
      | "event_delete"
      | "event_upsert"
      | "match"
      | "player_stat"
      | "recalculate_all"
      | "recalculate_match";
    payload: Record<string, unknown>;
  }) {
    setPendingAction(actionLabel);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/overrides", {
        body: JSON.stringify({
          matchId,
          overrideType,
          payload,
          poolId: bootstrap.pool.id,
          reason,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "Admin action failed");
      }

      setNotice({ text: `${actionLabel} applied.`, tone: "ok" });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    } catch (submitError) {
      setNotice({
        text:
          submitError instanceof Error
            ? submitError.message
            : "Admin action failed.",
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function createInvite() {
    setPendingAction("Create invite");
    setNotice(null);

    try {
      const response = await fetch("/api/admin/invites", {
        body: JSON.stringify({ poolId: bootstrap.pool.id }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not create invite");
      }

      setNotice({ text: "Invite created.", tone: "ok" });
      await invitesQuery.refetch();
    } catch (actionError) {
      setNotice({
        text:
          actionError instanceof Error
            ? actionError.message
            : "Could not create invite.",
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function setInviteRevoked(inviteId: string, revoked: boolean) {
    setPendingAction("Update invite");
    setNotice(null);

    try {
      const response = await fetch("/api/admin/invites", {
        body: JSON.stringify({ inviteId, poolId: bootstrap.pool.id, revoked }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not update invite");
      }

      setNotice({ text: revoked ? "Invite revoked." : "Invite reactivated.", tone: "ok" });
      await invitesQuery.refetch();
    } catch (actionError) {
      setNotice({
        text:
          actionError instanceof Error
            ? actionError.message
            : "Could not update invite.",
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function copyInvite(invite: InviteRow) {
    const url = `${window.location.origin}/invite/${invite.code}`;
    await navigator.clipboard.writeText(url);
    setCopiedInviteId(invite.id);
    window.setTimeout(() => setCopiedInviteId(null), 2000);
  }

  async function removeMember(userId: string) {
    const profile = getProfile(bootstrap, userId);

    if (!window.confirm(`Remove ${profile.displayName} from this pool?`)) {
      return;
    }

    setPendingAction("Remove member");
    setNotice(null);

    try {
      const response = await fetch("/api/admin/members", {
        body: JSON.stringify({ poolId: bootstrap.pool.id, userId }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not remove member");
      }

      setNotice({ text: `${profile.displayName} removed from the pool.`, tone: "ok" });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
    } catch (actionError) {
      setNotice({
        text:
          actionError instanceof Error
            ? actionError.message
            : "Could not remove member.",
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-stone-950 p-4 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
          Admin
        </p>
        <h2 className="mt-1 text-2xl font-black">Control room</h2>
        <p className="mt-2 text-sm font-bold text-white/65">
          Hotfix scores, events, player stats, special winners, and scoring
          snapshots.
        </p>
      </section>

      <ScoringStagesCard data={bootstrap} />

      <MemberAdminCard data={bootstrap} />

      {notice ? (
        <div
          className={
            notice.tone === "ok"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-950"
              : "rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-black text-red-900"
          }
        >
          {notice.text}
        </div>
      ) : null}

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <PanelTitle icon={<Ticket size={19} />} title="Pool invites" />
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-950 px-3 text-xs font-black uppercase text-white disabled:bg-stone-300 disabled:text-stone-500"
            disabled={pendingAction !== null}
            onClick={() => void createInvite()}
            type="button"
          >
            <PlusCircle size={15} />
            New
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {invitesQuery.isLoading ? (
            <p className="rounded-md bg-stone-50 p-3 text-sm font-bold text-stone-500">
              Loading invites...
            </p>
          ) : invitesQuery.data && invitesQuery.data.length > 0 ? (
            invitesQuery.data.map((invite) => {
              const revoked = Boolean(invite.revoked_at);
              const copied = copiedInviteId === invite.id;

              return (
                <div
                  className="rounded-md border border-black/10 bg-stone-50 p-3"
                  key={invite.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xl font-black tracking-widest">
                        {invite.code}
                      </p>
                      <p className="text-xs font-bold text-stone-500">
                        Used {invite.use_count}
                        {invite.max_uses ? `/${invite.max_uses}` : ""} ·{" "}
                        {revoked ? "Revoked" : "Active"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        className="grid size-9 place-items-center rounded-md bg-white text-stone-950 ring-1 ring-black/10"
                        onClick={() => void copyInvite(invite)}
                        type="button"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                      <button
                        className={
                          revoked
                            ? "rounded-md bg-emerald-100 px-3 py-2 text-xs font-black uppercase text-emerald-900"
                            : "rounded-md bg-red-50 px-3 py-2 text-xs font-black uppercase text-red-800"
                        }
                        disabled={pendingAction !== null}
                        onClick={() => void setInviteRevoked(invite.id, !revoked)}
                        type="button"
                      >
                        {revoked ? "Reactivate" : "Revoke"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-md bg-stone-50 p-3 text-sm font-bold text-stone-500">
              No invites yet. Create one to share the pool.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <PanelTitle icon={<UserMinus size={19} />} title="Pool members" />
        <div className="mt-3 space-y-2">
          {bootstrap.members.map((member) => {
            const profile = getProfile(bootstrap, member.userId);
            const isCurrentUser = member.userId === bootstrap.currentUserId;

            return (
              <div
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-black/10 bg-stone-50 p-3"
                key={member.userId}
              >
                <div className="min-w-0">
                  <p className="truncate font-black">{profile.displayName}</p>
                  <p className="text-xs font-bold uppercase text-stone-500">
                    {member.role}
                  </p>
                </div>
                <button
                  className="rounded-md bg-red-50 px-3 py-2 text-xs font-black uppercase text-red-800 disabled:bg-stone-100 disabled:text-stone-400"
                  disabled={isCurrentUser || pendingAction !== null}
                  onClick={() => void removeMember(member.userId)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {bootstrap.currentUserIsSystemAdmin ? (
        <>
      <section className="rounded-lg border border-black/10 bg-white p-4">
        <div className="flex items-center gap-2">
          <KeyRound size={19} />
          <h2 className="font-black">Correction target</h2>
        </div>
        <label className="mt-3 block text-xs font-black uppercase tracking-wide text-stone-500">
          Match
        </label>
        <select
          className="mt-1 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm font-bold"
          onChange={(event) => setSelectedMatchId(event.target.value)}
          value={effectiveSelectedMatchId}
        >
          {matches.map((match) => {
            const home = getTeam(data, match.homeTeamId);
            const away = getTeam(data, match.awayTeamId);
            return (
              <option key={match.id} value={match.id}>
                {home.shortName} vs {away.shortName} ·{" "}
                {formatMatchTiming({
                  kickoffAt: match.kickoffAt,
                  lockAt: match.predictionLockAt,
                })}
              </option>
            );
          })}
        </select>

        {selectedMatch ? (
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md bg-stone-50 p-3">
            <TeamBadge team={selectedTeams[0]} />
            <span className="font-mono text-lg font-black">
              {scoreText(selectedMatch)}
            </span>
            <TeamBadge align="right" team={selectedTeams[1]} />
          </div>
        ) : null}

        <label className="mt-3 block text-xs font-black uppercase tracking-wide text-stone-500">
          Audit note
        </label>
        <input
          className="mt-1 w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm font-bold"
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why this was changed"
          value={reason}
        />
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <PanelTitle icon={<ClipboardList size={19} />} title="Match override" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Home score">
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) =>
                updateMatchForm({
                  homeScore: event.target.value,
                })
              }
              value={matchForm.homeScore}
            />
          </Field>
          <Field label="Away score">
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) =>
                updateMatchForm({
                  awayScore: event.target.value,
                })
              }
              value={matchForm.awayScore}
            />
          </Field>
          <Field label="Home pens">
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) =>
                updateMatchForm({
                  homePenaltyScore: event.target.value,
                })
              }
              value={matchForm.homePenaltyScore}
            />
          </Field>
          <Field label="Away pens">
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) =>
                updateMatchForm({
                  awayPenaltyScore: event.target.value,
                })
              }
              value={matchForm.awayPenaltyScore}
            />
          </Field>
          <Field label="Status">
            <select
              className="input"
              onChange={(event) =>
                updateMatchForm({
                  status: event.target.value as MatchStatus,
                })
              }
              value={matchForm.status}
            >
              {matchStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Home team">
            <select
              className="input"
              onChange={(event) =>
                updateMatchForm({ homeTeamId: event.target.value })
              }
              value={matchForm.homeTeamId}
            >
              {data.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.shortName} · {team.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Away team">
            <select
              className="input"
              onChange={(event) =>
                updateMatchForm({ awayTeamId: event.target.value })
              }
              value={matchForm.awayTeamId}
            >
              {data.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.shortName} · {team.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Elapsed">
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) =>
                updateMatchForm({
                  elapsedMinutes: event.target.value,
                })
              }
              value={matchForm.elapsedMinutes}
            />
          </Field>
          <Field label="Kickoff">
            <input
              className="input"
              onChange={(event) =>
                updateMatchForm({
                  kickoffAt: event.target.value,
                })
              }
              type="datetime-local"
              value={matchForm.kickoffAt}
            />
          </Field>
          <Field label="Lock">
            <input
              className="input"
              onChange={(event) =>
                updateMatchForm({ lockAt: event.target.value })
              }
              type="datetime-local"
              value={matchForm.lockAt}
            />
          </Field>
          <Field label="Venue">
            <input
              className="input"
              onChange={(event) =>
                updateMatchForm({ venue: event.target.value })
              }
              value={matchForm.venue}
            />
          </Field>
          <Field label="City">
            <input
              className="input"
              onChange={(event) =>
                updateMatchForm({ city: event.target.value })
              }
              value={matchForm.city}
            />
          </Field>
        </div>
        <AdminButton
          disabled={!selectedMatch || pendingAction !== null}
          icon={<Save size={16} />}
          label="Save match correction"
          loading={pendingAction === "Match correction"}
          onClick={() =>
            submitOverride({
              actionLabel: "Match correction",
              overrideType: "match",
              payload: {
                away_penalty_score: nullableNumber(matchForm.awayPenaltyScore),
                away_score: nullableNumber(matchForm.awayScore),
                away_team_id: matchForm.awayTeamId,
                city: matchForm.city,
                elapsed_minutes: nullableNumber(matchForm.elapsedMinutes),
                home_penalty_score: nullableNumber(matchForm.homePenaltyScore),
                home_score: nullableNumber(matchForm.homeScore),
                home_team_id: matchForm.homeTeamId,
                kickoff_at: fromInputDateTime(matchForm.kickoffAt),
                prediction_lock_at: fromInputDateTime(matchForm.lockAt),
                provider_status_code: matchForm.providerStatusCode,
                status: matchForm.status,
                venue: matchForm.venue,
              },
            })
          }
        />
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <PanelTitle icon={<Goal size={19} />} title="Events" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Team">
            <select
              className="input"
              onChange={(event) =>
                setEventForm((current) => ({ ...current, teamId: event.target.value }))
              }
              value={eventTeamId}
            >
              {selectedTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.shortName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select
              className="input"
              onChange={(event) =>
                setEventForm((current) => ({
                  ...current,
                  eventType: event.target.value as EventType,
                }))
              }
              value={eventForm.eventType}
            >
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minute">
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) =>
                setEventForm((current) => ({ ...current, minute: event.target.value }))
              }
              value={eventForm.minute}
            />
          </Field>
          <Field label="Stoppage">
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) =>
                setEventForm((current) => ({
                  ...current,
                  stoppageMinute: event.target.value,
                }))
              }
              value={eventForm.stoppageMinute}
            />
          </Field>
          <Field label="Player">
            <input
              className="input"
              list="admin-event-players"
              onChange={(event) =>
                setEventForm((current) => ({
                  ...current,
                  playerName: event.target.value,
                }))
              }
              value={eventForm.playerName}
            />
          </Field>
          <Field label="Assist">
            <input
              className="input"
              list="admin-event-players"
              onChange={(event) =>
                setEventForm((current) => ({
                  ...current,
                  assistName: event.target.value,
                }))
              }
              value={eventForm.assistName}
            />
          </Field>
          <Field className="col-span-2" label="Detail">
            <input
              className="input"
              onChange={(event) =>
                setEventForm((current) => ({ ...current, detail: event.target.value }))
              }
              placeholder="Penalty, own goal, VAR correction..."
              value={eventForm.detail}
            />
          </Field>
        </div>
        <datalist id="admin-event-players">
          {teamPlayers.map(({ player, team }) => (
            <option key={`${team.id}-${player.id}`} value={player.name}>
              {team.shortName}
            </option>
          ))}
        </datalist>
        <AdminButton
          disabled={!selectedMatch || pendingAction !== null}
          icon={<Save size={16} />}
          label="Add or edit event"
          loading={pendingAction === "Event correction"}
          onClick={() =>
            submitOverride({
              actionLabel: "Event correction",
              overrideType: "event_upsert",
              payload: {
                assistName: eventForm.assistName,
                detail: eventForm.detail,
                eventType: eventForm.eventType,
                minute: numberOrZero(eventForm.minute),
                playerName: eventForm.playerName,
                stoppageMinute: nullableNumber(eventForm.stoppageMinute),
                teamId: eventTeamId,
              },
            })
          }
        />
        <div className="mt-4 space-y-2">
          {matchEvents.length === 0 ? (
            <p className="rounded-md bg-stone-50 p-3 text-sm font-bold text-stone-500">
              No events synced for this match yet.
            </p>
          ) : (
            matchEvents.map((event) => {
              const team = data.teams.find((item) => item.id === event.teamId);
              return (
                <div
                  className="flex items-center justify-between gap-3 rounded-md border border-black/10 bg-stone-50 p-3"
                  key={event.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">
                      {event.minute}&apos; {team?.shortName ?? "TBD"} · {event.type}
                    </p>
                    <p className="truncate text-xs font-bold text-stone-500">
                      {event.playerName}
                      {event.assistName ? ` · Assist ${event.assistName}` : ""}
                    </p>
                  </div>
                  <button
                    className="grid size-9 shrink-0 place-items-center rounded-md bg-red-50 text-red-800"
                    disabled={pendingAction !== null}
                    onClick={() =>
                      submitOverride({
                        actionLabel: "Event delete",
                        overrideType: "event_delete",
                        payload: { eventId: event.id },
                      })
                    }
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <PanelTitle icon={<Shield size={19} />} title="Player stats and cards" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Team">
            <select
              className="input"
              onChange={(event) =>
                setPlayerStatForm((current) => ({
                  ...current,
                  teamId: event.target.value,
                }))
              }
              value={playerStatTeamId}
            >
              {selectedTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.shortName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Player">
            <input
              className="input"
              list="admin-stat-players"
              onChange={(event) =>
                setPlayerStatForm((current) => ({
                  ...current,
                  playerName: event.target.value,
                }))
              }
              value={playerStatForm.playerName}
            />
          </Field>
          {(["goals", "assists", "yellowCards", "redCards", "minutes", "saves"] as const).map(
            (field) => (
              <Field key={field} label={field}>
                <input
                  className="input"
                  inputMode="numeric"
                  onChange={(event) =>
                    setPlayerStatForm((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                  value={playerStatForm[field]}
                />
              </Field>
            ),
          )}
        </div>
        <datalist id="admin-stat-players">
          {teamPlayers.map(({ player, team }) => (
            <option key={`${team.id}-${player.id}`} value={player.name}>
              {team.shortName}
            </option>
          ))}
        </datalist>
        <AdminButton
          disabled={!selectedMatch || !playerStatForm.playerName || pendingAction !== null}
          icon={<Save size={16} />}
          label="Save player stat"
          loading={pendingAction === "Player stat correction"}
          onClick={() =>
            submitOverride({
              actionLabel: "Player stat correction",
              overrideType: "player_stat",
              payload: {
                assists: numberOrZero(playerStatForm.assists),
                goals: numberOrZero(playerStatForm.goals),
                minutes: numberOrZero(playerStatForm.minutes),
                playerName: playerStatForm.playerName,
                redCards: numberOrZero(playerStatForm.redCards),
                saves: numberOrZero(playerStatForm.saves),
                teamId: playerStatTeamId,
                yellowCards: numberOrZero(playerStatForm.yellowCards),
              },
            })
          }
        />
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <PanelTitle icon={<Shield size={19} />} title="Special winners" />
        <div className="mt-3 grid grid-cols-[1fr_72px] gap-3">
          <Field label="Special">
            <select
              className="input"
              onChange={(event) => {
                const type = event.target.value as BonusPickType;
                const firstOption = data.bonusPickOptions.find(
                  (option) => option.type === type,
                );
                setBonusForm({
                  optionId: firstOption?.id ?? "",
                  slot: type === "finalist" ? "1" : "1",
                  type,
                });
              }}
              value={bonusForm.type}
            >
              {bonusTypes.map((type) => (
                <option key={type} value={type}>
                  {specialLabels[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Slot">
            <select
              className="input"
              disabled={bonusForm.type !== "finalist"}
              onChange={(event) =>
                setBonusForm((current) => ({ ...current, slot: event.target.value }))
              }
              value={bonusForm.slot}
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </Field>
          <Field className="col-span-2" label="Winner">
            <select
              className="input"
              onChange={(event) =>
                setBonusForm((current) => ({ ...current, optionId: event.target.value }))
              }
              value={effectiveBonusOptionId}
            >
              {bonusOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <AdminButton
          disabled={!effectiveBonusOptionId || pendingAction !== null}
          icon={<Save size={16} />}
          label="Set special winner"
          loading={pendingAction === "Special winner"}
          onClick={() =>
            submitOverride({
              actionLabel: "Special winner",
              matchId: undefined,
              overrideType: "bonus_winner",
              payload: {
                optionId: effectiveBonusOptionId,
                slot: Number(bonusForm.slot),
                type: bonusForm.type,
              },
            })
          }
        />
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <PanelTitle icon={<RotateCw size={19} />} title="Recalculate" />
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <AdminButton
            disabled={!selectedMatch || pendingAction !== null}
            icon={<RotateCw size={16} />}
            label="Recalculate selected match"
            loading={pendingAction === "Match recalculation"}
            onClick={() =>
              submitOverride({
                actionLabel: "Match recalculation",
                overrideType: "recalculate_match",
                payload: {},
              })
            }
          />
          <AdminButton
            disabled={pendingAction !== null}
            icon={<RotateCw size={16} />}
            label="Recalculate all"
            loading={pendingAction === "Full recalculation"}
            onClick={() =>
              submitOverride({
                actionLabel: "Full recalculation",
                matchId: undefined,
                overrideType: "recalculate_all",
                payload: {},
              })
            }
          />
        </div>
      </section>
        </>
      ) : (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-black text-stone-950">Global overrides locked</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-stone-700">
            Match score, event, stat, and bonus-winner overrides change shared
            tournament data for every pool. Those tools are restricted to the
            tournament operator. Pool invite and member tools above still work
            for pool admins.
          </p>
        </section>
      )}

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <PanelTitle icon={<Activity size={19} />} title="Sync status" />
        <div className="mt-3 space-y-3">
          {data.syncRuns.map((run) => (
            <div
              className="rounded-md border border-black/10 bg-stone-50 p-3"
              key={run.id}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{run.source}</p>
                <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase text-emerald-900">
                  {run.status}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-stone-600">
                {run.message}
              </p>
              <p className="mt-2 text-xs font-bold text-stone-400">
                Requests used: {run.requestsUsed} ·{" "}
                {run.finishedAt
                  ? new Date(run.finishedAt).toLocaleString()
                  : "Still running"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <PanelTitle icon={<KeyRound size={19} />} title="Override audit log" />
        <div className="mt-3 space-y-3">
          {data.adminOverrides.length === 0 ? (
            <p className="rounded-md bg-stone-50 p-3 text-sm font-bold text-stone-500">
              No manual overrides yet.
            </p>
          ) : (
            data.adminOverrides.map((override) => (
              <details
                className="rounded-md border border-black/10 bg-stone-50 p-3"
                key={override.id}
              >
                <summary className="cursor-pointer text-sm font-black">
                  {override.overrideType} ·{" "}
                  {new Date(override.createdAt).toLocaleString()}
                </summary>
                {override.reason ? (
                  <p className="mt-2 text-xs font-bold text-stone-600">
                    {override.reason}
                  </p>
                ) : null}
                <pre className="mt-2 max-h-56 overflow-auto rounded bg-stone-950 p-3 text-[11px] font-bold text-white">
                  {jsonPreview(override.payload)}
                </pre>
              </details>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="font-black">{title}</h2>
    </div>
  );
}

function Field({
  children,
  className = "",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-stone-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function TeamBadge({
  align = "left",
  team,
}: {
  align?: "left" | "right";
  team?: { iso2?: string; name: string; shortName: string };
}) {
  if (!team) {
    return null;
  }

  return (
    <div
      className={
        align === "right"
          ? "flex min-w-0 items-center justify-end gap-2"
          : "flex min-w-0 items-center gap-2"
      }
    >
      {align === "left" ? <Flag code={team.iso2} label={team.name} /> : null}
      <span className="truncate text-sm font-black">{team.shortName}</span>
      {align === "right" ? <Flag code={team.iso2} label={team.name} /> : null}
    </div>
  );
}

function AdminButton({
  disabled,
  icon,
  label,
  loading,
  onClick,
}: {
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-950 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      {loading ? "Working..." : label}
    </button>
  );
}
