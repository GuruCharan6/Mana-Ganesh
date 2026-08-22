import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center min-h-11 px-5 rounded-lg text-body font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-marigold text-paper hover:brightness-95",
  secondary: "bg-transparent text-ink border border-line hover:bg-surface",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function Button({ variant = "primary", className = "", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
});
