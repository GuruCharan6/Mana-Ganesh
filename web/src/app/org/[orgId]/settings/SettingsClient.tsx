"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch, apiUpload, ApiError } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { OrgBrandMark } from "@/components/OrgBrandMark";
import { MembersSection } from "./MembersSection";

export function SettingsClient({
  orgId,
  initialName,
  initialLogoUrl,
}: {
  orgId: string;
  initialName: string;
  initialLogoUrl: string | null;
}) {
  const [totals, setTotals] = useState<{ total_collected: number; total_spent: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);

  useEffect(() => {
    apiGet(`/orgs/${orgId}/dashboard`)
      .then(setTotals)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load totals"));
  }, [orgId]);

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-8 max-w-xl mx-auto w-full">
      <h1 className="font-display text-heading-1">Settings</h1>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <p className="text-caption text-ink-muted uppercase tracking-[0.02em]">Collected</p>
          <p className="font-mono text-display-lg text-ink">
            {totals ? formatAmount(totals.total_collected) : "—"}
          </p>
        </div>
        <div>
          <p className="text-caption text-ink-muted uppercase tracking-[0.02em]">Spent</p>
          <p className="font-mono text-display-lg text-ink">
            {totals ? formatAmount(totals.total_spent) : "—"}
          </p>
        </div>
      </div>
      {error && <p className="text-caption text-sindoor">{error}</p>}

      <OrgIdentitySection orgId={orgId} initialName={initialName} initialLogoUrl={initialLogoUrl} />

      <section className="flex flex-col gap-3">
        <button
          onClick={() => setMembersOpen((v) => !v)}
          className="flex items-center justify-between py-2 border-b border-line text-left"
        >
          <span className="text-body-strong">Members</span>
          <span className="text-ink-muted text-body">{membersOpen ? "▾" : "▸"}</span>
        </button>
        {membersOpen && <MembersSection orgId={orgId} />}
      </section>
    </main>
  );
}

function OrgIdentitySection({
  orgId,
  initialName,
  initialLogoUrl,
}: {
  orgId: string;
  initialName: string;
  initialLogoUrl: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveName() {
    setNameError(null);
    setNameSaved(false);
    if (!name.trim()) return setNameError("Name can't be empty");
    setSavingName(true);
    try {
      await apiPatch(`/orgs/${orgId}`, { name: name.trim() });
      setNameSaved(true);
      router.refresh();
    } catch (e) {
      setNameError(e instanceof ApiError ? e.message : "Could not rename");
    } finally {
      setSavingName(false);
    }
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function uploadPhoto() {
    if (!file) return;
    setLogoError(null);
    setUploading(true);
    try {
      const res = await apiUpload(`/orgs/${orgId}/logo`, file);
      setLogoUrl(res.logo_url);
      setFile(null);
      setPreview(null);
      router.refresh();
    } catch (e) {
      setLogoError(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <span className="text-body font-semibold">Youth group name</span>
        <div className="flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameSaved(false);
            }}
            className="w-full rounded-lg border border-line px-3 py-2.5 text-body outline-none"
          />
          <Button onClick={saveName} disabled={savingName}>
            {savingName ? "Saving..." : "Save"}
          </Button>
        </div>
        {nameError && <p className="text-caption text-sindoor">{nameError}</p>}
        {nameSaved && <p className="text-caption text-durva">Saved.</p>}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-body font-semibold">Youth group photo</span>
        <div className="flex items-center gap-4">
          <OrgBrandMark logoUrl={preview ?? logoUrl} size={64} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={onPickPhoto}
            className="hidden"
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Change Photo
          </Button>
        </div>
        {logoError && <p className="text-caption text-sindoor">{logoError}</p>}
        {file && (
          <Button onClick={uploadPhoto} disabled={uploading}>
            {uploading ? "Uploading..." : "Save Photo"}
          </Button>
        )}
      </div>
    </section>
  );
}
