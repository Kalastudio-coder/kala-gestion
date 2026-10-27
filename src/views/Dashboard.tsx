import { AlertCircle, CalendarClock, Plus, Repeat, TrendingUp, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { expensesInMonth, monthlyRecurring, paymentsInMonth, remaining } from "../lib/billing";
import { addDays, formatDateLong, monthKey } from "../lib/dates";
import { formatMoney } from "../lib/format";
import { useStore } from "../lib/store";
import type { Charge } from "../lib/types";
import { ChargeRow } from "../components/ChargeRow";
import { Button, Card, Empty, PageHeader, cx } from "../components/ui";

function Stat({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon: ReactNode; tone: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted">{label}</p>
        <div className={cx("flex h-8 w-8 items-center justify-center rounded-lg", tone)}>{icon}</div>
      </div>
      <p className="mt-3 font-display text-[26px] font-semibold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
    </Card>
  );
}

export function Dashboard({
  onPay,
  onOpenClient,
  onNewClient,
  onGoCharges,
}: {
  onPay: (c: Charge) => void;
  onOpenClient: (id: string) => void;
  onNewClient: () => void;
  onGoCharges: () => void;
}) {
  const { data, charges, now } = useStore();
  const month = monthKey(now);
  const activeClients = data.clients.filter((c) => !c.archived);

  const collected = paymentsInMonth(data.payments, month).reduce((s, p) => s + p.amount, 0);
  const costs = expensesInMonth(data.expenses, month).reduce((s, x) => s + x.expense.amount, 0);
  const thisMonth = charges.filter((c) => monthKey(c.dueDate) === month);
  const toCollect = thisMonth.filter((c) => c.status !== "pagado" && c.dueDate >= now).reduce((s, c) => s + remaining(c), 0);
  const overdue = charges.filter((c) => c.status === "vencido");
  const overdueTotal = overdue.reduce((s, c) => s + remaining(c), 0);
  const upcoming = charges.filter((c) => c.status !== "pagado" && c.status !== "vencido" && c.dueDate <= addDays(now, 14));
  const mrr = monthlyRecurring(data.services, now);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <div>
      <PageHeader
        title={data.settings.ownerName ? `${greeting}, ${data.settings.ownerName}` : greeting}
        subtitle={formatDateLong(now)}
        actions={
          <Button variant="primary" onClick={onNewClient}>
            <Plus size={16} /> Nuevo cliente
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <Stat
          label="Cobrado este mes"
          value={formatMoney(collected)}
          sub={costs ? `Ganancia: ${formatMoney(collected - costs)} (gastos ${formatMoney(costs)})` : undefined}
          icon={<Wallet size={16} />}
          tone="bg-ok/10 text-ok"
        />
        <Stat
          label="Falta cobrar este mes"
          value={formatMoney(toCollect)}
          sub={`${thisMonth.filter((c) => c.status === "pendiente" || c.status === "parcial").length} vencimientos`}
          icon={<CalendarClock size={16} />}
          tone="bg-accent/10 text-accent-2"
        />
        <Stat
          label="Atrasado"
          value={formatMoney(overdueTotal)}
          sub={overdue.length ? `${overdue.length} sin pagar` : "Todo al día"}
          icon={<AlertCircle size={16} />}
          tone="bg-bad/10 text-bad"
        />
        <Stat
          label="Ingreso fijo mensual"
          value={formatMoney(mrr)}
          sub={`${activeClients.length} clientes activos`}
          icon={<Repeat size={16} />}
          tone="bg-warn/10 text-warn"
        />
      </div>

      {data.clients.length === 0 ? (
        <Card className="mt-6">
          <Empty
            icon={<Users size={22} />}
            title="Empezá cargando tu primer cliente"
            text="Agregá el cliente, después sus servicios con el monto y cada cuánto te paga. Los vencimientos se arman solos."
            action={
              <Button variant="primary" onClick={onNewClient}>
                <Plus size={16} /> Nuevo cliente
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          {overdue.length > 0 && (
            <Section title="Atrasados" count={overdue.length} tone="text-bad">
              {overdue.map((c) => (
                <ChargeRow key={c.key} charge={c} onPay={onPay} onOpenClient={onOpenClient} />
              ))}
            </Section>
          )}
          <Section title="Próximos 14 días" count={upcoming.length} action={<Button size="sm" variant="ghost" onClick={onGoCharges}>Ver todos</Button>}>
            {upcoming.length ? (
              upcoming.map((c) => <ChargeRow key={c.key} charge={c} onPay={onPay} onOpenClient={onOpenClient} />)
            ) : (
              <Empty icon={<TrendingUp size={22} />} title="Nada por cobrar en las próximas dos semanas" />
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

export function Section({
  title,
  count,
  tone,
  action,
  children,
}: {
  title: string;
  count?: number;
  tone?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h2 className={cx("font-display font-semibold", tone)}>
          {title}
          {count !== undefined && <span className="ml-2 text-sm font-normal text-faint">{count}</span>}
        </h2>
        {action}
      </div>
      <div className="divide-y divide-line">{children}</div>
    </Card>
  );
}
