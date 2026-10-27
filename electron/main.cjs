const { app, BrowserWindow, ipcMain, dialog, shell, Notification, Tray, Menu, nativeImage } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

// Los datos viven en %APPDATA%\Kala Gestión: el instalador puede actualizarse sin tocarlos.
// KALA_DATA_DIR sirve para probar con otra carpeta sin tocar los datos reales.
if (process.env.KALA_DATA_DIR) app.setPath("userData", process.env.KALA_DATA_DIR);
const dataDir = () => app.getPath("userData");
const dataFile = () => path.join(dataDir(), "datos.json");
const backupDir = () => path.join(dataDir(), "copias");
const MAX_BACKUPS = 30;
const ICON = path.join(__dirname, "..", "build", "icon.png");

// Una sola ventana: si se abre otra vez (o arranca con Windows y después se abre a mano), se muestra la que hay.
if (!app.requestSingleInstanceLock()) app.exit(0);

/** @type {BrowserWindow | null} */
let mainWindow = null;
let tray = null;
let quitting = false;

function showWindow() {
  if (!mainWindow) return createWindow(true);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function readData() {
  try {
    lastWritten = fs.readFileSync(dataFile(), "utf8");
    return JSON.parse(lastWritten);
  } catch {
    return null;
  }
}

function settings() {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), "utf8")).settings || {};
  } catch {
    return {};
  }
}

// Escribe a un archivo temporal y lo renombra: si se corta la luz, el archivo anterior queda entero.
function writeData(data) {
  fs.mkdirSync(dataDir(), { recursive: true });
  const tmp = dataFile() + ".tmp";
  lastWritten = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmp, lastWritten, "utf8");
  fs.renameSync(tmp, dataFile());
  dailyBackup(data.settings && data.settings.cloudBackupDir);
}

// Lo último que escribió la app: si el archivo cambia y no coincide, lo cambió otro programa
// (por ejemplo Claude cargando un calendario) y hay que mostrarlo sin pisarlo.
let lastWritten = null;

function watchExternalChanges() {
  fs.watchFile(dataFile(), { interval: 1000 }, () => {
    let raw;
    try {
      raw = fs.readFileSync(dataFile(), "utf8");
    } catch {
      return;
    }
    if (raw === lastWritten) return;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return; // archivo a medio escribir: el próximo aviso lo levanta entero
    }
    lastWritten = raw;
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send("data:changed", data);
  });
}

// Una copia por día en la compu y otra en la carpeta de Drive u OneDrive (si está elegida),
// guardando las últimas 30 en cada lugar.
let lastCloud = {};

function copyWithRotation(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  fs.copyFileSync(dataFile(), path.join(dir, `datos-${today}.json`));
  const files = fs.readdirSync(dir).filter((f) => /^datos-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  for (const old of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) fs.unlinkSync(path.join(dir, old));
}

function dailyBackup(cloudDir) {
  if (!fs.existsSync(dataFile())) return;
  copyWithRotation(backupDir());
  if (!cloudDir) return;
  try {
    if (!fs.existsSync(cloudDir)) throw new Error("No se encuentra la carpeta. ¿Está abierto Drive u OneDrive?");
    copyWithRotation(path.join(cloudDir, "Kala Gestión"));
    lastCloud = { at: new Date().toISOString() };
  } catch (err) {
    lastCloud = { at: lastCloud.at, error: err.message };
  }
}

ipcMain.handle("data:load", () => readData());
ipcMain.handle("data:save", (_e, data) => {
  writeData(data);
  return true;
});

ipcMain.handle("data:export", async (e, data) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const today = new Date().toISOString().slice(0, 10);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "Exportar copia de seguridad",
    defaultPath: path.join(app.getPath("documents"), `kala-gestion-${today}.json`),
    filters: [{ name: "Copia de Kala Gestión", extensions: ["json"] }],
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  return true;
});

ipcMain.handle("data:import", async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: "Importar copia de seguridad",
    filters: [{ name: "Copia de Kala Gestión", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths[0]) return null;
  return JSON.parse(fs.readFileSync(filePaths[0], "utf8"));
});

ipcMain.handle("data:openFolder", () => shell.openPath(dataDir()));

ipcMain.handle("folder:choose", async (e, title) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { title, properties: ["openDirectory", "createDirectory"] });
  return canceled ? null : filePaths[0] || null;
});

// Carpetas sincronizadas que suelen existir: OneDrive y Google Drive para escritorio.
ipcMain.handle("cloud:folders", () => {
  const home = app.getPath("home");
  const candidates = [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial];
  for (const letter of "DEFGHIJKLMNOPQRSTUVWXYZ") {
    candidates.push(`${letter}:\\Mi unidad`, `${letter}:\\My Drive`);
  }
  candidates.push(path.join(home, "Google Drive"), path.join(home, "Google Drive", "Mi unidad"), path.join(home, "Dropbox"));
  return [...new Set(candidates.filter((d) => d && fs.existsSync(d)))];
});
ipcMain.handle("cloud:last", () => lastCloud);

// PDFs: Documentos\Kala Gestión\Calendarios y Documentos\Kala Gestión\Recibos.
const docsDir = () => path.join(app.getPath("documents"), "Kala Gestión");

ipcMain.handle("pdf:create", async (_e, { html, fileName, footer, folder }) => {
  const dir = path.join(docsDir(), folder === "Recibos" ? "Recibos" : "Calendarios");
  fs.mkdirSync(dir, { recursive: true });
  const htmlFile = path.join(app.getPath("temp"), `kala-pdf-${Date.now()}.html`);
  fs.writeFileSync(htmlFile, html, "utf8");
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } });
  try {
    await win.loadFile(htmlFile);
    const pdf = await win.webContents.printToPDF({
      pageSize: "A4",
      landscape: folder !== "Recibos",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-family:Segoe UI,sans-serif;font-size:7.5pt;color:#9ca3af;padding:0 14mm;display:flex;justify-content:space-between"><span>${footer.replace(/</g, "&lt;")}</span><span class="pageNumber"></span></div>`,
    });
    const target = path.join(dir, fileName);
    fs.writeFileSync(target, pdf);
    return target;
  } finally {
    win.destroy();
    fs.rmSync(htmlFile, { force: true });
  }
});

// Sólo se tocan archivos generados por la app.
const inDocsDir = (file) => path.resolve(file).startsWith(path.resolve(docsDir()) + path.sep);

ipcMain.handle("file:open", (_e, file) => inDocsDir(file) && shell.openPath(file));
ipcMain.handle("file:show", (_e, file) => inDocsDir(file) && shell.showItemInFolder(file));

// Copia el archivo al portapapeles para pegarlo con Ctrl+V en WhatsApp.
ipcMain.handle("file:copy", (_e, file) => {
  if (!inDocsDir(file) || process.platform !== "win32") return false;
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", "Set-Clipboard -LiteralPath $env:KALA_FILE"],
      { env: { ...process.env, KALA_FILE: file }, windowsHide: true },
      (err) => resolve(!err),
    );
  });
});
ipcMain.handle("open:external", (_e, url) => {
  if (/^(https:\/\/|mailto:)/.test(url)) shell.openExternal(url);
});

// Avisos de Windows. Al tocar uno se abre la app en el cliente correspondiente.
ipcMain.handle("notify", (_e, notices) => {
  if (!Notification.isSupported()) return;
  for (const n of notices.slice(0, 4)) {
    const notification = new Notification({ title: n.title, body: n.body, icon: ICON });
    notification.on("click", () => {
      showWindow();
      if (n.clientId) mainWindow.webContents.send("open-client", n.clientId);
    });
    notification.show();
  }
});

// Arranque con Windows: abre escondida, en la bandeja, sólo para avisar.
ipcMain.handle("login:set", (_e, open) => {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: !!open, args: ["--oculto"] });
});

ipcMain.handle("app:version", () => app.getVersion());

// Actualizaciones automáticas desde las versiones publicadas en GitHub.
let updater = null;
let lastUpdateStatus = { state: "idle" };
const sendUpdate = (status) => {
  lastUpdateStatus = status;
  if (mainWindow) mainWindow.webContents.send("update:status", status);
};

// Los errores de electron-updater son largos y en inglés: los resumimos.
function updateError(err) {
  const msg = String(err && err.message ? err.message : err);
  if (/\b404\b/.test(msg)) return "todavía no hay versiones publicadas.";
  if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|net::/.test(msg)) return "no hay conexión a internet.";
  return msg.split("\n")[0].slice(0, 140);
}

function setupUpdates() {
  if (!app.isPackaged) return;
  updater = require("electron-updater").autoUpdater;
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  updater.on("checking-for-update", () => sendUpdate({ state: "checking" }));
  updater.on("update-not-available", () => sendUpdate({ state: "none" }));
  updater.on("update-available", (i) => sendUpdate({ state: "available", version: i.version }));
  updater.on("download-progress", (p) => sendUpdate({ state: "downloading", percent: Math.round(p.percent) }));
  updater.on("update-downloaded", (i) => sendUpdate({ state: "ready", version: i.version }));
  updater.on("error", (err) => sendUpdate({ state: "error", message: updateError(err) }));
  const check = () => updater.checkForUpdates().catch(() => {});
  setTimeout(check, 15_000);
  setInterval(check, 6 * 60 * 60 * 1000);
}

ipcMain.handle("update:check", async () => {
  if (!updater) return sendUpdate({ state: "error", message: "Las actualizaciones funcionan en la app instalada." });
  await updater.checkForUpdates().catch(() => {});
});
ipcMain.handle("update:get", () => lastUpdateStatus);
ipcMain.handle("update:install", () => {
  if (!updater) return;
  quitting = true;
  updater.quitAndInstall();
});

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip("Kala Gestión");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir Kala Gestión", click: showWindow },
      { type: "separator" },
      {
        label: "Salir",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", showWindow);
}

function createWindow(show) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show,
    backgroundColor: "#0b0b10",
    title: "Kala Gestión",
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Los links externos (WhatsApp, mail) se abren en el navegador, no dentro de la app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https|mailto):/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Con los avisos prendidos, cerrar la ventana la deja en la bandeja para seguir avisando.
  mainWindow.on("close", (e) => {
    if (quitting || settings().notifications === false) return;
    e.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on("closed", () => (mainWindow = null));

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.on("second-instance", showWindow);
app.on("before-quit", () => (quitting = true));

app.whenReady().then(() => {
  app.setAppUserModelId("ar.com.kalastudio.gestion");
  watchExternalChanges();
  createTray();
  createWindow(!process.argv.includes("--oculto"));
  setupUpdates();
  app.on("activate", showWindow);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
