"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet, apiPatchForm, apiDelete, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { AmountText } from "@/components/AmountText";
import { SyncBadge } from "@/components/ui/SyncBadge";
import { formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";
import { addToOutbox, listOutboxByKind, onOutboxChange } from "@/lib/offline/outbox";
import { syncOutbox } from "@/lib/offline/sync";
import { useOutboxSync } from "@/lib/offline/useOutboxSync";
import { useMyMembership } from "@/lib/useMyMembership";
import type { ExpenseAdjustPayload, ExpenseCommentPayload, OutboxRecord } from "@/lib/offline/db";

type Entry = {
  id: string;
  category: string;
  vendor_name: string | null;
  amount: number;
  expense_date: string;
  receipt_url: string | null;
  adjustment_for: string | null;
  logged_by_name: string;
};

type Comment = {
  id: string;
  comment: string;
  commented_by_name: string;
  created_at: string;
};

type Detail = {
  entry: Entry;
  comments: Comment[];
  adjustments: Entry[];
};

export default function ExpenseDetailPage() {
  const { orgId, expenseId } = useParams<{ orgId: string; expenseId: string }>();
  const router = useRouter();
  const { isAdmin } = useMyMembership(orgId);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingComments, setPendingComments] = useState<OutboxRecord[]>([]);
  const [pendingAdjustments, setPendingAdjustments] = useState<OutboxRecord[]>([]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function remove() {
    if (!confirm("Delete this expense entry permanently? This cannot be undone.")) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await apiDelete(`/expenses/${expenseId}`);
      router.push(`/org/${orgId}/expenses`);
    } catch (e) {
      setDeleteError(e instanceof ApiError ? e.message : "Could not delete entry");
      setDeleting(false);
    }
  }

  const load = useCallback(async () => {
    try {
      setDetail(await apiGet(`/expenses/${expenseId}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load entry (offline?)");
    }
  }, [expenseId]);

  const loadPending = useCallback(async () => {
    const comments = await listOutboxByKind(orgId, ["expense_comment"]);
    const adjustments = await listOutboxByKind(orgId, ["expense_adjust"]);
    setPendingComments(
      comments.filter((r) => (r.payload as ExpenseCommentPayload).entryId === expenseId)
    );
    setPendingAdjustments(
      adjustments.filter((r) => (r.payload as ExpenseAdjustPayload).entryId === expenseId)
    );
  }, [orgId, expenseId]);

  useOutboxSync(orgId, () => {
    load();
    loadPending();
  });

  useEffect(() => {
    load();
    loadPending();
    const unsubscribe = onOutboxChange(loadPending);
    return unsubscribe;
  }, [load, loadPending]);

  if (error) {
    return (
      <main className="flex flex-1 flex-col px-6 py-6 max-w-xl mx-auto w-full">
        <p className="text-caption text-sindoor">{error}</p>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="flex flex-1 flex-col px-6 py-6 max-w-xl mx-auto w-full">
        <p className="text-body text-ink-muted">Loading…</p>
      </main>
    );
  }

  const { entry, comments, adjustments } = detail;

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-6 max-w-xl mx-auto w-full">
      <div className="flex flex-col gap-3 border border-line rounded-lg bg-surface p-4">
        {entry.adjustment_for && (
          <span className="text-caption text-marigold font-semibold">
            Adjustment entry
          </span>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-heading-2 font-display break-words">
              {entry.vendor_name || entry.category}
            </p>
            <p className="text-caption text-ink-muted">{entry.category}</p>
          </div>
          <div className="shrink-0">
            <AmountText amount={entry.amount} size="lg" />
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-caption">
          <dt className="text-ink-muted">Date</dt>
          <dd>{formatDate(entry.expense_date)}</dd>
          <dt className="text-ink-muted">Logged by</dt>
          <dd>{entry.logged_by_name}</dd>
        </dl>
        {entry.receipt_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.receipt_url}
            alt="Receipt"
            className="rounded-lg border border-line max-h-80 object-contain"
          />
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
        <EditExpenseForm
          entry={entry}
          onDone={() => {
            setEditing(false);
            load();
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {(adjustments.length > 0 || pendingAdjustments.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-heading-2 font-sans">Adjustments</h2>
          {adjustments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 border-b border-line py-3">
              <p className="text-caption text-ink-muted">
                {formatDate(a.expense_date)} · {a.logged_by_name}
              </p>
              <AmountText amount={a.amount} />
            </div>
          ))}
          {pendingAdjustments.map((r) => {
            const p = r.payload as ExpenseAdjustPayload;
            return (
              <div key={r.localId} className="flex items-center justify-between gap-3 border-b border-line py-3">
                <SyncBadge status={r.status === "error" ? "error" : "pending"} />
                <AmountText amount={p.amount} />
              </div>
            );
          })}
        </section>
      )}

      <CommentsSection
        comments={comments}
        pending={pendingComments}
        orgId={orgId}
        expenseId={expenseId}
      />
      <AdjustSection orgId={orgId} expenseId={expenseId} />
    </main>
  );
}

function CommentsSection({
  comments,
  pending,
  orgId,
  expenseId,
}: {
  comments: Comment[];
  pending: OutboxRecord[];
  orgId: string;
  expenseId: string;
}) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  async function post() {
    if (!text.trim()) return;
    setPosting(true);
    await addToOutbox({
      orgId,
      kind: "expense_comment",
      displayTitle: text.trim().slice(0, 40),
      payload: { entryId: expenseId, comment: text.trim() },
    });
    setText("");
    setPosting(false);
    syncOutbox(orgId);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-heading-2 font-sans">Comments</h2>
      {comments.length === 0 && pending.length === 0 && (
        <p className="text-caption text-ink-muted">No comments yet.</p>
      )}
      {comments.map((c) => (
        <div key={c.id} className="border-b border-line pb-2">
          <p className="text-body">{c.comment}</p>
          <p className="text-caption text-ink-muted">
            {c.commented_by_name} · {formatDate(c.created_at.slice(0, 10))}
          </p>
        </div>
      ))}
      {pending.map((r) => {
        const p = r.payload as ExpenseCommentPayload;
        return (
          <div key={r.localId} className="border-b border-line pb-2">
            <p className="text-body">{p.comment}</p>
            <SyncBadge status={r.status === "error" ? "error" : "pending"} />
          </div>
        );
      })}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a comment..."
        rows={2}
        className="rounded-lg border border-line px-3 py-2 text-body outline-none resize-none"
      />
      <Button variant="secondary" onClick={post} disabled={posting}>
        {posting ? "Saving..." : "Post Comment"}
      </Button>
    </section>
  );
}

function AdjustSection({ orgId, expenseId }: { orgId: string; expenseId: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const amt = parseFloat(amount);
    if (!amt) return setError("Enter a nonzero adjustment amount");
    if (!note.trim()) return setError("Explain the correction");

    setSaving(true);
    await addToOutbox({
      orgId,
      kind: "expense_adjust",
      displayTitle: `Adjustment: ${note.trim().slice(0, 30)}`,
      payload: {
        entryId: expenseId,
        amount: amt,
        note: note.trim(),
        category: category || undefined,
      },
    });
    setAmount("");
    setNote("");
    setCategory("");
    setOpen(false);
    setSaving(false);
    syncOutbox(orgId);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-body font-semibold text-peacock self-start">
        Correct this entry →
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-3 border border-line rounded-lg bg-surface p-4">
      <h2 className="text-heading-2 font-sans">Adjustment</h2>
      <p className="text-caption text-ink-muted">
        This entry can&apos;t be edited or deleted. Add a correcting entry instead —
        use a negative amount to reduce the total spent, positive to add.
      </p>
      <input
        type="number"
        inputMode="decimal"
        placeholder="Adjustment amount (e.g. -50)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 text-body font-mono outline-none"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 text-body outline-none bg-surface"
      >
        <option value="">Same category as original</option>
        {EXPENSE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <textarea
        placeholder="Why is this being corrected?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="rounded-lg border border-line px-3 py-2 text-body outline-none resize-none"
      />
      {error && <p className="text-caption text-sindoor">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={saving} className="flex-1">
          {saving ? "Saving..." : "Save Adjustment"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
          Cancel
        </Button>
      </div>
    </section>
  );
}

function EditExpenseForm({
  entry,
  onDone,
  onCancel,
}: {
  entry: Entry;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState(entry.category);
  const [vendorName, setVendorName] = useState(entry.vendor_name ?? "");
  const [amount, setAmount] = useState(String(entry.amount));
  const [expenseDate, setExpenseDate] = useState(entry.expense_date);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount");
    setSaving(true);
    try {
      const form = new FormData();
      form.append("category", category);
      form.append("amount", String(amt));
      form.append("expense_date", expenseDate);
      form.append("vendor_name", vendorName.trim());
      if (receipt) form.append("receipt", receipt);
      await apiPatchForm(`/expenses/${entry.id}`, form);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 border border-line rounded-lg bg-surface p-4">
      <h2 className="text-heading-2 font-sans">Edit Expense Entry</h2>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 text-body outline-none bg-surface"
      >
        {EXPENSE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input
        placeholder="Vendor / payee name"
        value={vendorName}
        onChange={(e) => setVendorName(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 text-body outline-none"
      />
      <input
        type="number"
        inputMode="decimal"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 text-body font-mono outline-none"
      />
      <input
        type="date"
        value={expenseDate}
        onChange={(e) => setExpenseDate(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 text-body outline-none"
      />
      <input
        type="file"
        accept="image/png,image/jpeg"
        onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
        className="text-body"
      />
      <p className="text-caption text-ink-muted">Leave file empty to keep the current receipt.</p>
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
