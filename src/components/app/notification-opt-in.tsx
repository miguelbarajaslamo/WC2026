"use client";

import { Bell } from "lucide-react";
import { useState } from "react";

function base64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function NotificationOptIn() {
  const [message, setMessage] = useState("Not enabled");
  const [busy, setBusy] = useState(false);

  async function enableNotifications() {
    setBusy(true);

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setMessage("Push is not supported on this device/browser.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage("Permission was not granted.");
        return;
      }

      const keyResponse = await fetch("/api/push/vapid-public-key");
      const { publicKey } = (await keyResponse.json()) as { publicKey?: string };

      if (!publicKey) {
        setMessage("Missing VAPID public key.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        applicationServerKey: base64ToUint8Array(publicKey),
        userVisibleOnly: true,
      });

      const response = await fetch("/api/push/subscribe", {
        body: JSON.stringify({ subscription }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as { error?: string };

      setMessage(response.ok ? "Deadline reminders enabled." : body.error ?? "Could not save subscription.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-black/10 bg-white p-4">
      <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md bg-stone-100 text-stone-600">
          <Bell size={20} />
        </span>
        <span>
          <span className="block font-black">Deadline reminders</span>
          <span className="text-sm font-bold text-stone-500">{message}</span>
        </span>
        <button
          className="rounded-md bg-stone-950 px-3 py-2 text-xs font-black uppercase text-white disabled:bg-stone-300"
          disabled={busy}
          onClick={enableNotifications}
          type="button"
        >
          Enable
        </button>
      </div>
      <p className="mt-3 text-xs font-bold leading-5 text-stone-500">
        On iPhone, install the PWA to the Home Screen before enabling web push.
      </p>
    </div>
  );
}
