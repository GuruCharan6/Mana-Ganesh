"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RupeeIcon() {
  return (
    <span className="h-5 w-5 flex items-center justify-center text-lg font-bold leading-none">
      ₹
    </span>
  );
}

const ICONS = {
  dashboard: "M3 11.5 12 4l9 7.5M5.5 10v9a1 1 0 0 0 1 1h4v-6h3v6h4a1 1 0 0 0 1-1v-9",
  transactions: "M12 8v5l3 2M21 12a9 9 0 1 1-3-6.7M21 3v5h-5",
  expenses: "M6 3h12v18l-3-2-3 2-3-2-3 2V3zM8 8h8M8 12h8M8 16h5",
};

export function OrgNav({ orgId }: { orgId: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: `/org/${orgId}`, label: "Home", icon: <Icon path={ICONS.dashboard} /> },
    { href: `/org/${orgId}/chanda`, label: "Chanda", icon: <RupeeIcon /> },
    { href: `/org/${orgId}/expenses`, label: "Expenses", icon: <Icon path={ICONS.expenses} /> },
    { href: `/org/${orgId}/transactions`, label: "History", icon: <Icon path={ICONS.transactions} /> },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-line bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((tab) => {
        const active =
          tab.href === `/org/${orgId}`
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 ${
              active ? "text-marigold" : "text-ink-muted"
            }`}
          >
            {tab.icon}
            <span className="text-badge leading-none">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
