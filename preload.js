// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Función que el frontend llamará para iniciar el proceso
    startAnalysis: (data) => ipcRenderer.invoke('start-analysis', data)
});