import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { useState } from "react";
import { paymentsInMonth, remaining } from "../lib/billing";
import { formatMonth, monthKey, shiftMonth } from "../lib/dates";
import { formatMoney } from "../lib/format";
import { useStore } from "../lib/store";
import type { Charge } from "../lib/types";
import { ChargeRow } from "../components/ChargeRow";
import { Button, Card, Empty, PageHeader, cx } from "../components/ui";
import { Section } from "./Dashboard";

type Filter = "todos" | "pendientes" | "pagados";

export function Charges({ onPay, onOpenClient }: { onPay: (c: Charge) => void; onOpenClient: (id: string) => void }) {
  const { data, charges, now } = useStore();
  const [month, setMonth] = useState(monthKey(now));
  const [filter, setFilter] = useState<Filter>("todos");
  const isCurrent = month === monthKey(now);

  const inMonth = charges
    .filter((c) => monthKey(c.dueDate) === month)
    .filter((c) => (filter === "pendientes" ? c.status !== "pagado" : filter === "pagados" ? c.status === "pagado" : true));
  // En el mes actual también mostramos lo atrasado de meses anteriores.
  const olderOverdue = isCurrent && filter !== "pagados" ? charges.filter((c) => c.status === "vencido" && monthKey(c.dueDate) < month) : [];

  const monthCharges = charges.filter((c) => monthKey(c.dueDate) === month);
  const expected = monthCharges.reduce((s, c) => s + c.amount, 0);
  const pending = monthCharges.filter((c) => c.status !== "pagado").reduce((s, c) => s + remaining(c), 0);
  const received = paymentsInMonth(data.payments, month).reduce((s, p) => s + p.amount, 0);
  const progress = expected ? Math.min(100, ((expected - pending) / expected) * 100) : 0;

  return (
    <div>
      <PageHeader title="Cobros" subtitle="Vencimientos de todos tus clientes, mes por mes" />

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMonth(shiftMonth(month, -1))}>
              <ChevronLeft size={16} />
            </Button>
            <p className="w-44 text-center font-display text-lg font-semibold">{formatMonth(month)}</p>
            <Button size="sm" variant="ghost" onClick={() => setMonth(shiftMonth(month, 1))}>
              <ChevronRight size={16} />
            </Button>
            {!isCurrent && (
              <Button size="sm" variant="ghost" onClick={() => setMonth(monthKey(now))}>
                Hoy
              </Button>
            )}
          </div>
          <div className="flex gap-8 text-right">
            <Total label="A cobrar en el mes" value={formatMoney(expected)} />
            <Total label="Falta" value={formatMoney(pending)} tone={pending ? "text-warn" : undefined} />
            <Total label="Entró en el mes" value={formatMoney(received)} tone="text-ok" />
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-ok transition-all" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <div className="mb-4 flex w-fit rounded-xl border border-line p-1 text-[13px]">
        {(["todos", "pendientes", "pagados"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cx("cursor-pointer rounded-lg px-3 py-1.5 capitalize", filter === f ? "bg-panel-2 text-ink" : "text-muted hover:text-ink")}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {olderOverdue.length > 0 && (
          <Section title="Atrasados de meses anteriores" count={olderOverdue.length} tone="text-bad">
            {olderOverdue.map((c) => (
              <ChargeRow key={c.key} charge={c} onPay={onPay} onOpenClient={onOpenClient} />
            ))}
          </Section>
        )}
        <Section title={formatMonth(month)} count={inMonth.length}>
          {inMonth.length ? (
            inMonth.map((c) => <ChargeRow key={c.key} charge={c} onPay={onPay} onOpenClient={onOpenClient} />)
          ) : (
            <Empty icon={<Receipt size={22} />} title="No hay vencimientos" text="Los vencimientos se arman con los servicios de cada cliente." />
          )}
        </Section>
      </div>
    </div>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-faint">{label}</p>
      <p className={cx("font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}
