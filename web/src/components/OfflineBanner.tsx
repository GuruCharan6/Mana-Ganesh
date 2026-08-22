"use client";

import { useEffect, useState } from "react";
import { useOutboxSync } from "@/lib/offline/useOutboxSync";

export function OfflineBanner({ orgId }: { orgId: string }) {
  const { pendingCount } = useOutboxSync(orgId);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online && pendingCount === 0) return null;

  return (
    <div className="bg-marigold/10 text-marigold text-caption px-6 py-2 flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-marigold animate-pulse shrink-0" />
      {!online && pendingCount === 0 && "Offline — entries will sync once you're back online."}
      {!online && pendingCount > 0 &&
        `Offline — ${pendingCount} ${pendingCount === 1 ? "entry" : "entries"} saved locally, will sync.`}
      {online && pendingCount > 0 &&
        `Syncing ${pendingCount} ${pendingCount === 1 ? "entry" : "entries"}...`}
    </div>
  );
}
