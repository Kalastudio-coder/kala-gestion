import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  AtSign,
  Briefcase,
  CalendarDays,
  FileText,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  TrendingUp,
  Undo2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { amountAt, expensesInMonth, frequencyInfo, isServiceActive, monthlyRecurring, paymentsInMonth, remaining } from "../lib/billing";
import { formatDate, formatMonth, monthKey, today } from "../lib/dates";
import { formatMoney } from "../lib/format";
import { waLink } from "../lib/phone";
import { receiptCode } from "../lib/receiptPdf";
import { openExternal, useStore } from "../lib/store";
import type { Charge, Expense, Service } from "../lib/types";
import { ChargeRow } from "../components/ChargeRow";
import { ClientModal, METHODS, ServiceModal } from "../components/forms";
import { ExpenseModal, IncreaseModal } from "../components/money";
import { ReceiptModal } from "../components/ReceiptModal";
import { Avatar, Button, Card, Empty, cx } from "../components/ui";
import { ContentCalendar } from "./ContentCalendar";
import { Section } from "./Dashboard";

export type ClientTab = "resumen" | "calendario";

export function ClientDetail({
  clientId,
  initialTab = "resumen",
  onBack,
  onPay,
}: {
  clientId: string;
  initialTab?: ClientTab;
  onBack: () => void;
  onPay: (c: Charge) => void;
}) {
  const { data, charges, now, update } = useStore();
  const [editing, setEditing] = useState(false);
  const [serviceModal, setServiceModal] = useState<Service | "new" | null>(null);
  const [increase, setIncrease] = useState<Service[] | null>(null);
  const [expenseModal, setExpenseModal] = useState<Expense | "new" | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [tab, setTab] = useState<ClientTab>(initialTab);
  const client = data.clients.find((c) => c.id === clientId);
  if (!client) return null;

  const month = monthKey(now);
  const services = data.services.filter((s) => s.clientId === clientId);
  const mine = charges.filter((c) => c.clientId === clientId);
  const open = mine.filter((c) => c.status !== "pagado");
  const owed = mine.filter((c) => c.status === "vencido").reduce((s, c) => s + remaining(c), 0);
  const payments = data.payments.filter((p) => p.clientId === clientId).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const expenses = data.expenses.filter((e) => e.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date));
  const monthIncome = paymentsInMonth(payments, month).reduce((s, p) => s + p.amount, 0);
  const monthCosts = expensesInMonth(expenses, month).reduce((s, x) => s + x.expense.amount, 0);
  const profit = monthIncome - monthCosts;
  const wa = waLink(client.phone);

  const endService = (s: Service) => {
    if (!confirm(`¿Terminar "${s.name}"? Deja de generar cobros después de hoy (lo que ya venció queda).`)) return;
    update((d) => ({ ...d, services: d.services.map((x) => (x.id === s.id ? { ...x, endDate: today() } : x)) }));
  };
  const deleteService = (s: Service) => {
    if (!confirm(`¿Borrar "${s.name}" y todos sus pagos registrados? No se puede deshacer.`)) return;
    update((d) => ({
      ...d,
      services: d.services.filter((x) => x.id !== s.id),
      payments: d.payments.filter((p) => p.serviceId !== s.id),
    }));
  };
  const undoPayment = (id: string) => {
    if (!confirm("¿Borrar este pago? El vencimiento vuelve a quedar pendiente.")) return;
    update((d) => ({ ...d, payments: d.payments.filter((p) => p.id !== id) }));
  };
  const toggleArchive = () => {
    if (!client.archived && !confirm(`¿Archivar a ${client.name}? Sus servicios dejan de generar cobros después de hoy.`)) return;
    update((d) => ({
      ...d,
      clients: d.clients.map((c) => (c.id === clientId ? { ...c, archived: !c.archived } : c)),
      services: client.archived
        ? d.services
        : d.services.map((s) => (s.clientId === clientId && !s.endDate ? { ...s, endDate: today() } : s)),
    }));
  };
  const deleteClient = () => {
    if (!confirm(`¿Borrar a ${client.name} con todos sus servicios, pagos, gastos y calendario? No se puede deshacer.`)) return;
    update((d) => ({
      ...d,
      clients: d.clients.filter((c) => c.id !== clientId),
      services: d.services.filter((s) => s.clientId !== clientId),
      payments: d.payments.filter((p) => p.clientId !== clientId),
      posts: d.posts.filter((p) => p.clientId !== clientId),
      expenses: d.expenses.filter((e) => e.clientId !== clientId),
    }));
    onBack();
  };

  return (
    <div>
      <button onClick={onBack} className="mb-5 flex cursor-pointer items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Clientes
      </button>

      <Card className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at 0% 0%, ${client.color}, transparent 55%)` }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={client.name} color={client.color} size={64} />
            <div>
              <h1 className="font-display text-[26px] font-semibold tracking-tight">
                {client.name}
                {client.archived && <span className="ml-3 rounded-full bg-panel-2 px-2.5 py-1 align-middle text-xs font-normal text-muted">Archivado</span>}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2">
                {client.contactName && <span className="text-sm text-muted">{client.contactName}</span>}
                {wa && (
                  <Button size="sm" variant="soft" onClick={() => openExternal(wa)}>
                    <MessageCircle size={14} /> WhatsApp
                  </Button>
                )}
                {client.email && (
                  <Button size="sm" variant="soft" onClick={() => openExternal(`mailto:${client.email}`)}>
                    <Mail size={14} /> {client.email}
                  </Button>
                )}
                {client.instagram && (
                  <Button size="sm" variant="soft" onClick={() => openExternal(`https://instagram.com/${client.instagram}`)}>
                    <AtSign size={14} /> {client.instagram}
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil size={14} /> Editar
            </Button>
            <Button size="sm" variant="ghost" onClick={toggleArchive}>
              {client.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              {client.archived ? "Reactivar" : "Archivar"}
            </Button>
            <Button size="sm" variant="danger" onClick={deleteClient} title="Borrar cliente">
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-4 gap-4 border-t border-line pt-5">
          <Mini label="Ingreso mensual" value={formatMoney(monthlyRecurring(services, now))} />
          <Mini label="Debe" value={formatMoney(owed)} tone={owed > 0 ? "text-bad" : undefined} />
          <Mini
            label={`Ganancia de ${formatMonth(month).split(" ")[0].toLowerCase()}`}
            value={formatMoney(profit)}
            sub={monthCosts ? `${formatMoney(monthIncome)} cobrado − ${formatMoney(monthCosts)} de gastos` : undefined}
            tone={profit < 0 ? "text-bad" : profit > 0 ? "text-ok" : undefined}
          />
          <Mini label="Cobrado en total" value={formatMoney(totalPaid)} />
        </div>
        {client.notes && <p className="relative mt-5 whitespace-pre-wrap rounded-xl bg-bg/70 px-4 py-3 text-sm text-muted">{client.notes}</p>}
      </Card>

      <div className="mt-6 flex w-fit rounded-xl border border-line p-1 text-sm">
        {(
          [
            ["resumen", "Servicios y cobros", <Wallet key="w" size={15} />],
            ["calendario", "Calendario de contenido", <CalendarDays key="c" size={15} />],
          ] as const
        ).map(([value, label, icon]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cx(
              "flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 transition-colors",
              tab === value ? "bg-panel-2 font-medium text-ink" : "text-muted hover:text-ink",
            )}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === "calendario" && (
        <div className="mt-4">
          <ContentCalendar client={client} />
        </div>
      )}

      <div className={cx("mt-4 space-y-6", tab !== "resumen" && "hidden")}>
        <Section
          title="Servicios"
          count={services.length}
          action={
            <div className="flex gap-2">
              {services.some((s) => s.frequency !== "unico" && isServiceActive(s, now)) && (
                <Button size="sm" onClick={() => setIncrease(services)}>
                  <TrendingUp size={14} /> Aumentar precios
                </Button>
              )}
              <Button size="sm" variant="primary" onClick={() => setServiceModal("new")}>
                <Plus size={14} /> Agregar servicio
              </Button>
            </div>
          }
        >
          {services.length === 0 ? (
            <Empty icon={<Briefcase size={22} />} title="Sin servicios" text="Cargá lo que le hacés, cuánto cobrás y cada cuánto te paga." />
          ) : (
            services.map((s) => {
              const active = isServiceActive(s, now);
              const current = amountAt(s, now);
              const upcoming = (s.priceChanges ?? []).filter((c) => c.from > now).sort((a, b) => a.from.localeCompare(b.from))[0];
              const last = (s.priceChanges ?? []).filter((c) => c.from <= now).sort((a, b) => b.from.localeCompare(a.from))[0];
              return (
                <div key={s.id} className={cx("flex items-center gap-4 px-5 py-4", !active && "opacity-50")}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-[13px] text-muted">
                      {frequencyInfo(s.frequency).label} · desde {formatDate(s.startDate)}
                      {s.endDate && ` · hasta ${formatDate(s.endDate)}`}
                      {last && ` · último aumento el ${formatDate(last.from)}`}
                      {s.notes && ` · ${s.notes}`}
                    </p>
                    {upcoming && (
                      <p className="mt-0.5 text-xs text-ok">
                        Pasa a {formatMoney(upcoming.amount)} desde el {formatDate(upcoming.from)}
                      </p>
                    )}
                  </div>
                  <p className="text-right">
                    <span className="font-semibold tabular-nums">{formatMoney(current)}</span>
                    <span className="block text-xs text-faint">{frequencyInfo(s.frequency).short}</span>
                  </p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setServiceModal(s)} title="Editar">
                      <Pencil size={14} />
                    </Button>
                    {active && s.frequency !== "unico" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setIncrease([s])} title="Aumentar precio">
                          <TrendingUp size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => endService(s)}>
                          Terminar
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="danger" onClick={() => deleteService(s)} title="Borrar">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </Section>

        {open.length > 0 && (
          <Section title="Por cobrar" count={open.length}>
            {open.map((c) => (
              <ChargeRow key={c.key} charge={c} onPay={onPay} hideClient />
            ))}
          </Section>
        )}

        <Section
          title="Gastos"
          count={expenses.length}
          action={
            <Button size="sm" onClick={() => setExpenseModal("new")}>
              <Plus size={14} /> Agregar gasto
            </Button>
          }
        >
          {expenses.length === 0 ? (
            <Empty icon={<Receipt size={22} />} title="Sin gastos" text="Cargá la pauta, los freelancers o las herramientas que pagás por este cliente para ver cuánto te deja." />
          ) : (
            expenses.map((e) => {
              const ended = e.monthly && e.endDate && e.endDate < now;
              return (
                <button
                  key={e.id}
                  onClick={() => setExpenseModal(e)}
                  className={cx("flex w-full cursor-pointer items-center gap-4 px-5 py-3 text-left hover:bg-panel-2/60", ended && "opacity-50")}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{e.concept}</p>
                    <p className="text-[13px] text-muted">
                      {e.monthly ? `Todos los meses desde ${formatDate(e.date)}${e.endDate ? ` hasta ${formatDate(e.endDate)}` : ""}` : formatDate(e.date)}
                    </p>
                  </div>
                  <p className="w-32 text-right font-semibold tabular-nums text-bad">
                    −{formatMoney(e.amount)}
                    {e.monthly && <span className="block text-xs font-normal text-faint">por mes</span>}
                  </p>
                </button>
              );
            })
          )}
        </Section>

        {payments.length > 0 && (
          <Section title="Historial de pagos" count={payments.length}>
            {payments.map((p) => {
              const s = data.services.find((x) => x.id === p.serviceId);
              return (
                <div key={p.id} className="group flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{s?.name ?? "Servicio borrado"}</p>
                    <p className="text-[13px] text-muted">
                      Vencimiento {formatDate(p.dueDate)} · {METHODS.find((m) => m.value === p.method)?.label}
                      {p.receiptNumber && ` · Recibo N° ${receiptCode(p.receiptNumber)}`}
                      {p.note && ` · ${p.note}`}
                    </p>
                  </div>
                  <p className="text-sm text-muted">{formatDate(p.paidAt)}</p>
                  <p className="w-28 text-right font-semibold tabular-nums text-ok">{formatMoney(p.amount)}</p>
                  <Button size="sm" variant="soft" title="Recibo" onClick={() => setReceipt(p.id)}>
                    <FileText size={14} /> Recibo
                  </Button>
                  <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" title="Deshacer pago" onClick={() => undoPayment(p.id)}>
                    <Undo2 size={14} />
                  </Button>
                </div>
              );
            })}
          </Section>
        )}
      </div>

      {editing && <ClientModal client={client} onClose={() => setEditing(false)} />}
      {serviceModal && (
        <ServiceModal clientId={clientId} service={serviceModal === "new" ? undefined : serviceModal} onClose={() => setServiceModal(null)} />
      )}
      {increase && <IncreaseModal services={increase} onClose={() => setIncrease(null)} />}
      {expenseModal && (
        <ExpenseModal clientId={clientId} expense={expenseModal === "new" ? undefined : expenseModal} onClose={() => setExpenseModal(null)} />
      )}
      {receipt && <ReceiptModal paymentId={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-faint">{label}</p>
      <p className={cx("mt-0.5 font-display text-xl font-semibold tabular-nums", tone)}>{value}</p>
      {sub && <p className="text-[11px] text-faint">{sub}</p>}
    </div>
  );
}
