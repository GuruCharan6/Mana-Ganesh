"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type Member = {
  id: string;
  name: string;
  email: string;
  mobile_number: string | null;
  status: "pending" | "joined";
  role: "admin" | "member";
  access_level: "full" | "view_only";
};

export function MembersSection({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
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
    const mobileDigits = mobile.replace(/\D/g, "");
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a name and valid email address");
      return;
    }
    if (mobileDigits.length !== 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setAdding(true);
    try {
      await apiPost(`/orgs/${orgId}/members`, {
        name: name.trim(),
        email: email.trim(),
        mobile_number: mobileDigits,
      });
      setName("");
      setEmail("");
      setMobile("");
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

  async function saveEdit(m: Member, newName: string, newEmail: string, newMobile: string) {
    setError(null);
    const mobileDigits = newMobile.replace(/\D/g, "");
    if (mobileDigits.length !== 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    try {
      await apiPatch(`/orgs/${orgId}/members/${m.id}`, {
        name: newName.trim(),
        email: newEmail.trim(),
        mobile_number: mobileDigits,
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save changes");
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {canManage && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="text-caption text-peacock shrink-0"
          >
            {showAdd ? "Cancel" : "+ Add"}
          </button>
        </div>
      )}

      {canManage && showAdd && (
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
          <div className="flex items-center rounded-lg border border-line overflow-hidden">
            <span className="px-3 text-body text-ink-muted border-r border-line py-2.5">+91</span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="Mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="flex-1 px-3 py-2.5 text-body outline-none"
            />
          </div>
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
            canManage={canManage}
            editing={editingId === m.id}
            onEdit={() => setEditingId(m.id)}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(n, em, mob) => saveEdit(m, n, em, mob)}
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
  canManage,
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
  canManage: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (name: string, email: string, mobile: string) => void;
  onToggleAccess: () => void;
  onMakeAdmin: () => void;
  onRemoveAdmin: () => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [mobile, setMobile] = useState(member.mobile_number ?? "");

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
        <div className="flex items-center rounded-lg border border-line overflow-hidden">
          <span className="px-3 text-body text-ink-muted border-r border-line py-2">+91</span>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="flex-1 px-3 py-2 text-body outline-none"
          />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => onSaveEdit(name, email, mobile)}>
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
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-body-strong truncate">{member.name}</p>
        <p className="text-caption text-ink-muted break-all">{member.email}</p>
        {member.mobile_number && (
          <a
            href={`tel:+91${member.mobile_number}`}
            className="text-caption text-peacock whitespace-nowrap"
          >
            +91 {member.mobile_number}
          </a>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge tone={member.status === "pending" ? "pending" : "joined"} />
        {member.role !== "admin" && <Badge tone={member.access_level} />}
      </div>

      {canManage && (
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
      )}
    </div>
  );
}
