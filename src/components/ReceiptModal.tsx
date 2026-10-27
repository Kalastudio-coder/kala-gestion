import { formatDate } from "../lib/dates";
import { formatMoney } from "../lib/format";
import { receiptCode, receiptFileName, receiptHtml } from "../lib/receiptPdf";
import { useStore } from "../lib/store";
import { SendPdfModal } from "./SendPdfModal";

/** Recibo de un pago: el número se asigna la primera vez que se genera. */
export function ReceiptModal({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const { data, update } = useStore();
  const payment = data.payments.find((p) => p.id === paymentId);
  const client = data.clients.find((c) => c.id === payment?.clientId);
  if (!payment || !client) return null;
  const service = data.services.find((s) => s.id === payment.serviceId);
  const number = payment.receiptNumber ?? data.settings.nextReceipt;
  const firstName = client.contactName?.split(" ")[0];

  const build = () => {
    if (!payment.receiptNumber) {
      update((d) => ({
        ...d,
        payments: d.payments.map((p) => (p.id === payment.id ? { ...p, receiptNumber: number } : p)),
        settings: { ...d.settings, nextReceipt: Math.max(d.settings.nextReceipt, number + 1) },
      }));
    }
    return {
      html: receiptHtml(payment, number, client, service, data.settings),
      fileName: receiptFileName(client, number),
      footer: `${data.settings.businessName} · Recibo N° ${receiptCode(number)}`,
      folder: "Recibos" as const,
    };
  };

  return (
    <SendPdfModal
      title={`Recibo N° ${receiptCode(number)}`}
      client={client}
      heading={`${client.name} · ${formatMoney(payment.amount)}`}
      sub={`${service?.name ?? "Servicio"} · pagado el ${formatDate(payment.paidAt)}`}
      defaultMessage={`¡Hola${firstName ? ` ${firstName}` : ""}! Te paso el recibo del pago de ${service?.name ?? "este mes"} por ${formatMoney(payment.amount)}. ¡Gracias! 🙌`}
      build={build}
      onClose={onClose}
    />
  );
}
