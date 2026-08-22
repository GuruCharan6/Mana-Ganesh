type Tone = "admin" | "view_only" | "full" | "pending" | "joined";

const tones: Record<Tone, string> = {
  admin: "bg-peacock/10 text-peacock",
  view_only: "bg-ink-muted/10 text-ink-muted",
  full: "bg-durva/10 text-durva",
  pending: "bg-marigold/10 text-marigold",
  joined: "bg-durva/10 text-durva",
};

const labels: Record<Tone, string> = {
  admin: "Admin",
  view_only: "View Only",
  full: "Full Access",
  pending: "Pending",
  joined: "Joined",
};

export function Badge({ tone }: { tone: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-badge uppercase tracking-[0.02em] ${tones[tone]}`}
    >
      {labels[tone]}
    </span>
  );
}
