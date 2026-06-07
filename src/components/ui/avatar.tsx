import { cn } from "@/lib/cn";

export function Avatar({
  color,
  name,
  size = "md",
}: {
  color: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md text-xs font-black text-white",
        size === "sm" && "size-8",
        size === "md" && "size-10",
        size === "lg" && "size-12 text-sm",
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}
