"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiUpload, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { OrgBrandMark } from "@/components/OrgBrandMark";

function LogoStep() {
  const router = useRouter();
  const orgId = useSearchParams().get("org");

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function upload() {
    if (!orgId || !file) return;
    setError(null);
    setLoading(true);
    try {
      await apiUpload(`/orgs/${orgId}/logo`, file);
      router.push(`/org/${orgId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed");
      setLoading(false);
    }
  }

  function skip() {
    if (orgId) router.push(`/org/${orgId}`);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-3">
        <OrgBrandMark logoUrl={preview} size={96} />
        <h1 className="font-display text-heading-1">Add your logo</h1>
        <p className="text-body text-ink-muted text-center max-w-sm">
          Optional — shows in the header everywhere. The default mark works fine
          too; you can add this later from Org Settings.
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-body font-semibold">
            Square image, min 256×256px, PNG or JPG, max 2MB
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={onPick}
            className="text-body"
          />
        </label>
        {error && <p className="text-caption text-sindoor">{error}</p>}
        <Button onClick={upload} disabled={loading || !file}>
          {loading ? "Uploading..." : "Save Logo"}
        </Button>
        <Button variant="secondary" onClick={skip} disabled={loading}>
          Skip for now
        </Button>
      </div>
    </main>
  );
}

export default function LogoPage() {
  return (
    <Suspense>
      <LogoStep />
    </Suspense>
  );
}
