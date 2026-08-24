"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch, apiUpload, ApiError } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { OrgBrandMark } from "@/components/OrgBrandMark";
import { InstallButton } from "@/components/InstallButton";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import { createClient } from "@/lib/supabase/client";
import { MembersSection } from "./MembersSection";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function SettingsClient({
  orgId,
  isAdmin,
  canWrite,
  initialName,
  initialLogoUrl,
  initialTicketPrice,
  initialQrUrl,
}: {
  orgId: string;
  isAdmin: boolean;
  canWrite: boolean;
  initialName: string;
  initialLogoUrl: string | null;
  initialTicketPrice: number | null;
  initialQrUrl: string | null;
}) {
  const [totals, setTotals] = useState<{
    total_collected: number;
    total_spent: number;
    total_lucky_draw: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [iconStale, setIconStale] = useState(false);
  const [iconUpdateError, setIconUpdateError] = useState<string | null>(null);
  const { promptInstall } = useInstallPrompt();

  async function logout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  useEffect(() => {
    if (!canWrite) return;
    apiGet(`/orgs/${orgId}/dashboard`)
      .then(setTotals)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load totals"));
  }, [orgId, canWrite]);

  useEffect(() => {
    const key = `installedLogo:${orgId}`;
    const current = initialLogoUrl ?? "";
    const stored = localStorage.getItem(key);

    if (!isStandalone()) {
      // Not running as an installed app — nothing to go stale, just keep
      // the baseline current for whenever they do install.
      localStorage.setItem(key, current);
      return;
    }
    if (stored === null) {
      // First time we've checked on this device for this org — assume
      // whatever's installed right now matches (can't know otherwise).
      localStorage.setItem(key, current);
      return;
    }
    setIconStale(stored !== current);
  }, [orgId, initialLogoUrl]);

  async function updateIcon() {
    setIconUpdateError(null);
    const accepted = await promptInstall();
    if (accepted) {
      localStorage.setItem(`installedLogo:${orgId}`, initialLogoUrl ?? "");
      setIconStale(false);
    } else {
      setIconUpdateError(
        "Not ready yet — uninstall the app from your home screen first, then tap this again."
      );
    }
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-8 max-w-xl mx-auto w-full">
      <h1 className="font-display text-heading-1">Settings</h1>

      {canWrite && (
        <>
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
            <div>
              <p className="text-caption text-ink-muted uppercase tracking-[0.02em]">Lucky Draw</p>
              <p className="font-mono text-display-lg text-ink">
                {totals ? formatAmount(totals.total_lucky_draw) : "—"}
              </p>
            </div>
          </div>
          {error && <p className="text-caption text-sindoor">{error}</p>}
        </>
      )}

      {isAdmin && (
        <OrgIdentitySection orgId={orgId} initialName={initialName} initialLogoUrl={initialLogoUrl} />
      )}

      {isAdmin && (
        <LuckyDrawSettingsSection
          orgId={orgId}
          initialTicketPrice={initialTicketPrice}
          initialQrUrl={initialQrUrl}
        />
      )}

      {canWrite && (
        <Link
          href={`/org/${orgId}/settings/thank-you`}
          className="flex items-center justify-between py-2 border-b border-line"
        >
          <span className="text-body-strong">Thank You</span>
          <span className="text-ink-muted text-body">→</span>
        </Link>
      )}

      {canWrite && (
        <section className="flex flex-col gap-3">
          <button
            onClick={() => setMembersOpen((v) => !v)}
            className="flex items-center justify-between py-2 border-b border-line text-left"
          >
            <span className="text-body-strong">Members</span>
            <span className="text-ink-muted text-body">{membersOpen ? "▾" : "▸"}</span>
          </button>
          {membersOpen && <MembersSection orgId={orgId} canManage={isAdmin} />}
        </section>
      )}

      {iconStale && (
        <div className="flex flex-col gap-2 border border-marigold rounded-lg bg-marigold/10 p-4">
          <p className="text-body-strong">Your organization&apos;s photo was updated</p>
          <p className="text-caption text-ink-muted">
            Your home screen icon is out of date. To fix it: long-press this
            app&apos;s icon on your home screen and uninstall/remove it, then
            come back here and tap the button below.
          </p>
          <Button onClick={updateIcon}>Update Home Screen Icon</Button>
          {iconUpdateError && <p className="text-caption text-sindoor">{iconUpdateError}</p>}
        </div>
      )}

      <InstallButton />

      <Button variant="secondary" onClick={logout} disabled={loggingOut}>
        {loggingOut ? "Logging out..." : "Log Out"}
      </Button>
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

function LuckyDrawSettingsSection({
  orgId,
  initialTicketPrice,
  initialQrUrl,
}: {
  orgId: string;
  initialTicketPrice: number | null;
  initialQrUrl: string | null;
}) {
  const router = useRouter();
  const [price, setPrice] = useState(initialTicketPrice != null ? String(initialTicketPrice) : "");
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceSaved, setPriceSaved] = useState(false);

  const [qrUrl, setQrUrl] = useState(initialQrUrl);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function savePrice() {
    setPriceError(null);
    setPriceSaved(false);
    const amt = parseFloat(price);
    if (!amt || amt <= 0) return setPriceError("Enter a valid ticket price");
    setSavingPrice(true);
    try {
      await apiPatch(`/orgs/${orgId}`, { lucky_draw_ticket_price: amt });
      setPriceSaved(true);
      router.refresh();
    } catch (e) {
      setPriceError(e instanceof ApiError ? e.message : "Could not save ticket price");
    } finally {
      setSavingPrice(false);
    }
  }

  function onPickQr(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setQrFile(f);
    setQrPreview(URL.createObjectURL(f));
  }

  async function uploadQr() {
    if (!qrFile) return;
    setQrError(null);
    setUploadingQr(true);
    try {
      const res = await apiUpload(`/orgs/${orgId}/lucky-draw-qr`, qrFile);
      setQrUrl(res.lucky_draw_qr_url);
      setQrFile(null);
      setQrPreview(null);
      router.refresh();
    } catch (e) {
      setQrError(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setUploadingQr(false);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-heading-2 font-sans">Lucky Draw</h2>

      <div className="flex flex-col gap-3">
        <span className="text-body font-semibold">Ticket price (₹)</span>
        <div className="flex flex-col gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setPriceSaved(false);
            }}
            className="w-full rounded-lg border border-line px-3 py-2.5 text-body font-mono outline-none"
          />
          <Button onClick={savePrice} disabled={savingPrice}>
            {savingPrice ? "Saving..." : "Save"}
          </Button>
        </div>
        {priceError && <p className="text-caption text-sindoor">{priceError}</p>}
        {priceSaved && <p className="text-caption text-durva">Saved.</p>}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-body font-semibold">Payment QR code</span>
        <div className="flex items-center gap-4">
          {(qrPreview ?? qrUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrPreview ?? qrUrl ?? undefined}
              alt="Payment QR code"
              className="h-20 w-20 rounded-lg border border-line object-contain bg-surface"
            />
          ) : (
            <div className="h-20 w-20 rounded-lg border border-line bg-surface flex items-center justify-center text-caption text-ink-muted">
              None
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={onPickQr}
            className="hidden"
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            {qrUrl ? "Change QR" : "Upload QR"}
          </Button>
        </div>
        {qrError && <p className="text-caption text-sindoor">{qrError}</p>}
        {qrFile && (
          <Button onClick={uploadQr} disabled={uploadingQr}>
            {uploadingQr ? "Uploading..." : "Save QR"}
          </Button>
        )}
      </div>
    </section>
  );
}
