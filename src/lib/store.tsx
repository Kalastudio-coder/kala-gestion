import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { buildCharges } from "./billing";
import { today } from "./dates";
import type { AppData, Charge } from "./types";

export type UpdateStatus =
  | { state: "idle" | "checking" | "none" }
  | { state: "available" | "downloading"; version?: string; percent?: number }
  | { state: "ready"; version: string }
  | { state: "error"; message: string };

export interface Notice {
  title: string;
  body: string;
  /** Cliente que se abre al tocar el aviso. */
  clientId?: string;
}

declare global {
  interface Window {
    kala?: {
      load: () => Promise<AppData | null>;
      save: (data: AppData) => Promise<boolean>;
      exportData: (data: AppData) => Promise<boolean>;
      importData: () => Promise<AppData | null>;
      openDataFolder: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      /** Genera el PDF en Documentos\Kala Gestión\<folder> y devuelve dónde quedó guardado. */
      createPdf: (args: { html: string; fileName: string; footer: string; folder: "Calendarios" | "Recibos" }) => Promise<string>;
      openFile: (file: string) => Promise<void>;
      showFile: (file: string) => Promise<void>;
      /** Deja el archivo en el portapapeles, listo para pegar en WhatsApp. */
      copyFile: (file: string) => Promise<boolean>;
      /** Avisa cuando otro programa (por ejemplo Claude) cambió el archivo de datos. */
      onExternalChange: (cb: (data: AppData) => void) => () => void;
      notify: (notices: Notice[]) => Promise<void>;
      /** Cuando se toca un aviso de Windows: qué cliente abrir. */
      onOpenClient: (cb: (clientId: string) => void) => () => void;
      setOpenAtLogin: (open: boolean) => Promise<void>;
      chooseFolder: (title: string) => Promise<string | null>;
      /** Carpetas de Google Drive u OneDrive encontradas en la compu. */
      cloudFolders: () => Promise<string[]>;
      lastCloudBackup: () => Promise<{ at?: string; error?: string }>;
      version: () => Promise<string>;
      checkForUpdates: () => Promise<void>;
      installUpdate: () => Promise<void>;
      getUpdateStatus: () => Promise<UpdateStatus>;
      onUpdateStatus: (cb: (s: UpdateStatus) => void) => () => void;
    };
  }
}

const EMPTY: AppData = {
  version: 1,
  clients: [],
  services: [],
  payments: [],
  posts: [],
  expenses: [],
  settings: {
    ownerName: "",
    businessName: "Kala Studio",
    nextReceipt: 1,
    notifications: true,
    openAtLogin: true,
  },
};

// Completa lo que falte en datos de versiones anteriores (por ejemplo, sin calendario o sin gastos).
const normalize = (d: AppData): AppData => ({
  ...EMPTY,
  ...d,
  posts: Array.isArray(d.posts) ? d.posts : [],
  expenses: Array.isArray(d.expenses) ? d.expenses : [],
  settings: { ...EMPTY.settings, ...d.settings },
});

// Fuera de Electron (vista previa en el navegador) guardamos en localStorage.
const LOCAL_KEY = "kala-gestion";
const backend = {
  async load(): Promise<AppData | null> {
    if (window.kala) return window.kala.load();
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? (JSON.parse(raw) as AppData) : null;
    } catch {
      return null;
    }
  },
  async save(data: AppData) {
    if (window.kala) return window.kala.save(data);
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch {
      // sin almacenamiento en el navegador: no hay nada que hacer
    }
  },
};

export function isValidData(d: unknown): d is AppData {
  const x = d as AppData;
  return (
    !!x && x.version === 1 && Array.isArray(x.clients) && Array.isArray(x.services) && Array.isArray(x.payments)
  );
}

interface Store {
  data: AppData;
  charges: Charge[];
  now: string;
  update: (fn: (d: AppData) => AppData) => void;
  replace: (d: AppData) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [now, setNow] = useState(today);
  const loaded = useRef(false);

  useEffect(() => {
    backend.load().then((d) => {
      setData(isValidData(d) ? normalize(d) : EMPTY);
      loaded.current = true;
    });
    return window.kala?.onExternalChange((d) => isValidData(d) && setData(normalize(d)));
  }, []);

  // Guardado automático, agrupando cambios seguidos.
  useEffect(() => {
    if (!data || !loaded.current) return;
    const t = setTimeout(() => backend.save(data), 300);
    return () => clearTimeout(t);
  }, [data]);

  // Si la app queda abierta de un día para otro, recalcula los vencimientos.
  useEffect(() => {
    const t = setInterval(() => setNow(today()), 60_000);
    return () => clearInterval(t);
  }, []);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => (d ? fn(d) : d)), []);
  const replace = useCallback((d: AppData) => setData(normalize(d)), []);
  const charges = useMemo(() => (data ? buildCharges(data, now) : []), [data, now]);

  if (!data) return null;
  return <Ctx.Provider value={{ data, charges, now, update, replace }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore fuera de StoreProvider");
  return s;
}

export function openExternal(url: string) {
  if (window.kala) window.kala.openExternal(url);
  else window.open(url, "_blank", "noopener");
}
