// ---------------------------------------------------------------------------
// INR formatting utilities. Amounts are whole rupees.
// ---------------------------------------------------------------------------

export const CRORE = 10_000_000;
export const LAKH = 100_000;

/** "₹4,82,00,000" style (Indian digit grouping) */
export function inr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

/** Compact: ₹4.82 Cr / ₹38.4L / ₹6.2L */
export function inrCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= CRORE) {
    return `${sign}₹${(abs / CRORE).toFixed(2)} Cr`;
  }
  if (abs >= LAKH) {
    return `${sign}₹${(abs / LAKH).toFixed(1)}L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(0)}k`;
  }
  return `${sign}₹${Math.round(abs)}`;
}

/** Signed compact, e.g. "+₹1.2L" / "−₹64L" */
export function inrDelta(value: number): string {
  const sign = value > 0 ? "+" : "−";
  return `${sign}${inrCompact(Math.abs(value))}`;
}

/** Full amount with Indian grouping and no decimals, e.g. "₹4,82,00,000" */
export function inrFull(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function pct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function pctSigned(value: number, digits = 0): string {
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}%`;
}

/** Days in compact form: "52 days", "~7 wks" */
export function daysLabel(days: number | null): string {
  if (days === null) return "—";
  if (days < 1) return "today";
  return `${days} days`;
}

export function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
