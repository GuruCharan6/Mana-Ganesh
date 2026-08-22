"use client";

import { useState } from "react";
import { apiPost, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";

export type Pledge = {
  id: string;
  donor_name: string;
  donor_mobile: string | null;
  item_description: string | null;
  promised_on: string;
};

export function PledgeRow({
  pledge,
  onResolved,
}: {
  pledge: Pledge;
  onResolved: () => void;
}) {
  const [mode, setMode] = useState<"none" | "collected" | "cash">("none");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolveCollected() {
    setError(null);
    setSaving(true);
    try {
      await apiPost(`/pledges/${pledge.id}/resolve-collected`, {
        value: value.trim() ? parseFloat(value) : null,
      });
      onResolved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not resolve");
      setSaving(false);
    }
  }

  async function resolveCash() {
    setError(null);
    const amt = parseFloat(value);
    if (!amt || amt <= 0) return setError("Enter the cash amount they gave");
    setSaving(true);
    try {
      await apiPost(`/pledges/${pledge.id}/resolve-cash`, { amount: amt });
      onResolved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not resolve");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-line py-3">
      <div className="flex items-center gap-1.5">
        <span className="text-badge uppercase tracking-[0.02em] px-1 rounded shrink-0 bg-marigold/10 text-marigold">
          Later
        </span>
        <p className="text-body-strong">{pledge.donor_name}</p>
      </div>
      <p className="text-caption text-ink-muted">
        {pledge.item_description || "Cash"} · promised {formatDate(pledge.promised_on)}
      </p>

      {mode === "none" && (
        <div className="flex gap-x-4 gap-y-1 flex-wrap">
          <button onClick={() => setMode("collected")} className="text-caption text-peacock">
            Collected
          </button>
          <button onClick={() => setMode("cash")} className="text-caption text-peacock">
            Got Cash Instead
          </button>
        </div>
      )}

      {mode === "collected" && (
        <div className="flex flex-col gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Estimated value in ₹ (optional)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-lg border border-line px-3 py-2 text-body font-mono outline-none"
          />
          {error && <p className="text-caption text-sindoor">{error}</p>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={resolveCollected} disabled={saving}>
              {saving ? "Saving..." : "Confirm Collected"}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setMode("none")}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === "cash" && (
        <div className="flex flex-col gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Cash amount (₹)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-lg border border-line px-3 py-2 text-body font-mono outline-none"
          />
          {error && <p className="text-caption text-sindoor">{error}</p>}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={resolveCash} disabled={saving}>
              {saving ? "Saving..." : "Confirm Cash"}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setMode("none")}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
