"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";
import { addToOutbox } from "@/lib/offline/outbox";
import { syncOutbox } from "@/lib/offline/sync";

const today = () => new Date().toISOString().slice(0, 10);

export function NewExpenseClient() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();

  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today());
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount");
    if (!expenseDate) return setError("Date is required");

    setSaving(true);
    await addToOutbox({
      orgId,
      kind: "expense_create",
      displayTitle: vendorName.trim() || category,
      displayDate: expenseDate,
      payload: {
        category,
        vendorName: vendorName.trim() || null,
        amount: amt,
        expenseDate,
        receiptFile: receipt,
      },
    });

    syncOutbox(orgId);
    router.push(`/org/${orgId}/expenses`);
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-4 max-w-xl mx-auto w-full">
      <h1 className="font-display text-heading-1">Add Expense</h1>

      <Field label="Category">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-line px-3 py-3 text-body outline-none bg-surface"
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Vendor / payee name (optional)">
        <input
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          className="rounded-lg border border-line px-3 py-3 text-body outline-none"
        />
      </Field>

      <Field label="Amount (₹)">
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg border border-line px-3 py-3 text-body font-mono outline-none"
        />
      </Field>

      <Field label="Date">
        <input
          type="date"
          value={expenseDate}
          max={today()}
          onChange={(e) => setExpenseDate(e.target.value)}
          className="rounded-lg border border-line px-3 py-3 text-body outline-none"
        />
      </Field>

      <Field label="Receipt photo (optional)">
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
          className="text-body"
        />
      </Field>

      {error && <p className="text-caption text-sindoor">{error}</p>}

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save Expense"}
      </Button>
    </main>
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
