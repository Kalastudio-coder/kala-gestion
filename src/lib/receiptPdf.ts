// Arma el HTML del recibo de un pago, para exportarlo a PDF y mandarlo por WhatsApp.
import { formatDateLong } from "./dates";
import { formatMoney } from "./format";
import type { Client, Payment, Service, Settings } from "./types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const METHOD_LABELS: Record<Payment["method"], string> = {
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago",
  efectivo: "Efectivo",
  otro: "Otro",
};

export const receiptCode = (n: number) => String(n).padStart(5, "0");

export function receiptFileName(client: Client, n: number) {
  return `Recibo ${receiptCode(n)} - ${client.name}.pdf`.replace(/[\\/:*?"<>|]/g, "");
}

export function receiptHtml(p: Payment, n: number, client: Client, service: Service | undefined, s: Settings): string {
  const accent = "#7c3aed";
  const rows: [string, string][] = [
    ["Concepto", service?.name ?? "Servicio"],
    ["Vencimiento", formatDateLong(p.dueDate)],
    ["Medio de pago", METHOD_LABELS[p.method]],
  ];
  if (p.note) rows.push(["Detalle", p.note]);

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Recibo ${receiptCode(n)}</title>
<style>
  @page { size: A4 portrait; margin: 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #1f2937; font-size: 11pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .card { border: 1px solid #e5e7eb; border-radius: 18px; overflow: hidden; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; padding: 28px 32px; background: #111827; color: #fff; }
  .brand { font-size: 20pt; font-weight: 700; letter-spacing: -0.4px; }
  .brand-sub { font-size: 9pt; color: #9ca3af; margin-top: 4px; line-height: 1.5; }
  .doc { text-align: right; }
  .doc b { display: block; font-size: 9pt; letter-spacing: 2px; color: ${accent}; color: #c4b5fd; }
  .doc span { display: block; font-size: 18pt; font-weight: 700; margin-top: 2px; }
  .doc small { display: block; font-size: 9pt; color: #9ca3af; margin-top: 4px; }
  .body { padding: 30px 32px; }
  .lead { font-size: 12pt; line-height: 1.6; }
  .lead strong { color: #111827; }
  .amount { margin: 26px 0; padding: 20px 24px; border-radius: 14px; background: #f5f3ff; display: flex; justify-content: space-between; align-items: center; }
  .amount span { font-size: 10pt; color: #6b7280; letter-spacing: 1px; text-transform: uppercase; font-weight: 600; }
  .amount strong { font-size: 26pt; color: ${accent}; letter-spacing: -0.5px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 11px 0; border-bottom: 1px solid #f0f0f3; font-size: 10.5pt; }
  td:first-child { color: #6b7280; width: 38%; }
  .foot { margin-top: 34px; display: flex; justify-content: space-between; align-items: flex-end; }
  .legal { font-size: 8.5pt; color: #9ca3af; max-width: 60%; line-height: 1.5; }
  .sign { text-align: center; font-size: 9pt; color: #6b7280; }
  .sign i { display: block; width: 180px; border-top: 1px solid #9ca3af; margin-bottom: 6px; }
</style></head>
<body>
  <div class="card">
    <div class="top">
      <div>
        <div class="brand">${esc(s.businessName || "Kala Studio")}</div>
        <div class="brand-sub">${[s.businessId, s.businessContact].filter(Boolean).map((x) => esc(x!)).join("<br>")}</div>
      </div>
      <div class="doc"><b>RECIBO</b><span>N° ${receiptCode(n)}</span><small>${esc(formatDateLong(p.paidAt))}</small></div>
    </div>
    <div class="body">
      <p class="lead">Recibimos de <strong>${esc(client.name)}</strong> la suma indicada en concepto de
        <strong>${esc(service?.name ?? "servicios")}</strong>.</p>
      <div class="amount"><span>Total recibido</span><strong>${esc(formatMoney(p.amount))}</strong></div>
      <table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
      <div class="foot">
        <p class="legal">Comprobante de pago. No válido como factura.<br>¡Gracias por confiar en nosotros!</p>
        <div class="sign"><i></i>${esc(s.businessName || "Kala Studio")}</div>
      </div>
    </div>
  </div>
</body></html>`;
}
