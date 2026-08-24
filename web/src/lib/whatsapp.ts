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
  const givenLine = itemDescription
    ? amount > 0
      ? ` Given: ${itemDescription} (${formatAmount(amount)})`
      : ` Given: ${itemDescription}`
    : ` Amount: ${formatAmount(amount)}`;

  const year = new Date().getFullYear();

  const message = [
    `🙏 *${orgName}* 🙏`,
    ``,
    ` *Vinayaka Chavithi ${year}* `,
    ``,
    ` *Contribution Received*`,
    ` Name: ${donorName}`,
    givenLine,
    ``,
    ` Thank you for your generous contribution and support towards our Vinayaka Chavithi celebrations. ❤️`,
    ``,
    `🌺 Ganapati Bappa Morya! 🌺`,
    ``,
    `With gratitude,`,
    `✨ *Team ${orgName}* ✨`,
  ].join("\n");

  // whatsapp:// (not wa.me) — wa.me is a redirect webpage that re-parses the
  // URL before handing off to the app, which corrupts 4-byte emoji on some
  // Android/WhatsApp versions. The direct app deep link skips that hop.
  return `whatsapp://send?phone=${toWaNumber(donorMobile)}&text=${encodeURIComponent(message)}`;
}

export function buildLuckyDrawReceiptUrl(
  buyerName: string,
  buyerMobile: string,
  amount: number,
  orgName: string,
  paymentMethod: "cash" | "qr"
): string {
  const year = new Date().getFullYear();

  const message = [
    `🙏 *${orgName}* 🙏`,
    ``,
    ` *Vinayaka Chavithi ${year} Lucky Draw* `,
    ``,
    ` *Ticket Confirmation*`,
    ` Name: ${buyerName}`,
    ` Amount: ${formatAmount(amount)}`,
    ` Paid via: ${paymentMethod === "qr" ? "QR" : "Cash"}`,
    ``,
    ` Thank you for participating in our Vinayaka Chavithi Lucky Draw! `,
    ``,
    ` *Best of luck!* 👍 `,
    ``,
    `🌺 Ganapati Bappa Morya! 🌺`,
    ``,
    `With gratitude,`,
    `✨ *Team ${orgName}* ✨`,
  ].join("\n");

  return `whatsapp://send?phone=${toWaNumber(buyerMobile)}&text=${encodeURIComponent(message)}`;
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
