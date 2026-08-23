"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={logout}
      disabled={loggingOut}
      aria-label="Log out"
      className="text-ink-muted shrink-0 p-1"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M16 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
