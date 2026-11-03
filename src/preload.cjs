const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("grader", {
  chooseFolder: () => ipcRenderer.invoke("choose-folder"),
  grade: (options) => ipcRenderer.invoke("grade", options),
  cancel: () => ipcRenderer.invoke("cancel"),
  export: () => ipcRenderer.invoke("export"),
  runtimeInfo: () => ipcRenderer.invoke("runtime-info"),
  on: (channel, callback) => {
    if (["begin", "progress", "result"].includes(channel))
      ipcRenderer.on(channel, (_, value) => callback(value));
  },
});
