import { contextBridge, ipcRenderer } from "electron";

console.log("PRELOAD: caricato");

contextBridge.exposeInMainWorld("blast", {

    onAudioLevels(callback) {

        console.log("PRELOAD: registrazione listener audio");

        ipcRenderer.on("blast:audioLevels", (event, data) => {

            console.log("PRELOAD: ricevuti audioLevels");
            console.log(data);

            callback(data);
        });
    }

});