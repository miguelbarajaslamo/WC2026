"use client";

import { Bell, LogOut, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { NotificationOptIn } from "@/components/app/notification-opt-in";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { getProfile } from "@/lib/data/selectors";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getLocalTimeZone } from "@/lib/time";

export function SettingsView() {
  const { data, error, isLoading } = useBootstrap();
  const router = useRouter();

  if (isLoading || !data) {
    return <LoadingState label="Loading settings" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const profile = getProfile(data, data.currentUserId);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-black/10 bg-white p-4">
        <div className="flex items-center gap-3">
          <Avatar color={profile.avatarColor} name={profile.displayName} size="lg" />
          <div>
            <h2 className="text-xl font-black">{profile.displayName}</h2>
            <p className="text-sm font-bold text-stone-500">Profile and app preferences</p>
          </div>
        </div>
      </section>

      <SettingRow
        body="Deadline reminders, match locks, full-time score updates."
        icon={<Bell size={20} />}
        title="Notifications"
        value={profile.notificationDeadlines ? "On" : "Off"}
      />
      <SettingRow
        body={`Match and lock times use your phone/browser timezone: ${getLocalTimeZone()}.`}
        icon={<Smartphone size={20} />}
        title="Local time"
        value="Auto"
      />
      <NotificationOptIn />
      <SettingRow
        body="Add WORLD CUP PICKS to the home screen for standalone PWA mode."
        icon={<Smartphone size={20} />}
        title="Install helper"
        value="Ready"
      />
      <button
        className="flex w-full items-center gap-3 rounded-lg border border-black/10 bg-white p-4 text-left font-black text-red-700"
        onClick={logout}
        type="button"
      >
        <LogOut size={20} />
        Logout
      </button>
    </div>
  );
}

function SettingRow({
  body,
  icon,
  title,
  value,
}: {
  body: string;
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-lg border border-black/10 bg-white p-4">
      <span className="grid size-9 place-items-center rounded-md bg-stone-100 text-stone-600">
        {icon}
      </span>
      <span>
        <span className="block font-black">{title}</span>
        <span className="text-sm font-bold text-stone-500">{body}</span>
      </span>
      <span className="rounded bg-stone-100 px-2 py-1 text-[10px] font-black uppercase text-stone-500">
        {value}
      </span>
    </div>
  );
}
