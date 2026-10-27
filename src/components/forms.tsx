import { useState } from "react";
import type { FormEvent } from "react";
import { FREQUENCIES, dueDates, remaining } from "../lib/billing";
import { addDays, formatDate, formatDateLong, today } from "../lib/dates";
import { CLIENT_COLORS, formatMoney, uid } from "../lib/format";
import { useStore } from "../lib/store";
import type { Charge, Client, Frequency, PaymentMethod, PlanItem, Service } from "../lib/types";
import { Button, Field, Input, Modal, Select, Textarea, cx } from "./ui";

export function ClientModal({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved?: (id: string) => void }) {
  const { data, update } = useStore();
  const [f, setF] = useState<Client>(
    client ?? {
      id: uid(),
      name: "",
      color: CLIENT_COLORS[data.clients.length % CLIENT_COLORS.length],
      archived: false,
      createdAt: today(),
    },
  );
  const set = (patch: Partial<Client>) => setF((x) => ({ ...x, ...patch }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    const plan = (f.contentPlan ?? []).filter((p) => p.type.trim() && p.count > 0).map((p) => ({ ...p, type: p.type.trim() }));
    const clean = { ...f, name: f.name.trim(), contentPlan: plan.length ? plan : undefined };
    update((d) => ({
      ...d,
      clients: client ? d.clients.map((c) => (c.id === client.id ? clean : c)) : [...d.clients, clean],
    }));
    onSaved?.(clean.id);
    onClose();
  };

  return (
    <Modal title={client ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nombre del negocio">
          <Input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej: La Pastelería" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Persona de contacto">
            <Input value={f.contactName ?? ""} onChange={(e) => set({ contactName: e.target.value })} />
          </Field>
          <Field label="WhatsApp">
            <Input value={f.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} placeholder="299 15 555-1234" />
          </Field>
          <Field label="Email">
            <Input type="email" value={f.email ?? ""} onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <Field label="Instagram">
            <Input value={f.instagram ?? ""} onChange={(e) => set({ instagram: e.target.value.replace(/^@/, "") })} placeholder="usuario" />
          </Field>
        </div>
        <Field label="Color">
          <div className="flex gap-2">
            {CLIENT_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => set({ color: c })}
                className={cx("h-7 w-7 rounded-lg transition-transform", f.color === c && "scale-110 ring-2 ring-white/80 ring-offset-2 ring-offset-panel")}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>
        <PlanEditor plan={f.contentPlan ?? []} onChange={(contentPlan) => set({ contentPlan })} />
        <Field label="Notas">
          <Textarea value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="Accesos, preferencias, lo que haga falta recordar…" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!f.name.trim()}>
            {client ? "Guardar" : "Crear cliente"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const PLAN_TYPES = ["Placa", "Reel", "Carrusel", "Historia", "Efeméride", "Promo", "Efeméride o promo"];

/** Plan de contenido mensual: cuántas piezas de cada tipo. */
function PlanEditor({ plan, onChange }: { plan: PlanItem[]; onChange: (p: PlanItem[]) => void }) {
  const total = plan.reduce((s, p) => s + (p.count || 0), 0);
  const setItem = (i: number, patch: Partial<PlanItem>) => onChange(plan.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <Field label={`Plan de contenido mensual${total ? ` · ${total} piezas` : ""}`}>
      <div className="space-y-2">
        {plan.map((p, i) => (
          <div key={i} className="flex gap-2">
            <Input value={p.type} onChange={(e) => setItem(i, { type: e.target.value })} list="plan-types" placeholder="Tipo (ej. Reel)" />
            <Input type="number" min={0} className="w-24" value={p.count || ""} onChange={(e) => setItem(i, { count: Number(e.target.value) })} />
            <Button type="button" variant="ghost" onClick={() => onChange(plan.filter((_, j) => j !== i))}>
              ✕
            </Button>
          </div>
        ))}
        <datalist id="plan-types">
          {PLAN_TYPES.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange([...plan, { type: "", count: 0 }])}>
          + Agregar tipo de pieza
        </Button>
      </div>
    </Field>
  );
}

const SERVICE_IDEAS =["Gestión de redes", "Diseño de piezas", "Campañas de Meta Ads", "Producción de reels", "Branding", "Página web"];

export function ServiceModal({ clientId, service, onClose }: { clientId: string; service?: Service; onClose: () => void }) {
  const { update } = useStore();
  const [f, setF] = useState<Service>(
    service ?? { id: uid(), clientId, name: "", amount: 0, frequency: "mensual", startDate: today() },
  );
  const set = (patch: Partial<Service>) => setF((x) => ({ ...x, ...patch }));
  const valid = f.name.trim() && f.amount > 0 && f.startDate;
  const preview = valid ? dueDates(f, addDays(f.startDate, 400)).slice(0, 4) : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const clean = { ...f, name: f.name.trim(), endDate: f.endDate || undefined };
    update((d) => ({
      ...d,
      services: service ? d.services.map((s) => (s.id === service.id ? clean : s)) : [...d.services, clean],
    }));
    onClose();
  };

  return (
    <Modal title={service ? "Editar servicio" : "Nuevo servicio"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Servicio">
          <Input autoFocus value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej: Gestión de redes" list="service-ideas" />
          <datalist id="service-ideas">
            {SERVICE_IDEAS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto de cada cobro">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">$</span>
              <Input
                type="number"
                min={0}
                step={100}
                className="pl-7"
                value={f.amount || ""}
                onChange={(e) => set({ amount: Number(e.target.value) })}
              />
            </div>
          </Field>
          <Field label="Cada cuánto me paga">
            <Select value={f.frequency} onChange={(e) => set({ frequency: e.target.value as Frequency })}>
              {FREQUENCIES.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={f.frequency === "unico" ? "Fecha de cobro" : "Primer vencimiento"}>
            <Input type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </Field>
          {f.frequency !== "unico" && (
            <Field label="Termina (opcional)">
              <Input type="date" value={f.endDate ?? ""} min={f.startDate} onChange={(e) => set({ endDate: e.target.value })} />
            </Field>
          )}
        </div>
        {preview.length > 0 && (
          <div className="rounded-xl bg-bg px-4 py-3 text-[13px] text-muted">
            Vencimientos: {preview.map(formatDate).join(" · ")}
            {f.frequency !== "unico" && preview.length === 4 && " …"}
          </div>
        )}
        <Field label="Notas">
          <Textarea value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} placeholder="Qué incluye: cantidad de posts, reels, etc." />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!valid}>
            {service ? "Guardar" : "Agregar servicio"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "transferencia", label: "Transferencia" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "efectivo", label: "Efectivo" },
  { value: "otro", label: "Otro" },
];

export function PaymentModal({ charge, onClose, onDone }: { charge: Charge; onClose: () => void; onDone?: (paymentId: string) => void }) {
  const { data, update } = useStore();
  const service = data.services.find((s) => s.id === charge.serviceId);
  const client = data.clients.find((c) => c.id === charge.clientId);
  const [amount, setAmount] = useState(remaining(charge));
  const [paidAt, setPaidAt] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [note, setNote] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    const id = uid();
    update((d) => ({
      ...d,
      payments: [
        ...d.payments,
        {
          id,
          serviceId: charge.serviceId,
          clientId: charge.clientId,
          dueDate: charge.dueDate,
          amount,
          paidAt,
          method,
          note: note.trim() || undefined,
        },
      ],
    }));
    onClose();
    onDone?.(id);
  };

  return (
    <Modal title="Registrar cobro" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-bg px-4 py-3">
          <p className="font-medium">{client?.name}</p>
          <p className="text-[13px] text-muted">
            {service?.name} · vence el {formatDateLong(charge.dueDate)}
          </p>
          {charge.paid > 0 && (
            <p className="mt-1 text-[13px] text-warn">
              Ya pagó {formatMoney(charge.paid)} de {formatMoney(charge.amount)}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto recibido">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">$</span>
              <Input autoFocus type="number" min={0} className="pl-7" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
          </Field>
          <Field label="Fecha de pago">
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
        </div>
        <Field label="Medio de pago">
          <div className="grid grid-cols-4 gap-2">
            {METHODS.map((m) => (
              <button
                type="button"
                key={m.value}
                onClick={() => setMethod(m.value)}
                className={cx(
                  "h-9 rounded-xl border text-[13px] transition-colors",
                  method === m.value ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Nota (opcional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: N° de operación" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={amount <= 0}>
            Registrar {amount > 0 && formatMoney(amount)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
