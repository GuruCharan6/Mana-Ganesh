export function TxnTag({ type }: { type: "chanda" | "expense" | "promised" }) {
  const style =
    type === "chanda"
      ? "bg-peacock/10 text-peacock"
      : type === "expense"
        ? "bg-ink-muted/10 text-ink-muted"
        : "bg-marigold/10 text-marigold";
  const label = type === "chanda" ? "Chanda" : type === "expense" ? "Expense" : "Promised";

  return (
    <span className={`text-badge uppercase tracking-[0.02em] px-1 rounded shrink-0 ${style}`}>
      {label}
    </span>
  );
}
