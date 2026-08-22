import { formatAmount } from "@/lib/format";

export function AmountText({
  amount,
  size = "sm",
}: {
  amount: number;
  size?: "sm" | "lg";
}) {
  const sizeClass = size === "lg" ? "text-amount-lg" : "text-amount-sm";
  return (
    <span className={`font-mono ${sizeClass} text-ink whitespace-nowrap`}>
      {amount < 0 ? "−" : ""}
      {formatAmount(amount)}
    </span>
  );
}
