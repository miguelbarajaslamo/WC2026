"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";

// An avatar that opens the photo full-size when tapped. Members without an
// uploaded photo fall back to navigating to fallbackHref (so the tap isn't
// dead), matching the rest of their row.
export function ClickableAvatar({
  color,
  fallbackHref,
  imageUrl,
  name,
  size,
}: {
  color: string;
  fallbackHref?: string;
  imageUrl?: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={imageUrl ? `View ${name}'s photo` : `Open ${name}`}
        className="rounded-md"
        onClick={() => {
          if (imageUrl) {
            setOpen(true);
          } else if (fallbackHref) {
            router.push(fallbackHref);
          }
        }}
        type="button"
      >
        <Avatar color={color} imageUrl={imageUrl} name={name} size={size} />
      </button>

      {open && imageUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 pt-[calc(24px+var(--safe-top))]"
          onClick={() => setOpen(false)}
          role="dialog"
        >
          <button
            aria-label="Close photo"
            className="absolute right-4 top-[calc(16px+var(--safe-top))] grid size-10 place-items-center rounded-full bg-white/15 text-white"
            onClick={() => setOpen(false)}
            type="button"
          >
            <X size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={name}
            className="max-h-full w-auto max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            src={imageUrl}
          />
        </div>
      ) : null}
    </>
  );
}
