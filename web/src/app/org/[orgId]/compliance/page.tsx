"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";

type Row = {
  member_id: string;
  name: string;
  entries_today: number;
  last_entered_on: string | null;
};

export default function CompliancePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet(`/orgs/${orgId}/compliance`)
      .then(setRows)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Could not load compliance data")
      );
  }, [orgId]);

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-4 max-w-xl mx-auto w-full">
      <h1 className="font-display text-heading-1">Daily Compliance</h1>
      <p className="text-caption text-ink-muted">
        Who has logged chanda today, and when each member last entered anything.
      </p>

      {error && <p className="text-caption text-sindoor">{error}</p>}
      {rows === null && !error && <p className="text-body text-ink-muted">Loading…</p>}

      {rows && (
        <div className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-line pb-2">
            <span className="flex-1 text-caption text-ink-muted uppercase tracking-[0.02em]">
              Member
            </span>
            <span className="w-24 text-caption text-ink-muted uppercase tracking-[0.02em] text-right">
              Entries Today
            </span>
            <span className="w-32 text-caption text-ink-muted uppercase tracking-[0.02em] text-right">
              Last Entered
            </span>
          </div>
          {rows.map((r) => (
            <div key={r.member_id} className="flex items-center gap-3 border-b border-line py-3 min-h-11">
              <span className="flex-1 text-body-strong truncate">{r.name}</span>
              <span
                className={`w-24 text-right font-mono text-amount-sm ${
                  r.entries_today > 0 ? "text-durva" : "text-ink-muted"
                }`}
              >
                {r.entries_today}
              </span>
              <span className="w-32 text-right text-caption text-ink-muted">
                {r.last_entered_on
                  ? new Date(r.last_entered_on).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })
                  : "Never"}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
