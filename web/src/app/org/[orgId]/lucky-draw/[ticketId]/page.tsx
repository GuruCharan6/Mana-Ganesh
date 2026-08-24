"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPatch, apiDelete, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { AmountText } from "@/components/AmountText";
import { formatDate, formatAmount } from "@/lib/format";
import { useMyMembership } from "@/lib/useMyMembership";
import { useOrgName } from "@/lib/useOrgName";
import { PaymentMethodToggle, type PaymentMethod } from "@/components/PaymentMethodField";
import { ReceiptButton } from "@/components/ReceiptButton";

type Ticket = {
  id: string;
  buyer_name: string;
  buyer_mobile: string | null;
  buyer_address: string | null;
  amount: number;
  payment_method: "cash" | "qr";
  receipt_sent_at: string | null;
  sold_by_name: string;
  created_at: string;
};

export default function LuckyDrawTicketPage() {
  const { orgId, ticketId } = useParams<{ orgId: string; ticketId: string }>();
  const router = useRouter();
  const { isAdmin } = useMyMembership(orgId);
  const orgName = useOrgName(orgId);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTicket(await apiGet(`/lucky-draw/${ticketId}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load ticket (offline?)");
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove() {
    if (!confirm("Delete this ticket permanently? This cannot be undone.")) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await apiDelete(`/lucky-draw/${ticketId}`);
      router.push(`/org/${orgId}/lucky-draw`);
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "Could not delete ticket");
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col px-6 py-6 max-w-xl mx-auto w-full">
        <p className="text-caption text-sindoor">{error}</p>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="flex flex-1 flex-col px-6 py-6 max-w-xl mx-auto w-full">
        <p className="text-body text-ink-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-6 max-w-xl mx-auto w-full">
      <div className="flex flex-col gap-4 border border-line rounded-lg bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-heading-2 font-display break-words">{ticket.buyer_name}</p>
            {ticket.buyer_mobile && (
              <p className="text-caption text-ink-muted mt-0.5">+91 {ticket.buyer_mobile}</p>
            )}
          </div>
          <div className="shrink-0">
            <AmountText amount={ticket.amount} size="lg" />
          </div>
        </div>
        <dl className="grid grid-cols-[7.5rem_1fr] gap-y-2.5 text-caption">
          <dt className="text-ink-muted">Sold on</dt>
          <dd>{formatDate(ticket.created_at.slice(0, 10))}</dd>
          <dt className="text-ink-muted">Sold by</dt>
          <dd>{ticket.sold_by_name}</dd>
          <dt className="text-ink-muted">Payment</dt>
          <dd>{ticket.payment_method === "qr" ? "QR" : "Cash"}</dd>
          {ticket.buyer_address && (
            <>
              <dt className="text-ink-muted">Address</dt>
              <dd className="break-words">{ticket.buyer_address}</dd>
            </>
          )}
        </dl>
        {ticket.buyer_mobile && !ticket.receipt_sent_at && (
          <ReceiptButton
            ticketId={ticket.id}
            buyerName={ticket.buyer_name}
            buyerMobile={ticket.buyer_mobile}
            amount={ticket.amount}
            orgName={orgName}
            paymentMethod={ticket.payment_method}
            onSent={load}
          />
        )}
        {ticket.buyer_mobile && ticket.receipt_sent_at && (
          <p className="text-caption text-durva">Receipt sent.</p>
        )}
      </div>

      {isAdmin && !editing && (
        <div className="flex items-center gap-4">
          <button onClick={() => setEditing(true)} className="text-body font-semibold text-peacock">
            Edit
          </button>
          <button onClick={remove} disabled={deleting} className="text-body font-semibold text-sindoor">
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      )}
      {deleteError && <p className="text-caption text-sindoor">{deleteError}</p>}

      {isAdmin && editing && (
        <EditTicketForm
          ticket={ticket}
          onDone={() => {
            setEditing(false);
            load();
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </main>
  );
}

function EditTicketForm({
  ticket,
  onDone,
  onCancel,
}: {
  ticket: Ticket;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [buyerName, setBuyerName] = useState(ticket.buyer_name);
  const [buyerMobile, setBuyerMobile] = useState(ticket.buyer_mobile ?? "");
  const [buyerAddress, setBuyerAddress] = useState(ticket.buyer_address ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(ticket.payment_method);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!buyerName.trim()) return setError("Buyer name is required");
    setSaving(true);
    try {
      await apiPatch(`/lucky-draw/${ticket.id}`, {
        buyer_name: buyerName.trim(),
        buyer_mobile: buyerMobile.trim() || null,
        buyer_address: buyerAddress.trim() || null,
        payment_method: paymentMethod,
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 border border-line rounded-lg bg-surface p-4">
      <h2 className="text-heading-2 font-sans">Edit Ticket</h2>
      <p className="text-caption text-ink-muted">
        Amount is fixed to the ticket price set in Settings ({formatAmount(ticket.amount)}) and
        can&apos;t be changed here.
      </p>
      <input
        placeholder="Buyer name"
        value={buyerName}
        onChange={(e) => setBuyerName(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 text-body outline-none"
      />
      <input
        placeholder="Mobile (optional)"
        value={buyerMobile}
        onChange={(e) => setBuyerMobile(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 text-body outline-none"
      />
      <input
        placeholder="Address (optional)"
        value={buyerAddress}
        onChange={(e) => setBuyerAddress(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 text-body outline-none"
      />
      <PaymentMethodToggle value={paymentMethod} onChange={setPaymentMethod} />
      {error && <p className="text-caption text-sindoor">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} className="flex-1">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </section>
  );
}
