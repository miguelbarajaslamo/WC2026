import { cn } from "@/lib/cn";

export function Flag({
  code,
  label,
  size = "md",
}: {
  code: string;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
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
