const { contextBridge, ipcRenderer } = require("electron");

// Suscripción a un evento del proceso principal; devuelve la función para cancelarla.
const subscribe = (channel) => (cb) => {
  const listener = (_e, value) => cb(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld("kala", {
  load: () => ipcRenderer.invoke("data:load"),
  save: (data) => ipcRenderer.invoke("data:save", data),
  exportData: (data) => ipcRenderer.invoke("data:export", data),
  importData: () => ipcRenderer.invoke("data:import"),
  openDataFolder: () => ipcRenderer.invoke("data:openFolder"),
  openExternal: (url) => ipcRenderer.invoke("open:external", url),
  createPdf: (args) => ipcRenderer.invoke("pdf:create", args),
  openFile: (file) => ipcRenderer.invoke("file:open", file),
  showFile: (file) => ipcRenderer.invoke("file:show", file),
  copyFile: (file) => ipcRenderer.invoke("file:copy", file),
  onExternalChange: subscribe("data:changed"),
  notify: (notices) => ipcRenderer.invoke("notify", notices),
  onOpenClient: subscribe("open-client"),
  setOpenAtLogin: (open) => ipcRenderer.invoke("login:set", open),
  chooseFolder: (title) => ipcRenderer.invoke("folder:choose", title),
  cloudFolders: () => ipcRenderer.invoke("cloud:folders"),
  lastCloudBackup: () => ipcRenderer.invoke("cloud:last"),
  version: () => ipcRenderer.invoke("app:version"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  getUpdateStatus: () => ipcRenderer.invoke("update:get"),
  onUpdateStatus: subscribe("update:status"),
});
