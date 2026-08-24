"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  payment_method: "cash" | "qr" | null;
  collected_by_name: string;
};

type StatusFilter = "all" | "collected" | "later";
type PaymentFilter = "all" | "cash" | "qr";

export function ChandaListClient({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const [serverEntries, setServerEntries] = useState<ServerEntry[] | null>(null);
  const [pledges, setPledges] = useState<Pledge[] | null>(null);
  const [outbox, setOutbox] = useState<OutboxRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [itemsOnly, setItemsOnly] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");

  const loadServer = useCallback(async () => {
    try {
      setError(null);
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

  const q = search.trim().toLowerCase();
  const matchesSearch = useCallback(
    (name: string) => q.length === 0 || name.toLowerCase().includes(q),
    [q]
  );

  const visibleEntries = useMemo(
    () =>
      (serverEntries ?? []).filter(
        (e) =>
          matchesSearch(e.donor_name) &&
          (!itemsOnly || e.item_description) &&
          (paymentFilter === "all" || e.payment_method === paymentFilter)
      ),
    [serverEntries, matchesSearch, itemsOnly, paymentFilter]
  );
  // Pledges have no payment method (nothing's been paid yet) — a cash/QR
  // filter naturally excludes them rather than guessing which bucket they'd
  // belong to.
  const visiblePledges = useMemo(
    () =>
      paymentFilter !== "all"
        ? []
        : (pledges ?? []).filter(
            (p) => matchesSearch(p.donor_name) && (!itemsOnly || p.item_description)
          ),
    [pledges, matchesSearch, itemsOnly, paymentFilter]
  );

  const total = (serverEntries ?? []).reduce((sum, e) => sum + e.amount, 0);
  const showPledges = filter === "all" || filter === "later";
  const showEntries = filter === "all" || filter === "collected";

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-6 max-w-xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-heading-1">Chanda</h1>
        {canWrite && (
          <Link href={`/org/${orgId}/chanda/new`}>
            <Button>+ Add</Button>
          </Link>
        )}
      </div>

      {serverEntries !== null && (
        <div className="flex items-baseline justify-between border-b-2 border-marigold pb-3">
          <span className="text-caption text-ink-muted uppercase tracking-[0.02em]">
            Total Collected
          </span>
          <AmountText amount={total} size="lg" />
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by donor name..."
        className="rounded-lg border border-line px-3 py-2.5 text-body outline-none"
      />

      <div className="grid grid-cols-3 gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as StatusFilter)}
          className="min-w-0 rounded-lg border border-line px-2 py-2 text-caption outline-none bg-surface capitalize"
        >
          <option value="all">All Status</option>
          <option value="collected">Collected</option>
          <option value="later">Later</option>
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
          className="min-w-0 rounded-lg border border-line px-2 py-2 text-caption outline-none bg-surface"
        >
          <option value="all">Any Payment</option>
          <option value="cash">Cash</option>
          <option value="qr">QR</option>
        </select>
        <button
          onClick={() => setItemsOnly((v) => !v)}
          className={`min-w-0 rounded-lg border px-2 py-2 text-caption font-semibold ${
            itemsOnly ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
          }`}
        >
          Items
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-caption text-sindoor">{error}</p>
          <button onClick={loadServer} className="text-caption text-peacock font-semibold shrink-0">
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col">
        {showPledges && visiblePledges.map((p) => (
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

        {serverEntries === null && pledges === null && outbox.length === 0 && !error && (
          <p className="text-body text-ink-muted py-4">Loading…</p>
        )}
        {!error &&
          serverEntries !== null &&
          pledges !== null &&
          showEntries &&
          visibleEntries.length === 0 &&
          (!showPledges || visiblePledges.length === 0) &&
          outbox.length === 0 && (
            <p className="text-body text-ink-muted py-4">
              {q || itemsOnly || paymentFilter !== "all"
                ? "No chanda entries match your filters."
                : canWrite
                  ? 'No chanda entries yet. Tap "+ Add" to log the first one.'
                  : "No chanda entries yet."}
            </p>
          )}

        {showEntries && visibleEntries.map((entry) => (
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
