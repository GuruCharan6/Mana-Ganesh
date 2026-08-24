"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { AmountText } from "@/components/AmountText";
import { formatAmount, formatDate } from "@/lib/format";

type Entry = {
  id: string;
  buyer_name: string;
  buyer_mobile: string | null;
  buyer_address: string | null;
  amount: number;
  payment_method: "cash" | "qr";
  sold_by_name: string;
  created_at: string;
};

export function LuckyDrawListClient({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      setEntries(await apiGet(`/orgs/${orgId}/lucky-draw`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load lucky draw entries (offline?)");
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const ticketCount = entries?.length ?? 0;
  const total = (entries ?? []).reduce((sum, e) => sum + e.amount, 0);

  const q = search.trim().toLowerCase();
  const visibleEntries = useMemo(
    () => (entries ?? []).filter((e) => q.length === 0 || e.buyer_name.toLowerCase().includes(q)),
    [entries, q]
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-6 max-w-xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-heading-1">Lucky Draw</h1>
        {canWrite && (
          <Link href={`/org/${orgId}/lucky-draw/new`}>
            <Button>+ Add</Button>
          </Link>
        )}
      </div>

      {entries !== null && (
        <div className="flex flex-wrap gap-x-8 gap-y-3 border-b-2 border-marigold pb-3">
          <div>
            <p className="text-caption text-ink-muted uppercase tracking-[0.02em]">
              Tickets Sold
            </p>
            <p className="font-mono text-display-lg text-ink">{ticketCount}</p>
          </div>
          <div>
            <p className="text-caption text-ink-muted uppercase tracking-[0.02em]">Collected</p>
            <p className="font-mono text-display-lg text-ink">{formatAmount(total)}</p>
          </div>
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by buyer name..."
        className="rounded-lg border border-line px-3 py-2.5 text-body outline-none"
      />

      {error && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-caption text-sindoor">{error}</p>
          <button onClick={load} className="text-caption text-peacock font-semibold shrink-0">
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col">
        {entries === null && !error && <p className="text-body text-ink-muted py-4">Loading…</p>}
        {entries !== null && visibleEntries.length === 0 && !error && (
          <p className="text-body text-ink-muted py-4">
            {q
              ? "No tickets match your search."
              : canWrite
                ? 'No tickets sold yet. Tap "+ Add" to sell the first one.'
                : "No tickets sold yet."}
          </p>
        )}
        {visibleEntries.map((entry) => (
          <Link
            key={entry.id}
            href={`/org/${orgId}/lucky-draw/${entry.id}`}
            className="flex items-center gap-3 border-b border-line py-3 min-h-11"
          >
            <div className="flex-1 min-w-0">
              <p className="text-body-strong truncate">{entry.buyer_name}</p>
              <p className="text-caption text-ink-muted truncate">
                {formatDate(entry.created_at.slice(0, 10))} · {entry.sold_by_name} ·{" "}
                {entry.payment_method === "qr" ? "QR" : "Cash"}
                {entry.buyer_address ? ` · ${entry.buyer_address}` : ""}
              </p>
            </div>
            <AmountText amount={entry.amount} />
          </Link>
        ))}
      </div>
    </main>
  );
}
