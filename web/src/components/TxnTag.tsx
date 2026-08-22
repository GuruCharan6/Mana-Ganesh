export function TxnTag({ type }: { type: "chanda" | "expense" }) {
  return (
    <span
      className={`text-badge uppercase tracking-[0.02em] px-1 rounded shrink-0 ${
        type === "chanda" ? "bg-peacock/10 text-peacock" : "bg-ink-muted/10 text-ink-muted"
      }`}
    >
      {type === "chanda" ? "Chanda" : "Expense"}
    </span>
  );
}
