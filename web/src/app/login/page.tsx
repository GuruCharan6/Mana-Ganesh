"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { OrgBrandMark } from "@/components/OrgBrandMark";

export default function LoginPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
    }
    // On success the browser navigates away to Google, then back to /auth/callback.
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-3">
        <OrgBrandMark size={64} />
        <h1 className="font-display text-heading-1">Mana Ganesh</h1>
        <p className="text-body text-ink-muted text-center">
          Chanda &amp; expense ledger for your festival committee
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        {error && <p className="text-caption text-sindoor text-center">{error}</p>}
        <Button onClick={signInWithGoogle} disabled={loading}>
          {loading ? "Redirecting..." : "Continue with Google"}
        </Button>
      </div>
    </main>
  );
}
