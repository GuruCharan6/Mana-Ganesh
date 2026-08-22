export function SyncBadge({ status }: { status: "synced" | "pending" | "error" }) {
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-sindoor">
        <span className="h-2 w-2 rounded-full bg-sindoor" />
        Sync failed
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-marigold">
        <span className="h-2 w-2 rounded-full bg-marigold animate-pulse" />
        Pending sync
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-durva">
      <span className="h-2 w-2 rounded-full bg-durva" />
      Synced
    </span>
  );
}
