"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { AmountText } from "@/components/AmountText";
import { AmountOrItem } from "@/components/AmountOrItem";
import { SyncBadge } from "@/components/ui/SyncBadge";
import { PledgeRow, type Pledge } from "@/components/PledgeRow";
import { formatDate } from "@/lib/format";
import { listOutboxByKind, onOutboxChange } from "@/lib/offline/outbox";
import { useOutboxSync } from "@/lib/offline/useOutboxSync";
import type { ChandaCreatePayload, OutboxRecord } from "@/lib/offline/db";

type ServerEntry = {
  id: string;
  donor_name: string;
  donor_mobile: string | null;
  amount: number;
  collected_on: string;
  area: string | null;
  book_reference: string | null;
  adjustment_for: string | null;
  item_description: string | null;
  collected_by_name: string;
};

type StatusFilter = "all" | "collected" | "later";

export default function ChandaListPage() {
  const { orgId } = useParams<{ orgId: string }>();

  const [serverEntries, setServerEntries] = useState<ServerEntry[] | null>(null);
  const [pledges, setPledges] = useState<Pledge[] | null>(null);
  const [outbox, setOutbox] = useState<OutboxRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const loadServer = useCallback(async () => {
    try {
      const data = await apiGet(`/orgs/${orgId}/chanda`);
      setServerEntries(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load entries (offline?)");
    }
  }, [orgId]);

  const loadPledges = useCallback(async () => {
    try {
      setPledges(await apiGet(`/orgs/${orgId}/pledges`));
    } catch {
      setPledges([]);
    }
  }, [orgId]);

  const loadOutbox = useCallback(async () => {
    setOutbox(await listOutboxByKind(orgId, ["chanda_create"]));
  }, [orgId]);

  useOutboxSync(orgId, loadServer);

  useEffect(() => {
    loadServer();
    loadPledges();
    loadOutbox();
    const unsubscribe = onOutboxChange(loadOutbox);
    return unsubscribe;
  }, [loadServer, loadPledges, loadOutbox]);

  const total = (serverEntries ?? []).reduce((sum, e) => sum + e.amount, 0);
  const showPledges = filter === "all" || filter === "later";
  const showEntries = filter === "all" || filter === "collected";

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-6 max-w-xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-heading-1">Chanda</h1>
        <Link href={`/org/${orgId}/chanda/new`}>
          <Button>+ Add</Button>
        </Link>
      </div>

      {serverEntries !== null && (
        <div className="flex items-baseline justify-between border-b-2 border-marigold pb-3">
          <span className="text-caption text-ink-muted uppercase tracking-[0.02em]">
            Total Collected
          </span>
          <AmountText amount={total} size="lg" />
        </div>
      )}

      <div className="flex gap-2">
        {(["all", "collected", "later"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-3 py-1.5 text-caption font-semibold capitalize ${
              filter === f ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <p className="text-caption text-sindoor">{error}</p>}

      <div className="flex flex-col">
        {showPledges && pledges?.map((p) => (
          <PledgeRow key={p.id} pledge={p} onResolved={() => { loadPledges(); loadServer(); }} />
        ))}

        {showEntries && outbox.map((entry) => {
          const p = entry.payload as ChandaCreatePayload;
          return (
            <div key={entry.localId} className="flex items-center gap-3 border-b border-line py-3 min-h-11">
              <div className="flex-1 min-w-0">
                <p className="text-body-strong truncate">{p.donorName}</p>
                <p className="text-caption text-ink-muted">
                  {formatDate(p.collectedOn)}
                  {p.area ? ` · ${p.area}` : ""}
                </p>
                <SyncBadge status={entry.status === "error" ? "error" : "pending"} />
              </div>
              <AmountOrItem amount={p.amount} itemDescription={p.itemDescription} />
            </div>
          );
        })}

        {serverEntries === null && pledges === null && outbox.length === 0 && (
          <p className="text-body text-ink-muted py-4">Loading…</p>
        )}
        {serverEntries !== null &&
          pledges !== null &&
          showEntries &&
          serverEntries.length === 0 &&
          (!showPledges || pledges.length === 0) &&
          outbox.length === 0 && (
            <p className="text-body text-ink-muted py-4">
              No chanda entries yet. Tap &quot;+ Add&quot; to log the first one.
            </p>
          )}

        {showEntries && serverEntries?.map((entry) => (
          <Link
            key={entry.id}
            href={`/org/${orgId}/chanda/${entry.id}`}
            className="flex items-center gap-3 border-b border-line py-3 min-h-11"
          >
            <div className="flex-1 min-w-0">
              <p className="text-body-strong truncate">
                {entry.donor_name}
                {entry.adjustment_for && (
                  <span className="text-caption text-marigold ml-2">Adjustment</span>
                )}
              </p>
              {entry.item_description && (
                <span className="text-badge uppercase tracking-[0.02em] px-1 rounded shrink-0 bg-marigold/10 text-marigold">
                  In-Kind
                </span>
              )}
              <p className="text-caption text-ink-muted truncate">
                {formatDate(entry.collected_on)}
                {entry.area ? ` · ${entry.area}` : ""} · {entry.collected_by_name}
              </p>
            </div>
            <AmountOrItem amount={entry.amount} itemDescription={entry.item_description} />
          </Link>
        ))}
      </div>
    </main>
  );
}
