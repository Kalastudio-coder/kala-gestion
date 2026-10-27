import { Check, ExternalLink, FileText, FolderOpen, Loader2, MessageCircle } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { waLink } from "../lib/phone";
import { openExternal } from "../lib/store";
import type { Client } from "../lib/types";
import { Button, Field, Modal, Textarea } from "./ui";

export interface PdfJob {
  html: string;
  fileName: string;
  footer: string;
  folder: "Calendarios" | "Recibos";
}

/** Genera un PDF y lo deja listo para mandar por WhatsApp (copiado para pegar con Ctrl+V). */
export function SendPdfModal({
  title,
  client,
  heading,
  sub,
  defaultMessage,
  disabled,
  build,
  onClose,
}: {
  title: string;
  client: Client;
  heading: ReactNode;
  sub: ReactNode;
  defaultMessage: string;
  disabled?: string;
  /** Arma el PDF. Se llama al tocar "Generar" (puede asignar números, por ejemplo de recibo). */
  build: () => PdfJob;
  onClose: () => void;
}) {
  const [message, setMessage] = useState(defaultMessage);
  const [file, setFile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<"pegar" | "adjuntar" | null>(null);
  const desktop = !!window.kala;

  const generate = async () => {
    setBusy(true);
    setError(null);
    const job = build();
    try {
      if (window.kala) {
        setFile(await window.kala.createPdf(job));
      } else {
        // Vista previa en el navegador: se imprime como PDF desde la ventana nueva.
        const w = window.open(URL.createObjectURL(new Blob([job.html], { type: "text/html" })), "_blank");
        w?.addEventListener("load", () => w.print());
      }
    } catch {
      setError("No se pudo generar el PDF. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!file || !window.kala) return;
    const copied = await window.kala.copyFile(file);
    openExternal(waLink(client.phone, message) ?? `https://wa.me/?text=${encodeURIComponent(message)}`);
    setSent(copied ? "pegar" : "adjuntar");
  };

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-xl bg-bg px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent-2">
            <FileText size={20} />
          </div>
          <div>
            <p className="font-medium">{heading}</p>
            <p className="text-[13px] text-muted">{sub}</p>
          </div>
        </div>

        <Step n={1} title="Generar el PDF" done={!!file}>
          {file ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-sm text-muted">{file.split(/[\\/]/).pop()}</span>
              <Button size="sm" onClick={() => window.kala?.openFile(file)}>
                <ExternalLink size={14} /> Abrir
              </Button>
              <Button size="sm" variant="ghost" onClick={() => window.kala?.showFile(file)}>
                <FolderOpen size={14} /> Ver en la carpeta
              </Button>
              <Button size="sm" variant="ghost" onClick={generate} disabled={busy}>
                Volver a generar
              </Button>
            </div>
          ) : (
            <Button variant="primary" onClick={generate} disabled={busy || !!disabled}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {disabled ?? (busy ? "Generando…" : "Generar PDF")}
            </Button>
          )}
          {error && <p className="mt-2 text-sm text-bad">{error}</p>}
          {!desktop && <p className="mt-2 text-xs text-faint">En la vista previa se abre para imprimir; en la app se guarda solo.</p>}
        </Step>

        <Step n={2} title="Mandarlo por WhatsApp" done={!!sent} disabled={!file}>
          <Field label="Mensaje">
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} disabled={!file} />
          </Field>
          {!waLink(client.phone) && (
            <p className="mt-2 text-xs text-warn">
              {client.name} no tiene WhatsApp cargado: vas a elegir el contacto en WhatsApp. Cargalo con "Editar" para que se abra directo.
            </p>
          )}
          <div className="mt-3">
            <Button variant="primary" onClick={send} disabled={!file}>
              <MessageCircle size={16} /> Abrir chat de WhatsApp
            </Button>
          </div>
          {sent === "pegar" && (
            <p className="mt-3 rounded-xl bg-ok/10 px-4 py-3 text-sm text-ok">
              El PDF quedó copiado. En el chat que se abrió, pegalo con <b>Ctrl+V</b> y mandalo junto con el mensaje.
            </p>
          )}
          {sent === "adjuntar" && (
            <p className="mt-3 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn">
              Se abrió el chat. Adjuntá el PDF con el clip (está en Documentos › Kala Gestión).
            </p>
          )}
        </Step>
      </div>
    </Modal>
  );
}

function Step({ n, title, done, disabled, children }: { n: number; title: string; done?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <div className={disabled ? "opacity-50" : undefined}>
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " + (done ? "bg-ok text-white" : "bg-panel-2 text-muted")
          }
        >
          {done ? <Check size={13} /> : n}
        </span>
        <p className="font-medium">{title}</p>
      </div>
      <div className="pl-8">{children}</div>
    </div>
  );
}
