"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

export function useOrgName(orgId: string): string {
  const [name, setName] = useState("");

  useEffect(() => {
    apiGet(`/orgs/${orgId}`)
      .then((org) => setName(org.name))
      .catch(() => {});
  }, [orgId]);

  return name;
}
