"use client";

import { useState } from "react";
import { useInstallPrompt } from "@/lib/useInstallPrompt";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallButton() {
  const { promptInstall } = useInstallPrompt();
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setMessage(null);
    const accepted = await promptInstall();
    if (accepted) return;
    setMessage(
      isIOS()
        ? "On iPhone/iPad: tap the Share button, then \"Add to Home Screen.\""
        : "Already installed, or your browser doesn't support installing yet."
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        className="w-full rounded-lg border border-marigold text-marigold px-3 py-3 text-body font-semibold"
      >
        Install App
      </button>
      {message && <p className="text-caption text-ink-muted">{message}</p>}
    </div>
  );
}
