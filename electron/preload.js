//import { contextBridge, ipcRenderer } from "electron";
const { contextBridge, ipcRenderer } = require("electron");

console.log("PRELOAD: ############################");
console.log("PRELOAD: preload.js caricato");
console.log("PRELOAD: ############################");

ipcRenderer.on("blast:audioLevels", (event, data) => {

    console.log("PRELOAD: ricevuti audioLevels");
    console.log(data);

});

contextBridge.exposeInMainWorld("blast", {

    onAudioLevels(callback) {

        console.log("PRELOAD: onAudioLevels() chiamato");

        ipcRenderer.on("blast:audioLevels", (event, data) => {

            console.log("PRELOAD: callback audioLevels");

            callback(data);

        });

    }

});