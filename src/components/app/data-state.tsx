"use client";

export function LoadingState({ label = "Loading data" }: { label?: string }) {
  return (
    <div className="grid min-h-[360px] place-items-center px-5 text-center">
      <div>
        <div className="mx-auto mb-4 size-9 animate-pulse rounded-md bg-emerald-900" />
        <p className="text-sm font-black uppercase tracking-wide text-stone-700">
          {label}
        </p>
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">
      {message}
    </div>
  );
}

export function EmptyState({
  body,
  title,
}: {
  body: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-white p-5">
      <p className="font-black text-stone-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-stone-600">{body}</p>
    </div>
  );
}
