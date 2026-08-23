import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;

  // Unauthenticated fetch, on purpose — Chrome/Android's WebAPK install
  // pipeline fetches this manifest with no cookies. Gating it behind login
  // (as an earlier version of this route did) makes the manifest look
  // invalid to that pipeline, and Chrome silently falls back to creating a
  // plain shortcut instead of a real install.
  const res = await fetch(`${API_URL}/orgs/${orgId}/public-brand`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const org: { name: string; logo_url: string | null } = await res.json();
  const icon = org.logo_url || "/icons/icon-512.png";
  const iconType = /\.jpe?g(\?|$)/i.test(icon) ? "image/jpeg" : "image/png";

  return NextResponse.json(
    {
      name: org.name,
      short_name: org.name,
      description: "Chanda and expense ledger for festival youth groups",
      start_url: `/org/${orgId}`,
      scope: `/org/${orgId}`,
      display: "standalone",
      background_color: "#FBF3E4",
      theme_color: "#D99A1B",
      icons: [
        { src: icon, sizes: "192x192", type: iconType, purpose: "any" },
        { src: icon, sizes: "512x512", type: iconType, purpose: "any" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
