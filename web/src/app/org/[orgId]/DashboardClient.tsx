"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { AmountOrItem } from "@/components/AmountOrItem";
import { TxnTag } from "@/components/TxnTag";
import { useOrgTransactions } from "@/lib/useOrgTransactions";

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

  const today = todayStr();
  const todaysTxns = transactions.filter((t) => t.enteredAt.slice(0, 10) === today);

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
      {loaded && !txnError && todaysTxns.length === 0 && (
        <p className="text-body text-ink-muted py-2">Nothing logged yet today.</p>
      )}
      {todaysTxns.map((t) => (
        <Link
          key={`${t.type}-${t.id}`}
          href={t.href}
          className="flex items-center gap-3 border-b border-line py-3 min-h-11"
        >
          <div className="flex-1 min-w-0">
            <p className="text-body-strong truncate">{t.title}</p>
            <div className="flex items-center gap-1.5 min-w-0">
              <TxnTag type={t.type} />
              <p className="text-caption text-ink-muted truncate">{t.subtitle}</p>
            </div>
          </div>
          <AmountOrItem amount={t.amount} itemDescription={t.itemDescription} />
        </Link>
      ))}
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
        <p className="text-caption text-ink-muted">No announcements yet.</p>
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
