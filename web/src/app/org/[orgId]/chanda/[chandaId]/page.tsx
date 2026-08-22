"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { AmountText } from "@/components/AmountText";
import { ThankYouButton } from "@/components/ThankYouButton";
import { SyncBadge } from "@/components/ui/SyncBadge";
import { formatDate } from "@/lib/format";
import { addToOutbox, listOutboxByKind, onOutboxChange } from "@/lib/offline/outbox";
import { syncOutbox } from "@/lib/offline/sync";
import { useOutboxSync } from "@/lib/offline/useOutboxSync";
import { useOrgName } from "@/lib/useOrgName";
import type { ChandaAdjustPayload, ChandaCommentPayload, OutboxRecord } from "@/lib/offline/db";

type Entry = {
  id: string;
  donor_name: string;
  donor_mobile: string | null;
  amount: number;
  collected_on: string;
  entered_on: string;
  area: string | null;
  book_reference: string | null;
  adjustment_for: string | null;
  item_description: string | null;
  collected_by_name: string;
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

export default function ChandaDetailPage() {
  const { orgId, chandaId } = useParams<{ orgId: string; chandaId: string }>();
  const orgName = useOrgName(orgId);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingComments, setPendingComments] = useState<OutboxRecord[]>([]);
  const [pendingAdjustments, setPendingAdjustments] = useState<OutboxRecord[]>([]);

  const load = useCallback(async () => {
    try {
      setDetail(await apiGet(`/chanda/${chandaId}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load entry (offline?)");
    }
  }, [chandaId]);

  const loadPending = useCallback(async () => {
    const comments = await listOutboxByKind(orgId, ["chanda_comment"]);
    const adjustments = await listOutboxByKind(orgId, ["chanda_adjust"]);
    setPendingComments(
      comments.filter((r) => (r.payload as ChandaCommentPayload).entryId === chandaId)
    );
    setPendingAdjustments(
      adjustments.filter((r) => (r.payload as ChandaAdjustPayload).entryId === chandaId)
    );
  }, [orgId, chandaId]);

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
        {entry.item_description && (
          <span className="text-badge uppercase tracking-[0.02em] px-1.5 py-0.5 rounded bg-marigold/10 text-marigold self-start">
            In-Kind
          </span>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-heading-2 font-display break-words">{entry.donor_name}</p>
            {entry.donor_mobile && (
              <p className="text-caption text-ink-muted">+91 {entry.donor_mobile}</p>
            )}
          </div>
          <div className="shrink-0">
            <AmountText amount={entry.amount} size="lg" />
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-caption">
          {entry.item_description && (
            <>
              <dt className="text-ink-muted">Item</dt>
              <dd>{entry.item_description}</dd>
            </>
          )}
          <dt className="text-ink-muted">Collected on</dt>
          <dd>{formatDate(entry.collected_on)}</dd>
          <dt className="text-ink-muted">Entered by</dt>
          <dd>{entry.collected_by_name}</dd>
          {entry.area && (
            <>
              <dt className="text-ink-muted">Area</dt>
              <dd>{entry.area}</dd>
            </>
          )}
          {entry.book_reference && (
            <>
              <dt className="text-ink-muted">Book reference</dt>
              <dd>{entry.book_reference}</dd>
            </>
          )}
        </dl>
        {!entry.adjustment_for && entry.donor_mobile && (
          <ThankYouButton
            donorName={entry.donor_name}
            donorMobile={entry.donor_mobile}
            amount={entry.amount}
            orgName={orgName}
            itemDescription={entry.item_description}
          />
        )}
      </div>

      {(adjustments.length > 0 || pendingAdjustments.length > 0) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-heading-2 font-sans">Adjustments</h2>
          {adjustments.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 border-b border-line py-3">
              <p className="text-caption text-ink-muted">
                {formatDate(a.collected_on)} · {a.collected_by_name}
              </p>
              <AmountText amount={a.amount} />
            </div>
          ))}
          {pendingAdjustments.map((r) => {
            const p = r.payload as ChandaAdjustPayload;
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
        chandaId={chandaId}
      />

      <AdjustSection orgId={orgId} chandaId={chandaId} />
    </main>
  );
}

function CommentsSection({
  comments,
  pending,
  orgId,
  chandaId,
}: {
  comments: Comment[];
  pending: OutboxRecord[];
  orgId: string;
  chandaId: string;
}) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  async function post() {
    if (!text.trim()) return;
    setPosting(true);
    await addToOutbox({
      orgId,
      kind: "chanda_comment",
      displayTitle: text.trim().slice(0, 40),
      payload: { entryId: chandaId, comment: text.trim() },
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
        const p = r.payload as ChandaCommentPayload;
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

function AdjustSection({ orgId, chandaId }: { orgId: string; chandaId: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
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
      kind: "chanda_adjust",
      displayTitle: `Adjustment: ${note.trim().slice(0, 30)}`,
      payload: { entryId: chandaId, amount: amt, note: note.trim() },
    });
    setAmount("");
    setNote("");
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
        use a negative amount to reduce, positive to add.
      </p>
      <input
        type="number"
        inputMode="decimal"
        placeholder="Adjustment amount (e.g. -50)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="rounded-lg border border-line px-3 py-2 text-body font-mono outline-none"
      />
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
