"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

export function useMyMembership(orgId: string) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    apiGet(`/orgs/${orgId}/me`)
      .then((m) => setIsAdmin(m.role === "admin"))
      .catch(() => {});
  }, [orgId]);

  return { isAdmin };
}
