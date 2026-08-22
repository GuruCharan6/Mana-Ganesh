"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Member = {
  id: string;
  name: string;
  email: string;
  status: "pending" | "joined";
  role: "admin" | "member";
  access_level: "full" | "view_only";
};

export function MembersSection({ orgId }: { orgId: string }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet(`/orgs/${orgId}/members`);
      setMembers(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load members");
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addMember() {
    setError(null);
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a name and valid email address");
      return;
    }
    setAdding(true);
    try {
      await apiPost(`/orgs/${orgId}/members`, {
        name: name.trim(),
        email: email.trim(),
      });
      setName("");
      setEmail("");
      setShowAdd(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add member");
    } finally {
      setAdding(false);
    }
  }

  async function toggleAccess(m: Member) {
    setError(null);
    const next = m.access_level === "full" ? "view_only" : "full";
    try {
      await apiPatch(`/orgs/${orgId}/members/${m.id}`, { access_level: next });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update access");
    }
  }

  async function setRole(m: Member, role: "admin" | "member") {
    setError(null);
    try {
      await apiPatch(`/orgs/${orgId}/members/${m.id}`, { role });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not change role");
    }
  }

  async function removeMember(m: Member) {
    setError(null);
    try {
      await apiDelete(`/orgs/${orgId}/members/${m.id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove member");
    }
  }

  async function saveEdit(m: Member, newName: string, newEmail: string) {
    setError(null);
    try {
      await apiPatch(`/orgs/${orgId}/members/${m.id}`, {
        name: newName.trim(),
        email: newEmail.trim(),
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save changes");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="text-caption text-peacock shrink-0"
        >
          {showAdd ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showAdd && (
        <div className="flex flex-col gap-3 border border-line rounded-lg bg-surface p-4">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-line px-3 py-2.5 text-body outline-none"
          />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-line px-3 py-2.5 text-body outline-none"
          />
          <Button onClick={addMember} disabled={adding}>
            {adding ? "Adding..." : "Add Member"}
          </Button>
        </div>
      )}

      {error && <p className="text-caption text-sindoor">{error}</p>}

      <div className="flex flex-col">
        {members === null && <p className="text-body text-ink-muted">Loading…</p>}
        {members?.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            editing={editingId === m.id}
            onEdit={() => setEditingId(m.id)}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(n, em) => saveEdit(m, n, em)}
            onToggleAccess={() => toggleAccess(m)}
            onMakeAdmin={() => setRole(m, "admin")}
            onRemoveAdmin={() => setRole(m, "member")}
            onRemove={() => removeMember(m)}
          />
        ))}
      </div>
    </section>
  );
}

function MemberRow({
  member,
  editing,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleAccess,
  onMakeAdmin,
  onRemoveAdmin,
  onRemove,
}: {
  member: Member;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (name: string, email: string) => void;
  onToggleAccess: () => void;
  onMakeAdmin: () => void;
  onRemoveAdmin: () => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);

  if (editing) {
    return (
      <div className="flex flex-col gap-2 border-b border-line py-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 text-body outline-none"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 text-body outline-none"
        />
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => onSaveEdit(name, email)}>
            Save
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onCancelEdit}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-b border-line py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-body-strong truncate">{member.name}</p>
          <p className="text-caption text-ink-muted truncate">{member.email}</p>
        </div>
        <Badge tone={member.status === "pending" ? "pending" : "joined"} />
        {member.role !== "admin" && <Badge tone={member.access_level} />}
      </div>

      <div className="flex gap-x-4 gap-y-1 flex-wrap">
        {member.status === "pending" && (
          <button onClick={onEdit} className="text-caption text-peacock">
            Edit
          </button>
        )}
        {member.status === "joined" && member.role !== "admin" && (
          <>
            <button onClick={onToggleAccess} className="text-caption text-peacock">
              {member.access_level === "full" ? "Set View Only" : "Set Full Access"}
            </button>
            <button onClick={onMakeAdmin} className="text-caption text-peacock">
              Make Admin
            </button>
          </>
        )}
        {member.status === "joined" && member.role === "admin" && (
          <button onClick={onRemoveAdmin} className="text-caption text-peacock">
            Remove Admin
          </button>
        )}
        <button onClick={onRemove} className="text-caption text-sindoor">
          Remove
        </button>
      </div>
    </div>
  );
}
