// Avance del plan de contenido: cuántas piezas de cada tipo hay cargadas en un mes.
import { splitTitle } from "./calendarPdf";
import type { ContentPost, PlanItem } from "./types";

// "Efemérides" → "efemeride", "Reels" → "reel": para comparar sin tildes, mayúsculas ni plurales.
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/s$/, "");

/** Un tipo del plan puede aceptar varias variantes: "Efeméride o promo", "Efeméride / Promo". */
const variants = (type: string) => type.split(/\s*(?:\/|\bo\b|,)\s*/i).map(norm).filter(Boolean);

export interface PlanProgress {
  type: string;
  count: number;
  done: number;
}

export function planProgress(plan: PlanItem[], posts: ContentPost[]): { items: PlanProgress[]; extra: number } {
  const pending = posts.map((p) => norm(splitTitle(p.title).type));
  const items = plan.map((item) => {
    const accepted = variants(item.type);
    let done = 0;
    // Cada publicación cuenta para un solo tipo del plan (el primero que la acepta).
    for (let i = 0; i < pending.length && done < item.count; i++) {
      if (pending[i] && accepted.includes(pending[i])) {
        pending[i] = "";
        done++;
      }
    }
    return { type: item.type, count: item.count, done };
  });
  return { items, extra: pending.filter(Boolean).length };
}
