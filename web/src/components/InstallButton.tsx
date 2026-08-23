"use client";

import { useInstallPrompt } from "@/lib/useInstallPrompt";

export function InstallButton() {
  const { available, promptInstall } = useInstallPrompt();

  if (!available) return null;

  return (
    <button
      onClick={promptInstall}
      className="w-full rounded-lg border border-marigold text-marigold px-3 py-3 text-body font-semibold"
    >
      Install App
    </button>
  );
}
