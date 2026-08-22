import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const supabase = await createClient();

  if (code) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Guards against a duplicate hit on this route re-using an
    // already-consumed PKCE code (throws "flow_state_already_used").
    if (!session) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(error.message)}`
        );
      }
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
