import {
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Clock,
  Home,
  ListChecks,
  Shield,
  Trophy,
} from "lucide-react";

const liveMatches = [
  {
    home: "Sweden",
    away: "Brazil",
    score: "1-1",
    minute: "63'",
    pick: "Sweden 2-1",
    points: "+0.0 now",
    status: "Live",
  },
  {
    home: "Mexico",
    away: "Japan",
    score: "0-0",
    minute: "HT",
    pick: "Draw 1-1",
    points: "+3.4 now",
    status: "Live",
  },
];

const upcomingMatches = [
  {
    home: "Canada",
    away: "Norway",
    kickoff: "18:00",
    lock: "Locks in 2h 45m",
    pick: "Missing pick",
  },
  {
    home: "Spain",
    away: "Ghana",
    kickoff: "21:00",
    lock: "Locks in 5h 45m",
    pick: "Spain 3-1",
  },
];

const leaderboard = [
  { rank: 1, name: "Lina", points: "18.7", movement: "+2" },
  { rank: 2, name: "Miguel", points: "16.2", movement: "-1" },
  { rank: 3, name: "Dad", points: "14.9", movement: "+1" },
];

function MatchCard({
  match,
  isLive = false,
}: {
  match: (typeof liveMatches)[number] | (typeof upcomingMatches)[number];
  isLive?: boolean;
}) {
  const hasScore = "score" in match;

  return (
    <article className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${
                isLive
                  ? "bg-rose-600 text-white"
                  : "bg-emerald-100 text-emerald-900"
              }`}
            >
              {hasScore ? match.status : match.kickoff}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-stone-500">
              <Clock size={13} />
              {hasScore ? match.minute : match.lock}
            </span>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="space-y-1">
              <p className="truncate text-lg font-black text-stone-950">
                {match.home}
              </p>
              <p className="truncate text-lg font-black text-stone-950">
                {match.away}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-black text-stone-950">
                {hasScore ? match.score : "vs"}
              </p>
              <p className="text-xs font-semibold text-stone-500">
                {hasScore ? match.points : match.pick}
              </p>
            </div>
          </div>
        </div>
        <ChevronRight className="mt-7 shrink-0 text-stone-400" size={20} />
      </div>

      {hasScore ? (
        <div className="mt-4 rounded-md bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700">
          Your pick: {match.pick}
        </div>
      ) : null}
    </article>
  );
}

function BottomNav() {
  const items = [
    { label: "Today", icon: Home, active: true },
    { label: "Fixtures", icon: CalendarDays },
    { label: "Table", icon: Trophy },
    { label: "Picks", icon: ListChecks },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white/95 px-3 pb-3 pt-2 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`flex h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-bold ${
                item.active
                  ? "bg-emerald-900 text-white"
                  : "text-stone-500 hover:bg-stone-100"
              }`}
              key={item.label}
              type="button"
            >
              <Icon size={19} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-[#f5f1e8] pb-24 text-stone-950">
      <section className="border-b border-emerald-950/20 bg-emerald-900 text-white">
        <div className="mx-auto max-w-md px-5 pb-5 pt-4 md:max-w-5xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime-200">
                Family Cup 2026
              </p>
              <h1 className="mt-1 text-2xl font-black">Today</h1>
            </div>
            <button
              className="grid size-11 place-items-center rounded-md bg-white/10 text-white ring-1 ring-white/20"
              type="button"
              aria-label="Profile and settings"
            >
              <CircleUserRound size={24} />
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-white/15 bg-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-md bg-lime-300 text-emerald-950">
                <Shield size={23} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black">1 missing pick</p>
                <p className="truncate text-sm text-white/75">
                  Canada vs Norway locks 15 min before kickoff.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-md gap-6 px-5 py-5 md:max-w-5xl md:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-black">Live now</h2>
              <span className="text-xs font-bold uppercase text-rose-700">
                Auto-updating
              </span>
            </div>
            <div className="space-y-3">
              {liveMatches.map((match) => (
                <MatchCard isLive key={`${match.home}-${match.away}`} match={match} />
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-black">Upcoming</h2>
              <button
                className="rounded-md bg-stone-950 px-3 py-2 text-xs font-bold text-white"
                type="button"
              >
                Fill picks
              </button>
            </div>
            <div className="space-y-3">
              {upcomingMatches.map((match) => (
                <MatchCard key={`${match.home}-${match.away}`} match={match} />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-black">Leaderboard</h2>
              <Trophy className="text-amber-500" size={20} />
            </div>
            <div className="space-y-3">
              {leaderboard.map((player) => (
                <div
                  className="grid grid-cols-[32px_1fr_auto] items-center gap-3"
                  key={player.name}
                >
                  <span className="grid size-8 place-items-center rounded-md bg-stone-100 text-sm font-black">
                    {player.rank}
                  </span>
                  <span className="font-bold">{player.name}</span>
                  <span className="text-right">
                    <span className="block font-mono text-lg font-black">
                      {player.points}
                    </span>
                    <span className="text-xs font-bold text-emerald-700">
                      {player.movement}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="font-black">Pool rules</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Picks lock 15 minutes before kickoff. The official scoring mode
              can be traditional or pot scoring, chosen before the tournament.
            </p>
          </section>
        </aside>
      </div>

      <BottomNav />
    </main>
  );
}
