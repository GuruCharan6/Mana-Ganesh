"use client";

import { useCallback, useEffect, useState } from "react";
import { syncOutbox } from "./sync";
import { countPending, onOutboxChange } from "./outbox";

export function useOutboxSync(orgId: string, onSynced?: () => void) {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    setPendingCount(await countPending(orgId));
  }, [orgId]);

  const runSync = useCallback(async () => {
    const { synced } = await syncOutbox(orgId);
    await refreshCount();
    if (synced > 0) onSynced?.();
  }, [orgId, refreshCount, onSynced]);

  useEffect(() => {
    refreshCount();
    const unsubscribe = onOutboxChange(refreshCount);
    return unsubscribe;
  }, [refreshCount]);

  useEffect(() => {
    runSync();
    window.addEventListener("online", runSync);
    const interval = setInterval(runSync, 30000);
    return () => {
      window.removeEventListener("online", runSync);
      clearInterval(interval);
    };
  }, [runSync]);

  return { pendingCount, runSync };
}
