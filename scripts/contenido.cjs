// Carga y consulta el calendario de contenido de Kala Gestión desde afuera de la app
// (lo usa Claude Code). Si la app está abierta, los cambios aparecen solos.
//
//   node scripts/contenido.cjs clientes
//   node scripts/contenido.cjs ver "La Pastelería" 2026-11
//   node scripts/contenido.cjs agregar calendario.json
//   node scripts/contenido.cjs completar piezas.json   (agrega "pieza" a publicaciones existentes)
//   node scripts/contenido.cjs crear-cliente "Librería Centro" "notas opcionales"
//   node scripts/contenido.cjs plan "Librería Centro" "Placa=8, Reel=6, Efeméride o promo=7"
//   node scripts/contenido.cjs borrar-mes "La Pastelería" 2026-11
//
// calendario.json:
//   { "cliente": "La Pastelería",
//     "publicaciones": [{ "fecha": "2026-11-03", "titulo": "Reel: ...", "copy": "..." }] }
//
// KALA_DATOS permite apuntar a otro archivo (para pruebas).
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const file = process.env.KALA_DATOS || path.join(process.env.APPDATA || "", "Kala Gestión", "datos.json");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function load() {
  if (!fs.existsSync(file)) fail(`No encuentro los datos en ${file}. ¿Abriste Kala Gestión al menos una vez?`);
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(d.posts)) d.posts = [];
  return d;
}

function save(d) {
  // Copia antes de tocar nada, por si hay que volver atrás.
  const dir = path.join(path.dirname(file), "copias");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  fs.copyFileSync(file, path.join(dir, `antes-de-claude-${stamp}.json`));
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

const norm = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function findClient(d, name) {
  if (!name) fail("Falta el nombre del cliente.");
  const exact = d.clients.filter((c) => norm(c.name) === norm(name));
  const matches = exact.length ? exact : d.clients.filter((c) => norm(c.name).includes(norm(name)));
  if (matches.length === 1) return matches[0];
  if (!matches.length) fail(`No hay ningún cliente que se llame "${name}". Clientes: ${d.clients.map((c) => c.name).join(", ")}`);
  fail(`"${name}" coincide con varios clientes: ${matches.map((c) => c.name).join(", ")}`);
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

const [cmd, ...args] = process.argv.slice(2);

if (cmd === "clientes") {
  const d = load();
  for (const c of d.clients.filter((c) => !c.archived)) {
    const n = d.posts.filter((p) => p.clientId === c.id).length;
    const plan = (c.contentPlan || []).map((p) => `${p.count} ${p.type}`).join(", ");
    console.log(
      `- ${c.name}${c.instagram ? ` (@${c.instagram})` : ""} · ${n} publicaciones` +
        (plan ? `\n  Plan mensual: ${plan}` : "") +
        (c.notes ? `\n  Notas: ${c.notes.replace(/\n/g, " ")}` : ""),
    );
  }
} else if (cmd === "ver") {
  const d = load();
  const c = findClient(d, args[0]);
  const month = args[1] || "";
  const posts = d.posts.filter((p) => p.clientId === c.id && p.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  if (!posts.length) console.log(`${c.name} no tiene publicaciones${month ? ` en ${month}` : ""}.`);
  const estado = (p) => (p.status === "aprobada" ? " [aprobada]" : p.status === "cambios" ? ` [con cambios: ${p.feedback || "sin detalle"}]` : "");
  for (const p of posts) console.log(`\n## ${p.date} · ${p.title}${estado(p)}\n${p.copy}${p.piece ? `\n\n### Pieza\n${p.piece}` : ""}`);
} else if (cmd === "agregar") {
  if (!args[0]) fail("Falta el archivo .json con el calendario.");
  const input = JSON.parse(fs.readFileSync(args[0], "utf8"));
  const d = load();
  const c = findClient(d, input.cliente);
  const list = input.publicaciones;
  if (!Array.isArray(list) || !list.length) fail('El archivo no tiene "publicaciones".');
  const bad = list.filter((p) => !isDate(p.fecha) || !String(p.titulo || "").trim());
  if (bad.length) fail(`Hay ${bad.length} publicaciones sin fecha válida (YYYY-MM-DD) o sin título.`);

  let added = 0;
  let skipped = 0;
  for (const p of list) {
    const title = String(p.titulo).trim();
    const dup = d.posts.some((x) => x.clientId === c.id && x.date === p.fecha && norm(x.title) === norm(title));
    if (dup) {
      skipped++;
      continue;
    }
    d.posts.push({
      id: crypto.randomUUID(),
      clientId: c.id,
      date: p.fecha,
      title,
      copy: String(p.copy || "").trim(),
      piece: p.pieza ? String(p.pieza).trim() : undefined,
    });
    added++;
  }
  save(d);
  console.log(`Listo: ${added} publicaciones cargadas para ${c.name}${skipped ? ` (${skipped} ya estaban y no se repitieron)` : ""}.`);
} else if (cmd === "completar") {
  // Agrega o cambia la pieza (y, si viene, el copy) de publicaciones que ya existen, por fecha y título.
  if (!args[0]) fail("Falta el archivo .json con las piezas.");
  const input = JSON.parse(fs.readFileSync(args[0], "utf8"));
  const d = load();
  const c = findClient(d, input.cliente);
  const missing = [];
  let done = 0;
  for (const p of input.publicaciones || []) {
    const post = d.posts.find((x) => x.clientId === c.id && x.date === p.fecha && norm(x.title) === norm(p.titulo));
    if (!post) {
      missing.push(`${p.fecha} · ${p.titulo}`);
      continue;
    }
    if (p.pieza) post.piece = String(p.pieza).trim();
    if (p.copy) post.copy = String(p.copy).trim();
    done++;
  }
  if (missing.length) fail(`No encontré estas publicaciones (no se cambió nada):\n${missing.join("\n")}`);
  save(d);
  console.log(`Listo: ${done} publicaciones completadas para ${c.name}.`);
} else if (cmd === "crear-cliente") {
  const [name, notes] = args;
  if (!name) fail("Falta el nombre del cliente.");
  const d = load();
  if (d.clients.some((c) => norm(c.name) === norm(name))) fail(`Ya existe un cliente "${name}".`);
  const colors = ["#8b5cf6", "#ec4899", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#ef4444"];
  d.clients.push({
    id: crypto.randomUUID(),
    name,
    color: colors[d.clients.length % colors.length],
    notes: notes || undefined,
    archived: false,
    createdAt: new Date().toISOString().slice(0, 10),
  });
  save(d);
  console.log(`Cliente "${name}" creado.`);
} else if (cmd === "plan") {
  // plan "Librería Centro" "Placa=8, Reel=6, Efeméride o promo=7"
  const d = load();
  const c = findClient(d, args[0]);
  if (!args[1]) fail('Indicá el plan, por ejemplo: "Placa=8, Reel=6, Efeméride o promo=7".');
  const plan = args[1].split(",").map((x) => {
    const [type, count] = x.split("=").map((s) => s.trim());
    if (!type || !(Number(count) > 0)) fail(`No entiendo "${x.trim()}". Usá Tipo=cantidad.`);
    return { type, count: Number(count) };
  });
  c.contentPlan = plan;
  save(d);
  console.log(`Plan de ${c.name}: ${plan.map((p) => `${p.count} ${p.type}`).join(", ")}.`);
} else if (cmd === "borrar-mes") {
  const d = load();
  const c = findClient(d, args[0]);
  const month = args[1];
  if (!/^\d{4}-\d{2}$/.test(month || "")) fail("Indicá el mes como YYYY-MM.");
  const before = d.posts.length;
  d.posts = d.posts.filter((p) => !(p.clientId === c.id && p.date.startsWith(month)));
  save(d);
  console.log(`Borradas ${before - d.posts.length} publicaciones de ${c.name} en ${month}.`);
} else {
  fail(
    "Comandos: clientes | ver <cliente> [YYYY-MM] | agregar <archivo.json> | completar <archivo.json> | crear-cliente <nombre> [notas] | plan <cliente> <Tipo=n, ...> | borrar-mes <cliente> <YYYY-MM>",
  );
}
