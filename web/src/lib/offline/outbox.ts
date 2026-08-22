import { getDb, type OutboxKind, type OutboxPayload, type OutboxRecord } from "./db";

const CHANGE_EVENT = "outbox-changed";

function notifyChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function onOutboxChange(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

export async function addToOutbox(entry: {
  orgId: string;
  kind: OutboxKind;
  payload: OutboxPayload;
  displayTitle: string;
  displayDate?: string | null;
}): Promise<OutboxRecord> {
  const db = await getDb();
  const row: OutboxRecord = {
    localId: crypto.randomUUID(),
    orgId: entry.orgId,
    kind: entry.kind,
    payload: entry.payload,
    displayTitle: entry.displayTitle,
    displayDate: entry.displayDate ?? null,
    createdAtLocal: new Date().toISOString(),
    status: "pending",
  };
  await db.add("outbox", row);
  notifyChange();
  return row;
}

export async function listOutbox(orgId: string): Promise<OutboxRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("outbox", "by-org", orgId);
  return all.sort((a, b) => b.createdAtLocal.localeCompare(a.createdAtLocal));
}

export async function listOutboxByKind(
  orgId: string,
  kinds: OutboxKind[]
): Promise<OutboxRecord[]> {
  const all = await listOutbox(orgId);
  return all.filter((r) => kinds.includes(r.kind));
}

export async function updateOutboxEntry(localId: string, patch: Partial<OutboxRecord>) {
  const db = await getDb();
  const existing = await db.get("outbox", localId);
  if (!existing) return;
  await db.put("outbox", { ...existing, ...patch });
  notifyChange();
}

export async function removeFromOutbox(localId: string) {
  const db = await getDb();
  await db.delete("outbox", localId);
  notifyChange();
}

export async function countPending(orgId: string): Promise<number> {
  const all = await listOutbox(orgId);
  return all.filter((e) => e.status !== "synced").length;
}
