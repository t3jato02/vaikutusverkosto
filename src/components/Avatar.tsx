import { NODE_COLORS } from "@/lib/constants";
import type { EntityType } from "@prisma/client";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function Avatar({
  name,
  type,
  imageUrl,
  size = 40,
}: {
  name: string;
  type: EntityType;
  imageUrl?: string | null;
  size?: number;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const color = NODE_COLORS[type] ?? "#777";
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}