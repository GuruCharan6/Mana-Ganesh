"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";
import { AmountOrItem } from "@/components/AmountOrItem";
import { TxnTag } from "@/components/TxnTag";
import { useOrgTransactions } from "@/lib/useOrgTransactions";

export default function TransactionsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { transactions, loaded, error, reload } = useOrgTransactions(orgId);

  const [memberFilter, setMemberFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // all | chanda | <expense category>
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const memberNames = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.memberName))).sort(),
    [transactions]
  );

  const filtered = transactions.filter((t) => {
    if (memberFilter !== "all" && t.memberName !== memberFilter) return false;
    if (typeFilter === "chanda" && t.type !== "chanda") return false;
    if (typeFilter !== "all" && typeFilter !== "chanda" && t.category !== typeFilter) return false;
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    return true;
  });

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-4 max-w-2xl mx-auto w-full">
      <h1 className="font-display text-heading-1">History</h1>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="min-w-0 rounded-lg border border-line px-2 py-2 text-caption outline-none bg-surface"
        >
          <option value="all">All members</option>
          {memberNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="min-w-0 rounded-lg border border-line px-2 py-2 text-caption outline-none bg-surface"
        >
          <option value="all">All types</option>
          <option value="chanda">Chanda only</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-badge text-ink-muted uppercase tracking-[0.02em]">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-line px-2 py-2 text-caption outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-badge text-ink-muted uppercase tracking-[0.02em]">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-line px-2 py-2 text-caption outline-none"
          />
        </label>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-caption text-sindoor">{error}</p>
          <button onClick={reload} className="text-caption text-peacock font-semibold shrink-0">
            Retry
          </button>
        </div>
      )}

      <div className="flex flex-col">
        {!loaded && !error && <p className="text-body text-ink-muted py-4">Loading…</p>}
        {loaded && filtered.length === 0 && (
          <p className="text-body text-ink-muted py-4">No transactions match these filters.</p>
        )}
        {filtered.map((t) => (
          <Link
            key={`${t.type}-${t.id}`}
            href={t.href}
            className="flex items-center gap-3 border-b border-line py-3 min-h-11"
          >
            <div className="flex-1 min-w-0">
              <p className="text-body-strong truncate">{t.title}</p>
              <TxnTag type={t.type} />
              <p className="text-caption text-ink-muted truncate">
                {formatDate(t.date)} · {t.subtitle}
              </p>
            </div>
            <AmountOrItem amount={t.amount} itemDescription={t.itemDescription} />
          </Link>
        ))}
      </div>
    </main>
  );
}
