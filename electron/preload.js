
//import { contextBridge, ipcRenderer } from "electron";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("blast", {

    onAudioLevels(callback) {

        ipcRenderer.on("blast:audioLevels", (event, data) => {
    
            callback(data);
            
        });
    }

});