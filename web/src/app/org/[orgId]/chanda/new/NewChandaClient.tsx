"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AmountText } from "@/components/AmountText";
import { ThankYouButton } from "@/components/ThankYouButton";
import { addToOutbox } from "@/lib/offline/outbox";
import { syncOutbox } from "@/lib/offline/sync";
import { apiPost, ApiError } from "@/lib/api";
import { useOrgName } from "@/lib/useOrgName";

const today = () => new Date().toISOString().slice(0, 10);

type Saved = {
  donorName: string;
  donorMobile: string | null;
  amount: number;
  itemDescription: string | null;
  pledged: boolean;
};

export function NewChandaClient() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const orgName = useOrgName(orgId);
  const [entryMode, setEntryMode] = useState<"single" | "batch">("single");
  const [saved, setSaved] = useState<Saved | null>(null);

  if (saved) {
    return (
      <main className="flex flex-1 flex-col px-6 py-6 gap-6 max-w-xl mx-auto w-full items-center text-center">
        <div className="flex flex-col items-center gap-2 pt-8">
          <span className="h-2 w-2 rounded-full bg-durva animate-pulse" />
          <h1 className="font-display text-heading-1">
            {saved.pledged ? "Reminder Saved" : "Saved"}
          </h1>
          <p className="text-body-strong">{saved.donorName}</p>
          {saved.pledged ? (
            <p className="text-caption text-ink-muted">
              Will show up in Chanda and Reminders as &quot;Later&quot; until collected.
            </p>
          ) : (
            <AmountText amount={saved.amount} size="lg" />
          )}
        </div>

        <div className="w-full max-w-sm flex flex-col gap-3">
          {!saved.pledged && saved.donorMobile && (
            <ThankYouButton
              donorName={saved.donorName}
              donorMobile={saved.donorMobile}
              amount={saved.amount}
              orgName={orgName}
              itemDescription={saved.itemDescription}
            />
          )}
          <Button variant="secondary" onClick={() => setSaved(null)}>
            Add Another
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/org/${orgId}/chanda`)}>
            Done
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-4 max-w-xl mx-auto w-full">
      <h1 className="font-display text-heading-1">Add Chanda</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setEntryMode("single")}
          className={`flex-1 rounded-lg border px-3 py-2.5 text-body font-semibold ${
            entryMode === "single" ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
          }`}
        >
          Single
        </button>
        <button
          onClick={() => setEntryMode("batch")}
          className={`flex-1 rounded-lg border px-3 py-2.5 text-body font-semibold ${
            entryMode === "batch" ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
          }`}
        >
          Batch
        </button>
      </div>

      {entryMode === "single" ? (
        <SingleEntryForm orgId={orgId} onSaved={setSaved} />
      ) : (
        <BatchEntryForm orgId={orgId} onDone={() => router.push(`/org/${orgId}/chanda`)} />
      )}
    </main>
  );
}

function SingleEntryForm({
  orgId,
  onSaved,
}: {
  orgId: string;
  onSaved: (s: Saved) => void;
}) {
  const [donorName, setDonorName] = useState("");
  const [donorMobile, setDonorMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [collectedOn, setCollectedOn] = useState(today());
  const [area, setArea] = useState("");
  const [bookReference, setBookReference] = useState("");
  const [item, setItem] = useState("");
  const [promiseMode, setPromiseMode] = useState<"now" | "later">("now");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasItem = item.trim().length > 0;

  async function save() {
    setError(null);
    if (!donorName.trim()) return setError("Donor name is required");
    const mobileDigits = donorMobile.replace(/\D/g, "");
    if (mobileDigits.length > 0 && mobileDigits.length !== 10)
      return setError("Mobile number should be 10 digits, or leave it blank");
    if (!collectedOn) return setError("Date is required");

    const mobile = mobileDigits.length === 10 ? donorMobile.trim() : null;

    if (promiseMode === "later") {
      setSaving(true);
      try {
        await apiPost(`/orgs/${orgId}/pledges`, {
          donor_name: donorName.trim(),
          donor_mobile: mobile,
          item_description: hasItem ? item.trim() : null,
          promised_on: collectedOn,
          area: area.trim() || null,
          book_reference: bookReference.trim() || null,
          promised_amount: parseFloat(amount) || null,
        });
        onSaved({
          donorName: donorName.trim(),
          donorMobile: mobile,
          amount: 0,
          itemDescription: hasItem ? item.trim() : null,
          pledged: true,
        });
      } catch (e) {
        setError(
          e instanceof ApiError
            ? e.message
            : "Could not save — reminders need a connection, try again once you're back online"
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    const amt = parseFloat(amount) || 0;
    if (!hasItem && amt <= 0) return setError("Enter a valid amount");

    setSaving(true);
    await addToOutbox({
      orgId,
      kind: "chanda_create",
      displayTitle: donorName.trim(),
      displayDate: collectedOn,
      payload: {
        donorName: donorName.trim(),
        donorMobile: mobile,
        amount: amt,
        collectedOn,
        area: area.trim() || null,
        bookReference: bookReference.trim() || null,
        itemDescription: hasItem ? item.trim() : null,
      },
    });

    // Best-effort immediate sync; if offline this just no-ops and the entry
    // stays queued — the offline banner + list badge reflect that already.
    syncOutbox(orgId);

    setSaving(false);
    onSaved({
      donorName: donorName.trim(),
      donorMobile: mobile,
      amount: amt,
      itemDescription: hasItem ? item.trim() : null,
      pledged: false,
    });
  }

  return (
    <>
      <Field label="Donor name">
        <input
          value={donorName}
          onChange={(e) => setDonorName(e.target.value)}
          className="rounded-lg border border-line px-3 py-3 text-body outline-none"
        />
      </Field>

      <Field label="Donor mobile number (optional)">
        <div className="flex items-center rounded-lg border border-line overflow-hidden">
          <span className="px-3 text-body text-ink-muted border-r border-line py-3">+91</span>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={donorMobile}
            onChange={(e) => setDonorMobile(e.target.value)}
            className="flex-1 px-3 py-3 text-body outline-none"
          />
        </div>
      </Field>

      <Field label="What are they giving? (optional)">
        <input
          placeholder="Leave blank for cash — or e.g. 2 bags rice, oil"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          className="rounded-lg border border-line px-3 py-3 text-body outline-none"
        />
      </Field>

      <Field
        label={
          promiseMode === "later"
            ? "Promised amount in ₹ (optional)"
            : hasItem
              ? "Estimated value in ₹ (optional)"
              : "Amount (₹)"
        }
      >
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg border border-line px-3 py-3 text-body font-mono outline-none"
        />
      </Field>

      <Field label={promiseMode === "later" ? "Promised on" : "Collected on"}>
        <input
          type="date"
          value={collectedOn}
          onChange={(e) => setCollectedOn(e.target.value)}
          max={today()}
          className="rounded-lg border border-line px-3 py-3 text-body outline-none"
        />
      </Field>

      <Field label="Area / address (optional)">
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="rounded-lg border border-line px-3 py-3 text-body outline-none"
        />
      </Field>

      <Field label="Book reference (optional)">
        <input
          value={bookReference}
          onChange={(e) => setBookReference(e.target.value)}
          className="rounded-lg border border-line px-3 py-3 text-body outline-none"
        />
      </Field>

      <Field label="Have they given it, or promised for later?">
        <div className="flex gap-2">
          <button
            onClick={() => setPromiseMode("now")}
            className={`flex-1 rounded-lg border px-3 py-2.5 text-body font-semibold ${
              promiseMode === "now" ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
            }`}
          >
            Received now
          </button>
          <button
            onClick={() => setPromiseMode("later")}
            className={`flex-1 rounded-lg border px-3 py-2.5 text-body font-semibold ${
              promiseMode === "later" ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
            }`}
          >
            Promised for later
          </button>
        </div>
      </Field>

      {error && <p className="text-caption text-sindoor">{error}</p>}

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving..." : promiseMode === "later" ? "Save Reminder" : "Save Chanda"}
      </Button>
    </>
  );
}

type Row = {
  key: string;
  donorName: string;
  donorMobile: string;
  amount: string;
  collectedOn: string;
  area: string;
  bookReference: string;
  item: string;
  promiseMode: "now" | "later";
};

function newRow(collectedOn: string): Row {
  return {
    key: crypto.randomUUID(),
    donorName: "",
    donorMobile: "",
    amount: "",
    collectedOn,
    area: "",
    bookReference: "",
    item: "",
    promiseMode: "now",
  };
}

function BatchEntryForm({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [sharedDate, setSharedDate] = useState(today());
  const [rows, setRows] = useState<Row[]>([newRow(today())]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, newRow(sharedDate)]);
  }

  function removeRow(key: string) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  }

  async function saveAll() {
    setError(null);
    const filled = rows.filter((r) => r.donorName.trim() || r.amount.trim() || r.item.trim());
    if (filled.length === 0) return setError("Add at least one row");

    for (const r of filled) {
      if (!r.donorName.trim()) return setError("Every row needs a donor name");
      const mobileDigits = r.donorMobile.replace(/\D/g, "");
      if (mobileDigits.length > 0 && mobileDigits.length !== 10)
        return setError(`Mobile number for ${r.donorName} should be 10 digits, or left blank`);
      if (r.promiseMode === "now") {
        const amt = parseFloat(r.amount);
        if (!r.item.trim() && (!amt || amt <= 0))
          return setError(`Enter a valid amount or item for ${r.donorName}`);
      }
    }

    setSaving(true);
    const failures: string[] = [];

    for (const r of filled) {
      const mobileDigits = r.donorMobile.replace(/\D/g, "");
      const mobile = mobileDigits.length === 10 ? r.donorMobile.trim() : null;
      const hasItem = r.item.trim().length > 0;

      if (r.promiseMode === "later") {
        try {
          await apiPost(`/orgs/${orgId}/pledges`, {
            donor_name: r.donorName.trim(),
            donor_mobile: mobile,
            item_description: hasItem ? r.item.trim() : null,
            promised_on: r.collectedOn,
            area: r.area.trim() || null,
            book_reference: r.bookReference.trim() || null,
            promised_amount: parseFloat(r.amount) || null,
          });
        } catch (e) {
          failures.push(
            `${r.donorName}: ${e instanceof ApiError ? e.message : "could not save reminder"}`
          );
        }
        continue;
      }

      await addToOutbox({
        orgId,
        kind: "chanda_create",
        displayTitle: r.donorName.trim(),
        displayDate: r.collectedOn,
        payload: {
          donorName: r.donorName.trim(),
          donorMobile: mobile,
          amount: parseFloat(r.amount) || 0,
          collectedOn: r.collectedOn,
          area: r.area.trim() || null,
          bookReference: r.bookReference.trim() || null,
          itemDescription: hasItem ? r.item.trim() : null,
        },
      });
    }

    syncOutbox(orgId);
    setSaving(false);

    if (failures.length > 0) {
      setError(`Some reminders couldn't be saved — ${failures.join("; ")}`);
      return;
    }
    onDone();
  }

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-body font-semibold">Collected on (applies to new rows)</span>
        <input
          type="date"
          value={sharedDate}
          max={today()}
          onChange={(e) => setSharedDate(e.target.value)}
          className="rounded-lg border border-line px-3 py-2.5 text-body outline-none max-w-xs"
        />
      </label>

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
              placeholder="Donor name"
              value={r.donorName}
              onChange={(e) => update(r.key, { donorName: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-body outline-none"
            />
            <input
              placeholder="Mobile (optional, 10 digits)"
              inputMode="numeric"
              maxLength={10}
              value={r.donorMobile}
              onChange={(e) => update(r.key, { donorMobile: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-body outline-none"
            />
            <input
              placeholder="What are they giving? (optional — leave blank for cash)"
              value={r.item}
              onChange={(e) => update(r.key, { item: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-body outline-none"
            />
            <input
              placeholder={
                r.promiseMode === "later"
                  ? "Promised amount in ₹ (optional)"
                  : r.item.trim()
                    ? "Estimated value in ₹ (optional)"
                    : "Amount"
              }
              type="number"
              inputMode="decimal"
              value={r.amount}
              onChange={(e) => update(r.key, { amount: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-body font-mono outline-none"
            />
            <input
              type="date"
              value={r.collectedOn}
              max={today()}
              onChange={(e) => update(r.key, { collectedOn: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-body outline-none"
            />
            <input
              placeholder="Area (optional)"
              value={r.area}
              onChange={(e) => update(r.key, { area: e.target.value })}
              className="w-full rounded-lg border border-line px-3 py-2 text-body outline-none"
            />
            <input
              placeholder="Book reference (optional)"
              value={r.bookReference}
              onChange={(e) => update(r.key, { bookReference: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-body outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => update(r.key, { promiseMode: "now" })}
                className={`flex-1 rounded-lg border px-2 py-2 text-caption font-semibold ${
                  r.promiseMode === "now"
                    ? "border-marigold bg-marigold/10 text-ink"
                    : "border-line text-ink-muted"
                }`}
              >
                Received now
              </button>
              <button
                onClick={() => update(r.key, { promiseMode: "later" })}
                className={`flex-1 rounded-lg border px-2 py-2 text-caption font-semibold ${
                  r.promiseMode === "later"
                    ? "border-marigold bg-marigold/10 text-ink"
                    : "border-line text-ink-muted"
                }`}
              >
                Promised for later
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button variant="secondary" onClick={addRow}>
        + Add Row
      </Button>

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
