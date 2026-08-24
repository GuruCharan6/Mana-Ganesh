"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { formatAmount } from "@/lib/format";
import { useOrgPaymentQr } from "@/lib/useOrgPaymentQr";
import { PaymentMethodField, PaymentMethodToggle, type PaymentMethod } from "@/components/PaymentMethodField";

const QUANTITY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function NewLuckyDrawClient() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const qrUrl = useOrgPaymentQr(orgId);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [ticketPrice, setTicketPrice] = useState<number | null>(null);

  useEffect(() => {
    apiGet(`/orgs/${orgId}`)
      .then((org) => setTicketPrice(org.lucky_draw_ticket_price ?? null))
      .catch(() => {});
  }, [orgId]);

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-4 max-w-xl mx-auto w-full">
      <h1 className="font-display text-heading-1">Sell Lucky Draw Tickets</h1>

      {ticketPrice === null && (
        <p className="text-caption text-sindoor">
          No ticket price set yet — an Admin needs to set one in Settings first.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setMode("single")}
          className={`flex-1 rounded-lg border px-3 py-2.5 text-body font-semibold ${
            mode === "single" ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
          }`}
        >
          Single
        </button>
        <button
          onClick={() => setMode("batch")}
          className={`flex-1 rounded-lg border px-3 py-2.5 text-body font-semibold ${
            mode === "batch" ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
          }`}
        >
          Batch
        </button>
      </div>

      {mode === "single" ? (
        <SingleTicketForm
          orgId={orgId}
          ticketPrice={ticketPrice}
          qrUrl={qrUrl}
          onDone={() => router.push(`/org/${orgId}/lucky-draw`)}
        />
      ) : (
        <BatchTicketForm
          orgId={orgId}
          ticketPrice={ticketPrice}
          onDone={() => router.push(`/org/${orgId}/lucky-draw`)}
        />
      )}
    </main>
  );
}

type Ticket = { name: string; mobile: string; address: string };

function emptyTickets(n: number): Ticket[] {
  return Array.from({ length: n }, () => ({ name: "", mobile: "", address: "" }));
}

function SingleTicketForm({
  orgId,
  ticketPrice,
  qrUrl,
  onDone,
}: {
  orgId: string;
  ticketPrice: number | null;
  qrUrl: string | null;
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [tickets, setTickets] = useState<Ticket[]>(emptyTickets(1));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setQty(n: number) {
    setQuantity(n);
    setTickets((prev) => {
      if (n === prev.length) return prev;
      if (n < prev.length) return prev.slice(0, n);
      return [...prev, ...emptyTickets(n - prev.length)];
    });
  }

  function updateTicket(i: number, patch: Partial<Ticket>) {
    setTickets((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  const totalAmount = ticketPrice ? ticketPrice * quantity : 0;

  async function save() {
    setError(null);
    if (!ticketPrice || ticketPrice <= 0) {
      return setError("Set a ticket price in Settings before selling tickets");
    }
    for (const t of tickets) {
      if (!t.name.trim()) return setError("Every ticket needs a buyer name");
      const digits = t.mobile.replace(/\D/g, "");
      if (digits.length > 0 && digits.length !== 10)
        return setError(`Mobile number for ${t.name} should be 10 digits, or left blank`);
    }

    setSaving(true);
    try {
      await apiPost(`/orgs/${orgId}/lucky-draw`, {
        payment_method: paymentMethod,
        tickets: tickets.map((t) => {
          const digits = t.mobile.replace(/\D/g, "");
          return {
            buyer_name: t.name.trim(),
            buyer_mobile: digits.length === 10 ? t.mobile.trim() : null,
            buyer_address: t.address.trim() || null,
          };
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save — check your connection");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Field label="How many tickets?">
        <div className="flex gap-2 flex-wrap">
          {QUANTITY_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setQty(n)}
              className={`rounded-lg border px-4 py-2 text-body font-semibold ${
                quantity === n ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>

      <div className="flex flex-col gap-3">
        {tickets.map((t, i) => (
          <div key={i} className="border border-line rounded-lg bg-surface p-3 flex flex-col gap-2">
            <span className="text-caption text-ink-muted">Ticket {i + 1}</span>
            <input
              placeholder="Buyer name"
              value={t.name}
              onChange={(e) => updateTicket(i, { name: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-body outline-none"
            />
            <div className="flex items-center rounded-lg border border-line overflow-hidden">
              <span className="px-3 text-body text-ink-muted border-r border-line py-2">+91</span>
              <input
                placeholder="Mobile (optional)"
                inputMode="numeric"
                maxLength={10}
                value={t.mobile}
                onChange={(e) => updateTicket(i, { mobile: e.target.value })}
                className="flex-1 px-3 py-2 text-body outline-none"
              />
            </div>
            <input
              placeholder="Address (optional)"
              value={t.address}
              onChange={(e) => updateTicket(i, { address: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-body outline-none"
            />
          </div>
        ))}
      </div>

      <Field label="Amount">
        <p className="rounded-lg border border-line px-3 py-3 text-body font-mono bg-ink-muted/5">
          {formatAmount(totalAmount)}
        </p>
      </Field>

      <Field label="Payment method">
        <PaymentMethodField qrUrl={qrUrl} value={paymentMethod} onChange={setPaymentMethod} />
      </Field>

      {error && <p className="text-caption text-sindoor">{error}</p>}

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving..." : `Save ${quantity} Ticket${quantity > 1 ? "s" : ""}`}
      </Button>
    </>
  );
}

type BatchRow = Ticket & { key: string; paymentMethod: PaymentMethod };

function newBatchRow(): BatchRow {
  return {
    key: crypto.randomUUID(),
    name: "",
    mobile: "",
    address: "",
    paymentMethod: "cash",
  };
}

function BatchTicketForm({
  orgId,
  ticketPrice,
  onDone,
}: {
  orgId: string;
  ticketPrice: number | null;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<BatchRow[]>([newBatchRow()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(key: string, patch: Partial<BatchRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, newBatchRow()]);
  }

  function removeRow(key: string) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  }

  async function saveAll() {
    setError(null);
    if (!ticketPrice || ticketPrice <= 0) {
      return setError("Set a ticket price in Settings before selling tickets");
    }
    const filled = rows.filter((r) => r.name.trim());
    if (filled.length === 0) return setError("Add at least one row");

    for (const r of filled) {
      const digits = r.mobile.replace(/\D/g, "");
      if (digits.length > 0 && digits.length !== 10)
        return setError(`Mobile number for ${r.name} should be 10 digits, or left blank`);
    }

    setSaving(true);
    const failures: string[] = [];
    for (const r of filled) {
      const digits = r.mobile.replace(/\D/g, "");
      try {
        await apiPost(`/orgs/${orgId}/lucky-draw`, {
          payment_method: r.paymentMethod,
          tickets: [
            {
              buyer_name: r.name.trim(),
              buyer_mobile: digits.length === 10 ? r.mobile.trim() : null,
              buyer_address: r.address.trim() || null,
            },
          ],
        });
      } catch (e) {
        const reason = e instanceof ApiError ? e.message : "could not save";
        failures.push(`${r.name}: ${reason}`);
      }
    }

    setSaving(false);
    if (failures.length > 0) {
      setError(`Some tickets couldn't be saved — ${failures.join("; ")}`);
      return;
    }
    onDone();
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={r.key} className="border border-line rounded-lg bg-surface p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-caption text-ink-muted">Row {i + 1}</span>
              {rows.length > 1 && (
                <button onClick={() => removeRow(r.key)} className="text-caption text-sindoor">
                  Remove
                </button>
              )}
            </div>
            <input
              placeholder="Buyer name"
              value={r.name}
              onChange={(e) => update(r.key, { name: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-body outline-none"
            />
            <input
              placeholder="Mobile (optional, 10 digits)"
              inputMode="numeric"
              maxLength={10}
              value={r.mobile}
              onChange={(e) => update(r.key, { mobile: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-body outline-none"
            />
            <input
              placeholder="Address (optional)"
              value={r.address}
              onChange={(e) => update(r.key, { address: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-body outline-none"
            />
            <PaymentMethodToggle
              value={r.paymentMethod}
              onChange={(v) => update(r.key, { paymentMethod: v })}
            />
          </div>
        ))}
      </div>

      <Button variant="secondary" onClick={addRow}>
        + Add Row
      </Button>

      {ticketPrice && (
        <Field label="Amount per ticket">
          <p className="rounded-lg border border-line px-3 py-3 text-body font-mono bg-ink-muted/5">
            {formatAmount(ticketPrice)}
          </p>
        </Field>
      )}

      {error && <p className="text-caption text-sindoor">{error}</p>}

      <Button onClick={saveAll} disabled={saving}>
        {saving ? "Saving..." : `Save All (${rows.length})`}
      </Button>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-body font-semibold">{label}</span>
      {children}
    </label>
  );
}
