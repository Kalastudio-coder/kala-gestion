import { calendarHtml, footerText, pdfFileName } from "../lib/calendarPdf";
import { formatMonth } from "../lib/dates";
import { useStore } from "../lib/store";
import type { Client } from "../lib/types";
import { SendPdfModal } from "./SendPdfModal";

export function SendCalendarModal({ client, month, onClose }: { client: Client; month: string; onClose: () => void }) {
  const { data } = useStore();
  const count = data.posts.filter((p) => p.clientId === client.id && p.date.startsWith(month)).length;
  const monthName = formatMonth(month);
  const firstName = client.contactName?.split(" ")[0];

  return (
    <SendPdfModal
      title="Exportar y enviar calendario"
      client={client}
      heading={`${client.name} · ${monthName}`}
      sub={`${count} ${count === 1 ? "publicación" : "publicaciones"} · portada, calendario del mes, copys y resumen del plan`}
      defaultMessage={`¡Hola${firstName ? ` ${firstName}` : ""}! 👋 Te paso el calendario de contenidos de ${monthName.toLowerCase()}. Fijate si está todo bien y cualquier cambio me avisás 😊`}
      disabled={count === 0 ? "No hay publicaciones este mes" : undefined}
      build={() => ({
        html: calendarHtml(client, month, data.posts),
        fileName: pdfFileName(client, month),
        footer: footerText(client, month),
        folder: "Calendarios",
      })}
      onClose={onClose}
    />
  );
}
