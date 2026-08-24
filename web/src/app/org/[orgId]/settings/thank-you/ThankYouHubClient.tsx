"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useOrgName } from "@/lib/useOrgName";
import { ThankYouButton } from "@/components/ThankYouButton";
import { ReceiptButton } from "@/components/ReceiptButton";

type ChandaEntry = {
  id: string;
  donor_name: string;
  donor_mobile: string | null;
  amount: number;
  item_description: string | null;
  collected_on: string;
  thank_you_sent_at: string | null;
};

type LuckyDrawTicket = {
  id: string;
  buyer_name: string;
  buyer_mobile: string | null;
  amount: number;
  payment_method: "cash" | "qr";
  created_at: string;
  receipt_sent_at: string | null;
};

export function ThankYouHubClient({ orgId }: { orgId: string }) {
  const orgName = useOrgName(orgId);
  const [tab, setTab] = useState<"thank-you" | "lucky-draw">("thank-you");

  const [chanda, setChanda] = useState<ChandaEntry[] | null>(null);
  const [chandaError, setChandaError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<LuckyDrawTicket[] | null>(null);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const loadChanda = useCallback(() => {
    setChandaError(null);
    apiGet(`/orgs/${orgId}/chanda`)
      .then(setChanda)
      .catch((e) => setChandaError(e instanceof ApiError ? e.message : "Could not load"));
  }, [orgId]);

  const loadTickets = useCallback(() => {
    setTicketsError(null);
    apiGet(`/orgs/${orgId}/lucky-draw`)
      .then(setTickets)
      .catch((e) => setTicketsError(e instanceof ApiError ? e.message : "Could not load"));
  }, [orgId]);

  useEffect(() => {
    loadChanda();
    loadTickets();
  }, [loadChanda, loadTickets]);

  const outstandingChanda = (chanda ?? []).filter((c) => c.donor_mobile && !c.thank_you_sent_at);
  const outstandingTickets = (tickets ?? []).filter((t) => t.buyer_mobile && !t.receipt_sent_at);

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-4 max-w-xl mx-auto w-full">
      <h1 className="font-display text-heading-1">Thank You</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("thank-you")}
          className={`flex-1 rounded-lg border px-3 py-2.5 text-body font-semibold ${
            tab === "thank-you" ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
          }`}
        >
          Thank You
        </button>
        <button
          onClick={() => setTab("lucky-draw")}
          className={`flex-1 rounded-lg border px-3 py-2.5 text-body font-semibold ${
            tab === "lucky-draw" ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
          }`}
        >
          Lucky Draw
        </button>
      </div>

      {tab === "thank-you" ? (
        <div className="flex flex-col">
          {chandaError && <p className="text-caption text-sindoor">{chandaError}</p>}
          {chanda !== null && outstandingChanda.length === 0 && !chandaError && (
            <p className="text-body text-ink-muted py-4">All caught up — nothing outstanding.</p>
          )}
          {outstandingChanda.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-b border-line py-3 min-h-11">
              <div className="flex-1 min-w-0">
                <p className="text-body-strong truncate">{c.donor_name}</p>
                <p className="text-caption text-ink-muted truncate">
                  {formatDate(c.collected_on)} · +91 {c.donor_mobile}
                </p>
              </div>
              <ThankYouButton
                entryId={c.id}
                donorName={c.donor_name}
                donorMobile={c.donor_mobile!}
                amount={c.amount}
                orgName={orgName}
                itemDescription={c.item_description}
                onSent={loadChanda}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          {ticketsError && <p className="text-caption text-sindoor">{ticketsError}</p>}
          {tickets !== null && outstandingTickets.length === 0 && !ticketsError && (
            <p className="text-body text-ink-muted py-4">All caught up — nothing outstanding.</p>
          )}
          {outstandingTickets.map((t) => (
            <div key={t.id} className="flex items-center gap-3 border-b border-line py-3 min-h-11">
              <div className="flex-1 min-w-0">
                <p className="text-body-strong truncate">{t.buyer_name}</p>
                <p className="text-caption text-ink-muted truncate">
                  {formatDate(t.created_at.slice(0, 10))} · +91 {t.buyer_mobile}
                </p>
              </div>
              <ReceiptButton
                ticketId={t.id}
                buyerName={t.buyer_name}
                buyerMobile={t.buyer_mobile!}
                amount={t.amount}
                orgName={orgName}
                paymentMethod={t.payment_method}
                onSent={loadTickets}
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
