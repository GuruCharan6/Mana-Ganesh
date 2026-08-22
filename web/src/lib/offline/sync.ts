import { apiPost, apiPostForm, ApiError } from "@/lib/api";
import { listOutbox, updateOutboxEntry, removeFromOutbox } from "./outbox";
import type {
  AnnouncementCreatePayload,
  ChandaAdjustPayload,
  ChandaCommentPayload,
  ChandaCreatePayload,
  ExpenseAdjustPayload,
  ExpenseCommentPayload,
  ExpenseCreatePayload,
  OutboxRecord,
} from "./db";

async function push(orgId: string, record: OutboxRecord): Promise<void> {
  switch (record.kind) {
    case "chanda_create": {
      const p = record.payload as ChandaCreatePayload;
      await apiPost(`/orgs/${orgId}/chanda`, {
        donor_name: p.donorName,
        donor_mobile: p.donorMobile,
        amount: p.amount,
        collected_on: p.collectedOn,
        area: p.area,
        book_reference: p.bookReference,
        item_description: p.itemDescription,
        client_ref: record.localId,
      });
      return;
    }
    case "expense_create": {
      const p = record.payload as ExpenseCreatePayload;
      const form = new FormData();
      form.append("category", p.category);
      form.append("amount", String(p.amount));
      form.append("expense_date", p.expenseDate);
      if (p.vendorName) form.append("vendor_name", p.vendorName);
      if (p.receiptFile) form.append("receipt", p.receiptFile);
      await apiPostForm(`/orgs/${orgId}/expenses`, form);
      return;
    }
    case "announcement_create": {
      const p = record.payload as AnnouncementCreatePayload;
      const form = new FormData();
      form.append("body", p.body);
      if (p.imageFile) form.append("image", p.imageFile);
      await apiPostForm(`/orgs/${orgId}/announcements`, form);
      return;
    }
    case "chanda_comment": {
      const p = record.payload as ChandaCommentPayload;
      await apiPost(`/chanda/${p.entryId}/comments`, { comment: p.comment });
      return;
    }
    case "chanda_adjust": {
      const p = record.payload as ChandaAdjustPayload;
      await apiPost(`/chanda/${p.entryId}/adjust`, {
        amount: p.amount,
        note: p.note,
        donor_name: p.donorName,
        donor_mobile: p.donorMobile,
        collected_on: p.collectedOn,
        area: p.area,
        book_reference: p.bookReference,
      });
      return;
    }
    case "expense_comment": {
      const p = record.payload as ExpenseCommentPayload;
      await apiPost(`/expenses/${p.entryId}/comments`, { comment: p.comment });
      return;
    }
    case "expense_adjust": {
      const p = record.payload as ExpenseAdjustPayload;
      await apiPost(`/expenses/${p.entryId}/adjust`, {
        amount: p.amount,
        note: p.note,
        category: p.category,
        vendor_name: p.vendorName,
        expense_date: p.expenseDate,
      });
      return;
    }
  }
}

let syncing = false;

export async function syncOutbox(orgId: string): Promise<{ synced: number; failed: number }> {
  if (syncing || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return { synced: 0, failed: 0 };
  }
  syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const outbox = await listOutbox(orgId);
    const pending = outbox.filter((e) => e.status === "pending" || e.status === "error");

    // Oldest first, and within an entry's own history a comment/adjust must
    // never race ahead of the create it depends on — listOutbox already
    // returns newest-first so reverse for FIFO processing.
    for (const entry of pending.reverse()) {
      await updateOutboxEntry(entry.localId, { status: "syncing", error: undefined });
      try {
        await push(orgId, entry);
        await removeFromOutbox(entry.localId);
        synced += 1;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await updateOutboxEntry(entry.localId, { status: "pending" });
          break;
        }
        await updateOutboxEntry(entry.localId, {
          status: "error",
          error: e instanceof ApiError ? e.message : "Sync failed",
        });
        failed += 1;
      }
    }
  } finally {
    syncing = false;
  }

  return { synced, failed };
}
