"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { AmountText } from "@/components/AmountText";
import { SyncBadge } from "@/components/ui/SyncBadge";
import { formatDate } from "@/lib/format";
import { listOutboxByKind, onOutboxChange } from "@/lib/offline/outbox";
import { useOutboxSync } from "@/lib/offline/useOutboxSync";
import type { ExpenseCreatePayload, OutboxRecord } from "@/lib/offline/db";

type Entry = {
  id: string;
  category: string;
  vendor_name: string | null;
  amount: number;
  expense_date: string;
  receipt_url: string | null;
  adjustment_for: string | null;
  logged_by_name: string;
};

export function ExpenseListClient({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [outbox, setOutbox] = useState<OutboxRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      setEntries(await apiGet(`/orgs/${orgId}/expenses`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load expenses (offline?)");
    }
  }, [orgId]);

  const loadOutbox = useCallback(async () => {
    setOutbox(await listOutboxByKind(orgId, ["expense_create"]));
  }, [orgId]);

  useOutboxSync(orgId, load);

  useEffect(() => {
    load();
    loadOutbox();
    const unsubscribe = onOutboxChange(loadOutbox);
    return unsubscribe;
  }, [load, loadOutbox]);

  const q = search.trim().toLowerCase();
  const visibleEntries = useMemo(
    () =>
      (entries ?? []).filter((e) => {
        if (!q) return true;
        return (e.vendor_name ?? "").toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
      }),
    [entries, q]
  );

  const total = (entries ?? []).reduce((sum, e) => sum + e.amount, 0);

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-6 max-w-xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-heading-1">Expenses</h1>
        {canWrite && (
          <Link href={`/org/${orgId}/expenses/new`}>
            <Button>+ Add</Button>
          </Link>
        )}
      </div>

      {entries !== null && (
        <div className="flex items-baseline justify-between border-b-2 border-marigold pb-3">
          <span className="text-caption text-ink-muted uppercase tracking-[0.02em]">
            Total Spent
          </span>
          <AmountText amount={total} size="lg" />
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by vendor or category..."
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
        {outbox.map((entry) => {
          const p = entry.payload as ExpenseCreatePayload;
          return (
            <div key={entry.localId} className="flex items-center gap-3 border-b border-line py-3 min-h-11">
              <div className="flex-1 min-w-0">
                <p className="text-body-strong truncate">{p.vendorName || p.category}</p>
                <span className="text-badge uppercase tracking-[0.02em] px-1 rounded shrink-0 bg-ink-muted/10 text-ink-muted">
                  {p.category}
                </span>
                <p className="text-caption text-ink-muted">{formatDate(p.expenseDate)}</p>
                <SyncBadge status={entry.status === "error" ? "error" : "pending"} />
              </div>
              <AmountText amount={p.amount} />
            </div>
          );
        })}

        {entries === null && outbox.length === 0 && !error && (
          <p className="text-body text-ink-muted py-4">Loading…</p>
        )}
        {!error && entries !== null && visibleEntries.length === 0 && outbox.length === 0 && (
          <p className="text-body text-ink-muted py-4">
            {q
              ? "No expenses match your search."
              : canWrite
                ? 'No expenses yet. Tap "+ Add" to log the first one.'
                : "No expenses yet."}
          </p>
        )}

        {visibleEntries.map((entry) => (
          <Link
            key={entry.id}
            href={`/org/${orgId}/expenses/${entry.id}`}
            className="flex items-center gap-3 border-b border-line py-3 min-h-11"
          >
            <div className="flex-1 min-w-0">
              <p className="text-body-strong truncate">
                {entry.vendor_name || entry.category}
                {entry.adjustment_for && (
                  <span className="text-caption text-marigold ml-2">Adjustment</span>
                )}
              </p>
              <span className="text-badge uppercase tracking-[0.02em] px-1 rounded shrink-0 bg-ink-muted/10 text-ink-muted">
                {entry.category}
              </span>
              <p className="text-caption text-ink-muted truncate">
                {formatDate(entry.expense_date)} · {entry.logged_by_name}
              </p>
            </div>
            <AmountText amount={entry.amount} />
          </Link>
        ))}
      </div>
    </main>
  );
}
