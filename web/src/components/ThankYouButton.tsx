import { buildThankYouUrl } from "@/lib/whatsapp";

export function ThankYouButton({
  donorName,
  donorMobile,
  amount,
  orgName,
  itemDescription,
}: {
  donorName: string;
  donorMobile: string;
  amount: number;
  orgName: string;
  itemDescription?: string | null;
}) {
  return (
    <a
      href={buildThankYouUrl(donorName, donorMobile, amount, orgName, itemDescription)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-lg text-body font-semibold bg-durva text-paper hover:brightness-95"
    >
      Send Thank You
    </a>
  );
}
