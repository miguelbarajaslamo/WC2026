"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, Smartphone } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ErrorState, LoadingState } from "@/components/app/data-state";
import { LogoutButton } from "@/components/app/logout-button";
import { NotificationOptIn } from "@/components/app/notification-opt-in";
import { QuietHoursPanel } from "@/components/app/quiet-hours-panel";
import { useBootstrap } from "@/components/app/use-bootstrap";
import { bootstrapQueryKey } from "@/lib/api/bootstrap";
import { getProfile } from "@/lib/data/selectors";
import { DEFAULT_WARNING_DAYS, getWarningDays, setWarningDays } from "@/lib/preferences";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getLocalTimeZone } from "@/lib/time";

export function SettingsView() {
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useBootstrap();
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState("");
  const [password, setPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [warningDays, setWarningDaysState] = useState(DEFAULT_WARNING_DAYS);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setWarningDaysState(getWarningDays()), []);

  if (isLoading || !data) {
    return <LoadingState label="Loading settings" />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const profile = getProfile(data, data.currentUserId);
  const effectiveDisplayName = displayName || profile.displayName;
  const effectiveAvatarColor = avatarColor || profile.avatarColor;

  async function refreshProfile() {
    await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileMessage("");

    const response = await fetch("/api/profile", {
      body: JSON.stringify({
        avatarColor: effectiveAvatarColor,
        displayName: effectiveDisplayName,
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setSavingProfile(false);

    if (!response.ok) {
      setProfileError(body.error ?? "Could not update profile.");
      return;
    }

    setProfileMessage("Profile updated.");
    await refreshProfile();
  }

  async function uploadAvatar(file?: File) {
    if (!file) {
      return;
    }

    setSavingAvatar(true);
    setProfileError("");
    setProfileMessage("");

    const formData = new FormData();
    formData.set("avatar", file);

    const response = await fetch("/api/profile/avatar", {
      body: formData,
      method: "POST",
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setSavingAvatar(false);

    if (!response.ok) {
      setProfileError(body.error ?? "Could not upload avatar.");
      return;
    }

    setProfileMessage("Profile picture updated.");
    await refreshProfile();
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 8) {
      setProfileError("Password must be at least 8 characters.");
      return;
    }

    setSavingPassword(true);
    setProfileError("");
    setProfileMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);

    if (updateError) {
      setProfileError(updateError.message);
      return;
    }

    setPassword("");
    setProfileMessage("Password updated.");
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-black/10 bg-white p-4">
        <div className="flex items-center gap-3">
          <Avatar
            color={profile.avatarColor}
            imageUrl={profile.avatarUrl}
            name={profile.displayName}
            size="lg"
          />
          <div>
            <h2 className="text-xl font-black">{profile.displayName}</h2>
            <p className="text-sm font-bold text-stone-500">Profile and app preferences</p>
          </div>
        </div>
      </section>

      {profileMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-950">
          {profileMessage}
        </div>
      ) : null}
      {profileError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-black text-red-900">
          {profileError}
        </div>
      ) : null}

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="font-black">Profile</h2>
        <form className="mt-3 space-y-3" onSubmit={saveProfile}>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-stone-500">
              Display name
            </span>
            <input
              className="input"
              maxLength={40}
              minLength={2}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={profile.displayName}
              value={displayName}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-stone-500">
              Avatar color
            </span>
            <div className="grid grid-cols-[44px_1fr] gap-2">
              <input
                aria-label="Avatar color"
                className="h-11 w-full rounded-md border border-black/15 bg-white p-1"
                onChange={(event) => setAvatarColor(event.target.value)}
                type="color"
                value={effectiveAvatarColor}
              />
              <input
                className="input"
                onChange={(event) => setAvatarColor(event.target.value)}
                value={effectiveAvatarColor}
              />
            </div>
          </label>
          <button
            className="h-11 w-full rounded-md bg-emerald-950 text-sm font-black text-white disabled:bg-stone-300 disabled:text-stone-500"
            disabled={savingProfile}
            type="submit"
          >
            {savingProfile ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="font-black">Profile picture</h2>
        <p className="mt-1 text-sm font-bold text-stone-500">
          JPG, PNG, or WebP. Max 2 MB.
        </p>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="mt-3 block w-full text-sm font-bold"
          disabled={savingAvatar}
          onChange={(event) => {
            void uploadAvatar(event.target.files?.[0]);
            event.target.value = "";
          }}
          type="file"
        />
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="font-black">Password</h2>
        <form className="mt-3 space-y-3" onSubmit={savePassword}>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-stone-500">
              New password
            </span>
            <input
              autoComplete="new-password"
              className="input"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <button
            className="h-11 w-full rounded-md bg-stone-950 text-sm font-black text-white disabled:bg-stone-300 disabled:text-stone-500"
            disabled={savingPassword}
            type="submit"
          >
            {savingPassword ? "Saving..." : "Change password"}
          </button>
        </form>
      </section>

      <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-lg border border-black/10 bg-white p-4">
        <span className="grid size-9 place-items-center rounded-md bg-stone-100 text-stone-600">
          <CalendarClock size={20} />
        </span>
        <span>
          <span className="block font-black">Pick reminder window</span>
          <span className="text-sm font-bold text-stone-500">
            Warn about unpicked matches kicking off within this many days.
          </span>
        </span>
        <select
          aria-label="Pick reminder window in days"
          className="rounded-md border border-black/15 bg-white px-2 py-1 text-sm font-black"
          onChange={(event) => {
            const next = Number(event.target.value);
            setWarningDays(next);
            setWarningDaysState(next);
          }}
          value={warningDays}
        >
          {[1, 2, 3, 5, 7].map((days) => (
            <option key={days} value={days}>
              {days} day{days === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </div>

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
      <QuietHoursPanel profile={profile} />
      <SettingRow
        body="Add WORLD CUP PICKS to the home screen for standalone PWA mode."
        icon={<Smartphone size={20} />}
        title="Install helper"
        value="Ready"
      />
      <LogoutButton />
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
