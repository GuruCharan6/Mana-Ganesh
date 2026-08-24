"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

export function useOrgPaymentQr(orgId: string): string | null {
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    apiGet(`/orgs/${orgId}`)
      .then((org) => setQrUrl(org.lucky_draw_qr_url ?? null))
      .catch(() => {});
  }, [orgId]);

  return qrUrl;
}
