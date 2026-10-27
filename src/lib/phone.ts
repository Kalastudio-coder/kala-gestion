// Links de WhatsApp a partir de los celulares que cargan los clientes, que en
// Argentina vienen de mil formas: "299 15 555-1234", "0299 5551234",
// "+54 9 299 555 1234"... wa.me necesita 549 + característica + número.

/** Número para wa.me (sólo dígitos); null si no parece un celular. */
export function waNumber(phone: string | null | undefined): string | null {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    let rest = d.slice(2);
    if (rest.startsWith("0")) rest = rest.slice(1);
    if (!rest.startsWith("9")) rest = `9${rest}`;
    d = `54${rest}`;
    return d.length >= 12 ? d : null;
  }
  if (d.startsWith("0")) d = d.slice(1);
  // "299 15 5551234": sacamos el 15 que va después de la característica.
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === "15") {
        d = d.slice(0, area) + d.slice(area + 2);
        break;
      }
    }
  }
  if (d.length === 10) return `549${d}`;
  // Otro país (ya con su código) o algo que no reconocemos.
  return d.length >= 11 ? d : null;
}

/** Link de WhatsApp con el mensaje ya escrito. */
export function waLink(phone: string | null | undefined, text?: string): string | null {
  const n = waNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
