import { buildLuckyDrawReceiptUrl } from "@/lib/whatsapp";
import { apiPost } from "@/lib/api";

export function ReceiptButton({
  ticketId,
  buyerName,
  buyerMobile,
  amount,
  orgName,
  paymentMethod,
  onSent,
}: {
  ticketId: string;
  buyerName: string;
  buyerMobile: string;
  amount: number;
  orgName: string;
  paymentMethod: "cash" | "qr";
  onSent?: () => void;
}) {
  return (
    <a
      href={buildLuckyDrawReceiptUrl(buyerName, buyerMobile, amount, orgName, paymentMethod)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        apiPost(`/lucky-draw/${ticketId}/mark-thanked`).catch(() => {});
        onSent?.();
      }}
      className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-lg text-body font-semibold bg-durva text-paper hover:brightness-95"
    >
      Send Receipt
    </a>
  );
}
