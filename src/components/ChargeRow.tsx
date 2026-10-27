import { Check, MessageCircle } from "lucide-react";
import { remaining } from "../lib/billing";
import { formatDate, formatDateLong, relative } from "../lib/dates";
import { formatMoney } from "../lib/format";
import { waLink } from "../lib/phone";
import { openExternal, useStore } from "../lib/store";
import type { Charge } from "../lib/types";
import { Avatar, Button, StatusBadge, cx } from "./ui";

/** Una fila de vencimiento: cliente, servicio, fecha, monto y acciones. */
export function ChargeRow({
  charge,
  onPay,
  onOpenClient,
  hideClient,
}: {
  charge: Charge;
  onPay: (c: Charge) => void;
  onOpenClient?: (id: string) => void;
  hideClient?: boolean;
}) {
  const { data, now } = useStore();
  const client = data.clients.find((c) => c.id === charge.clientId);
  const service = data.services.find((s) => s.id === charge.serviceId);
  const open = charge.status !== "pagado";
  const owed = remaining(charge);

  const reminder =
    open && client?.phone
      ? waLink(
          client.phone,
          `Hola${client.contactName ? ` ${client.contactName.split(" ")[0]}` : ""}! Te recuerdo el pago de ${service?.name ?? "el servicio"} por ${formatMoney(owed)}, ${
            charge.dueDate < now ? `que venció el ${formatDateLong(charge.dueDate)}` : `que vence el ${formatDateLong(charge.dueDate)}`
          }. ¡Gracias!`,
        )
      : null;

  return (
    <div className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-panel-2/60">
      {!hideClient && client && (
        <button onClick={() => onOpenClient?.(client.id)} className="cursor-pointer">
          <Avatar name={client.name} color={client.color} size={36} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {!hideClient && (
          <button onClick={() => client && onOpenClient?.(client.id)} className="block max-w-full cursor-pointer truncate text-left text-sm font-medium hover:underline">
            {client?.name ?? "Cliente borrado"}
          </button>
        )}
        <p className={cx("truncate text-[13px]", hideClient ? "text-sm font-medium text-ink" : "text-muted")}>
          {service?.name ?? "Servicio borrado"}
        </p>
      </div>
      <div className="w-24 shrink-0 text-right">
        <p className="text-sm">{formatDate(charge.dueDate)}</p>
        <p className={cx("text-xs", charge.status === "vencido" ? "text-bad" : "text-faint")}>
          {open ? relative(charge.dueDate, now) : "cobrado"}
        </p>
      </div>
      <div className="w-28 shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">{formatMoney(open ? owed : charge.amount)}</p>
        {charge.paid > 0 && open && <p className="text-xs text-faint">de {formatMoney(charge.amount)}</p>}
      </div>
      <div className="w-28 shrink-0 text-right">
        <StatusBadge status={charge.status} />
      </div>
      <div className="flex w-36 shrink-0 justify-end gap-1.5">
        {reminder && (
          <Button size="sm" variant="ghost" title="Recordarle por WhatsApp" onClick={() => openExternal(reminder)}>
            <MessageCircle size={15} />
          </Button>
        )}
        {open && (
          <Button size="sm" variant="primary" onClick={() => onPay(charge)}>
            <Check size={15} /> Cobrar
          </Button>
        )}
      </div>
    </div>
  );
}
