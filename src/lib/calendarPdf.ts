// Arma el HTML del calendario de contenido que se exporta a PDF para mandarle al cliente.
import { addDays, formatMonth, monthEnd, monthStart, parts } from "./dates";
import type { Client, ContentPost } from "./types";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "Reel: Unboxing" → { type: "Reel", name: "Unboxing" }. Sin prefijo, el tipo es "Publicación". */
export function splitTitle(title: string) {
  const m = title.match(/^([^:]{2,20}):\s*(.+)$/);
  return m ? { type: m[1].trim(), name: m[2].trim() } : { type: "Publicación", name: title };
}

const TYPE_TONES: Record<string, string> = {
  placa: "#2563eb",
  reel: "#db2777",
  promo: "#ea580c",
  efeméride: "#059669",
  efemeride: "#059669",
  historia: "#7c3aed",
  carrusel: "#0891b2",
};
const toneOf = (type: string, fallback: string) => TYPE_TONES[type.toLowerCase()] ?? fallback;

const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function gridDays(key: string): (string | null)[] {
  const first = monthStart(key);
  const [y, m, d] = parts(first);
  const lead = (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7;
  const out: (string | null)[] = Array(lead).fill(null);
  for (let day = first; day <= monthEnd(key); day = addDays(day, 1)) out.push(day);
  while (out.length % 7) out.push(null);
  return out;
}

export function pdfFileName(client: Client, month: string) {
  return `Calendario ${client.name} - ${formatMonth(month)}.pdf`.replace(/[\\/:*?"<>|]/g, "");
}

export function footerText(client: Client, month: string) {
  return `${client.name} · Calendario de contenidos · ${formatMonth(month)}`;
}

export function calendarHtml(client: Client, month: string, all: ContentPost[]): string {
  const posts = all.filter((p) => p.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  const accent = client.color;
  const monthName = formatMonth(month);
  const [year] = parts(monthStart(month));
  const lastDay = parts(monthEnd(month))[2];

  const counts = new Map<string, number>();
  for (const p of posts) {
    const t = splitTitle(p.title).type;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  // "placa" → "placas", "reel" → "reels", "publicación" → "publicaciones".
  const plural = (w: string) => (w.endsWith("ón") ? `${w.slice(0, -2)}ones` : `${w}s`);
  const plan = [...counts].map(([t, n]) => `${n} ${n === 1 ? t.toLowerCase() : plural(t.toLowerCase())}`);
  const pad = (n: number) => String(n).padStart(2, "0");

  const byDay = new Map<string, ContentPost[]>();
  for (const p of posts) byDay.set(p.date, [...(byDay.get(p.date) ?? []), p]);

  const days = gridDays(month);
  // Meses de 6 semanas: celdas más bajas para que la grilla entre en una sola hoja.
  const cellHeight = days.length > 35 ? 21 : 26;
  const cells = days
    .map((day) => {
      if (!day) return `<div class="cell empty"></div>`;
      const items = (byDay.get(day) ?? [])
        .map((p) => {
          const { type, name } = splitTitle(p.title);
          const tone = toneOf(type, accent);
          return `<div class="chip" style="border-color:${tone};background:${tone}12"><b style="color:${tone}">${esc(type)}</b>${esc(name)}</div>`;
        })
        .join("");
      return `<div class="cell"><span class="num">${parts(day)[2]}</span>${items}</div>`;
    })
    .join("");

  const details = posts
    .map((p) => {
      const { type, name } = splitTitle(p.title);
      const tone = toneOf(type, accent);
      const [, , d] = parts(p.date);
      const weekday = WEEKDAYS_SHORT[new Date(Date.UTC(...parts(p.date))).getUTCDay()];
      return `<article class="post">
        <div class="post-date"><span>${weekday}</span><strong>${d}</strong></div>
        <div class="post-body">
          <div class="post-head"><span class="tag" style="background:${tone}">${esc(type)}</span><h3>${esc(name)}</h3></div>
          <p>${esc(p.copy || "Copy a confirmar.")}</p>
        </div>
      </article>`;
    })
    .join("");

  const legend = [...counts.keys()]
    .map((t) => `<span><i style="background:${toneOf(t, accent)}"></i>${esc(t)}</span>`)
    .join("");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${esc(pdfFileName(client, month))}</title>
<style>
  @page { size: A4 landscape; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #1f2937; font-size: 10.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .cover { height: 172mm; display: flex; flex-direction: column; justify-content: center; position: relative; }
  .bar { width: 64px; height: 8px; border-radius: 4px; background: ${accent}; margin-bottom: 18px; }
  .cover h1 { font-size: 54pt; letter-spacing: -1.5px; line-height: 1; color: #111827; text-transform: uppercase; }
  .cover .sub { font-size: 15pt; color: #6b7280; margin-top: 10px; }
  .meta { margin-top: 36px; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; width: 70%; }
  .meta div { display: flex; border-top: 1px solid #e5e7eb; }
  .meta div:first-child { border-top: 0; }
  .meta dt { width: 150px; padding: 13px 18px; font-weight: 700; font-size: 9pt; letter-spacing: 1px; color: #6b7280; background: #f9fafb; }
  .meta dd { padding: 13px 18px; font-size: 11pt; }
  .meta .big { font-size: 20pt; font-weight: 700; color: ${accent}; }
  h2 { font-size: 20pt; letter-spacing: -0.4px; color: #111827; }
  .lead { color: #6b7280; margin: 4px 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(7, 1fr); border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
  .wd { background: #111827; color: #fff; font-size: 8pt; font-weight: 700; letter-spacing: 1px; text-align: center; padding: 7px 0; text-transform: uppercase; }
  .cell { min-height: ${cellHeight}mm; border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; padding: 5px; }
  .cell:nth-child(7n + 1) { border-left: 0; }
  .cell.empty { background: #f9fafb; }
  .num { display: block; font-size: 8.5pt; font-weight: 700; color: #9ca3af; margin-bottom: 3px; }
  .chip { border-left: 3px solid; border-radius: 4px; padding: 3px 5px; font-size: 7.5pt; line-height: 1.25; margin-bottom: 3px; }
  .chip b { display: block; font-size: 6.5pt; letter-spacing: 0.6px; text-transform: uppercase; }
  .titlebar { display: flex; justify-content: space-between; align-items: flex-end; }
  .legend { display: flex; gap: 16px; margin-bottom: 12px; font-size: 8.5pt; color: #6b7280; }
  .legend i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
  .posts { columns: 2; column-gap: 22px; margin-top: 6px; }
  .post { display: flex; gap: 12px; break-inside: avoid; padding: 12px 0; border-bottom: 1px solid #f0f0f3; }
  .post-date { width: 40px; text-align: center; flex-shrink: 0; }
  .post-date span { display: block; font-size: 7.5pt; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
  .post-date strong { font-size: 18pt; color: #111827; line-height: 1.1; }
  .post-head { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
  .tag { color: #fff; font-size: 6.5pt; font-weight: 700; letter-spacing: 0.7px; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; }
  .post h3 { font-size: 10.5pt; color: #111827; }
  .post p { white-space: pre-wrap; font-size: 9pt; line-height: 1.45; color: #4b5563; }
  .summary { width: 60%; border-collapse: collapse; margin-top: 8px; }
  .summary td { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; }
  .summary tr:last-child td { font-weight: 700; border-bottom: 0; }
</style></head>
<body>
  <section class="page cover">
    <div class="bar"></div>
    <h1>${esc(monthName.replace(/ de /, " "))}</h1>
    <p class="sub">Calendario de contenidos para redes sociales</p>
    <dl class="meta">
      <div><dt>CLIENTE</dt><dd class="big">${esc(client.name)}</dd></div>
      <div><dt>PERÍODO</dt><dd>01 — ${pad(lastDay)} de ${esc(monthName.split(" ")[0].toLowerCase())} ${year}</dd></div>
      <div><dt>PLAN</dt><dd>${posts.length} piezas de contenido${plan.length ? ` · ${esc(plan.join(", "))}` : ""}</dd></div>
    </dl>
  </section>

  <section class="page">
    <div class="titlebar">
      <div><h2>Calendario editorial</h2><p class="lead">Vista mensual de las publicaciones.</p></div>
      <div class="legend">${legend}</div>
    </div>
    <div class="grid">
      ${WEEKDAYS.map((d) => `<div class="wd">${d}</div>`).join("")}
      ${cells}
    </div>
  </section>

  <section class="page">
    <h2>Publicaciones y copys</h2>
    <p class="lead">El texto de cada publicación, listo para revisar.</p>
    <div class="posts">${details}</div>
  </section>

  <section class="page">
    <h2>Resumen del plan</h2>
    <table class="summary">
      ${[...counts].map(([t, n]) => `<tr><td><span class="tag" style="background:${toneOf(t, accent)}">${esc(t)}</span></td><td>${n}</td></tr>`).join("")}
      <tr><td>Total</td><td>${posts.length} piezas</td></tr>
    </table>
  </section>
</body></html>`;
}
