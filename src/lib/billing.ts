import { addDays, addMonths, parts, today } from "./dates";
import type { AppData, Charge, Expense, Frequency, Payment, Service } from "./types";

export const FREQUENCIES: { value: Frequency; label: string; short: string; perMonth: number }[] = [
  { value: "mensual", label: "Mensual", short: "por mes", perMonth: 1 },
  { value: "quincenal", label: "Quincenal (2 veces por mes)", short: "por quincena", perMonth: 2 },
  { value: "semanal", label: "Semanal", short: "por semana", perMonth: 52 / 12 },
  { value: "bimestral", label: "Cada 2 meses", short: "cada 2 meses", perMonth: 1 / 2 },
  { value: "trimestral", label: "Cada 3 meses", short: "cada 3 meses", perMonth: 1 / 3 },
  { value: "semestral", label: "Cada 6 meses", short: "cada 6 meses", perMonth: 1 / 6 },
  { value: "anual", label: "Anual", short: "por año", perMonth: 1 / 12 },
  { value: "unico", label: "Pago único", short: "pago único", perMonth: 0 },
];

export const frequencyInfo = (f: Frequency) => FREQUENCIES.find((x) => x.value === f)!;

const MONTH_STEP: Partial<Record<Frequency, number>> = {
  mensual: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** Vencimientos de un servicio hasta `until` (inclusive). */
export function dueDates(service: Service, until: string): string[] {
  const end = service.endDate && service.endDate < until ? service.endDate : until;
  const out: string[] = [];
  const start = service.startDate;
  const anchorDay = parts(start)[2];
  // Tope de seguridad: 20 años de cobros semanales.
  for (let n = 0; n < 1100; n++) {
    let date: string;
    if (service.frequency === "unico") {
      if (n > 0) break;
      date = start;
    } else if (service.frequency === "semanal") {
      date = addDays(start, 7 * n);
    } else if (service.frequency === "quincenal") {
      // El día del alta y 15 días después, todos los meses.
      const base = addMonths(start, Math.floor(n / 2), anchorDay);
      date = n % 2 === 0 ? base : addDays(base, 15);
    } else {
      date = addMonths(start, n * MONTH_STEP[service.frequency]!, anchorDay);
    }
    if (date > end) break;
    out.push(date);
  }
  return out;
}

/** Precio que rige para un vencimiento: el último aumento con fecha anterior o igual, o el inicial. */
export function amountAt(service: Service, date: string): number {
  let amount = service.amount;
  let from = "";
  for (const c of service.priceChanges ?? []) {
    if (c.from <= date && c.from >= from) {
      amount = c.amount;
      from = c.from;
    }
  }
  return amount;
}

/** Aplica un aumento (en %) desde una fecha, redondeado a la centena. */
export function withIncrease(service: Service, percent: number, from: string): Service {
  const base = amountAt(service, from);
  const amount = Math.round((base * (1 + percent / 100)) / 100) * 100;
  const others = (service.priceChanges ?? []).filter((c) => c.from !== from);
  return { ...service, priceChanges: [...others, { from, amount }].sort((a, b) => a.from.localeCompare(b.from)) };
}

export const chargeKey = (serviceId: string, dueDate: string) => `${serviceId}:${dueDate}`;

/** Días hacia adelante que se muestran como próximos vencimientos. */
export const HORIZON_DAYS = 62;

/** Todos los vencimientos (pasados y próximos) con lo pagado en cada uno. */
export function buildCharges(data: AppData, now = today()): Charge[] {
  const until = addDays(now, HORIZON_DAYS);
  const paidByKey = new Map<string, number>();
  for (const p of data.payments) {
    const k = chargeKey(p.serviceId, p.dueDate);
    paidByKey.set(k, (paidByKey.get(k) ?? 0) + p.amount);
  }

  const charges: Charge[] = [];
  const seen = new Set<string>();
  for (const s of data.services) {
    for (const due of dueDates(s, until)) {
      const key = chargeKey(s.id, due);
      seen.add(key);
      const paid = paidByKey.get(key) ?? 0;
      const amount = amountAt(s, due);
      charges.push({
        key,
        serviceId: s.id,
        clientId: s.clientId,
        dueDate: due,
        amount,
        paid,
        status: statusOf(amount, paid, due, now),
      });
    }
  }

  // Pagos de vencimientos que ya no existen (por ejemplo, si se cambió la fecha de inicio):
  // se muestran igual para no perder plata registrada.
  for (const p of data.payments) {
    const key = chargeKey(p.serviceId, p.dueDate);
    if (seen.has(key)) continue;
    seen.add(key);
    const paid = paidByKey.get(key)!;
    charges.push({
      key,
      serviceId: p.serviceId,
      clientId: p.clientId,
      dueDate: p.dueDate,
      amount: paid,
      paid,
      status: "pagado",
    });
  }

  return charges.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function statusOf(amount: number, paid: number, due: string, now: string) {
  if (paid >= amount) return "pagado" as const;
  if (due < now) return "vencido" as const;
  if (paid > 0) return "parcial" as const;
  return "pendiente" as const;
}

export const remaining = (c: Charge) => Math.max(0, c.amount - c.paid);
export const isOpen = (c: Charge) => c.status !== "pagado";

export function isServiceActive(s: Service, now = today()): boolean {
  if (s.endDate && s.endDate <= now) return false;
  if (s.frequency === "unico") return s.startDate >= now;
  return true;
}

/** Ingreso mensual estimado de los servicios recurrentes activos. */
export function monthlyRecurring(services: Service[], now = today()): number {
  return services
    .filter((s) => isServiceActive(s, now))
    .reduce((sum, s) => sum + amountAt(s, now) * frequencyInfo(s.frequency).perMonth, 0);
}

export function paymentsInMonth(payments: Payment[], key: string): Payment[] {
  return payments.filter((p) => p.paidAt.startsWith(key));
}

/** Gastos que caen en un mes (YYYY-MM): los únicos de ese mes y los mensuales vigentes. */
export function expensesInMonth(expenses: Expense[], key: string): { expense: Expense; date: string }[] {
  const out: { expense: Expense; date: string }[] = [];
  for (const e of expenses) {
    if (!e.monthly) {
      if (e.date.startsWith(key)) out.push({ expense: e, date: e.date });
      continue;
    }
    const date = addMonths(e.date, monthsBetween(e.date.slice(0, 7), key), parts(e.date)[2]);
    if (date >= e.date && (!e.endDate || date <= e.endDate)) out.push({ expense: e, date });
  }
  return out;
}

function monthsBetween(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
