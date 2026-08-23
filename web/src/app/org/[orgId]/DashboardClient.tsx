"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { AmountOrItem } from "@/components/AmountOrItem";
import { TxnTag } from "@/components/TxnTag";
import { useOrgTransactions } from "@/lib/useOrgTransactions";
import type { Pledge } from "@/components/PledgeRow";

type Announcement = {
  id: string;
  body: string;
  posted_by_name: string;
  created_at: string;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export function DashboardClient({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annError, setAnnError] = useState<string | null>(null);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const { transactions, loaded, error: txnError, reload } = useOrgTransactions(orgId);

  const loadAnnouncements = useCallback(() => {
    setAnnError(null);
    apiGet(`/orgs/${orgId}/announcements`)
      .then((a) => setAnnouncements(a.slice(0, 3)))
      .catch((err) =>
        setAnnError(err instanceof ApiError ? err.message : "Could not load announcements")
      );
  }, [orgId]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    apiGet(`/orgs/${orgId}/pledges`)
      .then(setPledges)
      .catch(() => setPledges([]));
  }, [orgId]);

  const today = todayStr();
  const todaysTxns = transactions.filter((t) => t.enteredAt.slice(0, 10) === today);
  // Promises made today show here too (in addition to Reminders) — a pledge
  // is by definition not yet collected as long as it's still in this list;
  // once resolved it turns into a real entry and shows via todaysTxns instead.
  const todaysPledges = pledges.filter((p) => p.created_at.slice(0, 10) === today);

  const todayEmpty = todaysTxns.length === 0 && todaysPledges.length === 0;
  const todayItems = [
    ...todaysTxns.map((t) => ({ kind: "txn" as const, sortKey: t.enteredAt, t })),
    ...todaysPledges.map((p) => ({ kind: "pledge" as const, sortKey: p.created_at, p })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const todaySection = (
    <section className="flex flex-col">
      <h1 className="font-display text-heading-1 mb-3">Today</h1>
      {!loaded && !txnError && <p className="text-body text-ink-muted py-2">Loading…</p>}
      {txnError && (
        <div className="flex items-center justify-between gap-3 py-2">
          <p className="text-caption text-sindoor">{txnError}</p>
          <button onClick={reload} className="text-caption text-peacock font-semibold shrink-0">
            Retry
          </button>
        </div>
      )}
      {loaded && !txnError && todayEmpty && (
        <p className="text-body text-ink-muted py-2">No transactions today</p>
      )}
      {todayItems.map((item) =>
        item.kind === "txn" ? (
          <Link
            key={`txn-${item.t.type}-${item.t.id}`}
            href={item.t.href}
            className="flex items-center gap-3 border-b border-line py-3 min-h-11"
          >
            <div className="flex-1 min-w-0">
              <p className="text-body-strong truncate">{item.t.title}</p>
              <div className="flex items-center gap-1.5 min-w-0">
                <TxnTag type={item.t.type} />
                <p className="text-caption text-ink-muted truncate">{item.t.subtitle}</p>
              </div>
            </div>
            <AmountOrItem amount={item.t.amount} itemDescription={item.t.itemDescription} />
          </Link>
        ) : (
          <Link
            key={`pledge-${item.p.id}`}
            href={`/org/${orgId}/reminders`}
            className="flex items-center gap-3 border-b border-line py-3 min-h-11"
          >
            <div className="flex-1 min-w-0">
              <p className="text-body-strong truncate">{item.p.donor_name}</p>
              <div className="flex items-center gap-1.5 min-w-0">
                <TxnTag type="promised" />
                <p className="text-caption text-ink-muted truncate">
                  {item.p.item_description || "Cash"} — not yet collected
                </p>
              </div>
            </div>
            <AmountOrItem
              amount={item.p.promised_amount ?? 0}
              itemDescription={item.p.item_description}
            />
          </Link>
        )
      )}
    </section>
  );

  const announcementsSection = (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-heading-2 font-sans">Announcements</h2>
        <div className="flex items-center gap-3">
          {canWrite && (
            <Link href={`/org/${orgId}/announcements`} className="text-caption text-peacock">
              + Add
            </Link>
          )}
          {announcements.length > 0 && (
            <Link href={`/org/${orgId}/announcements`} className="text-caption text-peacock">
              View all →
            </Link>
          )}
        </div>
      </div>
      {annError && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-caption text-sindoor">{annError}</p>
          <button onClick={loadAnnouncements} className="text-caption text-peacock font-semibold shrink-0">
            Retry
          </button>
        </div>
      )}
      {announcements.length === 0 && !annError && (
        <p className="text-caption text-ink-muted">No announcements</p>
      )}
      {announcements.map((a) => (
        <div key={a.id} className="border-b border-line pb-2">
          <p className="text-body">{a.body}</p>
          <p className="text-caption text-ink-muted">
            {a.posted_by_name} · {formatDate(a.created_at.slice(0, 10))}
          </p>
        </div>
      ))}
    </section>
  );

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-6 max-w-2xl w-full mx-auto">
      {announcementsSection}
      {todaySection}
    </main>
  );
}
