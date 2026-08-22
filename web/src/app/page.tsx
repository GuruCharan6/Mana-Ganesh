import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { apiPostServer } from "@/lib/api-server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const link = await apiPostServer("/auth/link-pending-member");

  if (link?.org_id) redirect(`/org/${link.org_id}`);
  redirect("/onboarding/create-org");
}
