// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { runAnalysis } = require('./backend-logic');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    // Escuchar petición del frontend
    ipcMain.handle('start-analysis', async (event, dbConfig) => {
        // Guardamos en el escritorio del usuario por defecto para evitar errores de permisos
        const outputFolder = app.getPath('desktop');
        
        const result = await runAnalysis(dbConfig, outputFolder);
        return result;
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});