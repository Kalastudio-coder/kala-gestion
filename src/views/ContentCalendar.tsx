import { AlertTriangle, Check, CheckCheck, ChevronLeft, ChevronRight, Clock, Copy, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { SendCalendarModal } from "../components/SendCalendarModal";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { addDays, formatDateLong, formatMonth, monthEnd, monthKey, monthStart, parts, shiftMonth } from "../lib/dates";
import { uid } from "../lib/format";
import { planProgress } from "../lib/plan";
import { useStore } from "../lib/store";
import type { Client, ContentPost, PostStatus } from "../lib/types";
import { Button, Card, Field, Input, Modal, Textarea, cx } from "../components/ui";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Días de la grilla del mes: de lunes a domingo, completando con días de los meses vecinos. */
function gridDays(key: string): string[] {
  const first = monthStart(key);
  const [y, m, d] = parts(first);
  const weekday = (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7; // lunes = 0
  const start = addDays(first, -weekday);
  const last = monthEnd(key);
  const days: string[] = [];
  for (let day = start; days.length % 7 !== 0 || day <= last; day = addDays(day, 1)) days.push(day);
  return days;
}

export function ContentCalendar({ client }: { client: Client }) {
  const { data, now, update } = useStore();
  const [month, setMonth] = useState(monthKey(now));
  const [editing, setEditing] = useState<ContentPost | null>(null);
  const [sending, setSending] = useState(false);

  const posts = data.posts.filter((p) => p.clientId === client.id);
  const inMonth = posts.filter((p) => monthKey(p.date) === month);
  const byDay = new Map<string, ContentPost[]>();
  for (const p of posts) byDay.set(p.date, [...(byDay.get(p.date) ?? []), p]);

  const plan = planProgress(client.contentPlan ?? [], inMonth);
  const approved = inMonth.filter((p) => p.status === "aprobada").length;
  const changes = inMonth.filter((p) => p.status === "cambios").length;

  const newPost = (date: string) => setEditing({ id: "", clientId: client.id, date, title: "", copy: "" });

  const approveAll = () => {
    const pending = inMonth.filter((p) => p.status !== "aprobada" && p.status !== "cambios").length;
    if (!pending) return;
    if (!confirm(`¿Marcar como aprobadas las ${pending} publicaciones pendientes de ${formatMonth(month).toLowerCase()}? Las que tienen cambios quedan igual.`)) return;
    update((d) => ({
      ...d,
      posts: d.posts.map((p) =>
        p.clientId === client.id && monthKey(p.date) === month && !p.status ? { ...p, status: "aprobada" as const } : p,
      ),
    }));
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMonth(shiftMonth(month, -1))}>
              <ChevronLeft size={16} />
            </Button>
            <p className="w-40 text-center font-display font-semibold">{formatMonth(month)}</p>
            <Button size="sm" variant="ghost" onClick={() => setMonth(shiftMonth(month, 1))}>
              <ChevronRight size={16} />
            </Button>
            {month !== monthKey(now) && (
              <Button size="sm" variant="ghost" onClick={() => setMonth(monthKey(now))}>
                Hoy
              </Button>
            )}
            <span className="ml-2 text-sm text-faint">
              {inMonth.length} {inMonth.length === 1 ? "publicación" : "publicaciones"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setSending(true)} disabled={inMonth.length === 0}>
              <Send size={14} /> Exportar y enviar
            </Button>
            <Button size="sm" variant="primary" onClick={() => newPost(month === monthKey(now) ? now : monthStart(month))}>
              <Plus size={14} /> Nueva publicación
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-line text-center text-xs text-faint">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridDays(month).map((day, i) => {
            const outside = monthKey(day) !== month;
            const dayPosts = byDay.get(day) ?? [];
            return (
              <div
                key={day}
                onClick={() => newPost(day)}
                className={cx(
                  "group min-h-28 cursor-pointer border-line p-1.5 transition-colors hover:bg-panel-2/50",
                  i % 7 !== 6 && "border-r",
                  i >= 7 && "border-t",
                  outside && "bg-bg/40",
                )}
              >
                <div className="mb-1 flex items-center justify-between px-1">
                  <span
                    className={cx(
                      "flex h-6 min-w-6 items-center justify-center rounded-full text-xs",
                      day === now ? "bg-accent font-semibold text-white" : outside ? "text-faint/60" : "text-muted",
                    )}
                  >
                    {parts(day)[2]}
                  </span>
                  <Plus size={13} className="text-faint opacity-0 group-hover:opacity-100" />
                </div>
                <div className="space-y-1">
                  {dayPosts.map((p) => (
                    <button
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(p);
                      }}
                      className={cx(
                        "flex w-full cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-left text-xs font-medium text-white transition-opacity hover:opacity-80",
                        p.status === "cambios" && "ring-2 ring-warn",
                      )}
                      style={{ background: `${client.color}cc` }}
                      title={`${p.title}${p.status === "aprobada" ? " · aprobada" : p.status === "cambios" ? " · con cambios" : ""}`}
                    >
                      {p.status === "aprobada" && <Check size={12} className="shrink-0" />}
                      {p.status === "cambios" && <AlertTriangle size={12} className="shrink-0" />}
                      <span className="truncate">{p.title || "Sin título"}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {(plan.items.length > 0 || inMonth.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-line bg-panel px-5 py-4">
          {plan.items.length > 0 ? (
            <>
              {plan.items.map((it) => (
                <div key={it.type} className="min-w-36">
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-muted">{it.type}</span>
                    <span className={cx("font-semibold tabular-nums", it.done >= it.count ? "text-ok" : "text-ink")}>
                      {it.done}/{it.count}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
                    <div
                      className={cx("h-full rounded-full", it.done >= it.count ? "bg-ok" : "bg-accent")}
                      style={{ width: `${Math.min(100, (it.done / it.count) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {plan.extra > 0 && <span className="text-xs text-warn">{plan.extra} fuera del plan</span>}
            </>
          ) : (
            <span className="text-[13px] text-faint">Cargá el plan de contenido del cliente con "Editar" para ver el avance del mes.</span>
          )}
          {inMonth.length > 0 && (
            <div className="ml-auto flex items-center gap-3 text-[13px]">
              <span className="text-ok">{approved} aprobadas</span>
              {changes > 0 && <span className="text-warn">{changes} con cambios</span>}
              {inMonth.some((p) => !p.status) && (
                <Button size="sm" variant="ghost" onClick={approveAll}>
                  <CheckCheck size={14} /> Aprobar el resto
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {inMonth.length === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line px-5 py-4 text-sm text-muted">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-accent-2" />
          <p>
            Tocá un día para cargar una publicación, o pedíselo a Claude en el chat de Claude Code:{" "}
            <span className="text-ink">"armá el calendario de {formatMonth(month).toLowerCase()} de {client.name}"</span>. Aparece acá
            solo, aunque tengas la app abierta.
          </p>
        </div>
      )}

      {editing && <PostModal post={editing} onClose={() => setEditing(null)} />}
      {sending && <SendCalendarModal client={client} month={month} onClose={() => setSending(false)} />}
    </div>
  );
}

const STATUSES: { value: PostStatus; label: string; icon: ReactNode; active: string }[] = [
  { value: "pendiente", label: "Pendiente", icon: <Clock size={14} />, active: "border-accent bg-accent/15 text-ink" },
  { value: "aprobada", label: "Aprobada", icon: <Check size={14} />, active: "border-ok bg-ok/15 text-ok" },
  { value: "cambios", label: "Con cambios", icon: <AlertTriangle size={14} />, active: "border-warn bg-warn/15 text-warn" },
];

function PostModal({ post, onClose }: { post: ContentPost; onClose: () => void }) {
  const { update } = useStore();
  const isNew = !post.id;
  const [f, setF] = useState(post);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"copy" | "pieza">("copy");
  const set = (patch: Partial<ContentPost>) => setF((x) => ({ ...x, ...patch }));
  const valid = f.title.trim() && f.date;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const clean = {
      ...f,
      id: f.id || uid(),
      title: f.title.trim(),
      copy: f.copy.trim(),
      piece: f.piece?.trim() || undefined,
      feedback: f.status === "cambios" ? f.feedback?.trim() || undefined : undefined,
    };
    update((d) => ({
      ...d,
      posts: isNew ? [...d.posts, clean] : d.posts.map((p) => (p.id === clean.id ? clean : p)),
    }));
    onClose();
  };

  const remove = () => {
    if (!confirm(`¿Borrar "${post.title}"?`)) return;
    update((d) => ({ ...d, posts: d.posts.filter((p) => p.id !== post.id) }));
    onClose();
  };

  const current = tab === "copy" ? f.copy : (f.piece ?? "");
  const copy = async () => {
    await navigator.clipboard.writeText(current);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal title={isNew ? "Nueva publicación" : formatDateLong(post.date)} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[1fr_180px] gap-3">
          <Field label="Título">
            <Input autoFocus={isNew} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ej: Reel — cómo hacemos los sorrentinos" />
          </Field>
          <Field label="Fecha">
            <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
        </div>
        <div>
          <div className="mb-1.5 flex w-fit rounded-xl border border-line p-0.5 text-[13px]">
            {(
              [
                ["copy", "Copy"],
                ["pieza", "Contenido de la pieza"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                onClick={() => setTab(value)}
                className={cx(
                  "flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5",
                  tab === value ? "bg-panel-2 font-medium text-ink" : "text-muted hover:text-ink",
                )}
              >
                {label}
                {value === "pieza" && f.piece?.trim() && <span className="h-1.5 w-1.5 rounded-full bg-ok" />}
              </button>
            ))}
          </div>
          {tab === "copy" ? (
            <Textarea
              value={f.copy}
              onChange={(e) => set({ copy: e.target.value })}
              className="min-h-56 leading-relaxed"
              placeholder="El texto del posteo, con emojis y hashtags."
            />
          ) : (
            <Textarea
              value={f.piece ?? ""}
              onChange={(e) => set({ piece: e.target.value })}
              className="min-h-56 leading-relaxed"
              placeholder="Texto que va en la placa, guion del reel toma por toma y notas de diseño."
            />
          )}
        </div>
        <Field label="Aprobación del cliente">
          <div className="grid grid-cols-3 gap-2">
            {STATUSES.map((s) => (
              <button
                type="button"
                key={s.value}
                onClick={() => set({ status: s.value === "pendiente" ? undefined : s.value })}
                className={cx(
                  "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border text-[13px] transition-colors",
                  (f.status ?? "pendiente") === s.value ? s.active : "border-line text-muted hover:text-ink",
                )}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </Field>
        {f.status === "cambios" && (
          <Field label="¿Qué pidió cambiar?">
            <Textarea value={f.feedback ?? ""} onChange={(e) => set({ feedback: e.target.value })} placeholder="Ej: cambiar la foto y sacar el precio" />
          </Field>
        )}
        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex gap-1">
            {current.trim() && (
              <Button type="button" variant="soft" onClick={copy}>
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiado" : tab === "copy" ? "Copiar copy" : "Copiar pieza"}
              </Button>
            )}
            {!isNew && (
              <Button type="button" variant="danger" onClick={remove}>
                <Trash2 size={15} />
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!valid}>
              {isNew ? "Agregar" : "Guardar"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
