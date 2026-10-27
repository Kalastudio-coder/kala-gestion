// Avisos de Windows del día: lo que vence, lo atrasado y lo que se publica.
import { remaining } from "./billing";
import { addDays } from "./dates";
import { formatMoney } from "./format";
import type { Notice } from "./store";
import type { AppData, Charge } from "./types";

export function dailyNotices(data: AppData, charges: Charge[], now: string): Notice[] {
  const name = (id: string) => data.clients.find((c) => c.id === id)?.name ?? "Cliente";
  const service = (id: string) => data.services.find((s) => s.id === id)?.name ?? "Servicio";
  const out: Notice[] = [];

  const dueToday = charges.filter((c) => c.dueDate === now && c.status !== "pagado");
  if (dueToday.length === 1) {
    const c = dueToday[0];
    out.push({ title: `Hoy vence el pago de ${name(c.clientId)}`, body: `${service(c.serviceId)} · ${formatMoney(remaining(c))}`, clientId: c.clientId });
  } else if (dueToday.length > 1) {
    out.push({
      title: `Hoy vencen ${dueToday.length} pagos`,
      body: dueToday.map((c) => `${name(c.clientId)} (${formatMoney(remaining(c))})`).join(", "),
    });
  }

  const overdue = charges.filter((c) => c.status === "vencido");
  if (overdue.length) {
    const total = overdue.reduce((s, c) => s + remaining(c), 0);
    const clients = [...new Set(overdue.map((c) => name(c.clientId)))];
    out.push({
      title: `Tenés ${formatMoney(total)} atrasados`,
      body: `${overdue.length} ${overdue.length === 1 ? "cobro" : "cobros"} sin pagar: ${clients.join(", ")}`,
      clientId: clients.length === 1 ? overdue[0].clientId : undefined,
    });
  }

  const postsToday = data.posts.filter((p) => p.date === now);
  if (postsToday.length) {
    out.push({
      title: postsToday.length === 1 ? `Hoy se publica para ${name(postsToday[0].clientId)}` : `Hoy hay ${postsToday.length} publicaciones`,
      body: postsToday.map((p) => (postsToday.length === 1 ? p.title : `${name(p.clientId)}: ${p.title}`)).join(" · "),
      clientId: new Set(postsToday.map((p) => p.clientId)).size === 1 ? postsToday[0].clientId : undefined,
    });
  }

  // Lo que sale mañana y el cliente todavía no aprobó.
  const tomorrow = addDays(now, 1);
  const unapproved = data.posts.filter((p) => p.date === tomorrow && p.status !== "aprobada");
  if (unapproved.length) {
    out.push({
      title: "Mañana sale contenido sin aprobar",
      body: unapproved.map((p) => `${name(p.clientId)}: ${p.title}`).join(" · "),
      clientId: new Set(unapproved.map((p) => p.clientId)).size === 1 ? unapproved[0].clientId : undefined,
    });
  }

  return out;
}
