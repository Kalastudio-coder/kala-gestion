import { Bell, Cloud, Download, FolderOpen, RefreshCw, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { isValidData, useStore } from "../lib/store";
import type { UpdateStatus } from "../lib/store";
import type { Settings as SettingsData } from "../lib/types";
import { Button, Card, Field, Input, PageHeader, cx } from "../components/ui";

export function Settings() {
  const { data, update, replace } = useStore();
  const [msg, setMsg] = useState<string | null>(null);
  const [cloudFolders, setCloudFolders] = useState<string[]>([]);
  const [lastCloud, setLastCloud] = useState<{ at?: string; error?: string }>({});
  const [version, setVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: "idle" });
  const desktop = !!window.kala;
  const s = data.settings;
  const set = (patch: Partial<SettingsData>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  useEffect(() => {
    if (!window.kala) return;
    window.kala.cloudFolders().then(setCloudFolders);
    window.kala.lastCloudBackup().then(setLastCloud);
    // Al elegir carpeta, la primera copia se hace con el guardado siguiente: la volvemos a consultar.
    const t = setTimeout(() => window.kala?.lastCloudBackup().then(setLastCloud), 1500);
    window.kala.version().then(setVersion);
    window.kala.getUpdateStatus().then(setUpdateStatus);
    const off = window.kala.onUpdateStatus(setUpdateStatus);
    return () => {
      clearTimeout(t);
      off();
    };
  }, [s.cloudBackupDir]);

  const exportData = async () => {
    if (window.kala) {
      if (await window.kala.exportData(data)) setMsg("Copia guardada.");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kala-gestion-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const importData = async () => {
    if (!window.kala) return;
    try {
      const d = await window.kala.importData();
      if (!d) return;
      if (!isValidData(d)) {
        setMsg("Ese archivo no es una copia de Kala Gestión.");
        return;
      }
      if (!confirm(`Se van a reemplazar tus datos por los de la copia (${d.clients.length} clientes). ¿Seguir?`)) return;
      replace(d);
      setMsg("Copia restaurada.");
    } catch {
      setMsg("No se pudo leer el archivo.");
    }
  };

  const chooseCloud = async () => {
    const dir = await window.kala?.chooseFolder("Elegí la carpeta de Drive u OneDrive para las copias");
    if (dir) set({ cloudBackupDir: dir });
  };

  const updateText = (() => {
    switch (updateStatus.state) {
      case "checking":
        return "Buscando versiones nuevas…";
      case "none":
        return "Tenés la última versión.";
      case "available":
        return `Bajando la versión ${updateStatus.version ?? "nueva"}…`;
      case "downloading":
        return `Bajando actualización… ${updateStatus.percent ?? 0}%`;
      case "ready":
        return `La versión ${updateStatus.version} está lista para instalar.`;
      case "error":
        return `No se pudo buscar actualizaciones: ${updateStatus.message}`;
      default:
        return "La app busca versiones nuevas sola al abrirse.";
    }
  })();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Ajustes" />

      <Card className="p-6">
        <h2 className="mb-4 font-display font-semibold">General</h2>
        <Field label="Tu nombre" hint="Para el saludo de la pantalla de inicio.">
          <Input value={s.ownerName} onChange={(e) => set({ ownerName: e.target.value })} />
        </Field>
      </Card>

      <Card className="p-6">
        <h2 className="font-display font-semibold">Datos de los recibos</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Lo que aparece arriba de cada recibo que mandás.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre">
            <Input value={s.businessName} onChange={(e) => set({ businessName: e.target.value })} />
          </Field>
          <Field label="CUIT o DNI (opcional)">
            <Input value={s.businessId ?? ""} onChange={(e) => set({ businessId: e.target.value || undefined })} placeholder="CUIT 20-12345678-9" />
          </Field>
          <Field label="Contacto (opcional)">
            <Input value={s.businessContact ?? ""} onChange={(e) => set({ businessContact: e.target.value || undefined })} placeholder="tusitio.com.ar · 299 15 000-0000" />
          </Field>
          <Field label="Próximo número de recibo">
            <Input type="number" min={1} value={s.nextReceipt} onChange={(e) => set({ nextReceipt: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="flex items-center gap-2 font-display font-semibold">
          <Bell size={17} className="text-accent-2" /> Avisos
        </h2>
        <div className="mt-4 space-y-3">
          <Toggle
            checked={s.notifications}
            onChange={(v) => set({ notifications: v })}
            title="Avisos de Windows"
            text="Una vez por día: lo que vence, lo atrasado, lo que se publica y lo que sale mañana sin aprobar. Al cerrar la ventana, la app queda en la bandeja (junto al reloj) para seguir avisando."
          />
          <Toggle
            checked={s.openAtLogin}
            onChange={(v) => set({ openAtLogin: v })}
            title="Abrir al prender la compu"
            text="Arranca escondida en la bandeja, sólo para mostrar los avisos del día."
          />
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="flex items-center gap-2 font-display font-semibold">
          <Cloud size={17} className="text-accent-2" /> Copias de seguridad
        </h2>
        <p className="mt-1 text-sm text-muted">
          Los datos se guardan solos en esta compu, con una copia por día (las últimas 30). Elegí una carpeta de Google Drive u OneDrive
          para guardar también una copia diaria en la nube: si se rompe la PC, no perdés nada.
        </p>

        {desktop && (
          <div className="mt-4 rounded-xl border border-line p-4">
            {s.cloudBackupDir ? (
              <>
                <p className="text-sm">
                  Copia diaria en <span className="font-medium">{s.cloudBackupDir}\Kala Gestión</span>
                </p>
                <p className={cx("mt-1 text-xs", lastCloud.error ? "text-bad" : "text-faint")}>
                  {lastCloud.error
                    ? lastCloud.error
                    : lastCloud.at
                      ? `Última copia: ${new Date(lastCloud.at).toLocaleString("es-AR")}`
                      : "La copia se hace con el próximo cambio que guardes."}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={chooseCloud}>
                    Cambiar carpeta
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => set({ cloudBackupDir: undefined })}>
                    Dejar de copiar
                  </Button>
                </div>
              </>
            ) : (
              <>
                {cloudFolders.length > 0 ? (
                  <>
                    <p className="text-sm text-muted">Encontré estas carpetas en tu compu:</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cloudFolders.map((f) => (
                        <Button key={f} size="sm" variant="primary" onClick={() => set({ cloudBackupDir: f })}>
                          <Cloud size={14} /> {f}
                        </Button>
                      ))}
                      <Button size="sm" variant="ghost" onClick={chooseCloud}>
                        Elegir otra…
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted">
                      No encontré Google Drive ni OneDrive instalados. Instalá Google Drive para escritorio o elegí cualquier carpeta que se
                      sincronice.
                    </p>
                    <Button size="sm" className="mt-3" onClick={chooseCloud}>
                      Elegir carpeta…
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={exportData}>
            <Download size={16} /> Exportar copia
          </Button>
          {desktop && (
            <>
              <Button onClick={importData}>
                <Upload size={16} /> Restaurar una copia
              </Button>
              <Button variant="ghost" onClick={() => window.kala?.openDataFolder()}>
                <FolderOpen size={16} /> Abrir carpeta de datos
              </Button>
            </>
          )}
        </div>
        {msg && <p className="mt-4 text-sm text-accent-2">{msg}</p>}
      </Card>

      <Card className="p-6">
        <h2 className="flex items-center gap-2 font-display font-semibold">
          <RefreshCw size={17} className="text-accent-2" /> Actualizaciones
        </h2>
        <p className="mt-1 text-sm text-muted">{updateText}</p>
        <div className="mt-4 flex gap-2">
          {updateStatus.state === "ready" ? (
            <Button variant="primary" onClick={() => window.kala?.installUpdate()}>
              <Download size={16} /> Reiniciar y actualizar
            </Button>
          ) : (
            <Button onClick={() => window.kala?.checkForUpdates()} disabled={!desktop || updateStatus.state === "checking"}>
              <RefreshCw size={16} /> Buscar ahora
            </Button>
          )}
        </div>
      </Card>

      <p className="text-xs text-faint">Kala Gestión {version} · Kala Studio</p>
    </div>
  );
}

function Toggle({ checked, onChange, title, text }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-line")}
      >
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-[13px] text-muted">{text}</span>
      </span>
    </label>
  );
}
