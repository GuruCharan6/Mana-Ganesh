import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrgBrandMark } from "@/components/OrgBrandMark";
import { OrgNav } from "@/components/OrgNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SettingsLink } from "@/components/SettingsLink";
import { RemindersLink } from "@/components/RemindersLink";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: org }, { data: member }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).maybeSingle(),
    supabase
      .from("org_members")
      .select("*")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "joined")
      .maybeSingle(),
  ]);

  if (!org || !member) notFound();

  const isAdmin = member.role === "admin";
  const canWrite = isAdmin || member.access_level === "full";

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface px-6 py-4 flex items-center gap-3">
        <OrgBrandMark logoUrl={org.logo_url} />
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-heading-2 leading-tight truncate">{org.name}</h1>
          <p className="text-caption text-ink-muted truncate">Welcome, {member.name}</p>
        </div>
        {canWrite && <RemindersLink orgId={orgId} />}
        {isAdmin && <SettingsLink orgId={orgId} />}
      </header>
      <OfflineBanner orgId={orgId} />
      <div
        className="flex flex-1 flex-col"
        style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
      <OrgNav orgId={orgId} />
    </div>
  );
}
