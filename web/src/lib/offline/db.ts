import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type OutboxKind =
  | "chanda_create"
  | "expense_create"
  | "announcement_create"
  | "chanda_comment"
  | "chanda_adjust"
  | "expense_comment"
  | "expense_adjust";

export type ChandaCreatePayload = {
  donorName: string;
  donorMobile: string | null;
  amount: number;
  collectedOn: string;
  area: string | null;
  bookReference: string | null;
  itemDescription: string | null;
};

export type ExpenseCreatePayload = {
  category: string;
  vendorName: string | null;
  amount: number;
  expenseDate: string;
  receiptFile: File | null;
};

export type AnnouncementCreatePayload = {
  body: string;
  imageFile: File | null;
};

export type ChandaCommentPayload = { entryId: string; comment: string };

export type ChandaAdjustPayload = {
  entryId: string;
  amount: number;
  note: string;
  donorName?: string;
  donorMobile?: string;
  collectedOn?: string;
  area?: string;
  bookReference?: string;
};

export type ExpenseCommentPayload = { entryId: string; comment: string };

export type ExpenseAdjustPayload = {
  entryId: string;
  amount: number;
  note: string;
  category?: string;
  vendorName?: string;
  expenseDate?: string;
};

export type OutboxPayload =
  | ChandaCreatePayload
  | ExpenseCreatePayload
  | AnnouncementCreatePayload
  | ChandaCommentPayload
  | ChandaAdjustPayload
  | ExpenseCommentPayload
  | ExpenseAdjustPayload;

export type OutboxRecord = {
  localId: string;
  orgId: string;
  kind: OutboxKind;
  payload: OutboxPayload;
  displayTitle: string;
  displayDate: string | null; // for list-merging (chanda/expense creates); null for comments/adjustments/announcements
  createdAtLocal: string;
  status: "pending" | "syncing" | "error" | "synced";
  error?: string;
};

interface ManaVinayakaDB extends DBSchema {
  outbox: {
    key: string;
    value: OutboxRecord;
    indexes: { "by-org": string };
  };
}

let dbPromise: Promise<IDBPDatabase<ManaVinayakaDB>> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<ManaVinayakaDB>("mana-vinayaka", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 2) {
          const legacyStores = Array.from(db.objectStoreNames) as string[];
          if (legacyStores.includes("chanda_outbox")) {
            db.deleteObjectStore("chanda_outbox" as never);
          }
          const store = db.createObjectStore("outbox", { keyPath: "localId" });
          store.createIndex("by-org", "orgId");
        }
      },
    });
  }
  return dbPromise;
}
