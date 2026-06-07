import { cn } from "@/lib/cn";

export function Flag({
  code,
  label,
  size = "md",
}: {
  code?: string;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  if (!code) {
    return (
      <span
        aria-label={`${label} flag unavailable`}
        className={cn(
          "grid shrink-0 place-items-center rounded-sm bg-stone-200 text-[8px] font-black text-stone-500 shadow-[0_0_0_1px_rgba(0,0,0,0.18)]",
          size === "sm" && "h-3 w-5",
          size === "md" && "h-4 w-7",
          size === "lg" && "h-6 w-10 text-[10px]",
        )}
        role="img"
      >
        {label.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      aria-label={`${label} flag`}
      className={cn(
        "fi shrink-0",
        `fi-${code}`,
        size === "sm" && "h-3 w-5",
        size === "md" && "h-4 w-7",
        size === "lg" && "h-6 w-10",
      )}
      role="img"
    />
  );
}
