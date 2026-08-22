"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { OrgBrandMark } from "@/components/OrgBrandMark";

export default function CreateOrgPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!orgName.trim() || !adminName.trim()) {
      setError("Both fields are required");
      return;
    }
    setLoading(true);
    try {
      const org = await apiPost("/orgs", {
        org_name: orgName.trim(),
        admin_name: adminName.trim(),
      });
      router.push(`/onboarding/logo?org=${org.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-3">
        <OrgBrandMark size={64} />
        <h1 className="font-display text-heading-1">Create your organization</h1>
        <p className="text-body text-ink-muted text-center max-w-sm">
          No pending invite found for your number. Set up a new committee — you&apos;ll
          be its Admin.
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-body font-semibold">Organization name</span>
          <input
            type="text"
            placeholder="e.g. Sri Ganesh Youth Mandal"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-3 text-body outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-body font-semibold">Your name</span>
          <input
            type="text"
            placeholder="Your full name"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-3 text-body outline-none"
          />
        </label>
        {error && <p className="text-caption text-sindoor">{error}</p>}
        <Button onClick={submit} disabled={loading}>
          {loading ? "Creating..." : "Create Organization"}
        </Button>
      </div>
    </main>
  );
}
