import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewExpenseClient } from "./NewExpenseClient";

export default async function NewExpensePage({
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

  const { data: member } = await supabase
    .from("org_members")
    .select("role, access_level")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "joined")
    .maybeSingle();

  if (!member) notFound();
  const canWrite = member.role === "admin" || member.access_level === "full";
  if (!canWrite) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-body text-sindoor">Full access required.</p>
      </main>
    );
  }

  return <NewExpenseClient />;
}
