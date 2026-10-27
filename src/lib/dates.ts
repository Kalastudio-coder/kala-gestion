// Fechas como texto "YYYY-MM-DD" (sin hora ni zona horaria): un vencimiento es un día.

export function today(): string {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
}

export function toISO(year: number, monthIndex: number, day: number): string {
  const d = new Date(Date.UTC(year, monthIndex, day));
  return d.toISOString().slice(0, 10);
}

export function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m - 1, d];
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  return toISO(y, m, d + days);
}

/** Suma meses respetando el día; si el mes no lo tiene (31 de febrero), usa el último día. */
export function addMonths(iso: string, months: number, anchorDay?: number): string {
  const [y, m, d] = parts(iso);
  const day = anchorDay ?? d;
  const lastDay = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();
  return toISO(y, m + months, Math.min(day, lastDay));
}

export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(...parts(from));
  const b = Date.UTC(...parts(to));
  return Math.round((b - a) / 86_400_000);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthStart(key: string): string {
  return `${key}-01`;
}

export function monthEnd(key: string): string {
  return addDays(addMonths(monthStart(key), 1), -1);
}

export function shiftMonth(key: string, delta: number): string {
  return monthKey(addMonths(monthStart(key), delta));
}

const dateFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
const dateLongFmt = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const monthFmt = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });

const asDate = (iso: string) => new Date(Date.UTC(...parts(iso)));

export const formatDate = (iso: string) => dateFmt.format(asDate(iso)).replace(".", "");
export const formatDateLong = (iso: string) => dateLongFmt.format(asDate(iso));
export const formatMonth = (key: string) => {
  const s = monthFmt.format(asDate(monthStart(key)));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "hoy", "mañana", "en 5 días", "hace 3 días". */
export function relative(iso: string, from = today()): string {
  const n = daysBetween(from, iso);
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  if (n === -1) return "ayer";
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}
