/* eslint-disable @next/next/no-img-element */
"use client";

export type PaymentMethod = "cash" | "qr";

export function PaymentMethodToggle({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange("cash")}
        className={`flex-1 rounded-lg border px-3 py-2.5 text-body font-semibold ${
          value === "cash" ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
        }`}
      >
        Cash
      </button>
      <button
        type="button"
        onClick={() => onChange("qr")}
        className={`flex-1 rounded-lg border px-3 py-2.5 text-body font-semibold ${
          value === "qr" ? "border-marigold bg-marigold/10 text-ink" : "border-line text-ink-muted"
        }`}
      >
        QR
      </button>
    </div>
  );
}

export function PaymentMethodField({
  qrUrl,
  value,
  onChange,
}: {
  qrUrl: string | null;
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <PaymentMethodToggle value={value} onChange={onChange} />
      {value === "qr" && qrUrl && (
        <img
          src={qrUrl}
          alt="Payment QR code"
          className="w-full max-w-[220px] mx-auto rounded-lg border border-line object-contain"
        />
      )}
    </div>
  );
}
