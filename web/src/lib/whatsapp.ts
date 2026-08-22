import { formatAmount } from "./format";

function toWaNumber(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export function buildThankYouUrl(
  donorName: string,
  donorMobile: string,
  amount: number,
  orgName: string,
  itemDescription?: string | null
): string {
  const gift = itemDescription
    ? amount > 0
      ? `${itemDescription} (${formatAmount(amount)})`
      : itemDescription
    : formatAmount(amount);
  const message =
    `Namaste Sir/Madam ${donorName}! 🙏 Thank you for your generous chanda of ${gift} ` +
    `for Ganesh Chaturthi. Your support means a lot to us.\n\n- ${orgName}`;
  return `https://wa.me/${toWaNumber(donorMobile)}?text=${encodeURIComponent(message)}`;
}

/**
 * v2 placeholder — automated, branded thank-you via WhatsApp Business API.
 * Explicitly out of scope for this build (PRD Section 5.9 / Section 3).
 * v1 uses buildThankYouUrl() above: a plain wa.me link the member taps and
 * sends themselves from their own WhatsApp, no API or backend involved.
 */
export async function notifyDonor(_donorMobile: string, _message: string): Promise<void> {
  throw new Error("notifyDonor() is a v2 stub — not implemented. Use buildThankYouUrl() for v1.");
}
