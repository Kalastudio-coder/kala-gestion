import { ArrowRight } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { amountAt, frequencyInfo, isServiceActive, withIncrease } from "../lib/billing";
import { addMonths, formatDateLong, monthKey, monthStart, today } from "../lib/dates";
import { formatMoney, uid } from "../lib/format";
import { useStore } from "../lib/store";
import type { Expense, Service } from "../lib/types";
import { Button, Field, Input, Modal, cx } from "./ui";

/** Aumento en % para uno o varios servicios, desde una fecha. Lo ya cobrado no cambia. */
export function IncreaseModal({ services, onClose }: { services: Service[]; onClose: () => void }) {
  const { data, update, now } = useStore();
  const candidates = services.filter((s) => s.frequency !== "unico" && isServiceActive(s, now));
  const [selected, setSelected] = useState<Set<string>>(new Set(candidates.map((s) => s.id)));
  const [percent, setPercent] = useState(10);
  const [from, setFrom] = useState(monthStart(monthKey(addMonths(today(), 1))));
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.name ?? "";
  const multiClient = new Set(candidates.map((s) => s.clientId)).size > 1;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!selected.size || !percent || !from) return;
    update((d) => ({ ...d, services: d.services.map((s) => (selected.has(s.id) ? withIncrease(s, percent, from) : s)) }));
    onClose();
  };

  return (
    <Modal title="Aumentar precios" onClose={onClose} wide>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted">No hay servicios recurrentes activos para aumentar.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Aumento">
              <div className="relative">
                <Input type="number" step={0.5} value={percent || ""} onChange={(e) => setPercent(Number(e.target.value))} className="pr-8" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">%</span>
              </div>
            </Field>
            <Field label="Desde" hint="Rige para los vencimientos desde esta fecha.">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
          </div>
          <div className="max-h-72 divide-y divide-line overflow-auto rounded-xl border border-line">
            {candidates.map((s) => {
              const before = amountAt(s, from);
              const after = amountAt(withIncrease(s, percent || 0, from), from);
              const on = selected.has(s.id);
              return (
                <label key={s.id} className={cx("flex cursor-pointer items-center gap-3 px-4 py-3", !on && "opacity-50")}>
                  <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="h-4 w-4 accent-[#8b5cf6]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{multiClient ? `${clientName(s.clientId)} · ${s.name}` : s.name}</p>
                    <p className="text-xs text-faint">{frequencyInfo(s.frequency).label}</p>
                  </div>
                  <span className="text-sm tabular-nums text-muted">{formatMoney(before)}</span>
                  <ArrowRight size={14} className="text-faint" />
                  <span className="w-28 text-right text-sm font-semibold tabular-nums text-ok">{formatMoney(after)}</span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-faint">
            Los montos se redondean a la centena. Lo cobrado antes del {from ? formatDateLong(from) : "…"} no cambia.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!selected.size || !percent || !from}>
              Aplicar a {selected.size} {selected.size === 1 ? "servicio" : "servicios"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

const EXPENSE_IDEAS = ["Pauta en Meta Ads", "Fotógrafo", "Editor de video", "Diseñador freelance", "Canva Pro", "Banco de imágenes"];

export function ExpenseModal({ clientId, expense, onClose }: { clientId: string; expense?: Expense; onClose: () => void }) {
  const { update } = useStore();
  const [f, setF] = useState<Expense>(expense ?? { id: uid(), clientId, concept: "", amount: 0, date: today() });
  const set = (patch: Partial<Expense>) => setF((x) => ({ ...x, ...patch }));
  const valid = f.concept.trim() && f.amount > 0 && f.date;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const clean = { ...f, concept: f.concept.trim(), endDate: f.monthly ? f.endDate || undefined : undefined };
    update((d) => ({
      ...d,
      expenses: expense ? d.expenses.map((x) => (x.id === expense.id ? clean : x)) : [...d.expenses, clean],
    }));
    onClose();
  };

  const remove = () => {
    if (!expense || !confirm(`¿Borrar "${expense.concept}"?`)) return;
    update((d) => ({ ...d, expenses: d.expenses.filter((x) => x.id !== expense.id) }));
    onClose();
  };

  return (
    <Modal title={expense ? "Editar gasto" : "Nuevo gasto"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Concepto">
          <Input autoFocus value={f.concept} onChange={(e) => set({ concept: e.target.value })} list="expense-ideas" placeholder="Ej: Pauta en Meta Ads" />
          <datalist id="expense-ideas">
            {EXPENSE_IDEAS.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">$</span>
              <Input type="number" min={0} className="pl-7" value={f.amount || ""} onChange={(e) => set({ amount: Number(e.target.value) })} />
            </div>
          </Field>
          <Field label="Fecha">
            <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" checked={!!f.monthly} onChange={(e) => set({ monthly: e.target.checked })} className="h-4 w-4 accent-[#8b5cf6]" />
          Se repite todos los meses
        </label>
        {f.monthly && (
          <Field label="Hasta (opcional)" hint="Dejalo vacío si sigue hasta que lo cambies.">
            <Input type="date" value={f.endDate ?? ""} min={f.date} onChange={(e) => set({ endDate: e.target.value })} />
          </Field>
        )}
        <div className="flex items-center justify-between pt-2">
          <div>
            {expense && (
              <Button type="button" variant="danger" onClick={remove}>
                Borrar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!valid}>
              {expense ? "Guardar" : "Agregar gasto"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
