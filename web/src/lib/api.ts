import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new ApiError(401, "Not signed in");
  return { Authorization: `Bearer ${session.access_token}` };
}

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function apiGet(path: string) {
  const headers = await authHeaders();
  return handle(await fetch(`${API_URL}${path}`, { headers }));
}

export async function apiPost(path: string, body?: unknown) {
  const headers = await authHeaders();
  return handle(
    await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

export async function apiPatch(path: string, body?: unknown) {
  const headers = await authHeaders();
  return handle(
    await fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}

export async function apiDelete(path: string) {
  const headers = await authHeaders();
  return handle(await fetch(`${API_URL}${path}`, { method: "DELETE", headers }));
}

export async function apiUpload(path: string, file: File) {
  const headers = await authHeaders();
  const form = new FormData();
  form.append("file", file);
  return handle(
    await fetch(`${API_URL}${path}`, { method: "PATCH", headers, body: form })
  );
}

export async function apiPostForm(path: string, form: FormData) {
  const headers = await authHeaders();
  return handle(
    await fetch(`${API_URL}${path}`, { method: "POST", headers, body: form })
  );
}

export async function apiPatchForm(path: string, form: FormData) {
  const headers = await authHeaders();
  return handle(
    await fetch(`${API_URL}${path}`, { method: "PATCH", headers, body: form })
  );
}
