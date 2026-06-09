"use client";

import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  ListChecks,
  Settings,
  Shield,
  Table2,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PoolGate } from "@/components/app/pool-gate";
import { cn } from "@/lib/cn";

const primaryNav = [
  { href: "/", icon: ClipboardList, label: "Today" },
  { href: "/groups", icon: Table2, label: "Groups" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/picks", icon: ListChecks, label: "Picks" },
];

const menuNav = [
  { href: "/pool", icon: Users, label: "Pool" },
  { href: "/fixtures", icon: CalendarDays, label: "Fixtures" },
  { href: "/stats", icon: BarChart3, label: "Stats" },
  { href: "/settings", icon: Settings, label: "Settings" },
  { href: "/admin", icon: Shield, label: "Admin" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  kicker,
  title,
}: {
  children: React.ReactNode;
  kicker?: string;
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Detail/sub views (anything not a primary/menu destination) get a back button.
  const isTopLevel = [...primaryNav, ...menuNav].some(
    (item) => item.href === pathname,
  );

  return (
    <PoolGate>
    <div className="min-h-dvh bg-stone-100 text-stone-950">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#022c22] pt-[var(--safe-top)] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {!isTopLevel ? (
              <button
                aria-label="Go back"
                className="grid size-10 shrink-0 place-items-center rounded-md bg-white/10 text-white ring-1 ring-white/15"
                onClick={() => router.back()}
                type="button"
              >
                <ArrowLeft size={20} />
              </button>
            ) : null}
            <Link className="min-w-0" href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="WORLD CUP PICKS"
                className="h-7 w-auto"
                height={200}
                src="/logo-wordmark.png"
                width={532}
              />
              <h1 className="mt-0.5 truncate text-xl font-black">{title}</h1>
              {kicker ? (
                <p className="truncate text-xs font-bold text-white/60">{kicker}</p>
              ) : null}
            </Link>
          </div>

          <details className="relative">
            <summary
              aria-label="Open secondary navigation"
              className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md bg-white/10 text-white ring-1 ring-white/15"
            >
              <ChevronDown size={20} />
            </summary>
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-black/10 bg-white p-2 text-stone-950 shadow-xl">
              {menuNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-bold hover:bg-stone-100"
                    href={item.href}
                    key={item.href}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </details>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-0 md:grid-cols-[220px_1fr]">
        <aside className="sticky top-[calc(69px+var(--safe-top))] hidden h-[calc(100dvh-69px-var(--safe-top))] border-r border-black/10 bg-white p-3 md:block">
          <nav className="space-y-1">
            {[...primaryNav, ...menuNav].map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-black",
                    active
                      ? "bg-emerald-950 text-white"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-950",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 pb-24 md:pb-8">
          <div className="mx-auto w-full max-w-md px-3 py-4 md:max-w-none md:px-6">
            {children}
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 px-2 pb-3 pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-black",
                  active ? "bg-emerald-950 text-white" : "text-stone-500",
                )}
                href={item.href}
                key={item.href}
              >
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
    </PoolGate>
  );
}
