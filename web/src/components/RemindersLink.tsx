import Link from "next/link";

export function RemindersLink({ orgId }: { orgId: string }) {
  return (
    <Link
      href={`/org/${orgId}/reminders`}
      aria-label="Reminders"
      className="text-ink-muted shrink-0 p-1"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
