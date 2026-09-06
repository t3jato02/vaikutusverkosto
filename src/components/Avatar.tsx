import type { EntityType } from "@prisma/client";

// Darker-than-graph tints so white initials clear WCAG AA (>= 4.5:1).
const AVATAR_BG: Partial<Record<EntityType, string>> = {
  PERSON: "#2f6099",
  ORGANIZATION: "#54606b",
  COMPANY: "#1c5f5a",
  GOVERNMENT_BODY: "#4b4f66",
  POLITICAL_PARTY: "#985327",
  EDUCATIONAL_INSTITUTION: "#356343",
  MEDIA_ORGANIZATION: "#286a8c",
  DECISION: "#33393f",
};
const AVATAR_FALLBACK = "#54606b";

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
  const color = AVATAR_BG[type] ?? AVATAR_FALLBACK;
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