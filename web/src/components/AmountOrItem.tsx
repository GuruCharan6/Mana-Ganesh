import { AmountText } from "@/components/AmountText";

export function AmountOrItem({
  amount,
  itemDescription,
  size = "sm",
}: {
  amount: number;
  itemDescription: string | null;
  size?: "sm" | "lg";
}) {
  if (itemDescription && amount === 0) {
    return (
      <span className="text-body-strong text-right truncate max-w-[40%] shrink-0">
        {itemDescription}
      </span>
    );
  }
  if (itemDescription) {
    return (
      <span className="flex flex-col items-end text-right shrink-0">
        <AmountText amount={amount} size={size} />
        <span className="text-caption text-ink-muted truncate max-w-[40vw]">
          ({itemDescription})
        </span>
      </span>
    );
  }
  return <AmountText amount={amount} size={size} />;
}
