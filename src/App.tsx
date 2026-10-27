import { Download, FileText, LayoutDashboard, Receipt, Settings as SettingsIcon, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { dailyNotices } from "./lib/notices";
import { useStore } from "./lib/store";
import type { UpdateStatus } from "./lib/store";
import type { Charge } from "./lib/types";
import { ClientModal, PaymentModal } from "./components/forms";
import { ReceiptModal } from "./components/ReceiptModal";
import { Button, cx } from "./components/ui";
import { Charges } from "./views/Charges";
import { ClientDetail } from "./views/ClientDetail";
import type { ClientTab } from "./views/ClientDetail";
import { Clients } from "./views/Clients";
import { Dashboard } from "./views/Dashboard";
import { Settings } from "./views/Settings";

type View =
  | { name: "inicio" }
  | { name: "clientes" }
  | { name: "cliente"; id: string; tab?: ClientTab }
  | { name: "cobros" }
  | { name: "ajustes" };

const NOTICE_KEY = "kala-avisos-dia";

export default function App() {
  const { data, charges, now } = useStore();
  const [view, setView] = useState<View>({ name: "inicio" });
  const [paying, setPaying] = useState<Charge | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [justPaid, setJustPaid] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateStatus>({ state: "idle" });

  const openClient = (id: string, tab?: ClientTab) => setView({ name: "cliente", id, tab });
  const overdue = charges.filter((c) => c.status === "vencido").length;
  const section = view.name === "cliente" ? "clientes" : view.name;

  // Avisos de Windows: una vez por día, desde las 8 de la mañana.
  useEffect(() => {
    if (!window.kala || !data.settings.notifications || new Date().getHours() < 8) return;
    let last: string | null = null;
    try {
      last = localStorage.getItem(NOTICE_KEY);
    } catch {
      // sin almacenamiento: se avisa igual
    }
    if (last === now) return;
    const notices = dailyNotices(data, charges, now);
    if (notices.length) window.kala.notify(notices);
    try {
      localStorage.setItem(NOTICE_KEY, now);
    } catch {
      // nada
    }
  }, [now, data, charges]);

  useEffect(() => window.kala?.onOpenClient((id) => openClient(id)), []);
  useEffect(() => {
    window.kala?.setOpenAtLogin(data.settings.openAtLogin);
  }, [data.settings.openAtLogin]);
  useEffect(() => {
    window.kala?.getUpdateStatus().then(setUpdate);
    return window.kala?.onUpdateStatus(setUpdate);
  }, []);

  // El aviso de "cobro registrado" se va solo.
  useEffect(() => {
    if (!justPaid) return;
    const t = setTimeout(() => setJustPaid(null), 10_000);
    return () => clearTimeout(t);
  }, [justPaid]);

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-panel/60 px-3 py-5">
        <div className="mb-8 flex items-center gap-2.5 px-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-fuchsia-500 font-display text-lg font-bold text-white">
            K
          </div>
          <div>
            <p className="font-display font-semibold leading-tight">Kala Gestión</p>
            <p className="text-xs text-faint">Kala Studio</p>
          </div>
        </div>
        <nav className="space-y-1">
          <NavItem icon={<LayoutDashboard size={18} />} label="Inicio" active={section === "inicio"} onClick={() => setView({ name: "inicio" })} />
          <NavItem icon={<Users size={18} />} label="Clientes" active={section === "clientes"} onClick={() => setView({ name: "clientes" })} />
          <NavItem
            icon={<Receipt size={18} />}
            label="Cobros"
            badge={overdue || undefined}
            active={section === "cobros"}
            onClick={() => setView({ name: "cobros" })}
          />
        </nav>
        <div className="mt-auto space-y-3">
          {update.state === "ready" && (
            <div className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-[13px]">
              <p className="font-medium">Versión {update.version} lista</p>
              <p className="mt-0.5 text-muted">Se instala al reiniciar la app.</p>
              <Button size="sm" variant="primary" className="mt-2 w-full" onClick={() => window.kala?.installUpdate()}>
                <Download size={14} /> Reiniciar y actualizar
              </Button>
            </div>
          )}
          <NavItem icon={<SettingsIcon size={18} />} label="Ajustes" active={section === "ajustes"} onClick={() => setView({ name: "ajustes" })} />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-10 py-9">
          {view.name === "inicio" && (
            <Dashboard onPay={setPaying} onOpenClient={openClient} onNewClient={() => setNewClient(true)} onGoCharges={() => setView({ name: "cobros" })} />
          )}
          {view.name === "clientes" && <Clients onOpenClient={openClient} onNewClient={() => setNewClient(true)} />}
          {view.name === "cliente" && (
            <ClientDetail
              key={view.id + (view.tab ?? "")}
              clientId={view.id}
              initialTab={view.tab}
              onBack={() => setView({ name: "clientes" })}
              onPay={setPaying}
            />
          )}
          {view.name === "cobros" && <Charges onPay={setPaying} onOpenClient={openClient} />}
          {view.name === "ajustes" && <Settings />}
        </div>
      </main>

      {justPaid && (
        <div className="animate-pop fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-2xl border border-line bg-panel-2 py-2.5 pl-4 pr-2 shadow-2xl">
          <span className="text-sm">Cobro registrado ✓</span>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setReceipt(justPaid);
              setJustPaid(null);
            }}
          >
            <FileText size={14} /> Mandar recibo
          </Button>
          <button onClick={() => setJustPaid(null)} className="rounded-lg p-1 text-muted hover:text-ink">
            <X size={15} />
          </button>
        </div>
      )}

      {paying && <PaymentModal charge={paying} onClose={() => setPaying(null)} onDone={setJustPaid} />}
      {receipt && <ReceiptModal paymentId={receipt} onClose={() => setReceipt(null)} />}
      {newClient && <ClientModal onClose={() => setNewClient(false)} onSaved={(id) => openClient(id)} />}
    </div>
  );
}

function NavItem({ icon, label, active, badge, onClick }: { icon: ReactNode; label: string; active: boolean; badge?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
        active ? "bg-accent/15 font-medium text-ink" : "text-muted hover:bg-panel-2 hover:text-ink",
      )}
    >
      <span className={active ? "text-accent-2" : undefined}>{icon}</span>
      {label}
      {badge && <span className="ml-auto rounded-full bg-bad px-2 py-0.5 text-[11px] font-semibold text-white">{badge}</span>}
    </button>
  );
}
