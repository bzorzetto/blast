import {app, BrowserWindow, Tray, Menu} from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


// --------------------------------------------------
// ESM equivalents of __dirname / __filename
// --------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// --------------------------------------------------
// Windows
// --------------------------------------------------

let mainWindow = null;
let splashWindow = null;
let tray = null;

// ======================================================
// RICEZIONE DATI DA BlastCore.js
// ======================================================

process.on("blast:audioLevels", (audioLevels) => {

    //console.log("ELECTRON MAIN: ricevuti audioLevels");
    //console.log(audioLevels);

    if (!mainWindow) {
        console.log("ELECTRON MAIN: mainWindow non esiste");
        return;
    }

    if (mainWindow.isDestroyed()) {
        console.log("ELECTRON MAIN: mainWindow è distrutta");
        return;
    }

    //console.log("ELECTRON MAIN: invio audioLevels alla UI");

    mainWindow.webContents.send(
        "blast:audioLevels",
        audioLevels
    );
});

// --------------------------------------------------
// BLAST Core
// --------------------------------------------------

let blastCore = null;


// --------------------------------------------------
// Splash
// --------------------------------------------------

function createSplash() {

    splashWindow = new BrowserWindow({

        width: 600,
        height: 350,

        frame: false,
        resizable: false,

        transparent: true,
        alwaysOnTop: true,

        center: true,

        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        }

    });

    splashWindow.loadFile(
        path.join(__dirname, '../ui/splash.html')
    );

}


// --------------------------------------------------
// Main window
// --------------------------------------------------

function createMainWindow() {

    mainWindow = new BrowserWindow({

        width: 1200,
        height: 700,

        minWidth: 900,
        minHeight: 500,

        show: false,

        webPreferences: {

            preload: path.join(__dirname, 'preload.js'),

            contextIsolation: true,
            nodeIntegration: false

        }

    });

    mainWindow.webContents.on(
        "preload-error",
        (event, preloadPath, error) => {

            console.error("PRELOAD ERROR");
            console.error("Path:", preloadPath);
            console.error(error);

        }
    );
    
    mainWindow.loadFile(
        path.join(__dirname, '../ui/index.html')
    );


    // Chiudendo la finestra la nascondiamo
    // invece di terminare BLAST.

    mainWindow.on('close', event => {

        if (!app.isQuitting) {

            event.preventDefault();

            mainWindow.hide();

        }

    });

    //console.log("PRELOAD PATH:", path.join(__dirname, "preload.js"));
    
}


// --------------------------------------------------
// System tray
// --------------------------------------------------

function createTray() {

    tray = new Tray(
        path.join(
            __dirname,
            '../ui/assets/blast-tray.png'
        )
    );


    const contextMenu = Menu.buildFromTemplate([

        {
            label: 'Apri BLAST',

            click() {

                mainWindow.show();

            }

        },

        {
            label: 'Nascondi BLAST',

            click() {

                mainWindow.hide();

            }

        },

        {
            type: 'separator'
        },

        {
            label: 'Esci',

            click() {

                app.isQuitting = true;

                app.quit();

            }

        }

    ]);


    tray.setToolTip('BLAST');

    tray.setContextMenu(contextMenu);


    tray.on('double-click', () => {

        mainWindow.show();

    });

}


// --------------------------------------------------
// Start BLAST
// --------------------------------------------------

async function startBlast() {

    console.log('BLAST: avvio Core...');


    /*
     * Questo import esegue BlastCore.js.
     */

    blastCore = await import('../BlastCore.js');


    console.log('BLAST: Core avviato.');

}


// --------------------------------------------------
// Electron
// --------------------------------------------------

app.whenReady().then(async () => {

    console.log('BLAST: Electron ready');

    // 1
    createSplash();


    // 2
    await startBlast();


    // 3
    createMainWindow();


    // 4
    createTray();


    // 5
    // Mostriamo la UI dopo lo splash.

    setTimeout(() => {

        if (splashWindow) {

            splashWindow.close();

            splashWindow = null;

        }


        mainWindow.hide();

    }, 3500);
    

});