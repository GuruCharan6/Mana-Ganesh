"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, ApiError } from "@/lib/api";

type ChandaEntry = {
  id: string;
  donor_name: string;
  amount: number;
  collected_on: string;
  entered_on: string;
  item_description: string | null;
  collected_by_name: string;
};

type ExpenseEntry = {
  id: string;
  category: string;
  vendor_name: string | null;
  amount: number;
  expense_date: string;
  created_at: string;
  logged_by_name: string;
};

export type Txn = {
  id: string;
  type: "chanda" | "expense";
  title: string;
  subtitle: string;
  amount: number;
  date: string; // collected_on / expense_date — shown in the row
  enteredAt: string; // entered_on / created_at — timeline sort key
  memberName: string;
  category: string | null;
  itemDescription: string | null;
  href: string;
};

export function useOrgTransactions(orgId: string) {
  const [chanda, setChanda] = useState<ChandaEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([apiGet(`/orgs/${orgId}/chanda`), apiGet(`/orgs/${orgId}/expenses`)])
      .then(([c, e]) => {
        setChanda(c);
        setExpenses(e);
        setLoaded(true);
      })
      .catch((err) => {
        // Leave `loaded` false and previous data untouched on failure — a
        // transient fetch error (cold-start timeout, network blip) must never
        // render as "nothing logged yet", which looks like real, alarming data loss.
        setError(err instanceof ApiError ? err.message : "Could not load transactions (offline?)");
      });
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const transactions: Txn[] = useMemo(() => {
    const c: Txn[] = chanda.map((e) => ({
      id: e.id,
      type: "chanda",
      title: e.donor_name,
      subtitle: e.collected_by_name,
      amount: e.amount,
      date: e.collected_on,
      enteredAt: e.entered_on,
      memberName: e.collected_by_name,
      category: null,
      itemDescription: e.item_description,
      href: `/org/${orgId}/chanda/${e.id}`,
    }));
    const x: Txn[] = expenses.map((e) => ({
      id: e.id,
      type: "expense",
      title: e.vendor_name || e.category,
      subtitle: `${e.category} · ${e.logged_by_name}`,
      amount: e.amount,
      date: e.expense_date,
      enteredAt: e.created_at,
      memberName: e.logged_by_name,
      category: e.category,
      itemDescription: null,
      href: `/org/${orgId}/expenses/${e.id}`,
    }));
    // Sorted by the transaction's own date (collected_on / expense_date), not
    // by when it was entered into the app — so a backdated entry sorts where
    // it actually happened, not at the top just because it was saved just now.
    return [...c, ...x].sort(
      (a, b) => b.date.localeCompare(a.date) || b.enteredAt.localeCompare(a.enteredAt)
    );
  }, [chanda, expenses, orgId]);

  return { transactions, loaded, error, reload: load };
}
