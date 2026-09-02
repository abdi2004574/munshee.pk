// NOTE: For Phase 2+ (AI extraction / receipts) we will migrate money to bigint
// paise (smallest currency unit) and add a `divisor` prop (default 100) here.
// The DB currently stores numeric(12,2) so values may arrive as JS numbers.

type MoneyValue = number | string | bigint | null | undefined;

interface MoneyProps {
  value: MoneyValue;
  currency?: string;
  className?: string;
}

const CURRENCY_CONFIG: Record<string, { locale: string; symbol: string }> = {
  PKR: { locale: "en-PK", symbol: "Rs " },
  USD: { locale: "en-US", symbol: "$" },
  EUR: { locale: "de-DE", symbol: "€" },
  GBP: { locale: "en-GB", symbol: "£" },
};

const FALLBACK = { locale: "en-US", symbol: "" };

export function Money({ value, currency = "PKR", className = "" }: MoneyProps) {
  if (value === null || value === undefined || value === "") {
    return <span className={className}>—</span>;
  }

  const upper = currency.toUpperCase();
  const config = CURRENCY_CONFIG[upper] ?? FALLBACK;

  let numeric: number;
  if (typeof value === "bigint") {
    numeric = Number(value);
  } else if (typeof value === "string") {
    numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return <span className={className}>{value}</span>;
    }
  } else {
    numeric = value;
  }

  const formatted = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);

  return (
    <span className={className}>
      {config.symbol}
      {formatted}
    </span>
  );
}
