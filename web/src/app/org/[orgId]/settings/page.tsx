import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: member }, { data: org }] = await Promise.all([
    supabase
      .from("org_members")
      .select("role, access_level")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "joined")
      .maybeSingle(),
    supabase.from("organizations").select("name, logo_url").eq("id", orgId).maybeSingle(),
  ]);

  if (!member || !org) notFound();
  const isAdmin = member.role === "admin";
  const canWrite = isAdmin || member.access_level === "full";
  if (!canWrite) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-body text-sindoor">Full access required.</p>
      </main>
    );
  }

  return (
    <SettingsClient
      orgId={orgId}
      isAdmin={isAdmin}
      initialName={org.name}
      initialLogoUrl={org.logo_url}
    />
  );
}
