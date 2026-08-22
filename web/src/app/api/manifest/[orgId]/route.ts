import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("name, logo_url")
    .eq("id", orgId)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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
