import { Plus, Search, TrendingUp, Users } from "lucide-react";
import { IncreaseModal } from "../components/money";
import { useState } from "react";
import { isServiceActive, monthlyRecurring, remaining } from "../lib/billing";
import { formatMoney } from "../lib/format";
import { useStore } from "../lib/store";
import { Avatar, Button, Card, Empty, Input, PageHeader, cx } from "../components/ui";

export function Clients({ onOpenClient, onNewClient }: { onOpenClient: (id: string) => void; onNewClient: () => void }) {
  const { data, charges, now } = useStore();
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [increasing, setIncreasing] = useState(false);

  const list = data.clients
    .filter((c) => c.archived === showArchived)
    .filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const archivedCount = data.clients.filter((c) => c.archived).length;

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${data.clients.filter((c) => !c.archived).length} activos`}
        actions={
          <>
            {data.services.length > 0 && (
              <Button onClick={() => setIncreasing(true)}>
                <TrendingUp size={16} /> Aumentar precios
              </Button>
            )}
            <Button variant="primary" onClick={onNewClient}>
              <Plus size={16} /> Nuevo cliente
            </Button>
          </>
        }
      />
      {increasing && (
        <IncreaseModal
          services={data.services.filter((s) => !data.clients.find((c) => c.id === s.clientId)?.archived)}
          onClose={() => setIncreasing(false)}
        />
      )}

      <div className="mb-5 flex items-center gap-3">
        <div className="relative w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input className="pl-9" placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {archivedCount > 0 && (
          <div className="flex rounded-xl border border-line p-1 text-[13px]">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                onClick={() => setShowArchived(v)}
                className={cx("rounded-lg px-3 py-1.5", showArchived === v ? "bg-panel-2 text-ink" : "text-muted")}
              >
                {v ? `Archivados (${archivedCount})` : "Activos"}
              </button>
            ))}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <Card>
          <Empty
            icon={<Users size={22} />}
            title={q ? "No hay clientes con ese nombre" : "Todavía no cargaste clientes"}
            action={
              !q && (
                <Button variant="primary" onClick={onNewClient}>
                  <Plus size={16} /> Nuevo cliente
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {list.map((c) => {
            const services = data.services.filter((s) => s.clientId === c.id);
            const active = services.filter((s) => isServiceActive(s, now));
            const owed = charges.filter((x) => x.clientId === c.id && x.status === "vencido").reduce((s, x) => s + remaining(x), 0);
            return (
              <button
                key={c.id}
                onClick={() => onOpenClient(c.id)}
                className="group cursor-pointer rounded-2xl border border-line bg-panel p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} color={c.color} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold">{c.name}</p>
                    <p className="truncate text-[13px] text-muted">{c.contactName || (c.instagram ? `@${c.instagram}` : "Sin contacto")}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-faint">Por mes</p>
                    <p className="font-semibold tabular-nums">{formatMoney(monthlyRecurring(services, now))}</p>
                  </div>
                  <div className="text-right">
                    {owed > 0 ? (
                      <span className="rounded-full bg-bad/10 px-2.5 py-1 text-xs font-medium text-bad">Debe {formatMoney(owed)}</span>
                    ) : (
                      <span className="text-xs text-faint">
                        {active.length} {active.length === 1 ? "servicio" : "servicios"}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
