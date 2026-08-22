"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, ApiError } from "@/lib/api";
import { PledgeRow, type Pledge } from "@/components/PledgeRow";

export function RemindersClient({ orgId }: { orgId: string }) {
  const [pledges, setPledges] = useState<Pledge[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPledges(await apiGet(`/orgs/${orgId}/pledges`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load reminders");
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-4 max-w-xl mx-auto w-full">
      <h1 className="font-display text-heading-1">Reminders</h1>

      {error && <p className="text-caption text-sindoor">{error}</p>}

      <div className="flex flex-col">
        {pledges === null && <p className="text-body text-ink-muted">Loading…</p>}
        {pledges?.length === 0 && (
          <p className="text-body text-ink-muted py-2">Nothing outstanding.</p>
        )}
        {pledges?.map((p) => (
          <PledgeRow key={p.id} pledge={p} onResolved={load} />
        ))}
      </div>
    </main>
  );
}
