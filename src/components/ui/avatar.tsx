import { cn } from "@/lib/cn";

export function Avatar({
  color,
  imageUrl,
  name,
  size = "md",
}: {
  color: string;
  imageUrl?: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sizeClass = cn(
    size === "sm" && "size-8",
    size === "md" && "size-10",
    size === "lg" && "size-12 text-sm",
  );

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={`${name} profile`}
        className={cn("shrink-0 rounded-md object-cover", sizeClass)}
        src={imageUrl}
      />
    );
  }

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md text-xs font-black text-white",
        sizeClass,
      )}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}
