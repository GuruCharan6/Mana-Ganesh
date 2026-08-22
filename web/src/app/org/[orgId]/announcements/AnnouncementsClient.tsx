"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatchForm, apiDelete, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { SyncBadge } from "@/components/ui/SyncBadge";
import { formatDate } from "@/lib/format";
import { addToOutbox, listOutboxByKind, onOutboxChange } from "@/lib/offline/outbox";
import { syncOutbox } from "@/lib/offline/sync";
import { useOutboxSync } from "@/lib/offline/useOutboxSync";
import type { AnnouncementCreatePayload, OutboxRecord } from "@/lib/offline/db";

type Announcement = {
  id: string;
  body: string;
  image_url: string | null;
  posted_by_name: string;
  created_at: string;
  updated_at: string | null;
};

export function AnnouncementsClient({ orgId, canWrite }: { orgId: string; canWrite: boolean }) {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [pending, setPending] = useState<OutboxRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAnnouncements(await apiGet(`/orgs/${orgId}/announcements`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load announcements (offline?)");
    }
  }, [orgId]);

  const loadPending = useCallback(async () => {
    setPending(await listOutboxByKind(orgId, ["announcement_create"]));
  }, [orgId]);

  useOutboxSync(orgId, load);

  useEffect(() => {
    load();
    loadPending();
    const unsubscribe = onOutboxChange(loadPending);
    return unsubscribe;
  }, [load, loadPending]);

  async function remove(id: string) {
    setError(null);
    try {
      await apiDelete(`/announcements/${id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete announcement");
    }
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-6 gap-6 max-w-xl mx-auto w-full">
      <h1 className="font-display text-heading-1">Announcements</h1>

      {canWrite && <ComposeForm orgId={orgId} onPosted={load} />}

      {error && <p className="text-caption text-sindoor">{error}</p>}

      <div className="flex flex-col gap-4">
        {pending.map((r) => {
          const p = r.payload as AnnouncementCreatePayload;
          return (
            <div key={r.localId} className="border-b border-line pb-4 flex flex-col gap-2">
              <p className="text-body whitespace-pre-wrap">{p.body}</p>
              <SyncBadge status={r.status === "error" ? "error" : "pending"} />
            </div>
          );
        })}

        {announcements === null && pending.length === 0 && (
          <p className="text-body text-ink-muted">Loading…</p>
        )}
        {announcements?.length === 0 && pending.length === 0 && (
          <p className="text-body text-ink-muted">No announcements yet.</p>
        )}
        {announcements?.map((a) =>
          editingId === a.id ? (
            <EditForm
              key={a.id}
              announcement={a}
              onDone={() => {
                setEditingId(null);
                load();
              }}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={a.id} className="border-b border-line pb-4 flex flex-col gap-2">
              <p className="text-body whitespace-pre-wrap">{a.body}</p>
              {a.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.image_url}
                  alt=""
                  className="rounded-lg border border-line max-h-80 object-contain"
                />
              )}
              <div className="flex items-center justify-between">
                <p className="text-caption text-ink-muted">
                  {a.posted_by_name} · {formatDate(a.created_at.slice(0, 10))}
                  {a.updated_at ? " · edited" : ""}
                </p>
                {canWrite && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditingId(a.id)}
                      className="text-caption text-peacock"
                    >
                      Edit
                    </button>
                    <button onClick={() => remove(a.id)} className="text-caption text-sindoor">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </main>
  );
}

function ComposeForm({ orgId, onPosted }: { orgId: string; onPosted: () => void }) {
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post() {
    setError(null);
    if (!body.trim()) return setError("Write something first");
    setPosting(true);
    await addToOutbox({
      orgId,
      kind: "announcement_create",
      displayTitle: body.trim().slice(0, 40),
      payload: { body: body.trim(), imageFile: image },
    });
    setBody("");
    setImage(null);
    setPosting(false);
    syncOutbox(orgId);
    onPosted();
  }

  return (
    <div className="flex flex-col gap-3 border border-line rounded-lg bg-surface p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share an update with the group..."
        rows={3}
        className="rounded-lg border border-line px-3 py-2 text-body outline-none resize-none"
      />
      <input
        type="file"
        accept="image/png,image/jpeg"
        onChange={(e) => setImage(e.target.files?.[0] ?? null)}
        className="text-body"
      />
      {error && <p className="text-caption text-sindoor">{error}</p>}
      <Button onClick={post} disabled={posting}>
        {posting ? "Posting..." : "Post Announcement"}
      </Button>
    </div>
  );
}

function EditForm({
  announcement,
  onDone,
  onCancel,
}: {
  announcement: Announcement;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(announcement.body);
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!body.trim()) return setError("Announcement can't be empty");
    setSaving(true);
    try {
      const form = new FormData();
      form.append("body", body.trim());
      if (image) form.append("image", image);
      await apiPatchForm(`/announcements/${announcement.id}`, form);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border border-line rounded-lg bg-surface p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="rounded-lg border border-line px-3 py-2 text-body outline-none resize-none"
      />
      <input
        type="file"
        accept="image/png,image/jpeg"
        onChange={(e) => setImage(e.target.files?.[0] ?? null)}
        className="text-body"
      />
      <p className="text-caption text-ink-muted">
        Leave file empty to keep the current image.
      </p>
      {error && <p className="text-caption text-sindoor">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving} className="flex-1">
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}
